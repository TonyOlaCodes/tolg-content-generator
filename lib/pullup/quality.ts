import type { AnalysisResult, RepRecord, UserCalibration } from "./types";

export function averageQuality(reps: RepRecord[]): number {
  if (!reps.length) return 0;
  return Math.round(reps.reduce((s, r) => s + r.quality, 0) / reps.length);
}

export function velocityLossPct(reps: RepRecord[]): number | null {
  if (reps.length < 2) return null;
  const first = reps.slice(0, Math.min(3, reps.length));
  const last = reps.slice(-Math.min(3, reps.length));
  const a = first.reduce((s, r) => s + r.peakSpeedNorm, 0) / first.length;
  const b = last.reduce((s, r) => s + r.peakSpeedNorm, 0) / last.length;
  if (a < 1e-4) return null;
  return Math.round(Math.max(0, ((a - b) / a) * 100));
}

export function buildCoachingNotes(reps: RepRecord[], velLoss: number | null): string[] {
  const notes: string[] = [];
  if (!reps.length) {
    notes.push("No pull-up repetitions were detected. Check bar placement, framing, and lighting.");
    return notes;
  }

  const valid = reps.filter((r) => r.grade === "valid").length;
  const partial = reps.filter((r) => r.grade === "partial").length;
  const failed = reps.filter((r) => r.grade === "failed").length;

  if (failed > valid && failed > 0) {
    notes.push("Several attempts did not reach a clear top position relative to your bar reference.");
  }
  if (partial > 0 && valid > 0) {
    notes.push("Some reps were borderline — consider pausing briefly with chin at or above the bar.");
  }
  if (velLoss != null && velLoss >= 25) {
    notes.push(
      `Concentric speed dropped about ${velLoss}% from early to late reps (velocity-loss estimate).`,
    );
  }
  const sway = reps.map((r) => r.swayNorm);
  const avgSway = sway.reduce((a, b) => a + b, 0) / sway.length;
  if (avgSway > 0.04) {
    notes.push("Hip/torso sway was elevated — bracing the core may improve bar path consistency.");
  }
  const lockouts = reps.filter((r) => r.lockOut).length;
  if (lockouts < reps.length * 0.6) {
    notes.push("Full elbow extension at the bottom was inconsistent across the set.");
  }
  const shortChins = reps.filter((r) => r.chinClass === "short").length;
  if (shortChins >= Math.ceil(reps.length / 3)) {
    notes.push("Chin often stayed below the bar line — verify the bar guide or pull higher.");
  }
  if (!notes.length) {
    notes.push("Tracking looks consistent. Review individual reps for tempo and range details.");
  }
  return notes;
}

export function summarizeSet(
  reps: RepRecord[],
  framesConfidence: number,
  calibration: UserCalibration,
  duration: number,
  videoWidth: number,
  videoHeight: number,
  hangY: number,
  topY: number,
  frames: AnalysisResult["frames"],
): AnalysisResult {
  const avgQ = averageQuality(reps);
  const velLoss = velocityLossPct(reps);
  return {
    duration,
    videoWidth,
    videoHeight,
    frames,
    hangShoulderY: hangY,
    bestTopShoulderY: topY,
    reps,
    avgQuality: avgQ,
    velocityLossPct: velLoss,
    trackingConfidence: framesConfidence,
    calibration,
    coachingNotes: buildCoachingNotes(reps, velLoss),
    analyzedAt: Date.now(),
  };
}

/** Documented quality heuristic for UI. */
export const QUALITY_METHOD = `Quality / 100 is a transparent heuristic from:
peak height vs hang→top range, chin vs bar guide, bottom lockout (elbow extension),
sway, left/right elbow symmetry at top, and pose confidence.
It is not a medical or competition-validated score.`;
