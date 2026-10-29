import type { LandmarkPoint, PoseFrame, RepGrade } from "@/lib/pullup/types";

export type ExerciseStatus = "ready" | "planned";

export type ExerciseCategory =
  | "powerlifting"
  | "bodybuilding"
  | "calisthenics"
  | "core";

export type MovementKind = "rep" | "hold" | "alternating";

export type CameraHint = "side" | "front" | "three-quarter" | "any";

export type ExerciseDefinition = {
  id: string;
  name: string;
  category: ExerciseCategory;
  kind: MovementKind;
  status: ExerciseStatus;
  blurb: string;
  cameraHint: CameraHint;
  /** Muscle regions highlighted in estimated effort map. */
  effortFocus: string[];
  /** Side-gauge label shown during analysis. */
  gaugeLabel: string;
  graphTitle: string;
  graphSubtitle: string;
};

export type GymCalibration = {
  exerciseId: string;
  bodyWeightKg: number | null;
  heightCm: number | null;
  externalLoadKg: number | null;
  mirrored: boolean;
  /** Optional horizontal reference (bar / floor / depth) in image y 0–1. */
  referenceY: number | null;
  metersPerImageHeight: number | null;
  cameraView: CameraHint;
};

export type GenericRep = {
  index: number;
  startT: number;
  peakT: number;
  endT: number;
  /** Primary signal peak (0–1 within set range). */
  peakNorm: number;
  bottomNorm: number;
  concentricSec: number;
  eccentricSec: number;
  pauseSec: number;
  peakSpeedNorm: number;
  peakSpeedMs: number | null;
  romNorm: number;
  romCm: number | null;
  elbowL: number | null;
  elbowR: number | null;
  kneeL: number | null;
  kneeR: number | null;
  hipAngle: number | null;
  torsoAngle: number | null;
  depthClass?: "below" | "parallel" | "above" | "uncertain";
  lockOut: boolean;
  autoGrade: RepGrade;
  grade: RepGrade;
  quality: number;
  workJ: number | null;
  peakPowerW: number | null;
  extras: Record<string, string | number | boolean | null>;
};

export type HoldSegment = {
  startT: number;
  endT: number;
  durationSec: number;
  alignmentScore: number;
  notes: string[];
};

export type GymAnalysisResult = {
  exerciseId: string;
  exerciseName: string;
  kind: MovementKind;
  duration: number;
  videoWidth: number;
  videoHeight: number;
  frames: PoseFrame[];
  /** Primary scalar series used for the main graph (0–1). */
  signal: Array<{ t: number; v: number }>;
  signalHang: number;
  signalTop: number;
  reps: GenericRep[];
  hold: HoldSegment | null;
  avgQuality: number;
  velocityLossPct: number | null;
  trackingConfidence: number;
  calibration: GymCalibration;
  coachingNotes: string[];
  phaseAt: (t: number) => string;
  gaugeAt: (t: number) => number;
  analyzedAt: number;
  /** Equipment path samples (normalized x,y) when available. */
  equipmentPath: Array<{ t: number; x: number; y: number }>;
};

export type { LandmarkPoint, PoseFrame, RepGrade };
