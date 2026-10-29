import { heightNorm } from "./biomechanics";
import type { PoseFrame, RepGrade, RepRecord, UserCalibration } from "./types";

export type RepDetectorConfig = {
  /** Min normalized height to enter pull. */
  pullEnter: number;
  /** Min height to count as reaching top region. */
  topEnter: number;
  /** Height to re-enter hang / complete rep. */
  hangExit: number;
  /** Minimum time for a concentric (s). */
  minUpSec: number;
  /** Minimum time for eccentric (s). */
  minDownSec: number;
  /** Ignore tiny oscillations (norm units). */
  minRom: number;
  /** Chin clearance threshold relative to bar (image y). Negative = above bar. */
  chinAboveDelta: number;
  chinAtDelta: number;
};

export const DEFAULT_REP_CONFIG: RepDetectorConfig = {
  pullEnter: 0.18,
  topEnter: 0.62,
  hangExit: 0.2,
  minUpSec: 0.25,
  minDownSec: 0.2,
  minRom: 0.22,
  chinAboveDelta: -0.015,
  chinAtDelta: 0.025,
};

type ActiveRep = {
  startT: number;
  peakT: number;
  peakHeight: number;
  peakShoulderY: number;
  bottomShoulderY: number;
  reachedTop: boolean;
  elbowAtTopL: number | null;
  elbowAtTopR: number | null;
  maxUpSpeed: number;
  hipXs: number[];
};

function classifyChin(
  noseY: number | null,
  barY: number,
  cfg: RepDetectorConfig,
): RepRecord["chinClass"] {
  if (noseY == null) return "uncertain";
  const d = noseY - barY;
  if (d <= cfg.chinAboveDelta) return "above";
  if (d <= cfg.chinAtDelta) return "at";
  return "short";
}

function autoGrade(
  peakHeight: number,
  chin: RepRecord["chinClass"],
  lockOut: boolean,
  rom: number,
  cfg: RepDetectorConfig,
): RepGrade {
  if (rom < cfg.minRom || peakHeight < 0.4) return "failed";
  if (chin === "above" && peakHeight >= 0.75 && lockOut) return "valid";
  if (chin === "at" && peakHeight >= 0.65) return "valid";
  if (peakHeight >= 0.85) return "valid";
  if (peakHeight >= 0.5 || chin === "at" || chin === "above") return "partial";
  return "failed";
}

