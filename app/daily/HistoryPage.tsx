"use client";

import { useEffect, useMemo, useState } from "react";
import { dayMetrics, waterTotalForDate } from "@/daily/logic";
import { addMonths, dayLabel, longDate, monthGrid, monthKey, monthLabel, weekdayInitialsMondayFirst, dayOfMonth } from "@/daily/date";
import { formatCalories, formatDuration, formatInt, formatWater, formatWeight } from "@/daily/format";
import { METRIC_META, settingsOf, visibleMetrics, type MetricKey } from "@/daily/model";
import type { DailyApi } from "./api";

export default function HistoryPage({ api }: { api: DailyApi }) {
  const [month, setMonth] = useState(monthKey(api.selected));

  useEffect(() => {
    setMonth(monthKey(api.selected));
  }, [api.selected]);

  const cells = useMemo(() => monthGrid(month), [month]);
  const todayMonth = monthKey(api.today);
  const nextDisabled = month >= todayMonth;

  const waterByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of api.snap.water) map.set(entry.date, (map.get(entry.date) ?? 0) + entry.ml);
    return map;
  }, [api.snap.water]);

  const weightByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of api.snap.weights) map.set(entry.date, entry.kg);
    return map;
  }, [api.snap.weights]);

  const daysWith = useMemo(() => {
    const map = new Map<string, MetricKey[]>();
    const add = (date: string, metric: MetricKey) => {
      const list = map.get(date);
      if (list) {
        if (!list.includes(metric)) list.push(metric);
      } else {
        map.set(date, [metric]);
      }
    };
    for (const day of api.snap.days) {
      if (day.steps !== null) add(day.date, "steps");
      if (day.calories !== null) add(day.date, "calories");
      if (day.sleepMinutes !== null) add(day.date, "sleep");
    }
    for (const date of waterByDate.keys()) add(date, "water");
    for (const date of weightByDate.keys()) add(date, "weight");
    return map;
  }, [api.snap.days, waterByDate, weightByDate]);

  const selected = dayMetrics(api.snap, api.selected);
  const metrics = visibleMetrics(settingsOf(api.snap));
  const monthLogs = [...daysWith.keys()].filter((date) => date.startsWith(month)).length;

  const valueFor = (metric: MetricKey): string => {
    switch (metric) {
      case "steps":
        return selected.steps === null ? "—" : `${formatInt(selected.steps)}`;
      case "weight":
        return selected.weightKg === null ? "—" : formatWeight(selected.weightKg, api.settings.weightUnit);
      case "calories":
        return selected.calories === null ? "—" : formatCalories(selected.calories);
      case "sleep":
        return selected.sleepMinutes === null ? "—" : formatDuration(selected.sleepMinutes);
      case "water":
        return waterTotalForDate(api.snap, api.selected) === null
          ? "—"
          : formatWater(waterTotalForDate(api.snap, api.selected) ?? 0);
    }
  };

  const openMetric = (metric: MetricKey) => {
    api.openSheet({
      kind:
        metric === "steps"
          ? "steps"
          : metric === "weight"
            ? "weight"
            : metric === "calories"
              ? "calories"
              : metric === "sleep"
                ? "sleep"
                : "water",
    });
  };

  return (
    <div className="daily-page">
      <header className="daily-hero">
        <p className="daily-eyebrow">History</p>
        <h1 className="daily-hero-title">Calendar</h1>
      </header>

      <section className="daily-calendar" aria-label={`Calendar for ${monthLabel(month)}`}>
        <div className="daily-calendar-head">
          <button
            type="button"
            className="daily-date-arrow"
            onClick={() => setMonth(addMonths(month, -1))}
            aria-label="Previous month"
          >
            ‹
          </button>
          <div className="daily-calendar-title">
            <strong>{monthLabel(month)}</strong>
            <span>{monthLogs === 1 ? "1 day" : `${monthLogs} days`}</span>
          </div>
          <button
            type="button"
            className="daily-date-arrow"
            onClick={() => setMonth(addMonths(month, 1))}
            disabled={nextDisabled}
            aria-label="Next month"
          >
            ›
          </button>
        </div>

        <div className="daily-calendar-weekdays" aria-hidden>
          {weekdayInitialsMondayFirst().map((day, index) => (
            <span key={`${day}-${index}`}>{day}</span>
          ))}
        </div>

        <div className="daily-calendar-grid" role="grid">
          {cells.map((date, index) => {
            if (!date) return <span key={`blank-${index}`} className="daily-calendar-blank" aria-hidden />;
            const logged = (daysWith.get(date) ?? []).filter((metric) => metrics.includes(metric));
            const isSelected = date === api.selected;
            const isToday = date === api.today;
            const isFuture = date > api.today;
            return (
              <button
                key={date}
                type="button"
                role="gridcell"
                className={`daily-calendar-day${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}${isFuture ? " is-future" : ""}`}
                aria-selected={isSelected}
                aria-label={`${longDate(date)}${logged.length ? `, ${logged.length} metrics logged` : ""}`}
                disabled={isFuture}
                onClick={() => api.setSelected(date)}
              >
                <span className="daily-calendar-number">{dayOfMonth(date)}</span>
                <span className="daily-calendar-dots" aria-hidden>
                  {logged.map((metric) => (
                    <span key={metric} style={{ background: METRIC_META[metric].accent }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="daily-day-panel" aria-label="Selected day">
        <div className="daily-day-panel-head">
          <div>
            <p className="daily-eyebrow">Selected</p>
            <h2>{dayLabel(api.selected, api.today)}</h2>
          </div>
          <button type="button" className="daily-link" onClick={() => api.openSheet({ kind: "quicklog" })}>
            Log
          </button>
        </div>
        <ul className="daily-metric-rows">
          {metrics.map((metric) => {
            const meta = METRIC_META[metric];
            const value = valueFor(metric);
            return (
              <li key={metric} className="daily-metric-row">
                <span className="daily-metric-row-accent" style={{ background: meta.accent }} aria-hidden />
                <span className="daily-metric-row-main">
                  <strong>{meta.label}</strong>
                  <em className={value === "—" ? "is-missing" : ""}>{value}</em>
                </span>
                <button type="button" className="daily-link" onClick={() => openMetric(metric)}>
                  {value === "—" ? "Add" : "Edit"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
