import { detectReps, calibrateHeightRange } from "@/lib/pullup/rep-detector";
import { heightNorm } from "@/lib/pullup/biomechanics";
import type { PoseFrame } from "@/lib/pullup/types";
import { getExercise } from "./registry";
import {
  calibrateSignalRange,
  detectSignalReps,
  normSignal,
  velocityLoss,
  avgQuality,
} from "./signal-reps";
import {
  crunchFlexion,
  enrichFromFrame,
  hipMidY,
  shoulderMidY,
  wristMidX,
  wristMidY,
} from "./joints";
import type { GymAnalysisResult, GymCalibration, GenericRep } from "./types";

function equipmentPathFromFrames(frames: PoseFrame[]): GymAnalysisResult["equipmentPath"] {
  const out: GymAnalysisResult["equipmentPath"] = [];
  for (const f of frames) {
    const x = wristMidX(f.landmarks);
    const y = wristMidY(f.landmarks);
    if (x != null && y != null) out.push({ t: f.t, x, y });
  }
  return out;
}

function phaseLookup(
  reps: GenericRep[],
  t: number,
  labels: { rest: string; down: string; bottom: string; up: string },
): string {
  const rep = reps.find((r) => t >= r.startT && t <= r.endT + 0.05);
  if (!rep) return labels.rest;
  if (t < rep.peakT - 0.05) return labels.down;
  if (t <= rep.peakT + Math.max(0.05, rep.pauseSec)) return labels.bottom;
  return labels.up;
}

function baseResult(
  partial: Omit<GymAnalysisResult, "phaseAt" | "gaugeAt" | "analyzedAt"> & {
    phaseAt?: GymAnalysisResult["phaseAt"];
    gaugeAt?: GymAnalysisResult["gaugeAt"];
  },
): GymAnalysisResult {
  return {
    ...partial,
    phaseAt:
      partial.phaseAt ??
      ((t) => phaseLookup(partial.reps, t, { rest: "REST", down: "LOWER", bottom: "BOTTOM", up: "PRESS" })),
    gaugeAt:
      partial.gaugeAt ??
      ((t) => {
        const s = partial.signal.reduce((best, cur) =>
          Math.abs(cur.t - t) < Math.abs(best.t - t) ? cur : best,
        partial.signal[0] ?? { t: 0, v: 0 });
        return s?.v ?? 0;
      }),
    analyzedAt: Date.now(),
  };
}

/** Pull-up: reuse battle-tested detector, adapt to gym result. */
export function analyzePullUpGym(
  frames: PoseFrame[],
  calibration: GymCalibration,
  duration: number,
  videoWidth: number,
  videoHeight: number,
  trackingConfidence: number,
): GymAnalysisResult {
  const def = getExercise("pull_up")!;
  const { hangY, topY } = calibrateHeightRange(frames);
  const pullCal = {
    barY: calibration.referenceY ?? 0.18,
    bodyWeightKg: calibration.bodyWeightKg,
    heightCm: calibration.heightCm,
    addedWeightKg: calibration.externalLoadKg ?? 0,
    metersPerImageHeight: calibration.metersPerImageHeight,
  };
  const repsRaw = detectReps(frames, hangY, topY, pullCal);
  const reps: GenericRep[] = repsRaw.map((r) => ({
    index: r.index,
    startT: r.startT,
    peakT: r.peakT,
    endT: r.endT,
    peakNorm: r.peakHeightNorm,
    bottomNorm: 0,
    concentricSec: r.upDuration,
    eccentricSec: r.downDuration,
    pauseSec: 0,
    peakSpeedNorm: r.peakSpeedNorm,
    peakSpeedMs: r.peakSpeedMs,
    romNorm: r.romNorm,
    romCm: r.romCm,
    elbowL: r.elbowAtTopL,
    elbowR: r.elbowAtTopR,
    kneeL: null,
    kneeR: null,
    hipAngle: null,
    torsoAngle: null,
    lockOut: r.lockOut,
    autoGrade: r.autoGrade,
    grade: r.grade,
    quality: r.quality,
    workJ: r.workJ,
    peakPowerW: r.peakPowerW,
    extras: { chinClass: r.chinClass, swayNorm: r.swayNorm },
  }));

  const signal = frames
    .filter((f) => f.shoulderY != null)
    .map((f) => ({ t: f.t, v: heightNorm(f.shoulderY, hangY, topY) }));

  const notes: string[] = [];
  if (!reps.length) notes.push("No pull-up reps detected. Check bar guide and framing.");
  else {
    const short = reps.filter((r) => r.extras.chinClass === "short").length;
    if (short) notes.push(`${short} rep(s) stayed short of the bar reference.`);
    const vl = velocityLoss(reps);
    if (vl != null && vl >= 25) notes.push(`Concentric speed dropped ~${vl}% late in the set.`);
  }

  return baseResult({
    exerciseId: def.id,
    exerciseName: def.name,
    kind: "rep",
    duration,
    videoWidth,
    videoHeight,
    frames,
    signal,
    signalHang: 0,
    signalTop: 1,
    reps,
    hold: null,
    avgQuality: avgQuality(reps),
    velocityLossPct: velocityLoss(reps),
    trackingConfidence,
    calibration: { ...calibration, exerciseId: "pull_up" },
    coachingNotes: notes.length ? notes : ["Pull-up tracking looks consistent."],
    equipmentPath: equipmentPathFromFrames(frames),
    phaseAt: (t) =>
      phaseLookup(reps, t, { rest: "DEAD HANG", down: "PULL", bottom: "TOP", up: "LOWER" }),
    gaugeAt: (t) => {
      const f = frames.reduce((b, c) => (Math.abs(c.t - t) < Math.abs(b.t - t) ? c : b), frames[0]);
      return heightNorm(f?.shoulderY ?? null, hangY, topY);
    },
  });
}

