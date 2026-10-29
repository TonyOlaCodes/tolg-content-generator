/** Timeline + biomechanics for the Pull Up Analysis demo, keyed to the reference reel. */

export type Phase = "HANDS ON BAR" | "PULL" | "LOWER" | "DEAD HANG";
export type RepGrade = "full" | "at_bar" | "short" | "pending" | "current";

export type RepResult = {
  index: number;
  grade: Exclude<RepGrade, "pending" | "current">;
  peakHeight: number; // 0–100 relative to best
  peakSpeed: number;
  upSec: number;
  downSec: number;
  lockOut: boolean;
  efficiency: number;
  elbowL: number;
  elbowR: number;
  swayCm: number;
  workKj: number;
  peakPowerW: number;
  kcal: number;
};

export type LiveFrame = {
  t: number; // seconds into set
  reps: number;
  phase: Phase;
  elbow: number;
  speed: number;
  energyKcal: number;
  fatiguePct: number;
  chinProgress: number; // 0–1 toward bar
  shoulderHeight: number; // 0–100
  muscleHeat: number; // 0–1
  barY: number; // normalized 0–1 from top of frame
  /** Normalized joint positions in view space (x 0–1 left→right, y 0–1 top→bottom). */
  joints: Record<JointId, { x: number; y: number }>;
  currentRepDetail: null | {
    upSec: number;
    downSec: number;
    peakSpeed: number;
    kcal: number;
    effort: number;
    watts: number;
    swayCm: number;
    elbowGap: number;
    lockOut: boolean;
  };
  efficiencyLive: number | null;
  efficiencyLabel: string | null;
  showSummary: boolean;
};

export type JointId =
  | "nose"
  | "lShoulder"
  | "rShoulder"
  | "lElbow"
  | "rElbow"
  | "lWrist"
  | "rWrist"
  | "lHip"
  | "rHip"
  | "lKnee"
  | "rKnee"
  | "lAnkle"
  | "rAnkle";

export const SET_DURATION = 58; // matches 0:58 reel length
export const TOTAL_REPS = 10;

/** Final set results matching the SET SUMMARY screenshot. */
export const SET_SUMMARY = {
  reps: 10,
  avgEfficiency: 92,
  chinAbove: 4,
  atBar: 5,
  short: 1,
  lockOut: "10 / 10",
  romCm: 56,
  tempoUp: 1.5,
  tempoDown: 1.4,
  peakBest: 0.93,
  peakLast: 0.5,
  peakDropPct: 46,
  hipSway: 4,
  elbowL: 65,
  elbowR: 81,
  workKj: 4.1,
  peakPowerW: 852,
  energyKcal: 9,
  lastEffort: 1.7,
  repsLeft: 0,
  heightCm: 188,
  weightKg: 79,
  yoloReps: 10,
} as const;

