import { averageConfidence, elbowAngle, LM, midPoint } from "./landmarks";
import type { LandmarkPoint, Phase, PoseFrame, UserCalibration } from "./types";

export function landmarksToPoseFrame(t: number, landmarks: LandmarkPoint[] | null): PoseFrame {
  if (!landmarks?.length) {
    return {
      t,
      landmarks: null,
      shoulderY: null,
      hipY: null,
      noseY: null,
      elbowL: null,
      elbowR: null,
      confidence: 0,
    };
  }
  const midShoulder = midPoint(landmarks[LM.leftShoulder], landmarks[LM.rightShoulder]);
  const midHip = midPoint(landmarks[LM.leftHip], landmarks[LM.rightHip]);
  const nose = landmarks[LM.nose];
  return {
    t,
    landmarks,
    shoulderY: midShoulder?.y ?? null,
    hipY: midHip?.y ?? null,
    noseY: nose && (nose.visibility ?? 0) > 0.3 ? nose.y : null,
    elbowL: elbowAngle(landmarks, "L"),
    elbowR: elbowAngle(landmarks, "R"),
    confidence: averageConfidence(landmarks),
  };
}

/** 0 = hang (low), 1 = top (high). Uses measured hang/best-top shoulder Y. */
export function heightNorm(
  shoulderY: number | null,
  hangY: number,
  topY: number,
): number {
  if (shoulderY == null) return 0;
  const span = hangY - topY;
  if (Math.abs(span) < 1e-4) return 0;
  return Math.max(0, Math.min(1.15, (hangY - shoulderY) / span));
}

export function estimatePhase(
  height: number,
  velocity: number, // d(height)/dt, positive = going up
  hasPose: boolean,
  nearBar: boolean,
): Phase {
  if (!hasPose) return "NO POSE";
  if (height < 0.08 && Math.abs(velocity) < 0.15) return "DEAD HANG";
  if (height > 0.78 && Math.abs(velocity) < 0.25) return nearBar || height > 0.85 ? "TOP" : "TOP";
  if (velocity > 0.12 && height > 0.1) return "PULL";
  if (velocity < -0.12 && height > 0.1) return "LOWER";
  if (height < 0.12) return "DEAD HANG";
  if (height > 0.7) return "TOP";
  return velocity >= 0 ? "PULL" : "LOWER";
}

export function verticalSpeed(
  frames: PoseFrame[],
  index: number,
  hangY: number,
  topY: number,
  calibration: UserCalibration,
): { normPerSec: number; metersPerSec: number | null } {
  if (index <= 0 || index >= frames.length) return { normPerSec: 0, metersPerSec: null };
  const a = frames[index - 1];
  const b = frames[index];
  const dt = b.t - a.t;
  if (dt <= 0 || a.shoulderY == null || b.shoulderY == null) {
    return { normPerSec: 0, metersPerSec: null };
  }
  const ha = heightNorm(a.shoulderY, hangY, topY);
  const hb = heightNorm(b.shoulderY, hangY, topY);
  const normPerSec = (hb - ha) / dt;
  const spanY = Math.abs(hangY - topY);
  let metersPerSec: number | null = null;
  if (calibration.metersPerImageHeight != null && spanY > 1e-4) {
    const meters = Math.abs(b.shoulderY - a.shoulderY) * calibration.metersPerImageHeight;
    metersPerSec = meters / dt;
  } else if (calibration.heightCm != null && spanY > 1e-4) {
    // Rough: body height ≈ 0.45 of person image span; use user height to scale image.
    // Without full-body pixel height we approximate ROM span as ~0.3 of stature for pull-ups.
    const approxRomM = (calibration.heightCm / 100) * 0.3;
    const meters = (Math.abs(hb - ha) * approxRomM);
    metersPerSec = meters / dt;
  }
  return { normPerSec, metersPerSec };
}

export function hipSway(landmarks: LandmarkPoint[] | null, refX: number | null): number | null {
  if (!landmarks || refX == null) return null;
  const mid = midPoint(landmarks[LM.leftHip], landmarks[LM.rightHip]);
  if (!mid) return null;
  return Math.abs(mid.x - refX);
}

export function mechanicalWorkJ(
  massKg: number,
  romM: number,
): number {
  // Concentric work against gravity for vertical lift of COM ≈ mass * g * rom
  return massKg * 9.81 * romM;
}

export function findFrameAt(frames: PoseFrame[], t: number): PoseFrame | null {
  if (!frames.length) return null;
  if (t <= frames[0].t) return frames[0];
  if (t >= frames[frames.length - 1].t) return frames[frames.length - 1];
  let lo = 0;
  let hi = frames.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = frames[lo];
  const b = frames[hi];
  if (!a.landmarks && !b.landmarks) return a;
  // Prefer nearest with pose
  return Math.abs(a.t - t) <= Math.abs(b.t - t) ? a : b;
}

/** Interpolate shoulder series for graphing. */
export function sampleShoulderSeries(
  frames: PoseFrame[],
  hangY: number,
  topY: number,
): Array<{ t: number; h: number }> {
  return frames
    .filter((f) => f.shoulderY != null)
    .map((f) => ({ t: f.t, h: heightNorm(f.shoulderY, hangY, topY) }));
}
