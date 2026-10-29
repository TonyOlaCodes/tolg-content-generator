/**
 * Unit tests for gym signal rep detection & exercise analyzers (no MediaPipe / DOM).
 * Run: npx tsx tests/gym/signal-reps.test.ts
 */

import assert from "node:assert/strict";
import {
  analyzeBenchGym,
  analyzeCrunchGym,
  analyzeDeadliftGym,
  analyzeSquatGym,
  runExerciseAnalyzer,
} from "../../lib/gym/analyzers";
import { calibrateSignalRange, detectSignalReps, normSignal } from "../../lib/gym/signal-reps";
import { readyExercises, getExercise } from "../../lib/gym/registry";
import type { GymCalibration } from "../../lib/gym/types";
import type { LandmarkPoint, PoseFrame } from "../../lib/pullup/types";

function lm(partial: Partial<Record<number, { x: number; y: number }>>): LandmarkPoint[] {
  const out: LandmarkPoint[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.1,
    presence: 0.1,
  }));
  for (const [k, v] of Object.entries(partial)) {
    const i = Number(k);
    out[i] = {
      x: v!.x,
      y: v!.y,
      z: 0,
      visibility: 0.95,
      presence: 0.95,
    };
  }
  return out;
}

/** MediaPipe indices used by joints helpers. */
const L = {
  lShoulder: 11,
  rShoulder: 12,
  lElbow: 13,
  rElbow: 14,
  lWrist: 15,
  rWrist: 16,
  lHip: 23,
  rHip: 24,
  lKnee: 25,
  rKnee: 26,
  lAnkle: 27,
  rAnkle: 28,
};

function pose(
  t: number,
  opts: {
    wristY: number;
    hipY?: number;
    shoulderY?: number;
    elbow?: number;
  },
): PoseFrame {
  const hipY = opts.hipY ?? opts.wristY + 0.15;
  const shoulderY = opts.shoulderY ?? opts.wristY - 0.12;
  const landmarks = lm({
    [L.lWrist]: { x: 0.42, y: opts.wristY },
    [L.rWrist]: { x: 0.58, y: opts.wristY },
    [L.lShoulder]: { x: 0.4, y: shoulderY },
    [L.rShoulder]: { x: 0.6, y: shoulderY },
    [L.lElbow]: { x: 0.38, y: (opts.wristY + shoulderY) / 2 },
    [L.rElbow]: { x: 0.62, y: (opts.wristY + shoulderY) / 2 },
    [L.lHip]: { x: 0.42, y: hipY },
    [L.rHip]: { x: 0.58, y: hipY },
    [L.lKnee]: { x: 0.42, y: hipY + 0.18 },
    [L.rKnee]: { x: 0.58, y: hipY + 0.18 },
    [L.lAnkle]: { x: 0.42, y: hipY + 0.32 },
    [L.rAnkle]: { x: 0.58, y: hipY + 0.32 },
  });
  return {
    t,
    landmarks,
    shoulderY,
    hipY,
    noseY: shoulderY - 0.05,
    elbowL: opts.elbow ?? 150,
    elbowR: opts.elbow ?? 150,
    confidence: 0.9,
  };
}

const cal: GymCalibration = {
  exerciseId: "bench_press",
  bodyWeightKg: 80,
  heightCm: 180,
  externalLoadKg: 100,
  mirrored: false,
  referenceY: null,
  metersPerImageHeight: null,
  cameraView: "side",
};

/** Synthetic deeper-is-higher signal: rest → down → pause → up, n times. */
function syntheticDeepReps(n: number): Array<{ t: number; v: number }> {
  const out: Array<{ t: number; v: number }> = [];
  let t = 0;
  out.push({ t, v: 0.05 });
  t += 0.2;
  for (let r = 0; r < n; r++) {
    for (let i = 0; i <= 8; i++) {
      out.push({ t, v: 0.05 + (0.85 * i) / 8 });
      t += 0.08;
    }
    out.push({ t, v: 0.9 });
    t += 0.12;
    for (let i = 0; i <= 8; i++) {
      out.push({ t, v: 0.9 - (0.85 * i) / 8 });
      t += 0.08;
    }
    out.push({ t, v: 0.05 });
    t += 0.2;
  }
  return out;
}