/** Bench: wrist Y as bar proxy (higher y = deeper on chest). */
export function analyzeBenchGym(
  frames: PoseFrame[],
  calibration: GymCalibration,
  duration: number,
  videoWidth: number,
  videoHeight: number,
  trackingConfidence: number,
): GymAnalysisResult {
  const def = getExercise("bench_press")!;
  const raws = frames
    .map((f) => ({ t: f.t, raw: wristMidY(f.landmarks), frame: f }))
    .filter((s): s is { t: number; raw: number; frame: PoseFrame } => s.raw != null);
  const { low, high } = calibrateSignalRange(raws.map((s) => s.raw));
  // Deeper press = larger y → higher signal
  const samples = raws.map((s) => ({
    t: s.t,
    v: normSignal(s.raw, low, high),
    frame: s.frame,
  }));
  const reps = detectSignalReps(samples, calibration, undefined, (peak, end) => {
    const e = enrichFromFrame(peak.frame);
    return {
      ...e,
      lockOut: (end?.elbowL ?? 160) > 150 || (end?.elbowR ?? 160) > 150,
      extras: {
        pauseSec: 0,
        barPathNote: "Wrist midpoint used as bar proxy",
      },
    };
  });

  // Attach pause from detector already in concentric/eccentric; use pauseSec field
  const notes: string[] = [];
  if (!reps.length) notes.push("No bench reps detected. Prefer a side view with wrists visible.");
  else {
    const avgPause = reps.reduce((s, r) => s + r.pauseSec, 0) / reps.length;
    if (avgPause >= 0.4) notes.push(`Average bottom pause ~${avgPause.toFixed(2)} s.`);
    const vl = velocityLoss(reps);
    if (vl != null && vl >= 20) notes.push(`Pressing speed fell ~${vl}% across the set.`);
    const drift = equipmentPathFromFrames(frames);
    if (drift.length > 10) {
      const xs = drift.map((p) => p.x);
      const span = Math.max(...xs) - Math.min(...xs);
      if (span > 0.12) notes.push("Notable horizontal wrist/bar drift across the set.");
    }
  }

  return baseResult({
    exerciseId: def.id,
    exerciseName: def.name,
    kind: "rep",
    duration,
    videoWidth,
    videoHeight,
    frames,
    signal: samples.map((s) => ({ t: s.t, v: s.v })),
    signalHang: 0,
    signalTop: 1,
    reps,
    hold: null,
    avgQuality: avgQuality(reps),
    velocityLossPct: velocityLoss(reps),
    trackingConfidence,
    calibration: { ...calibration, exerciseId: "bench_press" },
    coachingNotes: notes.length ? notes : ["Bench tracking looks consistent."],
    equipmentPath: equipmentPathFromFrames(frames),
    phaseAt: (t) =>
      phaseLookup(reps, t, { rest: "LOCKOUT", down: "LOWER", bottom: "PAUSE", up: "PRESS" }),
  });
}

