"use client";

import { useMemo, type ReactNode } from "react";
import { saveChartPeriod } from "@/daily/actions";
import {
  average,
  bucketSeries,
  buildInsights,
  goalStats,
  periodDates,
  seriesForMetric,
  standardDeviation,
  weightStats,
  type Bucket,
} from "@/daily/logic";
import { shortDate, startOfWeek } from "@/daily/date";
import { formatCalories, formatDuration, formatInt, formatPercent, formatWater, formatWeight, formatWeightChange } from "@/daily/format";
import { CHART_PERIODS, METRIC_META, type MetricKey } from "@/daily/model";
import { BarChart, LineChart } from "./charts";
import type { DailyApi } from "./api";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="daily-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <em>{hint}</em> : null}
    </div>
  );
}

function TrendSection({
  metric,
  title,
  children,
  empty,
}: {
  metric: MetricKey;
  title: string;
  children?: ReactNode;
  empty: boolean;
}) {
  const meta = METRIC_META[metric];
  return (
    <section className="daily-trend" style={{ ["--daily-accent" as string]: meta.accent }}>
      <div className="daily-trend-head">
        <h2>{title}</h2>
        <span className="daily-trend-dot" style={{ background: meta.accent }} aria-hidden />
      </div>
      {empty ? <p className="daily-empty">No data</p> : children}
    </section>
  );
}

function BucketStats({ buckets }: { buckets: Bucket[] }) {
  const logged = buckets.filter((b) => b.value !== null).length;
  if (logged === 0) return null;
  return <p className="daily-meta-line">{logged === 1 ? "1 period" : `${logged} periods`}</p>;
}

