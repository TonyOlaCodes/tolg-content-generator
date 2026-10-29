"use client";

import { landmarksToPoseFrame } from "./biomechanics";
import { calibrateHeightRange, detectReps } from "./rep-detector";
import { PoseTracker } from "./pose-service";
import { summarizeSet } from "./quality";
import type { AnalysisResult, PoseFrame, UserCalibration } from "./types";

export type AnalyzeProgress = {
  phase: "loading" | "sampling" | "detecting" | "done" | "error";
  progress: number; // 0–1
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

/**
 * Offline analysis: sample the uploaded video, run MediaPipe Pose, detect reps.
 * Results are derived only from measured frames + user calibration.
 */
export async function analyzePullUpVideo(
  video: HTMLVideoElement,
  calibration: UserCalibration,
  onProgress?: (p: AnalyzeProgress) => void,
  options?: { sampleFps?: number },
): Promise<AnalysisResult> {
  const report = (p: AnalyzeProgress): void => onProgress?.(p);

  report({ phase: "loading", progress: 0.02, message: "Loading pose model…" });

  if (video.readyState < 1) {
    await waitForEvent(video, "loadedmetadata");
  }
  // Ensure we can decode frames
  if (video.readyState < 2) {
    try {
      await video.play();
      video.pause();
    } catch {
      /* autoplay may fail; seek still works after metadata */
    }
  }

  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
  if (duration < 0.5) {
    throw new Error("Video is too short to analyse.");
  }

  const sampleFps = options?.sampleFps ?? 12;
  const step = 1 / sampleFps;
  const tracker = new PoseTracker();
  tracker.reset();

  report({ phase: "sampling", progress: 0.08, message: "Sampling video frames…" });

  // Warm up landmarker
  await seekVideo(video, 0);
  await tracker.detect(video, 0);

  const frames: PoseFrame[] = [];
  let confSum = 0;
  let confN = 0;
  let stamp = 0;

  for (let t = 0; t <= duration; t += step) {
    await seekVideo(video, t);
    // Use monotonic ms timestamps for MediaPipe VIDEO mode
    stamp += Math.round(step * 1000);
    const detected = await tracker.detect(video, stamp);
    const frame = landmarksToPoseFrame(t, detected.landmarks);
    frames.push(frame);
    if (frame.confidence > 0) {
      confSum += frame.confidence;
      confN += 1;
    }
    const pct = 0.08 + 0.75 * (t / duration);
    if (frames.length % 3 === 0) {
      report({
        phase: "sampling",
        progress: pct,
        message: `Tracking pose… ${Math.min(100, Math.round((t / duration) * 100))}%`,
      });
      // Yield to UI
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  report({ phase: "detecting", progress: 0.9, message: "Detecting repetitions…" });

  const posed = frames.filter((f) => f.shoulderY != null).length;
  if (posed < 8) {
    throw new Error(
      "Could not track a person reliably. Try a clearer side/front view with the full body visible.",
    );
  }

  const { hangY, topY } = calibrateHeightRange(frames);
  const reps = detectReps(frames, hangY, topY, calibration);
  const avgConf = confN ? confSum / confN : 0;

  const result = summarizeSet(
    reps,
    avgConf,
    calibration,
    duration,
    video.videoWidth,
    video.videoHeight,
    hangY,
    topY,
    frames,
  );

  report({ phase: "done", progress: 1, message: `Detected ${reps.length} rep(s).` });
  await seekVideo(video, 0);
  return result;
}
