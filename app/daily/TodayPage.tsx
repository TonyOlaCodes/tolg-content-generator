"use client";

import { adjustWater } from "@/daily/actions";
import {
  currentStreak,
  dayMetrics,
  metricCardStatus,
  seriesForMetric,
  weightOverview,
  type DayMetrics,
  type MetricCardStatus,
} from "@/daily/logic";
import { addDays, dayLabel, shortDate } from "@/daily/date";
import type { ReactNode } from "react";
import {
  formatCalories,
  formatDuration,
  formatInt,
  formatPercent,
  formatWater,
  formatWeight,
  formatWeightChange,
} from "@/daily/format";
import { METRIC_META, settingsOf, visibleMetrics, type MetricKey } from "@/daily/model";
import { ProgressBar, ProgressRing, Sparkline } from "./charts";
import { uiCtx, type DailyApi } from "./api";

function MetricIcon({ metric }: { metric: MetricKey }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (metric) {
    case "steps":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <path d="M8 4.5c1.4 0 2.3 1 2.3 2.6 0 2.6-1 4-1 6.1 0 1.9 1 3.2 2.6 3.2 2 0 3.1-1.7 3.1-4.1 0-2.8 1.1-4.3 1.1-6.3 0-1.3.9-2 2-2" {...common} />
          <path d="M7.3 19.6c.6.6 1.4.9 2.3.9 2 0 3.2-1.3 5-1.3 1 0 1.8.3 2.4.9" {...common} strokeWidth={1.7} />
        </svg>
      );
    case "weight":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <rect x={4} y={7} width={16} height={12.5} rx={3} {...common} />
          <path d="M8.5 7a3.5 3.5 0 0 1 7 0" {...common} />
          <path d="M12 11.2a2 2 0 1 0 1.7 3l-1.2-1.8" {...common} strokeWidth={1.7} />
        </svg>
      );
    case "calories":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <path d="M12 3.5c.4 2.6-1.5 3.4-1.5 5.3 0 1 .6 1.8 1.5 2.2-.2-1.6.7-2.5 1.6-3 .1 1.7 2.4 2.9 2.4 5.5a4 4 0 0 1-8 0c0-2.4 1.2-4.1 2-5.9.7-1.4 1.3-2.5 2-4.1Z" {...common} />
        </svg>
      );
    case "sleep":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <path d="M19.5 14.3A7.7 7.7 0 0 1 9.7 4.5a8 8 0 1 0 9.8 9.8Z" {...common} />
          <path d="M15.5 4.5h3l-3 3h3" {...common} strokeWidth={1.5} />
        </svg>
      );
    case "water":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <path d="M12 3.6c3.2 3.8 5.4 6.5 5.4 9.2a5.4 5.4 0 0 1-10.8 0c0-2.7 2.2-5.4 5.4-9.2Z" {...common} />
          <path d="M9.6 13.6a2.5 2.5 0 0 0 2.5 2.6" {...common} strokeWidth={1.6} />
        </svg>
      );
  }
}

export type CardStatus = MetricCardStatus;

