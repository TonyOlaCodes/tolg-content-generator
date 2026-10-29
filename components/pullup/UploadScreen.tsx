"use client";

import { useRef, useState } from "react";
import type { ExerciseDefinition } from "@/lib/gym/types";

const ACCEPT = "video/mp4,video/quicktime,video/webm,video/x-m4v,video/*";

export default function UploadScreen({
  exercise,
  onBack,
  onReady,
}: {
  exercise: ExerciseDefinition;
  onBack: () => void;
  onReady: (
    file: File,
    meta: { weightKg: number | null; heightCm: number | null; externalLoadKg: number | null },
  ) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [load, setLoad] = useState("");
  const [error, setError] = useState<string | null>(null);

  const needsLoad =
    exercise.category === "powerlifting" ||
    exercise.category === "bodybuilding" ||
    exercise.id.includes("weighted");

  const pick = (f: File | null): void => {
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (!f) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    if (!f.type.startsWith("video/") && !/\.(mp4|mov|m4v|webm)$/i.test(f.name)) {
      setError("Please choose a video file (MP4, MOV, WebM, …).");
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const continueNext = (): void => {
    if (!file) {
      setError(`Upload a ${exercise.name.toLowerCase()} video first.`);
      return;
    }
    onReady(file, {
      weightKg: weight ? Number(weight) : null,
      heightCm: height ? Number(height) : null,
      externalLoadKg: load ? Number(load) : null,
    });
  };

  return (
    <div className="pu-screen pu-upload">
      <button type="button" className="pu-back" onClick={onBack}>
        ← Exercises
      </button>
      <header className="pu-hero">
        <p className="pu-kicker">AI Exercise Analysis</p>
        <h1>{exercise.name}</h1>
        <p className="pu-sub">
          {exercise.blurb} Upload real footage for MediaPipe pose tracking — processed in your
          browser.
        </p>
        <p className="pu-cam-hint">Recommended camera: {exercise.cameraHint}</p>
      </header>

      <button
        type="button"
        className="pu-drop"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          pick(e.dataTransfer.files?.[0] ?? null);
        }}
      >
        {previewUrl ? (
          <video src={previewUrl} className="pu-drop-preview" muted playsInline controls />
        ) : (
          <div className="pu-drop-empty">
            <strong>Tap to upload</strong>
            <span>MP4, MOV, WebM · phone or computer</span>
          </div>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />

      <div className="pu-meta-grid">
        <label>
          Body weight (kg)
          <input
            inputMode="decimal"
            placeholder="optional"
            value={weight}
            onChange={(e) => setWeight(e.target.value.replace(/[^0-9.]/g, ""))}
          />
        </label>
        <label>
          Height (cm)
          <input
            inputMode="decimal"
            placeholder="optional"
            value={height}
            onChange={(e) => setHeight(e.target.value.replace(/[^0-9.]/g, ""))}
          />
        </label>
        <label>
          {needsLoad ? "External load (kg)" : "Added weight (kg)"}
          <input
            inputMode="decimal"
            placeholder="optional"
            value={load}
            onChange={(e) => setLoad(e.target.value.replace(/[^0-9.]/g, ""))}
          />
        </label>
      </div>
      <p className="pu-note">
        Weight/height enable mechanical work &amp; m/s estimates. External load is never inferred from
        plates. Videos stay on-device.
      </p>

      {error ? <p className="pu-error">{error}</p> : null}

      <button type="button" className="pu-primary" disabled={!file} onClick={continueNext}>
        Continue to calibrate
      </button>
    </div>
  );
}
