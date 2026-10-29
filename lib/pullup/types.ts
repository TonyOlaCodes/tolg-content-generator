/** Shared types for real pull-up video analysis. */

export type Phase =
  | "HANDS ON BAR"
  | "DEAD HANG"
  | "PULL"
  | "TOP"
  | "LOWER"
  | "REST"
  | "NO POSE";

export type RepGrade = "valid" | "partial" | "failed";

export type LandmarkPoint = {
  x: number;
  y: number;
  z: number;
  visibility: number;
  presence: number;
};

export type PoseFrame = {
  t: number; // seconds
  landmarks: LandmarkPoint[] | null;
  /** Mid-shoulder y in image coords (0 top → 1 bottom). Null if no pose. */
  shoulderY: number | null;
  /** Mid-hip y. */
  hipY: number | null;
  /** Nose y for chin estimate. */
  noseY: number | null;
  elbowL: number | null;
  elbowR: number | null;
  confidence: number;
};

export type UserCalibration = {
  barY: number; // 0–1 in video image space (top → bottom)
  bodyWeightKg: number | null;
  heightCm: number | null;
  addedWeightKg: number;
  /** Optional: meters represented by full video height for scale. */
  metersPerImageHeight: number | null;
};

export type RepRecord = {
  index: number;
  startT: number;
  peakT: number;
  endT: number;
  peakHeightNorm: number; // 0 hang → 1 best-top within set
  peakShoulderY: number;
  bottomShoulderY: number;
  upDuration: number;
  downDuration: number;
  peakSpeedNorm: number; // normalized units / s
  peakSpeedMs: number | null; // m/s if calibrated
  elbowAtTopL: number | null;
  elbowAtTopR: number | null;
  romNorm: number;
  romCm: number | null;
  swayNorm: number;
  swayCm: number | null;
  lockOut: boolean;
  chinClass: "above" | "at" | "short" | "uncertain";
  autoGrade: RepGrade;
  grade: RepGrade; // may be manually overridden
  quality: number; // 0–100 heuristic
  workJ: number | null;
  peakPowerW: number | null;
};

export type AnalysisResult = {
  duration: number;
  videoWidth: number;
  videoHeight: number;
  frames: PoseFrame[];
  hangShoulderY: number;
  bestTopShoulderY: number;
  reps: RepRecord[];
  avgQuality: number;
  velocityLossPct: number | null;
  trackingConfidence: number;
  calibration: UserCalibration;
  coachingNotes: string[];
  analyzedAt: number;
};

export type PlaybackSnapshot = {
  t: number;
  frame: PoseFrame | null;
  repsCompleted: number;
  currentRep: RepRecord | null;
  phase: Phase;
  shoulderHeightPct: number;
  chinProgress: number;
  speedNorm: number;
  speedMs: number | null;
  energyEstimateJ: number | null;
  fatiguePct: number | null;
  elbowDisplay: number | null;
};
