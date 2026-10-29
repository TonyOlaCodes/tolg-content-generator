import type { LandmarkPoint } from "./types";

/** MediaPipe Pose Landmarker 33-point indices. */
export const LM = {
  nose: 0,
  leftEyeInner: 1,
  leftEye: 2,
  leftEyeOuter: 3,
  rightEyeInner: 4,
  rightEye: 5,
  rightEyeOuter: 6,
  leftEar: 7,
  rightEar: 8,
  mouthLeft: 9,
  mouthRight: 10,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftPinky: 17,
  rightPinky: 18,
  leftIndex: 19,
  rightIndex: 20,
  leftThumb: 21,
  rightThumb: 22,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
} as const;

export const SKELETON_BONES: Array<[number, number, "torso" | "arm" | "leg" | "face"]> = [
  [LM.leftShoulder, LM.rightShoulder, "torso"],
  [LM.leftShoulder, LM.leftHip, "torso"],
  [LM.rightShoulder, LM.rightHip, "torso"],
  [LM.leftHip, LM.rightHip, "torso"],
  [LM.leftShoulder, LM.leftElbow, "arm"],
  [LM.leftElbow, LM.leftWrist, "arm"],
  [LM.rightShoulder, LM.rightElbow, "arm"],
  [LM.rightElbow, LM.rightWrist, "arm"],
  [LM.leftHip, LM.leftKnee, "leg"],
  [LM.leftKnee, LM.leftAnkle, "leg"],
  [LM.rightHip, LM.rightKnee, "leg"],
  [LM.rightKnee, LM.rightAnkle, "leg"],
  [LM.leftShoulder, LM.nose, "face"],
  [LM.rightShoulder, LM.nose, "face"],
];

export function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Interior angle at B for points A–B–C, in degrees. */
export function angleDeg(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (mag < 1e-8) return 0;
  return (Math.acos(clamp(dot / mag, -1, 1)) * 180) / Math.PI;
}

export function midPoint(
  a: LandmarkPoint | undefined,
  b: LandmarkPoint | undefined,
): { x: number; y: number } | null {
  if (!a || !b) return null;
  if ((a.visibility ?? 0) < 0.3 || (b.visibility ?? 0) < 0.3) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function elbowAngle(landmarks: LandmarkPoint[], side: "L" | "R"): number | null {
  const s = side === "L" ? LM.leftShoulder : LM.rightShoulder;
  const e = side === "L" ? LM.leftElbow : LM.rightElbow;
  const w = side === "L" ? LM.leftWrist : LM.rightWrist;
  const A = landmarks[s];
  const B = landmarks[e];
  const C = landmarks[w];
  if (!A || !B || !C) return null;
  if ((B.visibility ?? 0) < 0.35) return null;
  return angleDeg(A, B, C);
}

export function averageConfidence(landmarks: LandmarkPoint[]): number {
  if (!landmarks.length) return 0;
  let sum = 0;
  let n = 0;
  for (const idx of [
    LM.nose,
    LM.leftShoulder,
    LM.rightShoulder,
    LM.leftElbow,
    LM.rightElbow,
    LM.leftWrist,
    LM.rightWrist,
    LM.leftHip,
    LM.rightHip,
  ]) {
    const p = landmarks[idx];
    if (!p) continue;
    sum += p.visibility ?? 0;
    n += 1;
  }
  return n ? sum / n : 0;
}

/** One-euro style light EMA smoother for 2D landmarks. */
export class LandmarkSmoother {
  private prev: LandmarkPoint[] | null = null;
  private readonly alpha: number;

  constructor(alpha = 0.35) {
    this.alpha = alpha;
  }

  reset(): void {
    this.prev = null;
  }

  smooth(next: LandmarkPoint[] | null): LandmarkPoint[] | null {
    if (!next) {
      this.prev = null;
      return null;
    }
    if (!this.prev || this.prev.length !== next.length) {
      this.prev = next.map((p) => ({ ...p }));
      return next.map((p) => ({ ...p }));
    }
    const a = this.alpha;
    const out = next.map((p, i) => {
      const q = this.prev![i];
      return {
        x: lerp(q.x, p.x, a),
        y: lerp(q.y, p.y, a),
        z: lerp(q.z, p.z, a),
        visibility: p.visibility,
        presence: p.presence,
      };
    });
    this.prev = out;
    return out;
  }
}

export function normalizeLandmark(raw: {
  x: number;
  y: number;
  z: number;
  visibility?: number;
  presence?: number;
}): LandmarkPoint {
  return {
    x: raw.x,
    y: raw.y,
    z: raw.z,
    visibility: raw.visibility ?? 1,
    presence: raw.presence ?? 1,
  };
}
