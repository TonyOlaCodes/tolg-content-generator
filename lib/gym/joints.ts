import { angleDeg, LM, midPoint } from "@/lib/pullup/landmarks";
import type { LandmarkPoint, PoseFrame } from "@/lib/pullup/types";

export function wristMidY(lm: LandmarkPoint[] | null): number | null {
  if (!lm) return null;
  const a = lm[LM.leftWrist];
  const b = lm[LM.rightWrist];
  if (!a || !b) return null;
  if ((a.visibility ?? 0) < 0.25 && (b.visibility ?? 0) < 0.25) return null;
  return (a.y + b.y) / 2;
}

export function wristMidX(lm: LandmarkPoint[] | null): number | null {
  if (!lm) return null;
  const a = lm[LM.leftWrist];
  const b = lm[LM.rightWrist];
  if (!a || !b) return null;
  return (a.x + b.x) / 2;
}

export function shoulderMidY(lm: LandmarkPoint[] | null): number | null {
  if (!lm) return null;
  const m = midPoint(lm[LM.leftShoulder], lm[LM.rightShoulder]);
  return m?.y ?? null;
}

export function hipMidY(lm: LandmarkPoint[] | null): number | null {
  if (!lm) return null;
  const m = midPoint(lm[LM.leftHip], lm[LM.rightHip]);
  return m?.y ?? null;
}

export function kneeAngle(lm: LandmarkPoint[], side: "L" | "R"): number | null {
  const h = side === "L" ? LM.leftHip : LM.rightHip;
  const k = side === "L" ? LM.leftKnee : LM.rightKnee;
  const a = side === "L" ? LM.leftAnkle : LM.rightAnkle;
  const A = lm[h];
  const B = lm[k];
  const C = lm[a];
  if (!A || !B || !C || (B.visibility ?? 0) < 0.3) return null;
  return angleDeg(A, B, C);
}

export function hipAngle(lm: LandmarkPoint[], side: "L" | "R"): number | null {
  const s = side === "L" ? LM.leftShoulder : LM.rightShoulder;
  const h = side === "L" ? LM.leftHip : LM.rightHip;
  const k = side === "L" ? LM.leftKnee : LM.rightKnee;
  const A = lm[s];
  const B = lm[h];
  const C = lm[k];
  if (!A || !B || !C || (B.visibility ?? 0) < 0.3) return null;
  return angleDeg(A, B, C);
}

/** Approx torso inclination from vertical (0 = upright, larger = more horizontal). */
export function torsoInclinationDeg(lm: LandmarkPoint[] | null): number | null {
  if (!lm) return null;
  const midS = midPoint(lm[LM.leftShoulder], lm[LM.rightShoulder]);
  const midH = midPoint(lm[LM.leftHip], lm[LM.rightHip]);
  if (!midS || !midH) return null;
  const dx = midS.x - midH.x;
  const dy = midH.y - midS.y; // positive when shoulders above hips in image? y grows down
  // In image coords y increases downward, so upright person: midS.y < midH.y, dy > 0
  const angleFromVertical = (Math.atan2(Math.abs(dx), Math.max(1e-6, Math.abs(dy))) * 180) / Math.PI;
  return angleFromVertical;
}

/** Crunch flexion proxy: shoulder–hip distance change / torso fold. */
export function crunchFlexion(lm: LandmarkPoint[] | null): number | null {
  if (!lm) return null;
  const midS = midPoint(lm[LM.leftShoulder], lm[LM.rightShoulder]);
  const midH = midPoint(lm[LM.leftHip], lm[LM.rightHip]);
  if (!midS || !midH) return null;
  // When crunching, shoulders move toward hips → smaller |dy|
  return Math.abs(midH.y - midS.y);
}

export function enrichFromFrame(frame?: PoseFrame): {
  elbowL: number | null;
  elbowR: number | null;
  kneeL: number | null;
  kneeR: number | null;
  hipAngle: number | null;
  torsoAngle: number | null;
} {
  const lm = frame?.landmarks ?? null;
  return {
    elbowL: frame?.elbowL ?? null,
    elbowR: frame?.elbowR ?? null,
    kneeL: lm ? kneeAngle(lm, "L") : null,
    kneeR: lm ? kneeAngle(lm, "R") : null,
    hipAngle: lm ? hipAngle(lm, "L") ?? hipAngle(lm, "R") : null,
    torsoAngle: torsoInclinationDeg(lm),
  };
}
