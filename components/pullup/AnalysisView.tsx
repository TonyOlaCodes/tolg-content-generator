"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findFrameAt, heightNorm, estimatePhase, verticalSpeed } from "@/lib/pullup/biomechanics";
import { PoseTracker, type SegmentationMaskData } from "@/lib/pullup/pose-service";
import { drawAnalysisFrame } from "@/lib/pullup/render-overlays";
import type { AnalysisResult, RepGrade, RepRecord } from "@/lib/pullup/types";
import SetSummary from "./SetSummary";

const SPEEDS = [0.5, 1, 1.5, 2] as const;

export default function AnalysisView({
  fileUrl,
  analysis,
  mirrored = false,
  onBack,
  onAnother,
  onOverrideGrade,
  onExport,
}: {
  fileUrl: string;
  analysis: AnalysisResult;
  mirrored?: boolean;
  onBack: () => void;
  onAnother: () => void;
  onOverrideGrade: (repIndex: number, grade: RepGrade) => void;
  onExport: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const maskRef = useRef<SegmentationMaskData | null>(null);
  const segTrackerRef = useRef<PoseTracker | null>(null);
  const lastMaskBucket = useRef(-1);

  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [t, setT] = useState(0);
  const [heatmap, setHeatmap] = useState(true);
  const [metricsOpen, setMetricsOpen] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const [selectedRep, setSelectedRep] = useState<number | null>(null);

  const speed = SPEEDS[speedIdx];

  useEffect(() => {
    if (!heatmap) {
      maskRef.current = null;
      return;
    }
    segTrackerRef.current = new PoseTracker({ segmentation: true });
    segTrackerRef.current.reset();
    return () => {
      segTrackerRef.current = null;
      maskRef.current = null;
    };
  }, [heatmap]);

  const syncCanvas = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!video || !canvas || !wrap) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawAnalysisFrame(ctx, video, analysis, {
      width: w,
      height: h,
      t: video.currentTime,
      heatmap,
      showHud: metricsOpen,
      showGraph: true,
      showSummary: false,
      selectedRepIndex: selectedRep,
      segmentationMask: maskRef.current,
      mirrored,
    });
  }, [analysis, heatmap, metricsOpen, mirrored, selectedRep]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    let raf = 0;
    let rvfc = 0;
    let cancelled = false;
    const video = videoRef.current;

    const tick = (): void => {
      if (cancelled) return;
      if (video) {
        setT(video.currentTime);
        // Throttled live segmentation for silhouette heatmap
        if (heatmap && segTrackerRef.current && video.readyState >= 2) {
          const bucket = Math.floor(video.currentTime * 5);
          if (bucket !== lastMaskBucket.current) {
            lastMaskBucket.current = bucket;
            const stamp = Math.round(video.currentTime * 1000) + 2;
            void segTrackerRef.current.detect(video, stamp).then((det) => {
              maskRef.current = det.mask;
            });
          }
        }
      }
      syncCanvas();
      const anyVideo = video as HTMLVideoElement & {
        requestVideoFrameCallback?: (cb: () => void) => number;
        cancelVideoFrameCallback?: (id: number) => void;
      };
      if (playing && anyVideo?.requestVideoFrameCallback) {
        rvfc = anyVideo.requestVideoFrameCallback(() => tick());
      } else {
        raf = requestAnimationFrame(tick);
      }
    };
    tick();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      const anyVideo = video as HTMLVideoElement & {
        cancelVideoFrameCallback?: (id: number) => void;
      };
      anyVideo?.cancelVideoFrameCallback?.(rvfc);
    };
  }, [playing, syncCanvas, heatmap]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => syncCanvas());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [syncCanvas]);

  const frame = useMemo(() => findFrameAt(analysis.frames, t), [analysis.frames, t]);
  const height = heightNorm(
    frame?.shoulderY ?? null,
    analysis.hangShoulderY,
    analysis.bestTopShoulderY,
  );
  const activeRep: RepRecord | null =
    selectedRep != null
      ? (analysis.reps.find((r) => r.index === selectedRep) ?? null)
      : (analysis.reps.find((r) => t >= r.startT && t <= r.endT + 0.2) ?? null);

  const togglePlay = async (): Promise<void> => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      await video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const seekRep = (rep: RepRecord): void => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = rep.startT;
    setSelectedRep(rep.index);
    setT(rep.startT);
    syncCanvas();
  };

  const replay = (): void => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    setShowSummary(false);
    void video.play().then(() => setPlaying(true));
  };

  return (
    <div className="pu-analysis">
      <div ref={wrapRef} className="pu-stage">
        <video
          ref={videoRef}
          src={fileUrl}
          className="pu-hidden-video"
          playsInline
          preload="auto"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setShowSummary(true);
          }}
          onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
        />
        <canvas ref={canvasRef} className="pu-overlay-canvas" />

        <div className="pu-top-chrome">
          <button type="button" className="pu-back ghost" onClick={onBack}>
            ←
          </button>
          <span className="pu-title-chip">Pull Up Analysis</span>
          <button
            type="button"
            className={`pu-chip ${metricsOpen ? "on" : ""}`}
            onClick={() => setMetricsOpen((v) => !v)}
          >
            Metrics
          </button>
          <button
            type="button"
            className={`pu-chip ${heatmap ? "on" : ""}`}
            onClick={() => setHeatmap((v) => !v)}
            title="Estimated effort heatmap (not EMG)"
          >
            Heatmap
          </button>
        </div>

        {activeRep && metricsOpen ? (
          <div className="pu-rep-card" key={activeRep.index}>
            <div className="pu-rep-card-head">
              <strong>REP {activeRep.index}</strong>
              <select
                value={activeRep.grade}
                onChange={(e) => onOverrideGrade(activeRep.index, e.target.value as RepGrade)}
              >
                <option value="valid">Valid</option>
                <option value="partial">Partial</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div className="pu-rep-grid">
              <span>up {activeRep.upDuration.toFixed(2)} s</span>
              <span>down {activeRep.downDuration.toFixed(2)} s</span>
              <span>
                peak{" "}
                {activeRep.peakSpeedMs != null
                  ? `${activeRep.peakSpeedMs.toFixed(2)} m/s`
                  : `${activeRep.peakSpeedNorm.toFixed(2)} rel/s`}
              </span>
              <span>
                ROM{" "}
                {activeRep.romCm != null
                  ? `${activeRep.romCm.toFixed(0)} cm`
                  : `${Math.round(activeRep.romNorm * 100)}%`}
              </span>
              <span>chin {activeRep.chinClass}</span>
              <span>quality {activeRep.quality}/100</span>
              <span>lockout {activeRep.lockOut ? "yes" : "no"}</span>
              <span>
                elbows{" "}
                {activeRep.elbowAtTopL != null || activeRep.elbowAtTopR != null
                  ? `${activeRep.elbowAtTopL != null ? Math.round(activeRep.elbowAtTopL) : "—"}° / ${activeRep.elbowAtTopR != null ? Math.round(activeRep.elbowAtTopR) : "—"}°`
                  : "—"}
              </span>
            </div>
          </div>
        ) : null}

        {!frame?.landmarks ? (
          <div className="pu-pose-warn">Pose unavailable in this frame</div>
        ) : null}

        <div className="pu-rep-tiles">
          {analysis.reps.map((rep) => (
            <button
              key={rep.index}
              type="button"
              className={`pu-tile pu-${rep.grade} ${selectedRep === rep.index ? "is-active" : ""}`}
              onClick={() => seekRep(rep)}
              title={`Rep ${rep.index}`}
            >
              {rep.grade === "valid" ? "✓" : rep.grade === "partial" ? "~" : "✕"}
            </button>
          ))}
          {!analysis.reps.length ? <span className="pu-muted">No reps detected</span> : null}
        </div>

        <div className="pu-controls">
          <button type="button" onClick={() => void togglePlay()}>
            {playing ? "Pause" : "Play"}
          </button>
          <button type="button" onClick={() => setSpeedIdx((i) => (i + 1) % SPEEDS.length)}>
            {speed}×
          </button>
          <button
            type="button"
            onClick={() => {
              const video = videoRef.current;
              if (!video) return;
              video.currentTime = 0;
              setT(0);
            }}
          >
            Restart
          </button>
          <button type="button" onClick={() => setShowSummary(true)}>
            Summary
          </button>
          <button type="button" onClick={onExport}>
            Export
          </button>
        </div>

        <div className="pu-seek">
          <input
            type="range"
            min={0}
            max={analysis.duration || 1}
            step={0.01}
            value={t}
            onChange={(e) => {
              const video = videoRef.current;
              const next = Number(e.target.value);
              if (video) video.currentTime = next;
              setT(next);
            }}
          />
          <span>
            {formatTime(t)} / {formatTime(analysis.duration)}
          </span>
        </div>
      </div>

      {showSummary ? (
        <SetSummary
          analysis={analysis}
          onReplay={replay}
          onClose={() => setShowSummary(false)}
          onExport={onExport}
          onAnother={onAnother}
        />
      ) : null}

      <span className="sr-only">
        phase {estimatePhase(height, 0, Boolean(frame?.landmarks), height > 0.8)} height{" "}
        {Math.round(height * 100)}
        {frame && analysis.frames.indexOf(frame) > 0
          ? ` speed ${verticalSpeed(analysis.frames, analysis.frames.indexOf(frame), analysis.hangShoulderY, analysis.bestTopShoulderY, analysis.calibration).normPerSec.toFixed(2)}`
          : ""}
      </span>
    </div>
  );
}

function formatTime(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}
