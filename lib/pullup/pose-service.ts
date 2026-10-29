"use client";

import type { LandmarkPoint } from "./types";
import { LandmarkSmoother, normalizeLandmark } from "./landmarks";

const MEDIAPIPE_VERSION = "0.10.18";
const WASM_ROOT = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

type SegMask = {
  width: number;
  height: number;
  getAsUint8Array?: () => Uint8Array;
  getAsFloat32Array?: () => Float32Array;
  close?: () => void;
};

type PoseLandmarkerLike = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number,
  ) => {
    landmarks: Array<
      Array<{ x: number; y: number; z: number; visibility?: number; presence?: number }>
    >;
    segmentationMasks?: SegMask[];
  };
  setOptions?: (opts: Record<string, unknown>) => Promise<void>;
  close: () => void;
};

const landmarkerCache = new Map<string, Promise<PoseLandmarkerLike>>();

async function createLandmarker(segmentation: boolean): Promise<PoseLandmarkerLike> {
  const vision = await import("@mediapipe/tasks-vision");
  const fileset = await vision.FilesetResolver.forVisionTasks(WASM_ROOT);
  const base = {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate: "GPU" as const,
    },
    runningMode: "VIDEO" as const,
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: segmentation,
  };
  try {
    return (await vision.PoseLandmarker.createFromOptions(fileset, base)) as unknown as PoseLandmarkerLike;
  } catch {
    return (await vision.PoseLandmarker.createFromOptions(fileset, {
      ...base,
      baseOptions: { ...base.baseOptions, delegate: "CPU" },
    })) as unknown as PoseLandmarkerLike;
  }
}

export async function getPoseLandmarker(opts?: {
  segmentation?: boolean;
}): Promise<PoseLandmarkerLike> {
  const key = opts?.segmentation ? "seg" : "pose";
  let promise = landmarkerCache.get(key);
  if (!promise) {
    promise = createLandmarker(Boolean(opts?.segmentation)).catch((err) => {
      landmarkerCache.delete(key);
      throw err;
    });
    landmarkerCache.set(key, promise);
  }
  return promise;
}

export function closePoseLandmarkers(): void {
  for (const p of landmarkerCache.values()) {
    void p.then((l) => {
      try {
        l.close();
      } catch {
        /* ignore */
      }
    });
  }
  landmarkerCache.clear();
}

export type SegmentationMaskData = {
  width: number;
  height: number;
  /** Float confidence 0–1 per pixel, row-major. */
  values: Float32Array;
};

export type DetectedPose = {
  landmarks: LandmarkPoint[] | null;
  confidence: number;
  mask: SegmentationMaskData | null;
};

function readMask(raw: SegMask | undefined): SegmentationMaskData | null {
  if (!raw) return null;
  try {
    const f32 = raw.getAsFloat32Array?.();
    if (f32 && f32.length) {
      const values = Float32Array.from(f32);
      raw.close?.();
      return { width: raw.width, height: raw.height, values };
    }
    const u8 = raw.getAsUint8Array?.();
    if (u8 && u8.length) {
      const values = new Float32Array(u8.length);
      for (let i = 0; i < u8.length; i++) values[i] = u8[i] / 255;
      raw.close?.();
      return { width: raw.width, height: raw.height, values };
    }
  } catch {
    raw.close?.();
  }
  return null;
}

export class PoseTracker {
  private smoother = new LandmarkSmoother(0.4);
  private lastTs = -1;
  private readonly segmentation: boolean;

  constructor(opts?: { segmentation?: boolean }) {
    this.segmentation = Boolean(opts?.segmentation);
  }

  reset(): void {
    this.smoother.reset();
    this.lastTs = -1;
  }

  async detect(video: HTMLVideoElement, timestampMs: number): Promise<DetectedPose> {
    const landmarker = await getPoseLandmarker({ segmentation: this.segmentation });
    let ts = timestampMs;
    if (ts <= this.lastTs) ts = this.lastTs + 1;
    this.lastTs = ts;

    const result = landmarker.detectForVideo(video, ts);
    const raw = result.landmarks?.[0];
    const mask = this.segmentation ? readMask(result.segmentationMasks?.[0]) : null;
    // Close unused masks if present
    if (!this.segmentation && result.segmentationMasks) {
      for (const m of result.segmentationMasks) m.close?.();
    }

    if (!raw?.length) {
      this.smoother.smooth(null);
      return { landmarks: null, confidence: 0, mask };
    }

    const mapped = raw.map(normalizeLandmark);
    const smoothed = this.smoother.smooth(mapped);
    const confidence =
      smoothed!.reduce((s, p) => s + (p.visibility ?? 0), 0) / smoothed!.length;

    return { landmarks: smoothed, confidence, mask };
  }
}

/** Suggest bar Y from wrist landmarks (slightly above average wrist height). */
export function suggestBarYFromLandmarks(landmarks: LandmarkPoint[] | null): number | null {
  if (!landmarks) return null;
  const lw = landmarks[15];
  const rw = landmarks[16];
  const ys: number[] = [];
  if (lw && (lw.visibility ?? 0) > 0.4) ys.push(lw.y);
  if (rw && (rw.visibility ?? 0) > 0.4) ys.push(rw.y);
  if (!ys.length) return null;
  const avg = ys.reduce((a, b) => a + b, 0) / ys.length;
  return Math.max(0.05, Math.min(0.5, avg - 0.02));
}
