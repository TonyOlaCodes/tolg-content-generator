"use client";

import { SET_SUMMARY } from "@/lib/pullup-sim";

export default function SetSummary() {
  const rows: Array<[string, string]> = [
    ["chin above bar · at bar · short", `${SET_SUMMARY.chinAbove} · ${SET_SUMMARY.atBar} · ${SET_SUMMARY.short}`],
    ["full lock-out at bottom", SET_SUMMARY.lockOut],
    ["range of motion", `${SET_SUMMARY.romCm} cm per rep`],
    ["tempo up / down", `${SET_SUMMARY.tempoUp.toFixed(1)} s / ${SET_SUMMARY.tempoDown.toFixed(1)} s`],
    [
      "peak speed best → last",
      `${SET_SUMMARY.peakBest.toFixed(2)} → ${SET_SUMMARY.peakLast.toFixed(2)} m/s (−${SET_SUMMARY.peakDropPct} %)`,
    ],
    ["hip sway", `${SET_SUMMARY.hipSway} cm avg`],
    ["elbow at top L / R", `${SET_SUMMARY.elbowL}° / ${SET_SUMMARY.elbowR}°`],
    ["work · peak power", `${SET_SUMMARY.workKj} kJ · ${SET_SUMMARY.peakPowerW} W`],
    ["energy, rough estimate", `≈ ${SET_SUMMARY.energyKcal} kcal for the set`],
    ["last rep vs best", `effort ×${SET_SUMMARY.lastEffort.toFixed(1)} · ~${SET_SUMMARY.repsLeft} reps left`],
  ];

  return (
    <div className="pullup-summary" role="dialog" aria-label="Set summary">
      <div className="pullup-summary-card">
        <h2 className="pullup-summary-title">SET SUMMARY</h2>
        <p className="pullup-summary-by">Pull Up Analysis by Fable and DyeAllPies</p>

        <div className="pullup-summary-heroes">
          <div>
            <div className="pullup-summary-hero-num">{SET_SUMMARY.reps}</div>
            <div className="pullup-summary-hero-label">reps</div>
          </div>
          <div>
            <div className="pullup-summary-hero-num is-teal">{SET_SUMMARY.avgEfficiency}</div>
            <div className="pullup-summary-hero-label">avg efficiency / 100</div>
          </div>
        </div>

        <dl className="pullup-summary-rows">
          {rows.map(([label, value]) => (
            <div key={label} className="pullup-summary-row">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <p className="pullup-summary-foot">
          MediaPipe 33-pt pose · YOLOv8 cross-check: {SET_SUMMARY.yoloReps} reps · {SET_SUMMARY.heightCm}{" "}
          cm, {SET_SUMMARY.weightKg} kg
        </p>
      </div>
    </div>
  );
}
