/**
 * Unit tests for pull-up rep detection & biomechanics (no MediaPipe / DOM).
 * Run: npx tsx tests/pullup/rep-detector.test.ts
 */

import assert from "node:assert/strict";
import { angleDeg } from "../../lib/pullup/landmarks";
import { heightNorm } from "../../lib/pullup/biomechanics";
import { calibrateHeightRange, detectReps } from "../../lib/pullup/rep-detector";
import type { PoseFrame, UserCalibration } from "../../lib/pullup/types";

function frame(t: number, shoulderY: number, noseY?: number): PoseFrame {
  return {
    t,
    landmarks: null,
    shoulderY,
    hipY: shoulderY + 0.2,
    noseY: noseY ?? shoulderY - 0.05,
    elbowL: 160,
    elbowR: 158,
    confidence: 0.9,
  };
}

/** Synthetic set: hang → up → top → down, repeated n times. */
function syntheticSet(reps: number, opts?: { shortLast?: boolean }): PoseFrame[] {
  const frames: PoseFrame[] = [];
  let t = 0;
  const hang = 0.55;
  const top = 0.22;
  frames.push(frame(t, hang));
  t += 0.2;
  for (let r = 0; r < reps; r++) {
    const thisTop = opts?.shortLast && r === reps - 1 ? 0.38 : top;
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      const y = hang + (thisTop - hang) * u;
      frames.push(frame(t, y, y - 0.06));
      t += 0.08;
    }
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      const y = thisTop + (hang - thisTop) * u;
      frames.push(frame(t, y, y - 0.04));
      t += 0.08;
    }
    frames.push(frame(t, hang));
    t += 0.15;
  }
  return frames;
}

const cal: UserCalibration = {
  barY: 0.2,
  bodyWeightKg: 80,
  heightCm: 180,
  addedWeightKg: 0,
  metersPerImageHeight: null,
};

function run(): void {
  console.log("Pull-up unit tests\n");

  {
    const a = angleDeg({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 });
    assert.ok(Math.abs(a - 90) < 0.01, `expected ~90°, got ${a}`);
    console.log("  ✓ elbow angle geometry");
  }

  {
    assert.equal(heightNorm(0.5, 0.5, 0.2), 0);
    assert.ok(Math.abs(heightNorm(0.2, 0.5, 0.2) - 1) < 1e-6);
    console.log("  ✓ height normalisation");
  }

  {
    const frames = syntheticSet(5);
    const { hangY, topY } = calibrateHeightRange(frames);
    assert.ok(hangY > topY);
    const reps = detectReps(frames, hangY, topY, cal);
    assert.equal(reps.length, 5, `expected 5 reps, got ${reps.length}`);
    assert.ok(reps.every((r) => r.upDuration > 0 && r.downDuration > 0));
    console.log(`  ✓ detects 5 clean reps (got ${reps.length})`);
  }

  {
    const frames = syntheticSet(3, { shortLast: true });
    const { hangY, topY } = calibrateHeightRange(frames);
    const reps = detectReps(frames, hangY, topY, cal);
    assert.equal(reps.length, 3);
    const last = reps[reps.length - 1];
    assert.ok(
      last.grade === "partial" ||
        last.grade === "failed" ||
        last.peakHeightNorm < reps[0].peakHeightNorm,
      "short last rep should be weaker",
    );
    console.log(`  ✓ short final rep graded ${last.grade} (peak ${last.peakHeightNorm.toFixed(2)})`);
  }

  {
    const hangFrames = Array.from({ length: 20 }, (_, i) => frame(i * 0.1, 0.5));
    const { hangY, topY } = calibrateHeightRange(hangFrames);
    const reps = detectReps(hangFrames, hangY, topY, cal);
    assert.equal(reps.length, 0);
    console.log("  ✓ no false reps on static hang");
  }

  {
    const frames = syntheticSet(4);
    const { hangY, topY } = calibrateHeightRange(frames);
    const reps = detectReps(frames, hangY, topY, cal);
    assert.ok(reps.every((r) => r.autoGrade === r.grade));
    assert.ok(reps.every((r) => r.quality >= 0 && r.quality <= 100));
    assert.ok(reps.every((r) => r.index === reps.indexOf(r) + 1));
    console.log("  ✓ quality scores and auto grades stay in range");
  }

  {
    // Tiny bounce should not create a rep
    const bounce: PoseFrame[] = [];
    for (let i = 0; i < 30; i++) {
      const y = 0.5 - Math.sin(i / 3) * 0.03;
      bounce.push(frame(i * 0.05, y));
    }
    const { hangY, topY } = calibrateHeightRange(bounce);
    const reps = detectReps(bounce, hangY, topY, cal);
    assert.equal(reps.length, 0);
    console.log("  ✓ ignores small shoulder bounce");
  }

  console.log("\nAll pull-up unit tests passed.");
}

run();
