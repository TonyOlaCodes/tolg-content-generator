"use client";

import type { LandmarkPoint } from "./types";
import { LandmarkSmoother, normalizeLandmark } from "./landmarks";

const MEDIAPIPE_VERSION = "0.10.18";
const WASM_ROOT = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

type PoseLandmarkerLike = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number,
  ) => {
    landmarks: Array<
      Array<{ x: number; y: number; z: number; visibility?: number; presence?: number }>
    >;
    segmentationMasks?: Array<{
      width: number;
      height: number;
      getAsUint8Array?: () => Uint8Array;
      getAsFloat32Array?: () => Float32Array;
      close?: () => void;
    }>;
  };
  close: () => void;
};

let landmarkerPromise: Promise<PoseLandmarkerLike> | null = null;

async function createLandmarker(): Promise<PoseLandmarkerLike> {
  const vision = await import("@mediapipe/tasks-vision");
  const fileset = await vision.FilesetResolver.forVisionTasks(WASM_ROOT);
  try {
    const landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputSegmentationMasks: false,
    });
    return landmarker as unknown as PoseLandmarkerLike;
  } catch {
    // GPU delegate unavailable — fall back to CPU
    const landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputSegmentationMasks: false,
    });
    return landmarker as unknown as PoseLandmarkerLike;
  }
}

export async function getPoseLandmarker(): Promise<PoseLandmarkerLike> {
  if (!landmarkerPromise) {
    landmarkerPromise = createLandmarker().catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

export function closePoseLandmarker(): void {
  void landmarkerPromise?.then((l) => {
    try {
      l.close();
    } catch {
      /* ignore */
    }
  });
  landmarkerPromise = null;
}

export type DetectedPose = {
  landmarks: LandmarkPoint[] | null;
  confidence: number;
};

export class PoseTracker {
  private smoother = new LandmarkSmoother(0.4);
  private lastTs = -1;

  reset(): void {
    this.smoother.reset();
    this.lastTs = -1;
  }

  async detect(video: HTMLVideoElement, timestampMs: number): Promise<DetectedPose> {
    const landmarker = await getPoseLandmarker();
    let ts = timestampMs;
    if (ts <= this.lastTs) ts = this.lastTs + 1;
    this.lastTs = ts;

    const result = landmarker.detectForVideo(video, ts);
    const raw = result.landmarks?.[0];
    if (!raw?.length) {
      this.smoother.smooth(null);
      return { landmarks: null, confidence: 0 };
    }

    const mapped = raw.map(normalizeLandmark);
    const smoothed = this.smoother.smooth(mapped);
    const confidence =
      smoothed!.reduce((s, p) => s + (p.visibility ?? 0), 0) / smoothed!.length;

    return { landmarks: smoothed, confidence };
  }
}
