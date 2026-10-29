"use client";

import { QUALITY_METHOD } from "@/lib/pullup/quality";
import type { AnalysisResult } from "@/lib/pullup/types";

export default function SetSummary({
  analysis,
  onReplay,
  onClose,
  onExport,
  onAnother,
}: {
  analysis: AnalysisResult;
  onReplay: () => void;
  onClose: () => void;
  onExport: () => void;
  onAnother: () => void;
}) {
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
  const avgUp = reps.length
    ? `${(reps.reduce((s, r) => s + r.upDuration, 0) / reps.length).toFixed(2)} s`
    : "—";
  const avgDown = reps.length
    ? `${(reps.reduce((s, r) => s + r.downDuration, 0) / reps.length).toFixed(2)} s`
    : "—";
  const fastest = reps.length
    ? `#${[...reps].sort((a, b) => b.peakSpeedNorm - a.peakSpeedNorm)[0].index}`
    : "—";
  const slowest = reps.length
    ? `#${[...reps].sort((a, b) => a.peakSpeedNorm - b.peakSpeedNorm)[0].index}`
    : "—";
  const avgSway =
    reps.length && reps.every((r) => r.swayCm != null)
      ? `${(reps.reduce((s, r) => s + (r.swayCm || 0), 0) / reps.length).toFixed(1)} cm`
      : reps.length
        ? `${((reps.reduce((s, r) => s + r.swayNorm, 0) / reps.length) * 100).toFixed(1)}% frame`
        : "—";
  const elbowsL = reps.map((r) => r.elbowAtTopL).filter((n): n is number => n != null);
  const elbowsR = reps.map((r) => r.elbowAtTopR).filter((n): n is number => n != null);
  const work = reps.map((r) => r.workJ).filter((n): n is number => n != null);
  const power = reps.map((r) => r.peakPowerW).filter((n): n is number => n != null);

  const rows: Array<[string, string]> = [
    ["valid · borderline · failed", `${valid} · ${partial} · ${failed}`],
    ["full lock-out at bottom", `${lockouts} / ${reps.length || 0}`],
    ["avg range of motion", avgRom],
    ["avg tempo up / down", `${avgUp} / ${avgDown}`],
    ["fastest · slowest rep", `${fastest} · ${slowest}`],
    [
      "velocity loss (early→late)",
      analysis.velocityLossPct != null ? `${analysis.velocityLossPct} %` : "Not enough reps",
    ],
    ["avg body sway", avgSway],
    [
      "elbow at top L / R",
      elbowsL.length && elbowsR.length
        ? `${Math.round(elbowsL.reduce((a, b) => a + b, 0) / elbowsL.length)}° / ${Math.round(elbowsR.reduce((a, b) => a + b, 0) / elbowsR.length)}°`
        : "Low confidence",
    ],
    [
      "mechanical work · peak power",
      work.length && power.length
        ? `${(work.reduce((a, b) => a + b, 0) / 1000).toFixed(2)} kJ · ${Math.round(Math.max(...power))} W`
        : "Not calibrated",
    ],
    ["tracking confidence", `${Math.round(analysis.trackingConfidence * 100)} %`],
  ];

  return (
    <div className="pu-summary" role="dialog" aria-label="Set summary">
      <div className="pu-summary-card">
        <div className="pu-summary-top">
          <h2>SET SUMMARY</h2>
          <button type="button" className="pu-icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="pu-summary-by">Pull Up Analysis</p>

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

        <p className="pu-summary-foot">{QUALITY_METHOD}</p>

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
            Analyse another
          </button>
        </div>
      </div>
    </div>
  );
}