/** Per-rep grades from the timeline strip in the summary frame. */
export const REP_RESULTS: RepResult[] = [
  { index: 1, grade: "full", peakHeight: 100, peakSpeed: 0.93, upSec: 1.4, downSec: 1.3, lockOut: true, efficiency: 99, elbowL: 62, elbowR: 64, swayCm: 3, workKj: 0.42, peakPowerW: 852, kcal: 0.95 },
  { index: 2, grade: "full", peakHeight: 98, peakSpeed: 0.91, upSec: 1.4, downSec: 1.3, lockOut: true, efficiency: 98, elbowL: 63, elbowR: 66, swayCm: 3, workKj: 0.41, peakPowerW: 820, kcal: 0.93 },
  { index: 3, grade: "full", peakHeight: 97, peakSpeed: 0.89, upSec: 1.45, downSec: 1.35, lockOut: true, efficiency: 97, elbowL: 64, elbowR: 68, swayCm: 4, workKj: 0.41, peakPowerW: 790, kcal: 0.92 },
  { index: 4, grade: "full", peakHeight: 95, peakSpeed: 0.86, upSec: 1.5, downSec: 1.4, lockOut: true, efficiency: 96, elbowL: 64, elbowR: 70, swayCm: 4, workKj: 0.41, peakPowerW: 760, kcal: 0.91 },
  { index: 5, grade: "at_bar", peakHeight: 88, peakSpeed: 0.78, upSec: 1.55, downSec: 1.4, lockOut: true, efficiency: 97, elbowL: 65, elbowR: 74, swayCm: 4, workKj: 0.4, peakPowerW: 680, kcal: 0.9 },
  { index: 6, grade: "at_bar", peakHeight: 86, peakSpeed: 0.74, upSec: 1.4, downSec: 1.4, lockOut: true, efficiency: 97, elbowL: 65, elbowR: 76, swayCm: 4, workKj: 0.4, peakPowerW: 640, kcal: 0.92 },
  { index: 7, grade: "at_bar", peakHeight: 82, peakSpeed: 0.68, upSec: 1.6, downSec: 1.45, lockOut: true, efficiency: 94, elbowL: 66, elbowR: 78, swayCm: 5, workKj: 0.39, peakPowerW: 590, kcal: 0.88 },
  { index: 8, grade: "at_bar", peakHeight: 78, peakSpeed: 0.62, upSec: 1.65, downSec: 1.5, lockOut: true, efficiency: 91, elbowL: 66, elbowR: 79, swayCm: 5, workKj: 0.39, peakPowerW: 540, kcal: 0.86 },
  { index: 9, grade: "at_bar", peakHeight: 74, peakSpeed: 0.56, upSec: 1.7, downSec: 1.5, lockOut: true, efficiency: 88, elbowL: 67, elbowR: 80, swayCm: 5, workKj: 0.38, peakPowerW: 480, kcal: 0.84 },
  { index: 10, grade: "short", peakHeight: 62, peakSpeed: 0.5, upSec: 1.8, downSec: 1.55, lockOut: true, efficiency: 72, elbowL: 70, elbowR: 81, swayCm: 6, workKj: 0.35, peakPowerW: 420, kcal: 0.8 },
];

const REP_START = 4.5; // first pull begins
const REP_PERIOD = 4.85; // ~up+down+hang

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/** Ease in/out for concentric / eccentric. */
function pullCurve(u: number): number {
  // 0 hang → 1 chin above bar
  if (u < 0.48) return smoothstep(u / 0.48);
  if (u < 0.55) return 1;
  return 1 - smoothstep((u - 0.55) / 0.45);
}

function jointsForHeight(
  height01: number,
  sway: number,
): Record<JointId, { x: number; y: number }> {
  // Athlete centered; bar near top. height01: 0 = dead hang, 1 = chin above.
  const cx = 0.5 + sway * 0.012;
  const barY = 0.175;
  const hangShoulder = 0.42;
  const topShoulder = 0.22;
  const shoulderY = lerp(hangShoulder, topShoulder, height01);
  const hipDrop = lerp(0.62, 0.48, height01);
  const elbowBend = lerp(155, 55, height01); // degrees open → closed
  const elbowRad = ((180 - elbowBend) * Math.PI) / 180;

  const shoulderSpread = 0.07;
  const wristSpread = 0.11;
  // Wrists fixed on bar
  const lWrist = { x: cx - wristSpread, y: barY };
  const rWrist = { x: cx + wristSpread, y: barY };
  const lShoulder = { x: cx - shoulderSpread, y: shoulderY };
  const rShoulder = { x: cx + shoulderSpread, y: shoulderY };

  // Elbows hang between wrist and shoulder with bend
  const elbowOut = 0.04 + (1 - height01) * 0.02;
  const lElbow = {
    x: cx - shoulderSpread - elbowOut * Math.sin(elbowRad),
    y: lerp(lWrist.y, lShoulder.y, 0.45) + (1 - height01) * 0.04,
  };
  const rElbow = {
    x: cx + shoulderSpread + elbowOut * Math.sin(elbowRad),
    y: lerp(rWrist.y, rShoulder.y, 0.45) + (1 - height01) * 0.04,
  };

  const lHip = { x: cx - 0.035 + sway * 0.008, y: hipDrop };
  const rHip = { x: cx + 0.035 + sway * 0.008, y: hipDrop };
  const kneeY = hipDrop + 0.16;
  const ankleY = hipDrop + 0.32;
  const legSway = sway * 0.01;

  return {
    nose: { x: cx, y: shoulderY - 0.055 },
    lShoulder,
    rShoulder,
    lElbow,
    rElbow,
    lWrist,
    rWrist,
    lHip,
    rHip,
    lKnee: { x: cx - 0.03 + legSway, y: kneeY },
    rKnee: { x: cx + 0.03 + legSway, y: kneeY },
    lAnkle: { x: cx - 0.028 + legSway * 1.2, y: ankleY },
    rAnkle: { x: cx + 0.028 + legSway * 1.2, y: ankleY },
  };
}

