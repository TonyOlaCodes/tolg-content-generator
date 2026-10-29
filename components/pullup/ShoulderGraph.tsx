"use client";

import { useMemo } from "react";
import { REP_RESULTS, repStatusAt, sampleFrame, SET_DURATION, type LiveFrame } from "@/lib/pullup-sim";

export default function ShoulderGraph({ frame }: { frame: LiveFrame }) {
  const series = useMemo(() => {
    const end = Math.min(frame.t, SET_DURATION);
    const pts: Array<{ x: number; y: number; repPeak?: number }> = [];
    const n = 160;
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1)) * end;
      const f = sampleFrame(t);
      pts.push({ x: t / SET_DURATION, y: f.shoulderHeight / 100 });
    }
    return pts;
  }, [frame.t]);

  const peaks = useMemo(() => {
    // Mark peaks at each completed (or current) rep apex time
    const out: Array<{ x: number; y: number; n: number }> = [];
    const repPeriod = 4.85;
    const repStart = 4.5;
    for (let i = 0; i < REP_RESULTS.length; i++) {
      const peakT = repStart + i * repPeriod + repPeriod * 0.5;
      if (peakT > frame.t + 0.05) break;
      const f = sampleFrame(peakT);
      out.push({ x: peakT / SET_DURATION, y: f.shoulderHeight / 100, n: i + 1 });
    }
    return out;
  }, [frame.t]);

  const statuses = repStatusAt(frame.reps, frame.showSummary);
  const w = 360;
  const h = 110;
  const padL = 28;
  const padR = 8;
  const padT = 18;
  const padB = 22;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const path = series
    .map((p, i) => {
      const x = padL + p.x * plotW;
      const y = padT + (1 - p.y) * plotH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const chinY = padT + (1 - 0.92) * plotH;

  return (
    <div className="pullup-graph">
      <div className="pullup-graph-head">
        <span className="pullup-graph-title">SHOULDER HEIGHT</span>
        <span className="pullup-graph-legend">0 % = dead hang · 100 % = best rep</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="pullup-graph-svg" preserveAspectRatio="none">
        <text x={2} y={padT + 4} className="pullup-axis">
          100
        </text>
        <text x={2} y={padT + plotH * 0.5 + 3} className="pullup-axis">
          50
        </text>
        <text x={8} y={padT + plotH + 3} className="pullup-axis">
          0
        </text>
        <line
          x1={padL}
          x2={padL + plotW}
          y1={chinY}
          y2={chinY}
          stroke="rgba(255,255,255,0.35)"
          strokeDasharray="4 4"
          strokeWidth="1"
        />
        <text x={padL + plotW - 58} y={chinY - 3} className="pullup-axis">
          chin at bar
        </text>
        {path ? (
          <path d={path} fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="1.6" />
        ) : null}
        {peaks.map((p) => {
          const x = padL + p.x * plotW;
          const y = padT + (1 - p.y) * plotH;
          return (
            <g key={p.n}>
              <circle cx={x} cy={y} r={3.2} fill="#ff9f1c" />
              <text x={x} y={y - 6} textAnchor="middle" className="pullup-peak-label">
                {p.n}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="pullup-rep-strip" aria-label="Rep status">
        {statuses.map((s) => (
          <span
            key={s.n}
            className={`pullup-rep-cell pullup-rep-${s.kind}`}
            title={`Rep ${s.n}`}
          >
            {s.kind === "check" ? "✓" : s.kind === "tilde" ? "~" : s.kind === "x" ? "✕" : s.n}
          </span>
        ))}
      </div>
    </div>
  );
}
