"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PoseTracker, suggestBarYFromLandmarks } from "@/lib/pullup/pose-service";
import { computeContainBox, canvasToLandmark } from "@/lib/pullup/video-layout";

export default function CalibrateScreen({
  fileUrl,
  initialBarY,
  onBack,
  onConfirm,
}: {
  fileUrl: string;
  initialBarY: number;
  onBack: () => void;
  onConfirm: (barY: number, mirrored: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [barY, setBarY] = useState(initialBarY);
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

  // Auto-suggest bar from first detectable wrist height
  useEffect(() => {
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
          setBarY(suggested);
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
  }, [fileUrl]);

  const box = useMemo(() => computeContainBox(size.w, size.h, size.vw, size.vh), [size]);
  const barTop = box.offsetY + barY * box.drawH;

  const onPointer = (clientY: number): void => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const py = clientY - rect.top;
    const { y } = canvasToLandmark(0, py, box);
    setBarY(Math.max(0.05, Math.min(0.55, y)));
    setSuggestNote("Manual bar position.");
  };

  return (
    <div className="pu-screen pu-calibrate">
      <button type="button" className="pu-back" onClick={onBack}>
        ← Back
      </button>
      <header className="pu-hero compact">
        <h1>Calibrate</h1>
        <p className="pu-sub">
          Align the dashed BAR guide with the pull-up bar. Flip if the recording is mirrored.
        </p>
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
        <div className="pu-bar-line" style={{ top: barTop }}>
          <span>BAR</span>
        </div>
      </div>

      <label className="pu-slider-row">
        Bar height
        <input
          type="range"
          min={5}
          max={55}
          value={Math.round(barY * 100)}
          onChange={(e) => {
            setBarY(Number(e.target.value) / 100);
            setSuggestNote("Manual bar position.");
          }}
        />
      </label>

      <label className="pu-check">
        <input type="checkbox" checked={mirrored} onChange={(e) => setMirrored(e.target.checked)} />
        Mirrored recording (front camera)
      </label>

      <p className="pu-note">{suggesting ? "Suggesting bar from pose…" : suggestNote}</p>

      <button type="button" className="pu-primary" onClick={() => onConfirm(barY, mirrored)}>
        Analyse video
      </button>
    </div>
  );
}
