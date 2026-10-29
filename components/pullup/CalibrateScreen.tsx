"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ExerciseDefinition } from "@/lib/gym/types";
import { PoseTracker, suggestBarYFromLandmarks } from "@/lib/pullup/pose-service";
import { computeContainBox, canvasToLandmark } from "@/lib/pullup/video-layout";

function referenceConfig(exercise: ExerciseDefinition): {
  enabled: boolean;
  label: string;
  hint: string;
  min: number;
  max: number;
  defaultY: number;
} {
  if (exercise.id === "pull_up") {
    return {
      enabled: true,
      label: "BAR",
      hint: "Align the dashed BAR guide with the pull-up bar.",
      min: 0.05,
      max: 0.55,
      defaultY: 0.18,
    };
  }
  if (exercise.id === "squat") {
    return {
      enabled: true,
      label: "DEPTH",
      hint: "Optional: place a depth reference near hip-crease / parallel. Skip accuracy claims without a clear side view.",
      min: 0.35,
      max: 0.85,
      defaultY: 0.55,
    };
  }
  if (exercise.id === "deadlift" || exercise.id === "bench_press") {
    return {
      enabled: true,
      label: "REF",
      hint: "Optional floor/bar reference line. Prefer a clear side or three-quarter view.",
      min: 0.15,
      max: 0.95,
      defaultY: exercise.id === "bench_press" ? 0.45 : 0.78,
    };
  }
  return {
    enabled: false,
    label: "REF",
    hint: "Confirm framing, then analyse. Side view works best for torso flexion.",
    min: 0.1,
    max: 0.9,
    defaultY: 0.5,
  };
}

export default function CalibrateScreen({
  exercise,
  fileUrl,
  initialReferenceY,
  onBack,
  onConfirm,
}: {
  exercise: ExerciseDefinition;
  fileUrl: string;
  initialReferenceY: number | null;
  onBack: () => void;
  onConfirm: (referenceY: number | null, mirrored: boolean) => void;
}) {
  const cfg = referenceConfig(exercise);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [refY, setRefY] = useState(initialReferenceY ?? cfg.defaultY);
  const [refEnabled, setRefEnabled] = useState(cfg.enabled && exercise.id === "pull_up");
  const [mirrored, setMirrored] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestNote, setSuggestNote] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 1, h: 1, vw: 1, vh: 1 });

  useEffect(() => {
    const video = videoRef.current;
    const wrap = wrapRef.current;
    if (!video || !wrap) return;

    const sync = (): void => {
      setSize({
        w: wrap.clientWidth,
        h: wrap.clientHeight,
        vw: video.videoWidth || 1,
        vh: video.videoHeight || 1,
      });
    };
    sync();
    video.addEventListener("loadedmetadata", sync);
    const ro = new ResizeObserver(sync);
    ro.observe(wrap);
    return () => {
      video.removeEventListener("loadedmetadata", sync);
      ro.disconnect();
    };
  }, [fileUrl]);

  useEffect(() => {
    if (exercise.id !== "pull_up") {
      setSuggestNote(cfg.hint);
      return;
    }
    let cancelled = false;
    const run = async (): Promise<void> => {
      const video = videoRef.current;
      if (!video) return;
      setSuggesting(true);
      try {
        if (video.readyState < 1) {
          await new Promise<void>((res) => video.addEventListener("loadedmetadata", () => res(), { once: true }));
        }
        video.currentTime = Math.min(0.3, (video.duration || 1) * 0.05);
        await new Promise<void>((res) => video.addEventListener("seeked", () => res(), { once: true }));
        const tracker = new PoseTracker({ segmentation: false });
        tracker.reset();
        const det = await tracker.detect(video, 1);
        if (cancelled) return;
        const suggested = suggestBarYFromLandmarks(det.landmarks);
        if (suggested != null) {
          setRefY(suggested);
          setRefEnabled(true);
          setSuggestNote("Bar suggested from wrist height — drag to fine-tune.");
        } else {
          setSuggestNote("Could not auto-detect bar. Drag the line onto the pull-up bar.");
        }
      } catch {
        if (!cancelled) setSuggestNote("Auto-suggest unavailable. Set the bar manually.");
      } finally {
        if (!cancelled) setSuggesting(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [fileUrl, exercise.id, cfg.hint]);

  const box = useMemo(() => computeContainBox(size.w, size.h, size.vw, size.vh), [size]);
  const barTop = box.offsetY + refY * box.drawH;

  const onPointer = (clientY: number): void => {
    if (!refEnabled && exercise.id !== "pull_up") return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const py = clientY - rect.top;
    const { y } = canvasToLandmark(0, py, box);
    setRefY(Math.max(cfg.min, Math.min(cfg.max, y)));
    setRefEnabled(true);
    setSuggestNote("Manual reference position.");
  };

  return (
    <div className="pu-screen pu-calibrate">
      <button type="button" className="pu-back" onClick={onBack}>
        ← Back
      </button>
      <header className="pu-hero compact">
        <h1>Calibrate · {exercise.name}</h1>
        <p className="pu-sub">{cfg.hint}</p>
      </header>

      <div
        ref={wrapRef}
        className="pu-cal-stage"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          onPointer(e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return;
          onPointer(e.clientY);
        }}
      >
        <video
          ref={videoRef}
          src={fileUrl}
          className="pu-cal-video"
          style={mirrored ? { transform: "scaleX(-1)" } : undefined}
          playsInline
          muted
          controls
        />
        {refEnabled || exercise.id === "pull_up" ? (
          <div className="pu-bar-line" style={{ top: barTop }}>
            <span>{cfg.label}</span>
          </div>
        ) : null}
      </div>

      {cfg.enabled ? (
        <>
          {exercise.id !== "pull_up" ? (
            <label className="pu-check">
              <input
                type="checkbox"
                checked={refEnabled}
                onChange={(e) => setRefEnabled(e.target.checked)}
              />
              Use reference line
            </label>
          ) : null}
          {(refEnabled || exercise.id === "pull_up") && (
            <label className="pu-slider-row">
              {cfg.label} height
              <input
                type="range"
                min={Math.round(cfg.min * 100)}
                max={Math.round(cfg.max * 100)}
                value={Math.round(refY * 100)}
                onChange={(e) => {
                  setRefY(Number(e.target.value) / 100);
                  setRefEnabled(true);
                  setSuggestNote("Manual reference position.");
                }}
              />
            </label>
          )}
        </>
      ) : null}

      <label className="pu-check">
        <input type="checkbox" checked={mirrored} onChange={(e) => setMirrored(e.target.checked)} />
        Mirrored recording (front camera)
      </label>

      <p className="pu-note">{suggesting ? "Suggesting from pose…" : suggestNote}</p>

      <button
        type="button"
        className="pu-primary"
        onClick={() =>
          onConfirm(refEnabled || exercise.id === "pull_up" ? refY : null, mirrored)
        }
      >
        Analyse video
      </button>
    </div>
  );
}
