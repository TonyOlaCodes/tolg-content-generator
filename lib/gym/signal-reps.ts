import type { PoseFrame, RepGrade } from "@/lib/pullup/types";
import type { GenericRep, GymCalibration } from "./types";

export type SignalRepConfig = {
  /** Higher signal = more "compressed" / deeper / higher depending on invert. */
  enter: number;
  peak: number;
  exit: number;
  minConcentric: number;
  minEccentric: number;
  minRom: number;
  /** If true, signal increases as athlete goes deeper (bench/squat/crunch). */
  deeperIsHigher: boolean;
};

export const DEFAULT_SIGNAL_CFG: SignalRepConfig = {
  enter: 0.18,
  peak: 0.55,
  exit: 0.2,
  minConcentric: 0.2,
  minEccentric: 0.15,
  minRom: 0.18,
  deeperIsHigher: true,
};

export function calibrateSignalRange(values: number[]): { low: number; high: number } {
  const sorted = [...values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length < 5) return { low: 0, high: 1 };
  const low = sorted[Math.floor(sorted.length * 0.08)];
  const high = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.92))];
  if (high - low < 0.08) {
    const mid = (high + low) / 2;
    return { low: mid - 0.06, high: mid + 0.06 };
  }
  return { low, high };
}

/** Normalize raw signal so 0 = low extreme, 1 = high extreme of the set. */
export function normSignal(raw: number, low: number, high: number): number {
  const span = high - low;
  if (Math.abs(span) < 1e-6) return 0;
  return Math.max(0, Math.min(1.2, (raw - low) / span));
}

type Active = {
  startT: number;
  peakT: number;
  peak: number;
  bottom: number;
  maxSpeed: number;
  pauseAccum: number;
  lastPauseT: number | null;
};

/**
 * Generic hang→work→return detector on a 0–1 signal series.
 * For bench/squat/crunch: higher = deeper. For deadlift: higher = lockout (deeperIsHigher false via inverted series).
 */
