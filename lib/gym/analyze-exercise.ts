"use client";

import { landmarksToPoseFrame } from "@/lib/pullup/biomechanics";
import { PoseTracker } from "@/lib/pullup/pose-service";
import { getExercise } from "./registry";
import { runExerciseAnalyzer } from "./analyzers";
import type { GymAnalysisResult, GymCalibration } from "./types";
import type { PoseFrame } from "@/lib/pullup/types";

export type GymAnalyzeProgress = {
  phase: "loading" | "sampling" | "detecting" | "done" | "error";
  progress: number;
  message: string;
};

function waitForEvent(target: EventTarget, event: string, timeoutMs = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeoutMs);
    const onOk = (): void => {
      window.clearTimeout(t);
      resolve();
    };
    const onErr = (): void => {
      window.clearTimeout(t);
      reject(new Error(`Video error during ${event}`));
    };
    target.addEventListener(event, onOk, { once: true });
    target.addEventListener("error", onErr, { once: true });
  });
}

async function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  if (Math.abs(video.currentTime - time) < 0.001) return;
  video.currentTime = Math.min(Math.max(0, time), Math.max(0, video.duration - 0.05));
  await waitForEvent(video, "seeked", 15000);
}

export async function analyzeExerciseVideo(
  video: HTMLVideoElement,
  calibration: GymCalibration,
  onProgress?: (p: GymAnalyzeProgress) => void,
  options?: { sampleFps?: number },
): Promise<GymAnalysisResult> {
  const def = getExercise(calibration.exerciseId);
  if (!def) throw new Error("Unknown exercise.");
  if (def.status !== "ready") {
    throw new Error(`“${def.name}” is not implemented yet. Pick a Ready exercise.`);
  }

  const report = (p: GymAnalyzeProgress): void => onProgress?.(p);
  report({ phase: "loading", progress: 0.02, message: "Loading pose model…" });

  if (video.readyState < 1) await waitForEvent(video, "loadedmetadata");
  if (video.readyState < 2) {
    try {
      await video.play();
      video.pause();
    } catch {
      /* ok */
    }
  }

  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
  if (duration < 0.5) throw new Error("Video is too short to analyse.");

  const sampleFps = options?.sampleFps ?? 14;
  const step = 1 / sampleFps;
  const tracker = new PoseTracker();
  tracker.reset();

  report({ phase: "sampling", progress: 0.08, message: `Tracking pose for ${def.name}…` });
  await seekVideo(video, 0);
  await tracker.detect(video, 0);

  const frames: PoseFrame[] = [];
  let confSum = 0;
  let confN = 0;
  let stamp = 0;

  for (let t = 0; t <= duration; t += step) {
    await seekVideo(video, t);
    stamp += Math.round(step * 1000);
    const detected = await tracker.detect(video, stamp);
    const frame = landmarksToPoseFrame(t, detected.landmarks);
    frames.push(frame);
    if (frame.confidence > 0) {
      confSum += frame.confidence;
      confN += 1;
    }
    if (frames.length % 3 === 0) {
      report({
        phase: "sampling",
        progress: 0.08 + 0.75 * (t / duration),
        message: `Tracking ${def.name}… ${Math.min(100, Math.round((t / duration) * 100))}%`,
      });
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  report({ phase: "detecting", progress: 0.9, message: "Running exercise-specific detection…" });

  const posed = frames.filter((f) => f.landmarks).length;
  if (posed < 8) {
    throw new Error(
      "Could not track a person reliably. Try a clearer view matching the recommended camera angle.",
    );
  }

  const result = runExerciseAnalyzer(calibration.exerciseId, frames, calibration, {
    duration,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    trackingConfidence: confN ? confSum / confN : 0,
  });

  report({
    phase: "done",
    progress: 1,
    message:
      result.kind === "hold"
        ? "Hold analysis complete."
        : `Detected ${result.reps.length} rep(s).`,
  });
  await seekVideo(video, 0);
  return result;
}