export function sampleShoulderSeries(untilT: number, samples = 120): Array<{ t: number; h: number; rep: number }> {
  const out: Array<{ t: number; h: number; rep: number }> = [];
  for (let i = 0; i < samples; i++) {
    const t = (i / (samples - 1)) * untilT;
    const frame = sampleFrame(t);
    out.push({ t, h: frame.shoulderHeight, rep: frame.reps });
  }
  return out;
}

export function sampleFrame(tRaw: number): LiveFrame {
  const t = clamp(tRaw, 0, SET_DURATION + 8);
  const showSummary = t >= SET_DURATION;

  if (t < REP_START) {
    // Hands on bar setup
    const height01 = 0.02 + Math.sin(t * 1.2) * 0.01;
    return {
      t,
      reps: 0,
      phase: "HANDS ON BAR",
      elbow: 155,
      speed: 0.01 + Math.abs(Math.sin(t * 2)) * 0.02,
      energyKcal: 0,
      fatiguePct: 0,
      chinProgress: height01 * 0.15,
      shoulderHeight: height01 * 8,
      muscleHeat: 0.15,
      barY: 0.175,
      joints: jointsForHeight(height01, Math.sin(t * 0.8)),
      currentRepDetail: null,
      efficiencyLive: null,
      efficiencyLabel: null,
      showSummary: false,
    };
  }

  if (showSummary) {
    const last = REP_RESULTS[REP_RESULTS.length - 1];
    return {
      t,
      reps: 10,
      phase: "DEAD HANG",
      elbow: 155,
      speed: 0.02,
      energyKcal: SET_SUMMARY.energyKcal,
      fatiguePct: 46,
      chinProgress: 0.05,
      shoulderHeight: 5,
      muscleHeat: 0.2,
      barY: 0.175,
      joints: jointsForHeight(0.05, 0),
      currentRepDetail: {
        upSec: last.upSec,
        downSec: last.downSec,
        peakSpeed: last.peakSpeed,
        kcal: last.kcal,
        effort: SET_SUMMARY.lastEffort,
        watts: last.peakPowerW,
        swayCm: last.swayCm,
        elbowGap: Math.abs(last.elbowR - last.elbowL),
        lockOut: last.lockOut,
      },
      efficiencyLive: SET_SUMMARY.avgEfficiency,
      efficiencyLabel: null,
      showSummary: true,
    };
  }

  const elapsed = t - REP_START;
  const repFloat = elapsed / REP_PERIOD;
  const completed = clamp(Math.floor(repFloat), 0, TOTAL_REPS);
  const inRep = completed < TOTAL_REPS;
  const u = inRep ? repFloat - completed : 1;
  const result = REP_RESULTS[clamp(completed, 0, TOTAL_REPS - 1)];
  const peakScale = result.peakHeight / 100;
  const height01 = inRep ? pullCurve(u) * peakScale : 0.04;
  const prevH = inRep ? pullCurve(Math.max(0, u - 0.02)) * peakScale : height01;
  // Scale so mid-rep speeds land near the reel (~0.4–0.7 m/s), peaking near result.peakSpeed
  const rawSpeed = Math.abs(height01 - prevH) * 14;
  const speed = clamp(Math.min(rawSpeed, result.peakSpeed * 1.05), 0.01, 1.0);

  let phase: Phase = "DEAD HANG";
  if (inRep) {
    if (u < 0.08) phase = "DEAD HANG";
    else if (u < 0.52) phase = "PULL";
    else phase = "LOWER";
  }

  const energy = REP_RESULTS.slice(0, completed).reduce((s, r) => s + r.kcal, 0) + (inRep ? result.kcal * clamp(u, 0, 1) : 0);
  const bestSpeed = REP_RESULTS[0].peakSpeed;
  const fatigue = clamp(((bestSpeed - (result.peakSpeed || bestSpeed)) / bestSpeed) * 100, 0, 60);

  // Match screenshot elbow angles roughly by height
  const elbow = Math.round(lerp(155, 55, height01));

  const chinProgress = clamp(height01 / 0.92, 0, 1.05);
  const muscleHeat = clamp(0.25 + height01 * 0.55 + (phase === "PULL" ? 0.2 : 0), 0, 1);

  let currentRepDetail: LiveFrame["currentRepDetail"] = null;
  let efficiencyLive: number | null = null;
  let efficiencyLabel: string | null = null;

  if (inRep && u > 0.48 && u < 0.72) {
    // Near top of rep — show REP detail card like screenshot at rep 6
    currentRepDetail = {
      upSec: result.upSec,
      downSec: result.downSec,
      peakSpeed: result.peakSpeed,
      kcal: result.kcal,
      effort: 1 + completed * 0.07,
      watts: Math.round(result.peakPowerW * (0.35 + height01 * 0.4)),
      swayCm: result.swayCm,
      elbowGap: Math.abs(result.elbowR - result.elbowL),
      lockOut: result.lockOut && height01 < 0.25,
    };
    if (result.grade === "full") {
      efficiencyLive = result.efficiency;
      efficiencyLabel = "CHIN ABOVE BAR";
    } else if (result.grade === "at_bar") {
      efficiencyLive = result.efficiency;
      efficiencyLabel = "CHIN AT BAR";
    } else {
      efficiencyLive = result.efficiency;
      efficiencyLabel = "SHORT";
    }
  }

  // After lock-out at bottom of rep, briefly show FULL LOCK-OUT
  if (inRep && u > 0.9 && result.lockOut) {
    currentRepDetail = {
      upSec: result.upSec,
      downSec: result.downSec,
      peakSpeed: result.peakSpeed,
      kcal: result.kcal,
      effort: 1 + completed * 0.07,
      watts: Math.round(result.peakPowerW * 0.34),
      swayCm: result.swayCm,
      elbowGap: Math.abs(result.elbowR - result.elbowL),
      lockOut: true,
    };
  }

  const sway = Math.sin(t * 2.1 + completed) * (0.4 + completed * 0.08);

  return {
    t,
    reps: completed,
    phase: phase === "DEAD HANG" && completed === 0 ? "HANDS ON BAR" : phase === "DEAD HANG" ? "LOWER" : phase,
    elbow,
    speed: Number(speed.toFixed(2)),
    energyKcal: Number(energy.toFixed(1)),
    fatiguePct: Math.round(fatigue),
    chinProgress,
    shoulderHeight: height01 * 100,
    muscleHeat,
    barY: 0.175,
    joints: jointsForHeight(height01, sway),
    currentRepDetail,
    efficiencyLive,
    efficiencyLabel,
    showSummary: false,
  };
}

export function repStatusAt(repsCompleted: number, showSummary: boolean): Array<{
  n: number;
  kind: "check" | "tilde" | "x" | "num" | "current";
}> {
  return REP_RESULTS.map((r) => {
    if (showSummary || repsCompleted >= r.index) {
      if (r.grade === "full") return { n: r.index, kind: "check" as const };
      if (r.grade === "at_bar") return { n: r.index, kind: "tilde" as const };
      return { n: r.index, kind: "x" as const };
    }
    if (repsCompleted + 1 === r.index) return { n: r.index, kind: "current" as const };
    return { n: r.index, kind: "num" as const };
  });
}