function syntheticBenchFrames(reps: number): PoseFrame[] {
  const frames: PoseFrame[] = [];
  let t = 0;
  const lock = 0.28;
  const chest = 0.48;
  frames.push(pose(t, { wristY: lock, elbow: 165 }));
  t += 0.15;
  for (let r = 0; r < reps; r++) {
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      frames.push(pose(t, { wristY: lock + (chest - lock) * u, elbow: 165 - 70 * u }));
      t += 0.07;
    }
    frames.push(pose(t, { wristY: chest, elbow: 95 }));
    t += 0.15;
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      frames.push(pose(t, { wristY: chest + (lock - chest) * u, elbow: 95 + 70 * u }));
      t += 0.07;
    }
    frames.push(pose(t, { wristY: lock, elbow: 165 }));
    t += 0.2;
  }
  return frames;
}

function syntheticDeadliftFrames(reps: number): PoseFrame[] {
  const frames: PoseFrame[] = [];
  let t = 0;
  const floor = 0.72;
  const lock = 0.38;
  frames.push(pose(t, { wristY: floor, hipY: 0.55, shoulderY: 0.4 }));
  t += 0.15;
  for (let r = 0; r < reps; r++) {
    for (let i = 0; i <= 12; i++) {
      const u = i / 12;
      const wy = floor + (lock - floor) * u;
      frames.push(
        pose(t, {
          wristY: wy,
          hipY: 0.55 + (0.42 - 0.55) * u,
          shoulderY: 0.4 + (0.28 - 0.4) * u,
          elbow: 170,
        }),
      );
      t += 0.07;
    }
    frames.push(pose(t, { wristY: lock, hipY: 0.42, shoulderY: 0.28, elbow: 175 }));
    t += 0.12;
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      frames.push(
        pose(t, {
          wristY: lock + (floor - lock) * u,
          hipY: 0.42 + (0.55 - 0.42) * u,
          shoulderY: 0.28 + (0.4 - 0.28) * u,
        }),
      );
      t += 0.06;
    }
    frames.push(pose(t, { wristY: floor, hipY: 0.55, shoulderY: 0.4 }));
    t += 0.2;
  }
  return frames;
}

function syntheticSquatFrames(reps: number): PoseFrame[] {
  const frames: PoseFrame[] = [];
  let t = 0;
  const stand = 0.42;
  const bottom = 0.62;
  frames.push(pose(t, { wristY: 0.25, hipY: stand, shoulderY: 0.28 }));
  t += 0.15;
  for (let r = 0; r < reps; r++) {
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      const hy = stand + (bottom - stand) * u;
      frames.push(pose(t, { wristY: 0.25 + 0.05 * u, hipY: hy, shoulderY: hy - 0.14 }));
      t += 0.07;
    }
    frames.push(pose(t, { wristY: 0.3, hipY: bottom, shoulderY: bottom - 0.14 }));
    t += 0.1;
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      const hy = bottom + (stand - bottom) * u;
      frames.push(pose(t, { wristY: 0.3 - 0.05 * u, hipY: hy, shoulderY: hy - 0.14 }));
      t += 0.07;
    }
    frames.push(pose(t, { wristY: 0.25, hipY: stand, shoulderY: 0.28 }));
    t += 0.2;
  }
  return frames;
}

function syntheticCrunchFrames(reps: number): PoseFrame[] {
  const frames: PoseFrame[] = [];
  let t = 0;
  // Extended: shoulders far from hips; peak: closer
  for (let r = 0; r < reps; r++) {
    for (let i = 0; i <= 8; i++) {
      const u = i / 8;
      const sh = 0.35 + 0.12 * u; // move toward hips
      const hip = 0.62;
      frames.push(pose(t, { wristY: sh + 0.05, hipY: hip, shoulderY: sh }));
      t += 0.07;
    }
    for (let i = 0; i <= 8; i++) {
      const u = i / 8;
      const sh = 0.47 - 0.12 * u;
      frames.push(pose(t, { wristY: sh + 0.05, hipY: 0.62, shoulderY: sh }));
      t += 0.07;
    }
    t += 0.15;
  }
  return frames;
}