/** Deadlift: wrist Y decreases toward lockout — invert so higher signal = higher bar. */
export function analyzeDeadliftGym(
  frames: PoseFrame[],
  calibration: GymCalibration,
  duration: number,
  videoWidth: number,
  videoHeight: number,
  trackingConfidence: number,
): GymAnalysisResult {
  const def = getExercise("deadlift")!;
  const raws = frames
    .map((f) => ({ t: f.t, raw: wristMidY(f.landmarks), hip: hipMidY(f.landmarks), sh: shoulderMidY(f.landmarks), frame: f }))
    .filter((s): s is { t: number; raw: number; hip: number | null; sh: number | null; frame: PoseFrame } => s.raw != null);
  const { low, high } = calibrateSignalRange(raws.map((s) => s.raw));
  // Invert: floor (high y) → 0, lockout (low y) → 1
  const samples = raws.map((s) => ({
    t: s.t,
    v: 1 - normSignal(s.raw, low, high),
    frame: s.frame,
    hip: s.hip,
    sh: s.sh,
  }));

  const reps = detectSignalReps(samples, calibration, {
    enter: 0.15,
    peak: 0.7,
    exit: 0.18,
    minConcentric: 0.25,
    minEccentric: 0.2,
    minRom: 0.25,
    deeperIsHigher: true,
  }, (peak) => {
    const e = enrichFromFrame(peak.frame);
    return { ...e, lockOut: true, extras: { stickingHint: "See velocity chart for slow region" } };
  });

  const notes: string[] = [];
  if (!reps.length) notes.push("No deadlift reps detected. Side/three-quarter view with bar & body visible works best.");
  else {
    // Hip rising before bar: compare early concentric hip vs wrist motion on first rep
    let hipLead = 0;
    for (const rep of reps) {
      const window = samples.filter((s) => s.t >= rep.startT && s.t <= rep.peakT);
      if (window.length < 4) continue;
      const early = window.slice(0, Math.ceil(window.length / 3));
      const hipMove = (early[0].hip ?? 0) - (early[early.length - 1].hip ?? 0);
      const barMove = early[early.length - 1].v - early[0].v;
      if (hipMove > 0.04 && barMove < 0.15) hipLead += 1;
    }
    if (hipLead >= Math.ceil(reps.length / 2)) {
      notes.push("Hips often rose early relative to bar travel — check setup and initial pull.");
    }
    const vl = velocityLoss(reps);
    if (vl != null && vl >= 20) notes.push(`Lockout-side speed dropped ~${vl}% late in the set.`);
  }

  return baseResult({
    exerciseId: def.id,
    exerciseName: def.name,
    kind: "rep",
    duration,
    videoWidth,
    videoHeight,
    frames,
    signal: samples.map((s) => ({ t: s.t, v: s.v })),
    signalHang: 0,
    signalTop: 1,
    reps,
    hold: null,
    avgQuality: avgQuality(reps),
    velocityLossPct: velocityLoss(reps),
    trackingConfidence,
    calibration: { ...calibration, exerciseId: "deadlift" },
    coachingNotes: notes.length ? notes : ["Deadlift tracking looks consistent."],
    equipmentPath: equipmentPathFromFrames(frames),
    phaseAt: (t) =>
      phaseLookup(reps, t, { rest: "FLOOR", down: "PULL", bottom: "LOCKOUT", up: "LOWER" }),
  });
}

/** Squat: hip Y increases as athlete descends. */
export function analyzeSquatGym(
  frames: PoseFrame[],
  calibration: GymCalibration,
  duration: number,
  videoWidth: number,
  videoHeight: number,
  trackingConfidence: number,
): GymAnalysisResult {
  const def = getExercise("squat")!;
  const raws = frames
    .map((f) => ({ t: f.t, raw: hipMidY(f.landmarks), frame: f }))
    .filter((s): s is { t: number; raw: number; frame: PoseFrame } => s.raw != null);
  const { low, high } = calibrateSignalRange(raws.map((s) => s.raw));
  const samples = raws.map((s) => ({
    t: s.t,
    v: normSignal(s.raw, low, high),
    frame: s.frame,
  }));

  const reps = detectSignalReps(samples, calibration, {
    enter: 0.2,
    peak: 0.55,
    exit: 0.22,
    minConcentric: 0.25,
    minEccentric: 0.2,
    minRom: 0.22,
    deeperIsHigher: true,
  }, (peak) => {
    const e = enrichFromFrame(peak.frame);
    const depth: GenericRep["depthClass"] =
      peak.v >= 0.75 ? "below" : peak.v >= 0.55 ? "parallel" : peak.v >= 0.35 ? "above" : "uncertain";
    return { ...e, depthClass: depth, extras: { depthClass: depth } };
  });

  const notes: string[] = [];
  if (!reps.length) notes.push("No squat reps detected. A clear side view helps depth estimation.");
  else {
    const depths = reps.map((r) => r.depthClass);
    const below = depths.filter((d) => d === "below").length;
    const above = depths.filter((d) => d === "above").length;
    if (above > below) notes.push("Several reps estimated above parallel — verify camera angle.");
    else if (below) notes.push(`${below}/${reps.length} reps estimated at or below parallel (heuristic).`);
    notes.push("Depth is an estimate from hip landmarks — not a competition ruling.");
  }

  return baseResult({
    exerciseId: def.id,
    exerciseName: def.name,
    kind: "rep",
    duration,
    videoWidth,
    videoHeight,
    frames,
    signal: samples.map((s) => ({ t: s.t, v: s.v })),
    signalHang: 0,
    signalTop: 1,
    reps,
    hold: null,
    avgQuality: avgQuality(reps),
    velocityLossPct: velocityLoss(reps),
    trackingConfidence,
    calibration: { ...calibration, exerciseId: "squat" },
    coachingNotes: notes,
    equipmentPath: equipmentPathFromFrames(frames),
    phaseAt: (t) =>
      phaseLookup(reps, t, { rest: "STANDING", down: "DESCENT", bottom: "BOTTOM", up: "ASCENT" }),
  });
}

