"use client";

import { formatEUR } from "@/money/money";

export type Slice = { label: string; color: string; value: number };

/** Accessible SVG donut. Each slice is labelled with its amount and share. */
export function Donut({ slices, emptyLabel }: { slices: Slice[]; emptyLabel: string }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return <p className="money-muted">{emptyLabel}</p>;
  const r = 44;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="money-donut">
      <svg viewBox="0 0 120 120" role="img" aria-label={`Allocation across ${slices.length} categories, total ${formatEUR(total)}`}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border)" strokeWidth="14" />
        {slices.map((s) => {
          const len = (s.value / total) * c;
          const el = (
            <circle
              key={s.label}
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="14"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 60 60)"
            >
              <title>{`${s.label}: ${formatEUR(s.value)} (${Math.round((s.value / total) * 100)}%)`}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
      </svg>
      <ul className="money-legend">
        {slices.map((s) => (
          <li key={s.label}>
            <span className="money-dot" style={{ background: s.color }} />
            <span>{s.label}</span>
            <strong>{Math.round((s.value / total) * 100)}%</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Accessible SVG line chart of cumulative money over time. Points are real confirmed history only. */
export function LineChart({ points }: { points: { date: string; cents: number }[] }) {
  if (points.length < 2) return <p className="money-muted">Balance history appears after your first confirmed transaction.</p>;
  const w = 320;
  const h = 120;
  const values = points.map((p) => p.cents);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const xs = (i: number) => (i / (points.length - 1)) * w;
  const ys = (v: number) => h - ((v - min) / span) * (h - 10) - 5;
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)},${ys(p.cents).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="money-line" role="img" aria-label={`Total money from ${points[0].date} to ${points[points.length - 1].date}, now ${formatEUR(values[values.length - 1])}`}>
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" />
    </svg>
  );
}
