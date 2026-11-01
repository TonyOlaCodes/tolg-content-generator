"use client";

import { useId, useState, type ReactNode } from "react";

/* --------------------------------------------------------------- progress */

export function ProgressRing({
  percent,
  color,
  size = 92,
  stroke = 9,
  children,
}: {
  /** Can exceed 100; the drawn arc caps at 100%. */
  percent: number | null;
  color: string;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const gradientId = useId();
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = percent === null ? 0 : Math.min(100, Math.max(0, percent));
  const offset = circumference * (1 - filled / 100);
  return (
    <div className="daily-ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden focusable="false">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.95} />
            <stop offset="100%" stopColor={color} stopOpacity={0.55} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={stroke}
        />
        <circle
          className="daily-ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="daily-ring-center">{children}</div>
    </div>
  );
}

export function ProgressBar({
  percent,
  color,
  label,
}: {
  percent: number | null;
  color: string;
  label?: string;
}) {
  const value = percent === null ? 0 : Math.min(100, Math.max(0, percent));
  const over = percent !== null && percent > 100;
  return (
    <div
      className={`daily-progress${over ? " is-over" : ""}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      aria-label={label}
    >
      <span style={{ width: `${value}%`, background: over ? undefined : color }} />
    </div>
  );
}

/* ----------------------------------------------------------------- charts */

type ChartPoint = { date: string; value: number | null };

type Bar = { label: string; value: number | null; fullLabel?: string };

const W = 320;
const H = 148;
const PAD = { top: 12, right: 8, bottom: 22, left: 8 };

function niceMax(values: number[], goal: number | null): number {
  const all = [...values, ...(goal !== null && goal > 0 ? [goal] : [])];
  if (all.length === 0) return 1;
  const max = Math.max(...all);
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const stepped = Math.ceil(max / magnitude) * magnitude;
  return stepped === max ? max * 1.08 : stepped;
}

function ChartShell({
  children,
  tooltip,
  onScrub,
  onLeave,
  ariaLabel,
}: {
  children: ReactNode;
  tooltip: ReactNode;
  onScrub: (clientX: number, rect: DOMRect) => void;
  onLeave: () => void;
  ariaLabel: string;
}) {
  return (
    <div className="daily-chart">
      <div
        className="daily-chart-hit"
        role="img"
        aria-label={ariaLabel}
        onPointerMove={(event) => onScrub(event.clientX, event.currentTarget.getBoundingClientRect())}
        onPointerDown={(event) => onScrub(event.clientX, event.currentTarget.getBoundingClientRect())}
        onPointerLeave={onLeave}
        onPointerCancel={onLeave}
      >
        {children}
        {tooltip}
      </div>
    </div>
  );
}

/** Compact bar chart. Missing days leave a gap; they are never drawn as zero. */
export function BarChart({
  bars,
  color,
  formatValue,
  goal = null,
  ariaLabel,
}: {
  bars: Bar[];
  color: string;
  formatValue: (value: number) => string;
  goal?: number | null;
  ariaLabel: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const values = bars.map((b) => b.value).filter((v): v is number => v !== null);
  const max = niceMax(values, goal);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = bars.length ? plotW / bars.length : plotW;
  const barW = Math.max(2, Math.min(14, slot * 0.62));
  const y = (value: number) => PAD.top + plotH - (value / max) * plotH;
  const goalY = goal !== null && goal > 0 ? y(Math.min(goal, max)) : null;
  const labelEvery = bars.length <= 8 ? 1 : Math.ceil(bars.length / 5);

  const scrub = (clientX: number, rect: DOMRect) => {
    if (!bars.length) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setActive(Math.min(bars.length - 1, Math.floor(ratio * bars.length)));
  };

  const activeBar = active !== null ? bars[active] : null;
  const leftPercent = ((Math.min(active ?? 0, bars.length - 1) + 0.5) / Math.max(1, bars.length)) * 100;
  const tooltip = activeBar ? (
    <div
      className="daily-chart-tip"
      style={{
        left: `${leftPercent}%`,
        transform: `translateX(${leftPercent < 16 ? "0%" : leftPercent > 84 ? "-100%" : "-50%"})`,
      }}
    >
      <strong>{activeBar.value === null ? "Not logged" : formatValue(activeBar.value)}</strong>
      <span>{activeBar.fullLabel ?? activeBar.label}</span>
    </div>
  ) : null;

  return (
    <ChartShell tooltip={tooltip} onScrub={scrub} onLeave={() => setActive(null)} ariaLabel={ariaLabel}>
      <svg viewBox={`0 0 ${W} ${H}`} className="daily-chart-svg" aria-hidden focusable="false">
        <line x1={PAD.left} y1={PAD.top + plotH} x2={W - PAD.right} y2={PAD.top + plotH} className="daily-chart-axis" />
        {goalY !== null ? (
          <line x1={PAD.left} y1={goalY} x2={W - PAD.right} y2={goalY} className="daily-chart-goal" style={{ stroke: color }} />
        ) : null}
        {bars.map((bar, index) => {
          const x = PAD.left + slot * index + (slot - barW) / 2;
          if (bar.value === null) {
            return (
              <rect
                key={bar.label + index}
                x={x}
                y={PAD.top + plotH - 2}
                width={barW}
                height={2}
                rx={1}
                className="daily-chart-gap"
              />
            );
          }
          const barY = y(Math.max(0, bar.value));
          const h = Math.max(2, PAD.top + plotH - barY);
          return (
            <rect
              key={bar.label + index}
              x={x}
              y={barY}
              width={barW}
              height={h}
              rx={Math.min(3, barW / 2)}
              fill={color}
              opacity={active === null || active === index ? 0.92 : 0.5}
            />
          );
        })}
        {bars.map((bar, index) =>
          index % labelEvery === 0 || index === bars.length - 1 ? (
            <text
              key={`label-${bar.label}-${index}`}
              x={PAD.left + slot * index + slot / 2}
              y={H - 6}
              textAnchor="middle"
              className="daily-chart-label"
            >
              {bar.label}
            </text>
          ) : null,
        )}
        {active !== null ? (
          <line
            x1={PAD.left + slot * active + slot / 2}
            y1={PAD.top}
            x2={PAD.left + slot * active + slot / 2}
            y2={PAD.top + plotH}
            className="daily-chart-cursor"
          />
        ) : null}
      </svg>
    </ChartShell>
  );
}

/** Line chart with an optional smoothed series. Gaps are not connected. */
export function LineChart({
  points,
  smoothed = null,
  color,
  formatValue,
  ariaLabel,
  goal = null,
  goalText,
}: {
  points: ChartPoint[];
  smoothed?: ChartPoint[] | null;
  color: string;
  formatValue: (value: number) => string;
  ariaLabel: string;
  /** Optional target value drawn as a dashed line. */
  goal?: number | null;
  goalText?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const values = [...points, ...(smoothed ?? [])]
    .map((p) => p.value)
    .filter((v): v is number => v !== null);
  const rangeValues = goal !== null ? [...values, goal] : values;
  const min = rangeValues.length ? Math.min(...rangeValues) : 0;
  const max = rangeValues.length ? Math.max(...rangeValues) : 1;
  const padding = Math.max(0.3, (max - min) * 0.25);
  const low = min - padding;
  const high = max + padding;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (index: number) => PAD.left + (points.length <= 1 ? plotW / 2 : (plotW * index) / (points.length - 1));
  const y = (value: number) => PAD.top + plotH - ((value - low) / Math.max(0.0001, high - low)) * plotH;

  const path = (series: ChartPoint[]) => {
    let d = "";
    let drawing = false;
    series.forEach((point, index) => {
      if (point.value === null) {
        drawing = false;
        return;
      }
      d += `${drawing ? "L" : "M"}${x(index).toFixed(1)} ${y(point.value).toFixed(1)} `;
      drawing = true;
    });
    return d.trim();
  };

  const scrub = (clientX: number, rect: DOMRect) => {
    if (!points.length) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setActive(Math.min(points.length - 1, Math.round(ratio * (points.length - 1))));
  };

  const activePoint = active !== null ? points[active] : null;
  const leftPercent = (x(active ?? 0) / W) * 100;
  const tooltip = activePoint ? (
    <div
      className="daily-chart-tip"
      style={{
        left: `${leftPercent}%`,
        transform: `translateX(${leftPercent < 16 ? "0%" : leftPercent > 84 ? "-100%" : "-50%"})`,
      }}
    >
      <strong>{activePoint.value === null ? "Not logged" : formatValue(activePoint.value)}</strong>
      <span>{shortTooltipDate(activePoint.date)}</span>
    </div>
  ) : null;

  return (
    <ChartShell tooltip={tooltip} onScrub={scrub} onLeave={() => setActive(null)} ariaLabel={ariaLabel}>
      <svg viewBox={`0 0 ${W} ${H}`} className="daily-chart-svg" aria-hidden focusable="false">
        <line x1={PAD.left} y1={PAD.top + plotH} x2={W - PAD.right} y2={PAD.top + plotH} className="daily-chart-axis" />
        {goal !== null ? (
          <>
            <line
              x1={PAD.left}
              y1={y(goal)}
              x2={W - PAD.right}
              y2={y(goal)}
              className="daily-chart-goal"
              style={{ stroke: color }}
            />
            {goalText ? (
              <text
                x={W - PAD.right}
                y={Math.min(PAD.top + plotH - 3, Math.max(PAD.top + 8, y(goal) - 4))}
                textAnchor="end"
                className="daily-chart-goal-label"
                style={{ fill: color }}
              >
                {goalText}
              </text>
            ) : null}
          </>
        ) : null}
        {smoothed && smoothed.length > 0 ? (
          <path d={path(smoothed)} fill="none" stroke={color} strokeOpacity={0.35} strokeWidth={1.6} strokeDasharray="4 4" strokeLinejoin="round" strokeLinecap="round" />
        ) : null}
        <path d={path(points)} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point, index) =>
          point.value === null ? null : (
            <circle
              key={point.date}
              cx={x(index)}
              cy={y(point.value)}
              r={active === index ? 3.6 : 2.2}
              fill={color}
              stroke="rgba(10,8,16,0.9)"
              strokeWidth={1}
            />
          ),
        )}
        {activePoint ? (
          <line x1={x(active ?? 0)} y1={PAD.top} x2={x(active ?? 0)} y2={PAD.top + plotH} className="daily-chart-cursor" />
        ) : null}
        {points.length > 0 ? (
          <>
            <text x={PAD.left} y={H - 6} textAnchor="start" className="daily-chart-label">
              {shortChartDate(points[0].date)}
            </text>
            {points.length > 1 ? (
              <text x={W - PAD.right} y={H - 6} textAnchor="end" className="daily-chart-label">
                {shortChartDate(points[points.length - 1].date)}
              </text>
            ) : null}
          </>
        ) : null}
      </svg>
    </ChartShell>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortChartDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  return `${d} ${MONTHS[m - 1]}`;
}

function shortTooltipDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Tiny decorative trend line for compact cards. */
export function Sparkline({ points, color }: { points: (number | null)[]; color: string }) {
  const values = points.filter((v): v is number => v !== null);
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 64;
  const h = 22;
  let d = "";
  let drawing = false;
  points.forEach((value, index) => {
    if (value === null) {
      drawing = false;
      return;
    }
    const px = points.length <= 1 ? w / 2 : (w * index) / (points.length - 1);
    const py = h - 2 - ((value - min) / span) * (h - 4);
    d += `${drawing ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)} `;
    drawing = true;
  });
  return (
    <svg className="daily-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden focusable="false">
      <path d={d.trim()} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