/** Crunch: smaller shoulder–hip distance = more flexion → invert distance to flexion signal. */
export function analyzeCrunchGym(
  frames: PoseFrame[],
  calibration: GymCalibration,
  duration: number,
  videoWidth: number,
  videoHeight: number,
  trackingConfidence: number,
): GymAnalysisResult {
  const def = getExercise("crunch")!;
  const raws = frames
    .map((f) => ({ t: f.t, raw: crunchFlexion(f.landmarks), frame: f }))
    .filter((s): s is { t: number; raw: number; frame: PoseFrame } => s.raw != null);
  const { low, high } = calibrateSignalRange(raws.map((s) => s.raw));
  // Smaller distance = more flexed → invert
  const samples = raws.map((s) => ({
    t: s.t,
    v: 1 - normSignal(s.raw, low, high),
    frame: s.frame,
  }));

  const reps = detectSignalReps(samples, calibration, {
    enter: 0.2,
    peak: 0.5,
    exit: 0.22,
    minConcentric: 0.15,
    minEccentric: 0.12,
    minRom: 0.2,
    deeperIsHigher: true,
  }, (peak) => {
    const e = enrichFromFrame(peak.frame);
    return { ...e, extras: { flexionPeak: peak.v } };
  });

  const notes: string[] = [];
  if (!reps.length) notes.push("No crunch reps detected. Side view with torso visible works best.");
  else {
    const avgUp = reps.reduce((s, r) => s + r.concentricSec, 0) / reps.length;
    notes.push(`Average crunch tempo ~${avgUp.toFixed(2)} s up.`);
  }

  return baseResult({
    exerciseId: def.id,
    exerciseName: def.name,
    kind: "rep",
    duration,
    videoWidth,
    videoHeight,
    frames,
    signal: samples.map((s) => ({ t: s.t, v: s.v })),
    signalHang: 0,
    signalTop: 1,
    reps,
    hold: null,
    avgQuality: avgQuality(reps),
    velocityLossPct: velocityLoss(reps),
    trackingConfidence,
    calibration: { ...calibration, exerciseId: "crunch" },
    coachingNotes: notes.length ? notes : ["Crunch tracking looks consistent."],
    equipmentPath: [],
    phaseAt: (t) =>
      phaseLookup(reps, t, { rest: "EXTENDED", down: "FLEXION", bottom: "PEAK", up: "RETURN" }),
  });
}

export function runExerciseAnalyzer(
  exerciseId: string,
  frames: PoseFrame[],
  calibration: GymCalibration,
  meta: { duration: number; videoWidth: number; videoHeight: number; trackingConfidence: number },
): GymAnalysisResult {
  const args = [
    frames,
    { ...calibration, exerciseId },
    meta.duration,
    meta.videoWidth,
    meta.videoHeight,
    meta.trackingConfidence,
  ] as const;

  switch (exerciseId) {
    case "pull_up":
      return analyzePullUpGym(...args);
    case "bench_press":
      return analyzeBenchGym(...args);
    case "deadlift":
      return analyzeDeadliftGym(...args);
    case "squat":
      return analyzeSquatGym(...args);
    case "crunch":
      return analyzeCrunchGym(...args);
    default:
      throw new Error(
        `Exercise "${exerciseId}" is listed but not implemented yet. Choose a Ready exercise.`,
      );
  }
}