export default function TrendsPage({ api }: { api: DailyApi }) {
  const period = api.settings.chartPeriod;
  const dates = useMemo(() => periodDates(api.snap, period, api.today), [api.snap, period, api.today]);
  const from = dates[0] ?? api.today;
  const insights = useMemo(() => buildInsights(api.snap, period, api.today), [api.snap, period, api.today]);

  const stepBuckets = useMemo(() => bucketSeries(seriesForMetric(api.snap, dates, "steps"), api.today), [api.snap, dates, api.today]);
  const calorieBuckets = useMemo(() => bucketSeries(seriesForMetric(api.snap, dates, "calories"), api.today), [api.snap, dates, api.today]);
  const sleepBuckets = useMemo(() => bucketSeries(seriesForMetric(api.snap, dates, "sleep"), api.today), [api.snap, dates, api.today]);
  const waterBuckets = useMemo(() => bucketSeries(seriesForMetric(api.snap, dates, "water"), api.today), [api.snap, dates, api.today]);
  const weight = useMemo(() => weightStats(api.snap, from, api.today), [api.snap, from, api.today]);

  const stepSeries = seriesForMetric(api.snap, dates, "steps");
  const calorieSeries = seriesForMetric(api.snap, dates, "calories");
  const sleepSeries = seriesForMetric(api.snap, dates, "sleep");
  const waterSeries = seriesForMetric(api.snap, dates, "water");

  const stepValues = stepSeries.map((p) => p.value).filter((v): v is number => v !== null);
  const calorieValues = calorieSeries.map((p) => p.value).filter((v): v is number => v !== null);
  const sleepValues = sleepSeries.map((p) => p.value).filter((v): v is number => v !== null);
  const waterValues = waterSeries.map((p) => p.value).filter((v): v is number => v !== null);

  const stepStats = goalStats(stepSeries, api.settings.stepGoal);
  const waterStats = goalStats(waterSeries, api.settings.waterGoalMl);
  const waterWeeks = useMemo(() => {
    const groups = new Map<string, number[]>();
    dates.forEach((date, index) => {
      const value = waterSeries[index]?.value;
      if (value === null || value === undefined) return;
      const key = startOfWeek(date);
      const list = groups.get(key);
      if (list) list.push(value);
      else groups.set(key, [value]);
    });
    return [...groups.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, values]) => ({
        key,
        label: `w/c ${shortDate(key)}`,
        value: values.reduce((sum, v) => sum + v, 0) / values.length,
        count: values.length,
      }));
  }, [dates, waterSeries]);
  const calorieAvg = average(calorieValues);
  const sleepAvg = average(sleepValues);
  const sleepSd = standardDeviation(sleepValues);

  const hasAnyData =
    stepValues.length > 0 ||
    calorieValues.length > 0 ||
    sleepValues.length > 0 ||
    waterValues.length > 0 ||
    weight.count > 0;

  // A new tracker should never claim a 30-day average from one logged day.
  const clampedToFirstEntry = period !== 0 && dates.length < period;
  const rangePhrase = period === 0 || clampedToFirstEntry ? "since your first entry" : `the last ${period} days`;
  const rangeLabel = period === 0 ? "all time" : `the last ${period} days`;

  return (
    <div className="daily-page">
      <header className="daily-hero">
        <p className="daily-eyebrow">Trends</p>
        <h1 className="daily-hero-title">Progress</h1>
        <p className="daily-hero-date">{rangePhrase}</p>
      </header>

      <div className="daily-period-chips" role="tablist" aria-label="Chart period">
        {CHART_PERIODS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={period === option.value}
            className={`daily-chip${period === option.value ? " is-active" : ""}`}
            onClick={() => {
              if (option.value === period) return;
              void api.commit(saveChartPeriod(api.snap, option.value), `${option.label} selected`, false);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {!hasAnyData ? (
        <section className="daily-empty">
          <h2>Nothing tracked yet</h2>
          <p>Log a day and your averages, trends and goal completion appear here automatically — no placeholders.</p>
          <button type="button" className="daily-btn-primary" onClick={() => api.setPage("today")}>
            Go to Today
          </button>
        </section>
      ) : null}

      {insights.length > 0 ? (
        <section className="daily-insights" aria-label="Insights">
          <h2 className="daily-block-title">Insights</h2>
          <ul>
            {insights.map((insight) => (
              <li key={insight.text}>
                <span
                  className="daily-insight-dot"
                  style={{ background: insight.metric ? METRIC_META[insight.metric].accent : "#a49fb2" }}
                  aria-hidden
                />
                <span>{insight.text}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <TrendSection metric="steps" title="Steps" empty={stepValues.length === 0}>
        <BarChart
          bars={stepBuckets.map((bucket) => ({ label: bucket.label, value: bucket.value }))}
          color={METRIC_META.steps.ring}
          formatValue={(value) => `${formatInt(value)} steps`}
          goal={api.settings.stepGoal}
          ariaLabel={`Steps chart for ${rangeLabel}`}
        />
        <div className="daily-stats">
          <Stat label="Average" value={stepValues.length ? `${formatInt(average(stepValues) ?? 0)} steps` : "—"} />
          <Stat label="Days logged" value={`${stepStats.loggedDays}`} hint="in this range" />
          <Stat
            label="Goal reached"
            value={stepStats.rate === null ? "—" : formatPercent(stepStats.rate)}
            hint={`${stepStats.goalDays} of ${stepStats.loggedDays} logged days`}
          />
        </div>
        <BucketStats buckets={stepBuckets} />
      </TrendSection>

      <TrendSection metric="weight" title="Weight" empty={weight.count === 0}>
        <LineChart
          points={weight.daily}
          smoothed={weight.smoothed}
          color={METRIC_META.weight.ring}
          formatValue={(value) => formatWeight(value, api.settings.weightUnit)}
          ariaLabel={`Weight chart for ${rangeLabel}`}
          goal={api.settings.weightGoalKg}
          goalText={api.settings.weightGoalKg !== null ? `Goal ${formatWeight(api.settings.weightGoalKg, api.settings.weightUnit)}` : undefined}
        />
        <p className="daily-chart-legend">
          <span className="is-solid" style={{ background: METRIC_META.weight.ring }} aria-hidden /> Weigh-ins
          <span className="is-dashed" style={{ color: METRIC_META.weight.ring }} aria-hidden /> Smoothed trend
          {api.settings.weightGoalKg !== null ? (
            <>
              <span className="is-dashed" style={{ color: METRIC_META.weight.accent }} aria-hidden /> Goal
            </>
          ) : null}
        </p>
        <div className="daily-stats">
          <Stat label="Latest" value={weight.latest ? formatWeight(weight.latest.kg, api.settings.weightUnit) : "—"} hint={weight.latest ? shortDate(weight.latest.date, true) : undefined} />
          <Stat
            label="Change"
            value={weight.changeKg === null ? "—" : formatWeightChange(weight.changeKg, api.settings.weightUnit)}
            hint={weight.count ? `${weight.count}` : undefined}
          />
          <Stat label="Average" value={weight.count ? formatWeight(average(weight.measurements.map((m) => m.kg)) ?? 0, api.settings.weightUnit) : "—"} />
        </div>
        {weight.weekly.length > 0 ? (
          <div className="daily-averages">
            <p className="daily-block-title">Weekly averages</p>
            <ul>
              {weight.weekly.slice(-4).map((week) => (
                <li key={week.key}>
                  <span>{week.label}</span>
                  <em>
                    {formatWeight(week.kg, api.settings.weightUnit)} · {week.count === 1 ? "1 weigh-in" : `${week.count} weigh-ins`}
                  </em>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {weight.monthly.length > 0 ? (
          <div className="daily-averages">
            <p className="daily-block-title">Monthly averages</p>
            <ul>
              {weight.monthly.slice(-4).map((month) => (
                <li key={month.key}>
                  <span>{month.label}</span>
                  <em>
                    {formatWeight(month.kg, api.settings.weightUnit)} · {month.count === 1 ? "1 weigh-in" : `${month.count} weigh-ins`}
                  </em>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </TrendSection>

      <TrendSection metric="calories" title="Calories" empty={calorieValues.length === 0}>
        <BarChart
          bars={calorieBuckets.map((bucket) => ({ label: bucket.label, value: bucket.value }))}
          color={METRIC_META.calories.ring}
          formatValue={(value) => formatCalories(value)}
          goal={api.settings.calorieGoal}
          ariaLabel={`Calories chart for ${rangeLabel}`}
        />
        <div className="daily-stats">
          <Stat label="Average" value={calorieAvg === null ? "—" : formatCalories(calorieAvg)} />
          <Stat label="Days logged" value={`${calorieValues.length}`} />
          <Stat
            label="Goal"
            value={api.settings.calorieGoal === null ? "—" : `${formatInt(api.settings.calorieGoal)}`}
            hint={
              calorieAvg !== null && api.settings.calorieGoal !== null
                ? `avg ${calorieAvg > api.settings.calorieGoal ? "+" : "−"}${formatInt(Math.abs(calorieAvg - api.settings.calorieGoal))}`
                : undefined
            }
          />
        </div>
      </TrendSection>

      <TrendSection metric="sleep" title="Sleep" empty={sleepValues.length === 0}>
        <BarChart
          bars={sleepBuckets.map((bucket) => ({ label: bucket.label, value: bucket.value }))}
          color={METRIC_META.sleep.ring}
          formatValue={(value) => formatDuration(value)}
          ariaLabel={`Sleep chart for ${rangeLabel}`}
        />
        <div className="daily-stats">
          <Stat label="Average" value={sleepAvg === null ? "—" : formatDuration(sleepAvg)} />
          <Stat label="Nights" value={`${sleepValues.length}`} />
          <Stat label="Spread" value={sleepSd === null ? "—" : `±${Math.round(sleepSd)}m`} />
        </div>
      </TrendSection>

      <TrendSection metric="water" title="Water" empty={waterValues.length === 0}>
        <BarChart
          bars={waterBuckets.map((bucket) => ({ label: bucket.label, value: bucket.value }))}
          color={METRIC_META.water.ring}
          formatValue={(value) => formatWater(Math.round(value))}
          goal={api.settings.waterGoalMl}
          ariaLabel={`Water chart for ${rangeLabel}`}
        />
        <div className="daily-stats">
          <Stat label="Average" value={waterValues.length ? formatWater(Math.round(average(waterValues) ?? 0)) : "—"} />
          <Stat label="Days logged" value={`${waterStats.loggedDays}`} />
          <Stat
            label="Goal reached"
            value={waterStats.rate === null ? "—" : formatPercent(waterStats.rate)}
            hint={`${waterStats.goalDays} of ${waterStats.loggedDays} logged days`}
          />
        </div>
        {waterWeeks.length > 0 ? (
          <div className="daily-averages">
            <p className="daily-block-title">Weekly averages</p>
            <ul>
              {waterWeeks.slice(-4).map((week) => (
                <li key={week.key}>
                  <span>{week.label}</span>
                  <em>
                    {formatWater(Math.round(week.value))} · {week.count === 1 ? "1 day logged" : `${week.count} days logged`}
                  </em>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </TrendSection>

    </div>
  );
}
