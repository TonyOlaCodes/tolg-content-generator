"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  onConfirm: (barY: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [barY, setBarY] = useState(initialBarY);
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

  const box = useMemo(
    () => computeContainBox(size.w, size.h, size.vw, size.vh),
    [size],
  );

  const barTop = box.offsetY + barY * box.drawH;

  const onPointer = (clientY: number): void => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const py = clientY - rect.top;
    const { y } = canvasToLandmark(0, py, box);
    setBarY(Math.max(0.05, Math.min(0.55, y)));
  };

  return (
    <div className="pu-screen pu-calibrate">
      <button type="button" className="pu-back" onClick={onBack}>
        ← Back
      </button>
      <header className="pu-hero compact">
        <h1>Calibrate bar</h1>
        <p className="pu-sub">Drag the dashed line onto the pull-up bar. This anchors chin classification.</p>
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
        <video ref={videoRef} src={fileUrl} className="pu-cal-video" playsInline muted controls />
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
          onChange={(e) => setBarY(Number(e.target.value) / 100)}
        />
      </label>

      <button type="button" className="pu-primary" onClick={() => onConfirm(barY)}>
        Analyse video
      </button>
    </div>
  );
}
