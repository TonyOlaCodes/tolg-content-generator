"use client";

import { getExercise } from "@/lib/gym/registry";
import type { GymAnalysisResult } from "@/lib/gym/types";

export default function SetSummary({
  analysis,
  onReplay,
  onClose,
  onExport,
  onAnother,
}: {
  analysis: GymAnalysisResult;
  onReplay: () => void;
  onClose: () => void;
  onExport: () => void;
  onAnother: () => void;
}) {
  const def = getExercise(analysis.exerciseId);
  const reps = analysis.reps;
  const valid = reps.filter((r) => r.grade === "valid").length;
  const partial = reps.filter((r) => r.grade === "partial").length;
  const failed = reps.filter((r) => r.grade === "failed").length;
  const lockouts = reps.filter((r) => r.lockOut).length;
  const avgRom =
    reps.length && reps.every((r) => r.romCm != null)
      ? `${(reps.reduce((s, r) => s + (r.romCm || 0), 0) / reps.length).toFixed(0)} cm`
      : reps.length
        ? `${Math.round((reps.reduce((s, r) => s + r.romNorm, 0) / reps.length) * 100)}% of set range`
        : "—";
  const avgConc = reps.length
    ? `${(reps.reduce((s, r) => s + r.concentricSec, 0) / reps.length).toFixed(2)} s`
    : "—";
  const avgEcc = reps.length
    ? `${(reps.reduce((s, r) => s + r.eccentricSec, 0) / reps.length).toFixed(2)} s`
    : "—";
  const avgPause = reps.length
    ? reps.reduce((s, r) => s + r.pauseSec, 0) / reps.length
    : 0;
  const fastest = reps.length
    ? `#${[...reps].sort((a, b) => b.peakSpeedNorm - a.peakSpeedNorm)[0].index}`
    : "—";
  const slowest = reps.length
    ? `#${[...reps].sort((a, b) => a.peakSpeedNorm - b.peakSpeedNorm)[0].index}`
    : "—";
  const elbowsL = reps.map((r) => r.elbowL).filter((n): n is number => n != null);
  const elbowsR = reps.map((r) => r.elbowR).filter((n): n is number => n != null);
  const work = reps.map((r) => r.workJ).filter((n): n is number => n != null);
  const power = reps.map((r) => r.peakPowerW).filter((n): n is number => n != null);
  const depths = reps.map((r) => r.depthClass).filter(Boolean);
  const load =
    analysis.calibration.externalLoadKg != null
      ? `${analysis.calibration.externalLoadKg} kg (entered)`
      : "Not entered";

  const rows: Array<[string, string]> = [
    ["exercise", analysis.exerciseName],
    ["external load", load],
    ["valid · partial · failed", `${valid} · ${partial} · ${failed}`],
    ["lock-out / completion", `${lockouts} / ${reps.length || 0}`],
    ["avg range of motion", avgRom],
    ["avg concentric / eccentric", `${avgConc} / ${avgEcc}`],
  ];

  if (avgPause >= 0.15) {
    rows.push(["avg bottom pause", `${avgPause.toFixed(2)} s`]);
  }

  rows.push(
    ["fastest · slowest rep", `${fastest} · ${slowest}`],
    [
      "velocity loss (early→late)",
      analysis.velocityLossPct != null ? `${analysis.velocityLossPct} %` : "Not enough reps",
    ],
  );

  if (depths.length) {
    const below = depths.filter((d) => d === "below").length;
    const parallel = depths.filter((d) => d === "parallel").length;
    const above = depths.filter((d) => d === "above").length;
    rows.push(["depth estimate (below / ≈ / above)", `${below} / ${parallel} / ${above}`]);
  }

  if (elbowsL.length || elbowsR.length) {
    rows.push([
      "elbow L / R (at peak sample)",
      `${elbowsL.length ? Math.round(elbowsL.reduce((a, b) => a + b, 0) / elbowsL.length) : "—"}° / ${elbowsR.length ? Math.round(elbowsR.reduce((a, b) => a + b, 0) / elbowsR.length) : "—"}°`,
    ]);
  }

  rows.push(
    [
      "mechanical work · peak power",
      work.length && power.length
        ? `${(work.reduce((a, b) => a + b, 0) / 1000).toFixed(2)} kJ · ${Math.round(Math.max(...power))} W`
        : "Needs load + scale",
    ],
    ["tracking confidence", `${Math.round(analysis.trackingConfidence * 100)} %`],
  );

  return (
    <div className="pu-summary" role="dialog" aria-label="Set summary">
      <div className="pu-summary-card">
        <div className="pu-summary-top">
          <h2>SET SUMMARY</h2>
          <button type="button" className="pu-icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="pu-summary-by">{analysis.exerciseName}</p>

        <div className="pu-summary-heroes">
          <div>
            <div className="pu-hero-num">{reps.length}</div>
            <div className="pu-hero-label">total reps</div>
          </div>
          <div>
            <div className="pu-hero-num teal">{analysis.avgQuality}</div>
            <div className="pu-hero-label">avg quality / 100</div>
          </div>
        </div>

        <dl className="pu-summary-rows">
          {rows.map(([k, v]) => (
            <div key={k} className="pu-summary-row">
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>

        <div className="pu-coach">
          <strong>Coaching notes</strong>
          <ul>
            {analysis.coachingNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>

        <p className="pu-summary-foot">
          Quality is a transparent heuristic from measured ROM, timing, and consistency — not injury
          diagnosis. Effort heatmaps are illustrative, not EMG. Focus:{" "}
          {(def?.effortFocus ?? []).join(", ") || "movement signal"}.
        </p>

        <div className="pu-summary-actions">
          <button type="button" onClick={onReplay}>
            Replay set
          </button>
          <button type="button" onClick={onClose}>
            View reps
          </button>
          <button type="button" className="is-accent" onClick={onExport}>
            Export video
          </button>
          <button type="button" onClick={onAnother}>
            New exercise
          </button>
        </div>
      </div>
    </div>
  );
}
