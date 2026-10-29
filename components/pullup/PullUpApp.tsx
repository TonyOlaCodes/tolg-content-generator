"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyzePullUpVideo, type AnalyzeProgress } from "@/lib/pullup/analyze-video";
import { exportAnalysedVideo } from "@/lib/pullup/export-video";
import { averageQuality } from "@/lib/pullup/quality";
import type { AnalysisResult, RepGrade, UserCalibration } from "@/lib/pullup/types";
import UploadScreen from "./UploadScreen";
import CalibrateScreen from "./CalibrateScreen";
import AnalysisView from "./AnalysisView";
import ExportPanel, { type ExportSettings } from "./ExportPanel";

type Step = "upload" | "calibrate" | "analyzing" | "results" | "exporting";

export default function PullUpApp({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState({
    weightKg: null as number | null,
    heightCm: null as number | null,
    addedKg: 0,
  });
  const [barY, setBarY] = useState(0.18);
  const [mirrored, setMirrored] = useState(false);
  const [progress, setProgress] = useState<AnalyzeProgress | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cacheKeyRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  const calibration: UserCalibration = useMemo(
    () => ({
      barY,
      bodyWeightKg: meta.weightKg,
      heightCm: meta.heightCm,
      addedWeightKg: meta.addedKg,
      metersPerImageHeight: null,
    }),
    [barY, meta],
  );

  const resetAll = useCallback(() => {
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFile(null);
    setFileUrl(null);
    setAnalysis(null);
    setProgress(null);
    setError(null);
    setExportMsg(null);
    setShowExportPanel(false);
    cacheKeyRef.current = null;
    setStep("upload");
  }, [fileUrl]);

  const onUploadReady = (f: File, m: typeof meta): void => {
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFile(f);
    setFileUrl(URL.createObjectURL(f));
    setMeta(m);
    setAnalysis(null);
    setError(null);
    cacheKeyRef.current = null;
    setStep("calibrate");
  };

  const runAnalysis = async (nextBarY: number, nextMirrored: boolean): Promise<void> => {
    setBarY(nextBarY);
    setMirrored(nextMirrored);
    setStep("analyzing");
    setError(null);
    setProgress({ phase: "loading", progress: 0, message: "Starting…" });

    const video = videoRef.current;
    if (!video || !fileUrl || !file) {
      setError("Video element missing.");
      setStep("calibrate");
      return;
    }

    const cacheKey = `${file.name}:${file.size}:${file.lastModified}:${nextBarY.toFixed(3)}:${nextMirrored}:${meta.weightKg}:${meta.heightCm}:${meta.addedKg}`;
    if (cacheKeyRef.current === cacheKey && analysis) {
      setStep("results");
      return;
    }

    video.src = fileUrl;
    try {
      await new Promise<void>((resolve, reject) => {
        const onMeta = (): void => resolve();
        const onErr = (): void => reject(new Error("Failed to load video."));
        video.addEventListener("loadedmetadata", onMeta, { once: true });
        video.addEventListener("error", onErr, { once: true });
        video.load();
      });

      const cal: UserCalibration = {
        barY: nextBarY,
        bodyWeightKg: meta.weightKg,
        heightCm: meta.heightCm,
        addedWeightKg: meta.addedKg,
        metersPerImageHeight: null,
      };

      const result = await analyzePullUpVideo(video, cal, setProgress, { sampleFps: 14 });
      setAnalysis(result);
      cacheKeyRef.current = cacheKey;
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
      setStep("calibrate");
    }
  };

  const overrideGrade = (repIndex: number, grade: RepGrade): void => {
    setAnalysis((prev) => {
      if (!prev) return prev;
      const reps = prev.reps.map((r) => (r.index === repIndex ? { ...r, grade } : r));
      return { ...prev, reps, avgQuality: averageQuality(reps) };
    });
  };

  const doExport = async (settings: ExportSettings): Promise<void> => {
    if (!analysis || !fileUrl) return;
    setShowExportPanel(false);
    setStep("exporting");
    setExportMsg("Preparing export…");
    const video = videoRef.current;
    if (!video) {
      setError("Video element missing for export.");
      setStep("results");
      return;
    }
    video.src = fileUrl;
    await new Promise<void>((resolve) => {
      video.addEventListener("loadeddata", () => resolve(), { once: true });
      video.load();
    });

    try {
      const result = await exportAnalysedVideo(video, analysis, {
        includeAudio: settings.includeAudio,
        aspect: settings.aspect,
        heatmap: settings.heatmap,
        appendSummary: settings.appendSummary,
        mirrored,
        onProgress: (pct, message) => setExportMsg(`${message} (${Math.round(pct * 100)}%)`),
      });
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pullup-analysis.${result.extension}`;
      a.click();
      URL.revokeObjectURL(url);
      setExportMsg(result.warning ? `Saved. Note: ${result.warning}` : "Saved analysed video.");
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
      setExportMsg(null);
      setStep("results");
    }
  };

  return (
    <div className="pu-root">
      <video ref={videoRef} className="pu-hidden-video" playsInline preload="auto" muted />

      {step === "upload" ? <UploadScreen onBack={onBack} onReady={onUploadReady} /> : null}

      {step === "calibrate" && fileUrl ? (
        <CalibrateScreen
          fileUrl={fileUrl}
          initialBarY={barY}
          onBack={() => setStep("upload")}
          onConfirm={(y, m) => void runAnalysis(y, m)}
        />
      ) : null}

      {step === "analyzing" ? (
        <div className="pu-screen pu-analyzing">
          <h1>Analysing…</h1>
          <p>{progress?.message ?? "Working"}</p>
          <div className="pu-progress">
            <div style={{ width: `${Math.round((progress?.progress ?? 0) * 100)}%` }} />
          </div>
          <p className="pu-note">
            Running MediaPipe Pose Landmarker on your video locally. Results are measured from your
            footage — not a simulation.
          </p>
        </div>
      ) : null}

      {step === "exporting" ? (
        <div className="pu-screen pu-analyzing">
          <h1>Exporting…</h1>
          <p>{exportMsg}</p>
          <div className="pu-progress">
            <div className="indeterminate" />
          </div>
        </div>
      ) : null}

      {step === "results" && analysis && fileUrl ? (
        <>
          <AnalysisView
            fileUrl={fileUrl}
            analysis={analysis}
            mirrored={mirrored}
            onBack={onBack}
            onAnother={resetAll}
            onOverrideGrade={overrideGrade}
            onExport={() => setShowExportPanel(true)}
          />
          {showExportPanel ? (
            <ExportPanel onCancel={() => setShowExportPanel(false)} onStart={(s) => void doExport(s)} />
          ) : null}
        </>
      ) : null}

      {error ? (
        <div className="pu-toast-error" role="alert">
          {error}
          <button type="button" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      {exportMsg && step === "results" ? <div className="pu-toast-ok">{exportMsg}</div> : null}

      {file ? (
        <p className="sr-only">
          Loaded {file.name} calibration bar {calibration.barY} mirrored {String(mirrored)}
        </p>
      ) : null}
    </div>
  );
}