function Card({
  metric,
  wide,
  onOpen,
  label,
  value,
  status,
  children,
  footer,
}: {
  metric: MetricKey;
  wide?: boolean;
  onOpen: () => void;
  label: string;
  value: string;
  status: CardStatus;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const meta = METRIC_META[metric];
  const empty = status === "empty";
  const statusText = status === "done" ? ", complete" : status === "progress" ? ", in progress" : "";
  return (
    <article
      className={`daily-card${wide ? " is-wide" : ""}${empty ? " is-empty" : ""}${status === "done" ? " is-done" : ""}${status === "progress" ? " is-progress" : ""}`}
      style={{ ["--daily-accent" as string]: meta.accent }}
    >
      <button
        type="button"
        className="daily-card-tap"
        onClick={onOpen}
        aria-label={`${label}: ${empty ? "no entry" : value}${statusText}. Open editor.`}
      >
        <span className="daily-card-top">
          <span className="daily-card-icon" aria-hidden>
            <MetricIcon metric={metric} />
          </span>
          <span className="daily-card-label">{label}</span>
          {status === "done" ? (
            <span className="daily-card-state" aria-hidden>
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="m6 12.5 4 4 8-9" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          ) : status === "progress" ? (
            <span className="daily-card-state is-progress" aria-hidden>
              Started
            </span>
          ) : (
            <span className="daily-card-chevron" aria-hidden>›</span>
          )}
        </span>
        <span className="daily-card-value">
          {empty ? <span className="daily-card-missing">—</span> : value}
        </span>
        {children}
      </button>
      {footer}
    </article>
  );
}

function StepsCard({ api, view, wide, status }: { api: DailyApi; view: DayMetrics; wide: boolean; status: CardStatus }) {
  const goal = api.settings.stepGoal;
  const percent = view.steps === null ? null : (view.steps / goal) * 100;
  const remaining = view.steps === null ? null : Math.max(0, goal - view.steps);
  return (
    <Card
      metric="steps"
      wide={wide}
      label="Steps"
      value={view.steps === null ? "—" : `${formatInt(view.steps)}`}
      status={status}
      onOpen={() => api.openSheet({ kind: "steps" })}
    >
      <div className="daily-steps-body">
        <ProgressRing percent={percent} color={METRIC_META.steps.ring} size={88} stroke={7}>
          <span className="daily-ring-number">{percent === null ? "—" : formatPercent(percent)}</span>
        </ProgressRing>
        <div className="daily-steps-info">
          <p className="daily-steps-goal">{formatInt(goal)} goal</p>
          {remaining !== null ? (
            <p className="daily-steps-note">
              {remaining === 0 ? "Goal reached" : `${formatInt(remaining)} left`}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function WeightCard({ api, view, wide, status }: { api: DailyApi; view: DayMetrics; wide: boolean; status: CardStatus }) {
  const unit = api.settings.weightUnit;
  const overview = weightOverview(api.snap, api.today);
  const latest = overview.latest;
  const dayEntry = view.weightKg !== null ? view.weightKg : null;
  const spark = seriesForMetric(api.snap, Array.from({ length: 14 }, (_, i) => addDays(api.today, -13 + i)), "weight").map((p) => p.value);
  const change = overview.change30;
  const goalKg = api.settings.weightGoalKg;
  const goalNote =
    goalKg === null
      ? null
      : latest
        ? Math.abs(latest.kg - goalKg) < 0.05
          ? "Goal reached"
          : `${formatWeight(Math.abs(latest.kg - goalKg), unit)} ${latest.kg > goalKg ? "above" : "below"} goal`
        : `Goal ${formatWeight(goalKg, unit)}`;
  return (
    <Card
      metric="weight"
      wide={wide}
      label="Weight"
      value={dayEntry !== null ? formatWeight(dayEntry, unit) : "—"}
      status={status}
      onOpen={() => api.openSheet({ kind: "weight" })}
    >
      <span className="daily-card-meta">
        {dayEntry !== null ? (
          <>
            {change !== null ? (
              <span className={`daily-delta ${change > 0 ? "is-up" : change < 0 ? "is-down" : ""}`}>
                {formatWeightChange(change, unit)} / 30d
              </span>
            ) : (
              <span>Today</span>
            )}
          </>
        ) : latest ? (
          <span>Last {shortDate(latest.date)} · {formatWeight(latest.kg, unit)}</span>
        ) : null}
        {goalNote ? <span className="daily-goal-note">{goalNote}</span> : null}
      </span>
      <Sparkline points={spark} color={METRIC_META.weight.ring} />
    </Card>
  );
}

function CaloriesCard({ api, view, wide, status }: { api: DailyApi; view: DayMetrics; wide: boolean; status: CardStatus }) {
  const goal = api.settings.calorieGoal;
  const percent = view.calories !== null && goal ? (view.calories / goal) * 100 : null;
  return (
    <Card
      metric="calories"
      wide={wide}
      label="Calories"
      value={view.calories === null ? "—" : formatCalories(view.calories)}
      status={status}
      onOpen={() => api.openSheet({ kind: "calories" })}
    >
      {percent !== null ? <ProgressBar percent={percent} color={METRIC_META.calories.ring} label="Calorie goal progress" /> : null}
      {view.calories !== null && goal !== null ? (
        <span className="daily-card-meta">
          <span>
            {formatInt(view.calories)} / {formatInt(goal)}
          </span>
          <span className={view.calories > goal ? "daily-delta is-up" : "daily-delta"}>
            {view.calories > goal ? `+${formatInt(view.calories - goal)}` : `${formatInt(goal - view.calories)} left`}
          </span>
        </span>
      ) : null}
    </Card>
  );
}

function SleepCard({ api, view, wide, status }: { api: DailyApi; view: DayMetrics; wide: boolean; status: CardStatus }) {
  const week = seriesForMetric(
    api.snap,
    Array.from({ length: 7 }, (_, i) => addDays(api.today, -6 + i)),
    "sleep",
  )
    .map((p) => p.value)
    .filter((v): v is number => v !== null);
  const weekAvg = week.length ? week.reduce((sum, v) => sum + v, 0) / week.length : null;
  return (
    <Card
      metric="sleep"
      wide={wide}
      label="Sleep"
      value={view.sleepMinutes === null ? "—" : formatDuration(view.sleepMinutes)}
      status={status}
      onOpen={() => api.openSheet({ kind: "sleep" })}
    >
      {weekAvg !== null ? (
        <span className="daily-card-meta">
          <span>Avg {formatDuration(weekAvg)}</span>
          {view.sleepMinutes !== null && Math.abs(view.sleepMinutes - weekAvg) >= 5 ? (
            <span className="daily-delta">
              {view.sleepMinutes >= weekAvg ? "+" : "−"}
              {formatDuration(Math.abs(view.sleepMinutes - weekAvg))}
            </span>
          ) : null}
        </span>
      ) : null}
    </Card>
  );
}

function WaterCard({ api, view, wide, status }: { api: DailyApi; view: DayMetrics; wide: boolean; status: CardStatus }) {
  const goal = api.settings.waterGoalMl;
  const percent = view.waterMl === null ? null : (view.waterMl / goal) * 100;
  const canSubtract = (view.waterMl ?? 0) > 0;
  const quick = (deltaMl: number) => {
    const label = deltaMl > 0 ? `+${formatWater(deltaMl)}` : `−${formatWater(Math.abs(deltaMl))}`;
    void api.commit(
      adjustWater(api.snap, { date: api.selected, deltaMl }, uiCtx(api.today)),
      label,
    );
  };
  return (
    <Card
      metric="water"
      wide={wide}
      label="Water"
      value={view.waterMl === null ? "—" : `${formatWater(view.waterMl)} / ${formatWater(goal)}`}
      status={status}
      onOpen={() => api.openSheet({ kind: "water" })}
      footer={
        <div className="daily-card-quick">
          <button
            type="button"
            className="daily-quick daily-quick-small"
            disabled={!canSubtract}
            onClick={() => quick(-250)}
            aria-label="Remove 250 millilitres of water"
          >
            −250
          </button>
          <button
            type="button"
            className="daily-quick daily-quick-small"
            onClick={() => quick(250)}
            aria-label="Add 250 millilitres of water"
          >
            +250
          </button>
        </div>
      }
    >
      <ProgressBar percent={percent} color={METRIC_META.water.ring} label="Water goal progress" />
      {view.waterMl !== null ? (
        <span className="daily-card-meta">
          <span>{formatPercent(percent ?? 0)}</span>
          <span>{formatWater(Math.max(0, goal - view.waterMl))} left</span>
        </span>
      ) : null}
    </Card>
  );
}

export default function TodayPage({ api }: { api: DailyApi }) {
  const settings = settingsOf(api.snap);
  const view = dayMetrics(api.snap, api.selected);
  const metrics = visibleMetrics(settings);
  const streak = currentStreak(api.snap, api.today);

  const statusFor = (metric: MetricKey): CardStatus => metricCardStatus(metric, view, settings);
  // Only finished cards sink to the bottom. Empty and in-progress keep the user's order together.
  const statusRank: Record<CardStatus, number> = { empty: 0, progress: 0, done: 1 };
  const sortedMetrics = [...metrics].sort((a, b) => statusRank[statusFor(a)] - statusRank[statusFor(b)]);
  const logged = metrics.filter((metric) => statusFor(metric) !== "empty").length;
  const missing = metrics.filter((metric) => statusFor(metric) === "empty").length;

  const go = (delta: number) => {
    const next = addDays(api.selected, delta);
    if (next > api.today) return;
    api.setSelected(next);
  };

  // When an odd number of compact cards remains, let the last one fill the row
  // instead of leaving a blank half-card hole in the grid.
  const compactMetrics = sortedMetrics.filter((metric) => metric !== "steps" && metric !== "water");
  const wideLastCompact = compactMetrics.length % 2 === 1 ? compactMetrics[compactMetrics.length - 1] : null;

  const renderCard = (metric: MetricKey) => {
    const wide = metric === "steps" || metric === "water" || metric === wideLastCompact;
    const status = statusFor(metric);
    switch (metric) {
      case "steps":
        return <StepsCard key={metric} api={api} view={view} wide={wide} status={status} />;
      case "weight":
        return <WeightCard key={metric} api={api} view={view} wide={wide} status={status} />;
      case "calories":
        return <CaloriesCard key={metric} api={api} view={view} wide={wide} status={status} />;
      case "sleep":
        return <SleepCard key={metric} api={api} view={view} wide={wide} status={status} />;
      case "water":
        return <WaterCard key={metric} api={api} view={view} wide={wide} status={status} />;
    }
  };

  return (
    <div className="daily-page">
      <header className="daily-hero">
        <div className="daily-hero-top">
          <div>
            <p className="daily-eyebrow">DetailFlows</p>
            <h1 className="daily-hero-title">Daily Tracker</h1>
            <p className="daily-hero-date">{dayLabel(api.selected, api.today)}</p>
          </div>
          <button type="button" className="daily-quicklog" onClick={() => api.openSheet({ kind: "quicklog" })}>
            <svg viewBox="0 0 24 24" aria-hidden focusable="false">
              <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
            </svg>
            <span>Log</span>
          </button>
        </div>

        <div className="daily-datebar" aria-label="Choose a day">
          <button
            type="button"
            className="daily-date-arrow"
            onClick={() => go(-1)}
            aria-label="Previous day"
          >
            ‹
          </button>
          <label className="daily-date-pick">
            <span className="daily-date-pick-text">
              {api.selected === api.today ? "Today" : shortDate(api.selected, api.selected.slice(0, 4) !== api.today.slice(0, 4))}
            </span>
            <input
              type="date"
              value={api.selected}
              max={api.today}
              aria-label="Pick a date"
              onChange={(event) => {
                const value = event.target.value;
                if (value && value <= api.today) api.setSelected(value);
              }}
            />
            <span className="daily-date-pick-icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                <rect x={4} y={5.5} width={16} height={15} rx={2.5} />
                <path d="M4 10h16M8.5 3v4M15.5 3v4" />
              </svg>
            </span>
          </label>
          <button
            type="button"
            className="daily-date-arrow"
            onClick={() => go(1)}
            disabled={api.selected >= api.today}
            aria-label="Next day"
          >
            ›
          </button>
        </div>

        <div className="daily-summary">
          <div className="daily-summary-dots" aria-hidden>
            {sortedMetrics.map((metric) => (
              <span
                key={metric}
                className={`daily-summary-dot${statusFor(metric) !== "empty" ? " is-on" : ""}`}
                style={{ ["--daily-accent" as string]: METRIC_META[metric].accent }}
              />
            ))}
          </div>
          {missing > 0 ? (
            <>
              <span className="daily-summary-missing">{missing} not logged</span>
              <span>
                {logged} of {metrics.length} entered
              </span>
            </>
          ) : (
            <span className="daily-summary-complete">All {metrics.length} logged</span>
          )}
          {streak > 1 ? <span className="daily-summary-streak">{streak}-day streak</span> : null}
        </div>
      </header>

      <div className="daily-metric-grid">{sortedMetrics.map(renderCard)}</div>
    </div>
  );
}