function qualityScore(input: {
  peakHeight: number;
  chin: RepRecord["chinClass"];
  lockOut: boolean;
  swayNorm: number;
  elbowSym: number | null;
  confidence: number;
  grade: RepGrade;
}): number {
  let score = 40;
  score += input.peakHeight * 35;
  if (input.chin === "above") score += 12;
  else if (input.chin === "at") score += 8;
  else if (input.chin === "short") score -= 8;
  if (input.lockOut) score += 6;
  score -= Math.min(15, input.swayNorm * 80);
  if (input.elbowSym != null) score -= Math.min(10, input.elbowSym / 4);
  score *= 0.7 + 0.3 * input.confidence;
  if (input.grade === "failed") score = Math.min(score, 55);
  if (input.grade === "partial") score = Math.min(score, 88);
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Detect pull-up repetitions from a pose timeline.
 * Uses a hang → pull → top → lower → hang state machine with hysteresis.
 */
export function detectReps(
  frames: PoseFrame[],
  hangY: number,
  topY: number,
  calibration: UserCalibration,
  cfg: RepDetectorConfig = DEFAULT_REP_CONFIG,
): RepRecord[] {
  const reps: RepRecord[] = [];
  type State = "hang" | "pulling" | "top" | "lowering";
  let state: State = "hang";
  let active: ActiveRep | null = null;
  let prevH = 0;
  let prevT = frames[0]?.t ?? 0;

  const refHipXs: number[] = [];
  for (const f of frames) {
    if (f.landmarks && f.hipY != null) {
      const lx = f.landmarks[23]?.x;
      const rx = f.landmarks[24]?.x;
      if (lx != null && rx != null) refHipXs.push((lx + rx) / 2);
    }
  }
  const refHipX =
    refHipXs.length > 0
      ? refHipXs.reduce((a, b) => a + b, 0) / refHipXs.length
      : null;

  const scaleCm =
    calibration.metersPerImageHeight != null
      ? calibration.metersPerImageHeight * 100
      : calibration.heightCm != null
        ? calibration.heightCm * 0.3 // approximate full ROM in cm when height known
        : null;

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (f.shoulderY == null) continue;
    const h = heightNorm(f.shoulderY, hangY, topY);
    const dt = Math.max(1e-3, f.t - prevT);
    const vel = (h - prevH) / dt;

    const hipX =
      f.landmarks && f.landmarks[23] && f.landmarks[24]
        ? (f.landmarks[23].x + f.landmarks[24].x) / 2
        : null;

    if (state === "hang") {
      if (h > cfg.pullEnter && vel > 0.08) {
        state = "pulling";
        active = {
          startT: f.t,
          peakT: f.t,
          peakHeight: h,
          peakShoulderY: f.shoulderY,
          bottomShoulderY: f.shoulderY,
          reachedTop: false,
          elbowAtTopL: f.elbowL,
          elbowAtTopR: f.elbowR,
          maxUpSpeed: Math.max(0, vel),
          hipXs: hipX != null ? [hipX] : [],
        };
      }
    } else if (state === "pulling" && active) {
      if (hipX != null) active.hipXs.push(hipX);
      if (f.shoulderY > active.bottomShoulderY) active.bottomShoulderY = f.shoulderY;
      if (h > active.peakHeight) {
        active.peakHeight = h;
        active.peakT = f.t;
        active.peakShoulderY = f.shoulderY;
        active.elbowAtTopL = f.elbowL;
        active.elbowAtTopR = f.elbowR;
      }
      active.maxUpSpeed = Math.max(active.maxUpSpeed, vel);
      if (h >= cfg.topEnter) {
        active.reachedTop = true;
        state = "top";
      } else if (vel < -0.15 && h < active.peakHeight - 0.08) {
        // Started descending without clear top
        state = "lowering";
      }
    } else if (state === "top" && active) {
      if (hipX != null) active.hipXs.push(hipX);
      if (h > active.peakHeight) {
        active.peakHeight = h;
        active.peakT = f.t;
        active.peakShoulderY = f.shoulderY;
        active.elbowAtTopL = f.elbowL;
        active.elbowAtTopR = f.elbowR;
      }
      if (vel < -0.1) state = "lowering";
    } else if (state === "lowering" && active) {
      if (hipX != null) active.hipXs.push(hipX);
      if (f.shoulderY > active.bottomShoulderY) active.bottomShoulderY = f.shoulderY;
      const upDur = active.peakT - active.startT;
      const downDur = f.t - active.peakT;
      if (h <= cfg.hangExit && downDur >= cfg.minDownSec * 0.5) {
        const rom = active.peakHeight;
        if (upDur >= cfg.minUpSec * 0.5 && rom >= cfg.minRom * 0.6) {
          // Prefer nose at peak for chin class
          const peakFrame = frames.reduce(
            (best, cur) =>
              Math.abs(cur.t - active!.peakT) < Math.abs(best.t - active!.peakT) ? cur : best,
            frames[0],
          );
          const chinAtPeak = classifyChin(peakFrame.noseY, calibration.barY, cfg);
          // Lock-out at bottom: elbows extended near end of rep
          const endLock =
            (f.elbowL != null && f.elbowL > 145) || (f.elbowR != null && f.elbowR > 145);

          const swayNorm =
            refHipX != null && active.hipXs.length
              ? active.hipXs.reduce((s, x) => s + Math.abs(x - refHipX), 0) / active.hipXs.length
              : 0;

          const elbowSym =
            active.elbowAtTopL != null && active.elbowAtTopR != null
              ? Math.abs(active.elbowAtTopL - active.elbowAtTopR)
              : null;

          const grade = autoGrade(active.peakHeight, chinAtPeak, endLock, rom, cfg);
          const romCm = scaleCm != null ? rom * scaleCm : null;
          const peakSpeedMs =
            scaleCm != null ? (active.maxUpSpeed * scaleCm) / 100 : null;

          const mass =
            calibration.bodyWeightKg != null
              ? calibration.bodyWeightKg + (calibration.addedWeightKg || 0)
              : null;
          const workJ =
            mass != null && romCm != null ? mass * 9.81 * (romCm / 100) : null;
          const peakPowerW =
            workJ != null && upDur > 0.05 ? workJ / upDur : null;

          const conf = peakFrame.confidence || 0.5;
          const quality = qualityScore({
            peakHeight: active.peakHeight,
            chin: chinAtPeak,
            lockOut: endLock,
            swayNorm,
            elbowSym,
            confidence: conf,
            grade,
          });

          reps.push({
            index: reps.length + 1,
            startT: active.startT,
            peakT: active.peakT,
            endT: f.t,
            peakHeightNorm: active.peakHeight,
            peakShoulderY: active.peakShoulderY,
            bottomShoulderY: active.bottomShoulderY,
            upDuration: Math.max(0, upDur),
            downDuration: Math.max(0, downDur),
            peakSpeedNorm: active.maxUpSpeed,
            peakSpeedMs,
            elbowAtTopL: active.elbowAtTopL,
            elbowAtTopR: active.elbowAtTopR,
            romNorm: rom,
            romCm,
            swayNorm,
            swayCm: scaleCm != null ? swayNorm * scaleCm : null,
            lockOut: endLock,
            chinClass: chinAtPeak,
            autoGrade: grade,
            grade,
            quality,
            workJ,
            peakPowerW,
          });
        }
        active = null;
        state = "hang";
      }
    }

    prevH = h;
    prevT = f.t;
  }

  return reps;
}

/** Establish hang (low) and best-top (high) shoulder Y from the timeline. */
export function calibrateHeightRange(frames: PoseFrame[]): {
  hangY: number;
  topY: number;
} {
  const ys = frames.map((f) => f.shoulderY).filter((y): y is number => y != null);
  if (ys.length < 5) {
    return { hangY: 0.55, topY: 0.25 };
  }
  const sorted = [...ys].sort((a, b) => a - b);
  // Top = low percentile (shoulders high on screen), hang = high percentile
  const topY = sorted[Math.floor(sorted.length * 0.08)];
  const hangY = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.92))];
  if (hangY - topY < 0.05) {
    return { hangY: hangY + 0.05, topY: topY - 0.02 };
  }
  return { hangY, topY };
}