export function detectSignalReps(
  samples: Array<{ t: number; v: number; frame?: PoseFrame }>,
  calibration: GymCalibration,
  cfg: SignalRepConfig = DEFAULT_SIGNAL_CFG,
  enrich?: (peakSample: { t: number; v: number; frame?: PoseFrame }, endFrame?: PoseFrame) => Partial<GenericRep>,
): GenericRep[] {
  const reps: GenericRep[] = [];
  type State = "rest" | "working" | "peak" | "returning";
  let state: State = "rest";
  let active: Active | null = null;
  let prevV = samples[0]?.v ?? 0;
  let prevT = samples[0]?.t ?? 0;

  const scaleCm =
    calibration.metersPerImageHeight != null
      ? calibration.metersPerImageHeight * 100
      : calibration.heightCm != null
        ? calibration.heightCm * 0.25
        : null;

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const v = s.v;
    const dt = Math.max(1e-3, s.t - prevT);
    const vel = (v - prevV) / dt;

    if (state === "rest") {
      if (v > cfg.enter && vel > 0.05) {
        state = "working";
        active = {
          startT: s.t,
          peakT: s.t,
          peak: v,
          bottom: v,
          maxSpeed: Math.max(0, vel),
          pauseAccum: 0,
          lastPauseT: null,
        };
      }
    } else if (state === "working" && active) {
      active.maxSpeed = Math.max(active.maxSpeed, vel);
      if (v > active.peak) {
        active.peak = v;
        active.peakT = s.t;
      }
      if (v < active.bottom) active.bottom = v;
      if (Math.abs(vel) < 0.08 && v > cfg.peak * 0.85) {
        active.pauseAccum += dt;
        active.lastPauseT = s.t;
      }
      if (v >= cfg.peak) state = "peak";
      else if (vel < -0.12 && v < active.peak - 0.08) state = "returning";
    } else if (state === "peak" && active) {
      if (v > active.peak) {
        active.peak = v;
        active.peakT = s.t;
      }
      if (Math.abs(vel) < 0.08) {
        active.pauseAccum += dt;
      }
      if (vel < -0.08) state = "returning";
    } else if (state === "returning" && active) {
      if (v < active.bottom) active.bottom = v;
      const conc = active.peakT - active.startT;
      const ecc = s.t - active.peakT;
      if (v <= cfg.exit && ecc >= cfg.minEccentric * 0.4) {
        const rom = active.peak - Math.min(active.bottom, cfg.exit);
        if (conc >= cfg.minConcentric * 0.4 && rom >= cfg.minRom * 0.55) {
          const grade = gradeFromRom(active.peak, rom, cfg);
          const romCm = scaleCm != null ? rom * scaleCm : null;
          const peakSpeedMs = scaleCm != null ? (active.maxSpeed * scaleCm) / 100 : null;
          const workMass = calibration.externalLoadKg;
          const workJ =
            workMass != null && romCm != null ? workMass * 9.81 * (romCm / 100) : null;
          const peakPowerW = workJ != null && conc > 0.05 ? workJ / conc : null;
          const peakSample = samples.reduce(
            (best, cur) =>
              Math.abs(cur.t - active!.peakT) < Math.abs(best.t - active!.peakT) ? cur : best,
            samples[0],
          );
          const extra = enrich?.(peakSample, s.frame) ?? {};
          const quality = Math.round(
            Math.max(
              0,
              Math.min(
                100,
                40 + active.peak * 40 + (grade === "valid" ? 12 : grade === "partial" ? 4 : -10),
              ),
            ),
          );
          reps.push({
            index: reps.length + 1,
            startT: active.startT,
            peakT: active.peakT,
            endT: s.t,
            peakNorm: active.peak,
            bottomNorm: active.bottom,
            concentricSec: Math.max(0, conc),
            eccentricSec: Math.max(0, ecc),
            pauseSec: active.pauseAccum,
            peakSpeedNorm: active.maxSpeed,
            peakSpeedMs,
            romNorm: rom,
            romCm,
            elbowL: (extra.elbowL as number | null | undefined) ?? null,
            elbowR: (extra.elbowR as number | null | undefined) ?? null,
            kneeL: (extra.kneeL as number | null | undefined) ?? null,
            kneeR: (extra.kneeR as number | null | undefined) ?? null,
            hipAngle: (extra.hipAngle as number | null | undefined) ?? null,
            torsoAngle: (extra.torsoAngle as number | null | undefined) ?? null,
            depthClass: extra.depthClass as GenericRep["depthClass"],
            lockOut: Boolean(extra.lockOut ?? true),
            autoGrade: grade,
            grade,
            quality: typeof extra.quality === "number" ? extra.quality : quality,
            workJ,
            peakPowerW,
            extras: (extra.extras as GenericRep["extras"]) ?? {},
          });
        }
        active = null;
        state = "rest";
      }
    }

    prevV = v;
    prevT = s.t;
  }

  return reps;
}

function gradeFromRom(peak: number, rom: number, cfg: SignalRepConfig): RepGrade {
  if (rom < cfg.minRom || peak < 0.35) return "failed";
  if (peak >= 0.75) return "valid";
  if (peak >= 0.5) return "partial";
  return "failed";
}

export function velocityLoss(reps: GenericRep[]): number | null {
  if (reps.length < 2) return null;
  const first = reps.slice(0, Math.min(3, reps.length));
  const last = reps.slice(-Math.min(3, reps.length));
  const a = first.reduce((s, r) => s + r.peakSpeedNorm, 0) / first.length;
  const b = last.reduce((s, r) => s + r.peakSpeedNorm, 0) / last.length;
  if (a < 1e-4) return null;
  return Math.round(Math.max(0, ((a - b) / a) * 100));
}

export function avgQuality(reps: GenericRep[]): number {
  if (!reps.length) return 0;
  return Math.round(reps.reduce((s, r) => s + r.quality, 0) / reps.length);
}
