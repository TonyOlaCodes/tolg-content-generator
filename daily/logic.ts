import type { ChartPeriod, MetricKey, Settings, Snapshot, WeightEntry } from "./model";
import { settingsOf } from "./model";

/** Today-card completion: empty, started but unfinished, or fully done for the day. */
export type MetricCardStatus = "empty" | "progress" | "done";
import {
  addDays,
  addMonths,
  compareDateKeys,
  daysBetween,
  eachDay,
  monthKey,
  monthLabel,
  shortDate,
  startOfWeek,
  todayKey,
} from "./date";
import { formatDuration, formatInt, formatWater, formatWeight, formatWeightChange, kgToUnit } from "./format";

export type SeriesPoint = { date: string; value: number | null };

export type DayMetrics = {
  date: string;
  steps: number | null;
  calories: number | null;
  sleepMinutes: number | null;
  waterMl: number | null;
  /** The day's weigh-in, or null when there was none. */
  weightKg: number | null;
  weightId: string | null;
  hasData: boolean;
};

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Population standard deviation; null until there are at least two values. */
export function standardDeviation(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = average(values);
  if (mean === null) return null;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function waterTotalForDate(snapshot: Snapshot, date: string): number | null {
  const entries = snapshot.water.filter((w) => w.date === date);
  if (entries.length === 0) return null;
  return entries.reduce((sum, w) => sum + w.ml, 0);
}

/** Sorts weigh-ins by date, with creation time only as a stable tie-breaker. */
export function sortWeights(entries: WeightEntry[]): WeightEntry[] {
  return [...entries].sort((a, b) => {
    if (a.date !== b.date) return compareDateKeys(a.date, b.date);
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });
}

export function weightsForDate(snapshot: Snapshot, date: string): WeightEntry[] {
  return sortWeights(snapshot.weights.filter((w) => w.date === date));
}

export function latestWeightOn(snapshot: Snapshot, date: string): WeightEntry | null {
  const list = weightsForDate(snapshot, date);
  return list.length ? list[list.length - 1] : null;
}

/** Most recent weigh-in on or before `date` (or the latest overall). */
export function latestWeight(snapshot: Snapshot, date?: string): WeightEntry | null {
  const list = sortWeights(date ? snapshot.weights.filter((w) => w.date <= date) : snapshot.weights);
  return list.length ? list[list.length - 1] : null;
}

export function dayMetrics(snapshot: Snapshot, date: string): DayMetrics {
  const day = snapshot.days.find((d) => d.date === date) ?? null;
  const weights = weightsForDate(snapshot, date);
  const latest = weights.length ? weights[weights.length - 1] : null;
  const waterMl = waterTotalForDate(snapshot, date);
  const steps = day?.steps ?? null;
  const calories = day?.calories ?? null;
  const sleepMinutes = day?.sleepMinutes ?? null;
  return {
    date,
    steps,
    calories,
    sleepMinutes,
    waterMl,
    weightKg: latest ? latest.kg : null,
    weightId: latest ? latest.id : null,
    hasData: steps !== null || calories !== null || sleepMinutes !== null || waterMl !== null || latest !== null,
  };
}

/**
 * Status for a Today metric card.
 * - Goal metrics (steps/water/sleep/calories-with-goal): partial counts as progress, never done.
 * - Weight: done only when that calendar day has a weigh-in (past days do not count).
 * - Calories-without-goal: logging the day is enough.
 */
export function metricCardStatus(metric: MetricKey, view: DayMetrics, settings: Settings): MetricCardStatus {
  switch (metric) {
    case "steps":
      if (view.steps === null) return "empty";
      return view.steps >= settings.stepGoal ? "done" : "progress";
    case "water":
      if (view.waterMl === null) return "empty";
      return view.waterMl >= settings.waterGoalMl ? "done" : "progress";
    case "calories":
      if (view.calories === null) return "empty";
      if (settings.calorieGoal === null) return "done";
      return view.calories >= settings.calorieGoal ? "done" : "progress";
    case "sleep":
      if (view.sleepMinutes === null) return "empty";
      return view.sleepMinutes >= settings.sleepGoalMinutes ? "done" : "progress";
    case "weight":
      return view.weightKg !== null ? "done" : "empty";
  }
}

export function metricValueForDay(snapshot: Snapshot, date: string, metric: MetricKey): number | null {
  const view = dayMetrics(snapshot, date);
  switch (metric) {
    case "steps":
      return view.steps;
    case "calories":
      return view.calories;
    case "sleep":
      return view.sleepMinutes;
    case "water":
      return view.waterMl;
    case "weight":
      return view.weightKg;
  }
}

export function seriesForMetric(snapshot: Snapshot, dates: string[], metric: MetricKey): SeriesPoint[] {
  return dates.map((date) => ({ date, value: metricValueForDay(snapshot, date, metric) }));
}

/**
 * First day with a tracked metric. Highlights alone do not open an analytics
 * range, because a highlight is not a measurement.
 */
export function earliestMetricDate(snapshot: Snapshot): string | null {
  const dates: string[] = [
    ...snapshot.days.map((d) => d.date),
    ...snapshot.weights.map((w) => w.date),
    ...snapshot.water.map((w) => w.date),
  ];
  if (dates.length === 0) return null;
  return dates.reduce((min, d) => (d < min ? d : min), dates[0]);
}

/**
 * Start of the selected chart range. Analytics never reach back before the
 * first logged day: a new tracker with one entry yesterday reports one day,
 * not thirty empty days. "All time" starts at that first measurement too.
 */
export function periodStart(snapshot: Snapshot, period: ChartPeriod, end: string): string {
  const first = earliestMetricDate(snapshot);
  if (!first) return end;
  const requested = period > 0 ? addDays(end, -(period - 1)) : first;
  return requested < first ? first : requested;
}

export function periodDates(snapshot: Snapshot, period: ChartPeriod, end: string): string[] {
  return eachDay(periodStart(snapshot, period, end), end);
}

export type Bucket = {
  label: string;
  /** Average of the recorded days inside the bucket; null when nothing was recorded. */
  value: number | null;
  points: SeriesPoint[];
  from: string;
  to: string;
  loggedDays: number;
};

/**
 * Keeps short ranges daily and folds longer ranges into weekly/monthly buckets
 * so charts stay readable on a phone. Missing days never become zero: buckets
 * average only recorded values and are null when the bucket has no data.
 */
export function bucketSeries(series: SeriesPoint[], today: string): Bucket[] {
  // Bin by the range that actually has records, not by the requested period.
  const bucketDays = series.length <= 35 ? 1 : series.length <= 210 ? 7 : 0;
  const toBucket = (points: SeriesPoint[]): Bucket => {
    const values = points.map((p) => p.value).filter((v): v is number => v !== null);
    const from = points[0]?.date ?? "";
    const to = points[points.length - 1]?.date ?? "";
    const label =
      bucketDays === 0
        ? monthLabel(monthKey(from))
        : bucketDays === 7
          ? shortDate(from)
          : from === today
            ? "Today"
            : shortDate(from, from.slice(0, 4) !== today.slice(0, 4));
    return { label, value: average(values), points, from, to, loggedDays: values.length };
  };

  if (bucketDays === 1) return series.map((point) => toBucket([point]));

  const buckets: Bucket[] = [];
  if (bucketDays === 7) {
    for (let i = 0; i < series.length; i += 7) buckets.push(toBucket(series.slice(i, i + 7)));
    return buckets;
  }

  const byMonth = new Map<string, SeriesPoint[]>();
  for (const point of series) {
    const key = monthKey(point.date);
    const list = byMonth.get(key);
    if (list) list.push(point);
    else byMonth.set(key, [point]);
  }
  for (const points of byMonth.values()) buckets.push(toBucket(points));
  return buckets;
}

export type GoalStats = {
  loggedDays: number;
  goalDays: number;
  /** Share of *logged* days that reached the goal; null when nothing was logged. */
  rate: number | null;
};

export function goalStats(series: SeriesPoint[], goal: number | null): GoalStats {
  const values = series.map((p) => p.value).filter((v): v is number => v !== null);
  if (goal === null || goal <= 0) return { loggedDays: values.length, goalDays: 0, rate: null };
  const goalDays = values.filter((v) => v >= goal).length;
  return {
    loggedDays: values.length,
    goalDays,
    rate: values.length ? (goalDays / values.length) * 100 : null,
  };
}

export function percentOf(value: number | null, goal: number | null): number | null {
  if (value === null || goal === null || goal <= 0) return null;
  return (value / goal) * 100;
}

export type WeightAverage = { key: string; label: string; kg: number; count: number };

function averagesBy(
  entries: WeightEntry[],
  keyOf: (entry: WeightEntry) => string,
  labelOf: (key: string) => string,
): WeightAverage[] {
  const groups = new Map<string, WeightEntry[]>();
  for (const entry of fieldSorted(entries)) {
    const key = keyOf(entry);
    const list = groups.get(key);
    if (list) list.push(entry);
    else groups.set(key, [entry]);
  }
  return [...groups.entries()].map(([key, list]) => ({
    key,
    label: labelOf(key),
    kg: list.reduce((sum, e) => sum + e.kg, 0) / list.length,
    count: list.length,
  }));
}

function fieldSorted(entries: WeightEntry[]): WeightEntry[] {
  return sortWeights(entries);
}

export type WeightStats = {
  measurements: WeightEntry[];
  count: number;
  latest: WeightEntry | null;
  first: WeightEntry | null;
  changeKg: number | null;
  daily: SeriesPoint[];
  smoothed: SeriesPoint[];
  weekly: WeightAverage[];
  monthly: WeightAverage[];
};

/** Weight trend over a date range, based only on real measurements. */
export function weightStats(snapshot: Snapshot, from: string, to: string): WeightStats {
  const measurements = fieldSorted(snapshot.weights.filter((w) => w.date >= from && w.date <= to));
  const dates = eachDay(from, to);
  const perDay = new Map<string, WeightEntry>();
  for (const entry of measurements) perDay.set(entry.date, entry);
  const daily: SeriesPoint[] = dates
    .filter((date) => perDay.has(date))
    .map((date) => ({ date, value: perDay.get(date)?.kg ?? null }));

  // Smoothed trend: exponentially weighted average over actual weigh-ins, so
  // missing days are skipped rather than counted as unchanged or zero.
  const alpha = 0.3;
  let smooth: number | null = null;
  const smoothed: SeriesPoint[] = [];
  for (const point of daily) {
    if (point.value === null) continue;
    smooth = smooth === null ? point.value : smooth + alpha * (point.value - smooth);
    smoothed.push({ date: point.date, value: smooth });
  }

  const first = measurements.length ? measurements[0] : null;
  const latest = measurements.length ? measurements[measurements.length - 1] : null;
  const changeKg = first && latest && measurements.length >= 2 ? latest.kg - first.kg : null;

  return {
    measurements,
    count: measurements.length,
    latest,
    first,
    changeKg,
    daily,
    smoothed,
    weekly: averagesBy(measurements, (e) => startOfWeek(e.date), (key) => `w/c ${shortDate(key)}`),
    monthly: averagesBy(measurements, (e) => monthKey(e.date), (key) => monthLabel(key)),
  };
}

/** Latest weigh-in overall plus change over a window ending `today`. */
export function weightOverview(snapshot: Snapshot, today: string) {
  const latest = latestWeight(snapshot);
  const thirtyDay = weightStats(snapshot, addDays(today, -29), today);
  const sevenDay = weightStats(snapshot, addDays(today, -6), today);
  return {
    latest,
    change30: thirtyDay.changeKg,
    change7: sevenDay.changeKg,
  };
}

export type WeightSeriesPoint = { date: string; kg: number };

/** All weigh-ins for a long-range chart, one point per measurement. */
export function weightMeasurementsSeries(snapshot: Snapshot, from: string, to: string): WeightSeriesPoint[] {
  return fieldSorted(snapshot.weights.filter((w) => w.date >= from && w.date <= to)).map((w) => ({
    date: w.date,
    kg: w.kg,
  }));
}

export type Insight = { metric: MetricKey | null; text: string };

/** Selected chart window label — always the timeframe the user picked, not “first entry”. */
export function timeframeLabel(period: ChartPeriod): string {
  if (period === 0) return "all time";
  if (period === 7) return "the last 7 days";
  if (period === 30) return "the last 30 days";
  if (period === 90) return "the last 90 days";
  if (period === 365) return "the last year";
  return `the last ${period} days`;
}

function coachAgainstGoal(
  metric: MetricKey,
  goodLead: string,
  needLead: string,
  avgLabel: string,
  avg: number,
  goal: number,
  where: string,
  formatGoal: (n: number) => string = formatInt,
): Insight {
  const onTrack = avg >= goal * 0.95;
  const lead = onTrack ? goodLead : needLead;
  const vs =
    avg >= goal
      ? `averaging ${avgLabel}, ahead of your ${formatGoal(goal)} goal`
      : `averaging ${avgLabel} vs your ${formatGoal(goal)} goal`;
  return { metric, text: `${lead} — ${vs} over ${where}.` };
}

/**
 * Coaching insights for the selected timeframe. Averages use only logged days
 * inside that window; the copy always names the timeframe the user picked.
 */
export function buildInsights(snapshot: Snapshot, period: ChartPeriod, today: string): Insight[] {
  const settings = settingsOf(snapshot);
  const dates = periodDates(snapshot, period, today);
  const out: Insight[] = [];
  const where = timeframeLabel(period);

  const stepSeries = seriesForMetric(snapshot, dates, "steps");
  const stepAvg = average(stepSeries.map((p) => p.value).filter((v): v is number => v !== null));
  if (stepAvg !== null) {
    out.push(
      coachAgainstGoal(
        "steps",
        "Good on steps",
        "Need more steps",
        formatInt(stepAvg),
        stepAvg,
        settings.stepGoal,
        where,
      ),
    );
  }

  const waterSeries = seriesForMetric(snapshot, dates, "water");
  const waterAvg = average(waterSeries.map((p) => p.value).filter((v): v is number => v !== null));
  if (waterAvg !== null) {
    out.push(
      coachAgainstGoal(
        "water",
        "Good on water",
        "Need more water",
        formatWater(Math.round(waterAvg)),
        waterAvg,
        settings.waterGoalMl,
        where,
        formatWater,
      ),
    );
  }

  const sleepSeries = seriesForMetric(snapshot, dates, "sleep");
  const sleepAvg = average(sleepSeries.map((p) => p.value).filter((v): v is number => v !== null));
  if (sleepAvg !== null) {
    out.push(
      coachAgainstGoal(
        "sleep",
        "Good on sleep",
        "Need more sleep",
        formatDuration(sleepAvg),
        sleepAvg,
        settings.sleepGoalMinutes,
        where,
        formatDuration,
      ),
    );
  }

  const calorieSeries = seriesForMetric(snapshot, dates, "calories");
  const calorieAvg = average(calorieSeries.map((p) => p.value).filter((v): v is number => v !== null));
  if (calorieAvg !== null) {
    if (settings.calorieGoal !== null) {
      const goal = settings.calorieGoal;
      const near = Math.abs(calorieAvg - goal) <= goal * 0.05;
      const high = calorieAvg > goal * 1.05;
      const text = near
        ? `Good on calories — averaging ${formatInt(calorieAvg)} kcal, near your ${formatInt(goal)} kcal goal over ${where}.`
        : high
          ? `Eating above your goal — averaging ${formatInt(calorieAvg)} kcal vs ${formatInt(goal)} kcal over ${where}.`
          : `Need more calories — averaging ${formatInt(calorieAvg)} kcal vs your ${formatInt(goal)} kcal goal over ${where}.`;
      out.push({ metric: "calories", text });
    } else {
      out.push({
        metric: "calories",
        text: `Averaging ${formatInt(calorieAvg)} kcal over ${where}.`,
      });
    }
  }

  const weight = weightStats(snapshot, dates[0] ?? today, today);
  if (weight.changeKg !== null && weight.first && weight.latest && weight.count >= 2) {
    const delta = weight.changeKg;
    const amount = formatWeightChange(Math.abs(delta), settings.weightUnit).replace("+", "");
    let text: string;
    if (delta === 0) {
      text = `Weight held steady over ${where}.`;
    } else if (settings.weightGoalKg !== null) {
      const before = Math.abs(weight.first.kg - settings.weightGoalKg);
      const after = Math.abs(weight.latest.kg - settings.weightGoalKg);
      if (after < before - 0.05) {
        text = `Moving toward your ${formatWeight(settings.weightGoalKg, settings.weightUnit)} goal (${delta < 0 ? "down" : "up"} ${amount}) over ${where}.`;
      } else if (after > before + 0.05) {
        text = `Moving away from your ${formatWeight(settings.weightGoalKg, settings.weightUnit)} goal (${delta < 0 ? "down" : "up"} ${amount}) over ${where}.`;
      } else {
        text = `Weight ${delta < 0 ? "down" : "up"} ${amount} over ${where}.`;
      }
    } else {
      text = `Weight ${delta < 0 ? "down" : "up"} ${amount} over ${where}.`;
    }
    out.push({ metric: "weight", text });
  }

  return out.slice(0, 5);
}

/** Consecutive days up to `today` with at least one recorded metric. */
export function currentStreak(snapshot: Snapshot, today: string): number {
  let streak = 0;
  let cursor = today;
  const first = earliestMetricDate(snapshot);
  if (!first) return 0;
  for (let i = 0; i < 4_000; i += 1) {
    if (cursor < first) break;
    if (!dayMetrics(snapshot, cursor).hasData) break;
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Days in the current ISO week (Monday–Sunday) that are on or before today. */
export function weekToDate(today: string): string[] {
  const start = startOfWeek(today);
  const total = daysBetween(start, today);
  return eachDay(start, today).slice(0, total + 1);
}

export function monthToDate(today: string): string[] {
  return eachDay(`${today.slice(0, 7)}-01`, today);
}

export function weekAverage(snapshot: Snapshot, today: string, metric: MetricKey): number | null {
  const dates = weekToDate(today);
  return average(
    seriesForMetric(snapshot, dates, metric)
      .map((p) => p.value)
      .filter((v): v is number => v !== null),
  );
}

export function monthAverage(snapshot: Snapshot, today: string, metric: MetricKey): number | null {
  return average(
    seriesForMetric(snapshot, monthToDate(today), metric)
      .map((p) => p.value)
      .filter((v): v is number => v !== null),
  );
}

export function displayWeightValue(kg: number | null, unit: "kg" | "lb"): string {
  if (kg === null) return "—";
  return formatWeight(kg, unit);
}

export function weightInUnit(kg: number, unit: "kg" | "lb"): number {
  return kgToUnit(kg, unit);
}

/** Stable "today" over a session; the UI re-checks this on a timer for midnight. */
export function safeToday(): string {
  return todayKey(new Date());
}

export function weeksInRange(snapshot: Snapshot, period: ChartPeriod, today: string): string[] {
  const from = periodStart(snapshot, period, today);
  return [...new Set(eachDay(from, today).map(startOfWeek))];
}

export function monthsInRange(snapshot: Snapshot, period: ChartPeriod, today: string): string[] {
  const from = periodStart(snapshot, period, today);
  return [...new Set(eachDay(from, today).map(monthKey))];
}

export function shiftMonth(month: string, count: number): string {
  return addMonths(month, count);
}
