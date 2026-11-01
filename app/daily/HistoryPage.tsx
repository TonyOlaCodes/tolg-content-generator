"use client";

import { useEffect, useMemo, useState } from "react";
import { dayMetrics, waterTotalForDate } from "@/daily/logic";
import { addMonths, dayLabel, longDate, monthGrid, monthKey, monthLabel, weekdayInitialsMondayFirst, dayOfMonth } from "@/daily/date";
import { formatCalories, formatDuration, formatInt, formatWater, formatWeight } from "@/daily/format";
import { METRIC_META, METRIC_KEYS, type MetricKey } from "@/daily/model";
import type { DailyApi } from "./api";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

  const highlightsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const highlight of api.snap.highlights) map.set(highlight.date, (map.get(highlight.date) ?? 0) + 1);
    return map;
  }, [api.snap.highlights]);

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
  const selectedHighlights = api.snap.highlights.filter((h) => h.date === api.selected);
  const monthHighlights = api.snap.highlights
    .filter((h) => h.date.startsWith(month))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const monthLogs = [...daysWith.keys()].filter((date) => date.startsWith(month)).length;

  const valueFor = (metric: MetricKey): string => {
    switch (metric) {
      case "steps":
        return selected.steps === null ? "Not logged" : `${formatInt(selected.steps)} steps`;
      case "weight":
        return selected.weightKg === null
          ? "Not logged"
          : `${formatWeight(selected.weightKg, api.settings.weightUnit)}${selected.weightCount > 1 ? ` · ${selected.weightCount} weigh-ins` : ""}`;
      case "calories":
        return selected.calories === null ? "Not logged" : formatCalories(selected.calories);
      case "sleep":
        return selected.sleepMinutes === null ? "Not logged" : formatDuration(selected.sleepMinutes);
      case "water":
        return waterTotalForDate(api.snap, api.selected) === null ? "Not logged" : formatWater(waterTotalForDate(api.snap, api.selected) ?? 0);
    }
  };

  const openMetric = (metric: MetricKey) => {
    api.openSheet({ kind: metric === "steps" ? "steps" : metric === "weight" ? "weight" : metric === "calories" ? "calories" : metric === "sleep" ? "sleep" : "water" });
  };

  return (
    <div className="daily-page">
      <header className="daily-hero">
        <p className="daily-eyebrow">History</p>
        <h1 className="daily-hero-title">Calendar</h1>
        <p className="daily-hero-date">Every day you have recorded, with nothing invented.</p>
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
            <span>{monthLogs === 1 ? "1 day logged" : `${monthLogs} days logged`}</span>
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
            const metrics = daysWith.get(date) ?? [];
            const isSelected = date === api.selected;
            const isToday = date === api.today;
            const isFuture = date > api.today;
            const highlightCount = highlightsByDate.get(date) ?? 0;
            return (
              <button
                key={date}
                type="button"
                role="gridcell"
                className={`daily-calendar-day${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}${isFuture ? " is-future" : ""}${highlightCount ? " has-highlight" : ""}`}
                aria-selected={isSelected}
                aria-label={`${longDate(date)}${metrics.length ? `, ${metrics.length} metrics logged` : ", nothing logged"}${highlightCount ? ", has a highlight" : ""}`}
                disabled={isFuture}
                onClick={() => api.setSelected(date)}
              >
                <span className="daily-calendar-number">{dayOfMonth(date)}</span>
                <span className="daily-calendar-dots" aria-hidden>
                  {METRIC_KEYS.filter((metric) => metrics.includes(metric)).map((metric) => (
                    <span key={metric} style={{ background: METRIC_META[metric].accent }} />
                  ))}
                </span>
                {highlightCount ? <span className="daily-calendar-star" aria-hidden>★</span> : null}
              </button>
            );
          })}
        </div>

        <div className="daily-calendar-legend">
          {METRIC_KEYS.map((metric) => (
            <span key={metric}>
              <i style={{ background: METRIC_META[metric].accent }} aria-hidden /> {METRIC_META[metric].short}
            </span>
          ))}
          <span>
            <i className="is-star" aria-hidden>★</i> Highlight
          </span>
        </div>
      </section>

      <section className="daily-day-panel" aria-label="Selected day">
        <div className="daily-day-panel-head">
          <div>
            <p className="daily-eyebrow">Selected day</p>
            <h2>{dayLabel(api.selected, api.today)}</h2>
          </div>
          <button type="button" className="daily-link" onClick={() => api.openSheet({ kind: "quicklog" })}>
            Log day
          </button>
        </div>
        <ul className="daily-metric-rows">
          {METRIC_KEYS.map((metric) => {
            const meta = METRIC_META[metric];
            const value = valueFor(metric);
            return (
              <li key={metric} className="daily-metric-row">
                <span className="daily-metric-row-accent" style={{ background: meta.accent }} aria-hidden />
                <span className="daily-metric-row-main">
                  <strong>{meta.label}</strong>
                  <em className={value === "Not logged" ? "is-missing" : ""}>{value}</em>
                </span>
                <button type="button" className="daily-link" onClick={() => openMetric(metric)}>
                  {value === "Not logged" ? "Add" : "Edit"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="daily-block">
        <div className="daily-block-head">
          <p className="daily-block-title">Highlights</p>
          <button type="button" className="daily-link" onClick={() => api.openSheet({ kind: "highlight", highlight: null })}>
            Add
          </button>
        </div>
        {selectedHighlights.length === 0 && monthHighlights.length === 0 ? (
          <p className="daily-hint">
            No highlights yet. Save a milestone or a memorable day whenever it feels worth keeping — never required.
          </p>
        ) : (
          <>
            {selectedHighlights.length > 0 ? (
              <ul className="daily-highlight-list">
                {selectedHighlights.map((highlight) => (
                  <li key={highlight.id}>
                    <button
                      type="button"
                      className="daily-highlight-row"
                      onClick={() => api.openSheet({ kind: "highlight", highlight })}
                    >
                      {highlight.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="daily-highlight-thumb" src={highlight.photo} alt="" />
                      ) : (
                        <span className="daily-highlight-badge" aria-hidden>★</span>
                      )}
                      <span className="daily-highlight-text">
                        <strong>{highlight.title}</strong>
                        {highlight.description ? <em>{highlight.description}</em> : null}
                        {highlight.tags.length ? <span className="daily-tags">{highlight.tags.map((tag) => `#${tag}`).join("  ")}</span> : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {monthHighlights.filter((h) => h.date !== api.selected).length > 0 ? (
              <div className="daily-month-highlights">
                <p className="daily-block-title">{MONTH_SHORT[Number(month.slice(5, 7)) - 1]} highlights</p>
                <ul>
                  {monthHighlights
                    .filter((h) => h.date !== api.selected)
                    .map((highlight) => (
                      <li key={highlight.id}>
                        <button
                          type="button"
                          className="daily-month-highlight"
                          onClick={() => {
                            api.setSelected(highlight.date);
                            api.openSheet({ kind: "highlight", highlight });
                          }}
                        >
                          <span className="daily-month-highlight-date">
                            {dayOfMonth(highlight.date)} {MONTH_SHORT[Number(highlight.date.slice(5, 7)) - 1]}
                          </span>
                          <span>{highlight.title}</span>
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </section>

      <p className="daily-footnote">Tap any date to see or edit that day. Future dates stay closed.</p>
    </div>
  );
}