function run(): void {
  console.log("Gym unit tests\n");

  {
    const ready = readyExercises();
    assert.equal(ready.length, 5);
    for (const id of ["bench_press", "deadlift", "squat", "pull_up", "crunch"]) {
      assert.equal(getExercise(id)?.status, "ready");
    }
    assert.equal(getExercise("plank")?.status, "planned");
    console.log("  ✓ registry ready vs planned");
  }

  {
    const vals = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    const { low, high } = calibrateSignalRange(vals);
    assert.ok(high > low);
    assert.ok(normSignal(low, low, high) < 0.05);
    assert.ok(normSignal(high, low, high) > 0.95);
    console.log("  ✓ signal calibration / normalisation");
  }

  {
    const samples = syntheticDeepReps(4).map((s) => ({ ...s, frame: undefined }));
    const reps = detectSignalReps(samples, cal);
    assert.ok(reps.length >= 3, `expected ≥3 signal reps, got ${reps.length}`);
    assert.ok(reps.every((r) => r.concentricSec > 0 && r.eccentricSec > 0));
    console.log(`  ✓ signal rep detector (${reps.length} reps)`);
  }

  {
    const frames = syntheticBenchFrames(4);
    const result = analyzeBenchGym(frames, cal, frames.at(-1)!.t, 720, 1280, 0.9);
    assert.ok(result.reps.length >= 3, `bench reps ${result.reps.length}`);
    assert.equal(result.exerciseId, "bench_press");
    assert.ok(result.signal.length > 10);
    assert.ok(result.phaseAt(result.reps[0].peakT).length > 0);
    console.log(`  ✓ bench analyzer (${result.reps.length} reps)`);
  }

  {
    const frames = syntheticDeadliftFrames(3);
    const result = analyzeDeadliftGym(
      frames,
      { ...cal, exerciseId: "deadlift", externalLoadKg: 180 },
      frames.at(-1)!.t,
      720,
      1280,
      0.9,
    );
    assert.ok(result.reps.length >= 2, `deadlift reps ${result.reps.length}`);
    assert.equal(result.exerciseId, "deadlift");
    console.log(`  ✓ deadlift analyzer (${result.reps.length} reps)`);
  }

  {
    const frames = syntheticSquatFrames(3);
    const result = analyzeSquatGym(
      frames,
      { ...cal, exerciseId: "squat" },
      frames.at(-1)!.t,
      720,
      1280,
      0.9,
    );
    assert.ok(result.reps.length >= 2, `squat reps ${result.reps.length}`);
    assert.ok(result.reps.some((r) => r.depthClass));
    console.log(`  ✓ squat analyzer (${result.reps.length} reps)`);
  }

  {
    const frames = syntheticCrunchFrames(5);
    const result = analyzeCrunchGym(
      frames,
      { ...cal, exerciseId: "crunch", externalLoadKg: null },
      frames.at(-1)!.t,
      720,
      1280,
      0.85,
    );
    assert.ok(result.reps.length >= 3, `crunch reps ${result.reps.length}`);
    console.log(`  ✓ crunch analyzer (${result.reps.length} reps)`);
  }

  {
    assert.throws(() =>
      runExerciseAnalyzer("plank", [], cal, {
        duration: 1,
        videoWidth: 100,
        videoHeight: 100,
        trackingConfidence: 0,
      }),
    );
    console.log("  ✓ planned exercise refuses fake analysis");
  }

  {
    // Static / noise: little ROM → no false reps
    const flat = Array.from({ length: 40 }, (_, i) => ({ t: i * 0.1, v: 0.2 + (i % 2) * 0.01 }));
    const reps = detectSignalReps(flat, cal);
    assert.equal(reps.length, 0);
    console.log("  ✓ no false reps on static noise");
  }

  console.log("\nAll gym tests passed.");
}

run();
