"use client";

import { useState, type ReactNode } from "react";
import { saveSettings, type Result } from "@/daily/actions";
import { exportSnapshot, validateBackup } from "@/daily/backup";
import { todayKey } from "@/daily/date";
import { formatWater } from "@/daily/format";
import { CHART_PERIODS, EMPTY_SNAPSHOT, METRIC_META, settingsOf, type MetricKey } from "@/daily/model";
import { parseWhole, type DailyApi } from "./api";

function Section({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  return (
    <section className="daily-settings-section">
      <h2>{title}</h2>
      {hint ? <p className="daily-hint">{hint}</p> : null}
      {children}
    </section>
  );
}

export default function SettingsPage({ api }: { api: DailyApi }) {
  const settings = settingsOf(api.snap);
  const [stepGoal, setStepGoal] = useState(String(settings.stepGoal));
  const [calorieGoal, setCalorieGoal] = useState(settings.calorieGoal !== null ? String(settings.calorieGoal) : "");
  const [waterGoal, setWaterGoal] = useState(String(settings.waterGoalMl));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const saveGoals = async () => {
    setError(null);
    const steps = parseWhole(stepGoal);
    if (steps === null) return setError("Enter your daily step goal as a whole number.");
    const water = parseWhole(waterGoal);
    if (water === null) return setError("Enter your daily water goal in millilitres.");
    const trimmedCalories = calorieGoal.trim();
    const calories = trimmedCalories ? parseWhole(trimmedCalories) : null;
    if (trimmedCalories && calories === null) return setError("Enter a whole number for calories, or leave it blank.");
    setBusy(true);
    const message = await api.commit(
      saveSettings(api.snap, { stepGoal: steps, waterGoalMl: water, calorieGoal: calories }),
      "Goals saved",
      false,
    );
    setBusy(false);
    if (message) setError(message);
  };

  const apply = async (result: Result, message: string) => {
    setError(null);
    setBusy(true);
    const failure = await api.commit(result, message, false);
    setBusy(false);
    if (failure) setError(failure);
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= settings.metricOrder.length) return;
    const order = [...settings.metricOrder];
    [order[index], order[target]] = [order[target], order[index]];
    void apply(saveSettings(api.snap, { metricOrder: order }), "Card order updated");
  };

  const toggleHidden = (metric: MetricKey) => {
    const hidden = settings.hiddenMetrics.includes(metric)
      ? settings.hiddenMetrics.filter((m) => m !== metric)
      : [...settings.hiddenMetrics, metric];
    void apply(saveSettings(api.snap, { hiddenMetrics: hidden }), settings.hiddenMetrics.includes(metric) ? "Card shown" : "Card hidden");
  };

  const download = () => {
    const json = exportSnapshot(api.snap);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `daily-tracker-backup-${todayKey()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    api.notify("Backup downloaded");
  };

  const restore = async (file: File) => {
    setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setError("That file is not valid JSON. Nothing was restored.");
      return;
    }
    const validation = validateBackup(parsed);
    if (!validation.ok) {
      setError(`${validation.error} Nothing was restored.`);
      return;
    }
    if (!window.confirm("Replace ALL Daily Tracker data on this device with this backup? This cannot be undone.")) return;
    setBusy(true);
    const message = await api.replace(validation.data);
    setBusy(false);
    if (message) setError(message);
  };

  const erase = async () => {
    if (!window.confirm("Erase ALL Daily Tracker data on this device? Export a backup first if you might need it.")) return;
    if (!window.confirm("Final confirmation: every day, weigh-in, water entry and highlight here will be permanently deleted.")) return;
    setBusy(true);
    const message = await api.replace(EMPTY_SNAPSHOT);
    setBusy(false);
    if (message) setError(message);
  };

  const stepCount = api.snap.days.length;
  const weighInCount = api.snap.weights.length;
  const waterCount = api.snap.water.length;
  const highlightCount = api.snap.highlights.length;

  return (
    <div className="daily-page">
      <header className="daily-hero">
        <p className="daily-eyebrow">Settings</p>
        <h1 className="daily-hero-title">Preferences</h1>
        <p className="daily-hero-date">Goals, display and your local data.</p>
      </header>

      {error ? (
        <p className="daily-error" role="alert">
          {error}
        </p>
      ) : null}

      <Section title="Daily goals" hint="You can change these any time. Calories are optional.">
        <label className="daily-field">
          <span>Step goal</span>
          <span className="daily-input-wrap">
            <input
              className="daily-input"
              type="text"
              inputMode="numeric"
              value={stepGoal}
              onChange={(event) => setStepGoal(event.target.value)}
            />
            <em className="daily-input-suffix">steps</em>
          </span>
        </label>
        <label className="daily-field">
          <span>Calorie goal (leave blank for none)</span>
          <span className="daily-input-wrap">
            <input
              className="daily-input"
              type="text"
              inputMode="numeric"
              placeholder="No goal"
              value={calorieGoal}
              onChange={(event) => setCalorieGoal(event.target.value)}
            />
            <em className="daily-input-suffix">kcal</em>
          </span>
        </label>
        <label className="daily-field">
          <span>Water goal</span>
          <span className="daily-input-wrap">
            <input
              className="daily-input"
              type="text"
              inputMode="numeric"
              value={waterGoal}
              onChange={(event) => setWaterGoal(event.target.value)}
            />
            <em className="daily-input-suffix">ml</em>
          </span>
        </label>
        <p className="daily-hint">Currently {formatWater(settings.waterGoalMl)} per day.</p>
        <button type="button" className="daily-btn-primary" disabled={busy} onClick={() => void saveGoals()}>
          Save goals
        </button>
      </Section>

      <Section title="Display">
        <div className="daily-settings-row">
          <span>Weight unit</span>
          <div className="daily-seg" role="group" aria-label="Weight unit">
            {(["kg", "lb"] as const).map((unit) => (
              <button
                key={unit}
                type="button"
                className={`daily-seg-btn${settings.weightUnit === unit ? " is-active" : ""}`}
                aria-pressed={settings.weightUnit === unit}
                onClick={() => void apply(saveSettings(api.snap, { weightUnit: unit }), unit === "kg" ? "Showing kilograms" : "Showing pounds")}
              >
                {unit === "kg" ? "Kilograms" : "Pounds"}
              </button>
            ))}
          </div>
        </div>
        <div className="daily-settings-row">
          <span>Default chart period</span>
          <div className="daily-seg is-wrap" role="group" aria-label="Default chart period">
            {CHART_PERIODS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`daily-seg-btn${settings.chartPeriod === option.value ? " is-active" : ""}`}
                aria-pressed={settings.chartPeriod === option.value}
                onClick={() => void apply(saveSettings(api.snap, { chartPeriod: option.value }), `${option.label} selected`)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="daily-settings-row">
          <span>Theme</span>
          <span className="daily-settings-value">DetailFlows dark</span>
        </div>
        <p className="daily-hint">Theme follows your existing DetailFlows appearance. Times use 24-hour format.</p>
      </Section>

      <Section title="Metric cards" hint="Reorder cards with the arrows. Hidden cards keep all of their stored data.">
        <ul className="daily-order-list">
          {settings.metricOrder.map((metric, index) => {
            const hidden = settings.hiddenMetrics.includes(metric);
            const meta = METRIC_META[metric];
            return (
              <li key={metric} className={`daily-order-row${hidden ? " is-hidden" : ""}`}>
                <span className="daily-order-dot" style={{ background: meta.accent }} aria-hidden />
                <span className="daily-order-name">{meta.label}</span>
                <button
                  type="button"
                  className="daily-icon-btn is-small"
                  onClick={() => move(index, -1)}
                  disabled={index === 0 || busy}
                  aria-label={`Move ${meta.label} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="daily-icon-btn is-small"
                  onClick={() => move(index, 1)}
                  disabled={index === settings.metricOrder.length - 1 || busy}
                  aria-label={`Move ${meta.label} down`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={`daily-toggle${hidden ? "" : " is-on"}`}
                  onClick={() => toggleHidden(metric)}
                  disabled={busy}
                  aria-pressed={!hidden}
                  aria-label={`${hidden ? "Show" : "Hide"} ${meta.label} card`}
                >
                  {hidden ? "Hidden" : "Shown"}
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section
        title="Your data"
        hint="Everything is stored in this browser with IndexedDB. There is no account requirement and nothing is sent to a server."
      >
        <div className="daily-data-counts">
          <span>{stepCount} days</span>
          <span>{weighInCount} weigh-ins</span>
          <span>{waterCount} water entries</span>
          <span>{highlightCount} highlights</span>
        </div>
        <div className="daily-warning">
          Clearing your browser&apos;s site data, using a private window or uninstalling the app can erase all of this. Export a backup
          regularly — highlight photos are included in the file, so it can be large.
        </div>
        <button type="button" className="daily-btn-primary" onClick={download}>
          Export JSON backup
        </button>
        <label className="daily-field">
          <span>Restore from a backup</span>
          <input
            className="daily-file"
            type="file"
            accept="application/json,.json"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void restore(file);
            }}
          />
        </label>
        <p className="daily-hint">
          Cloud sync is not enabled yet. The storage layer is ready for an optional account-based sync later, but for now this device is
          the only copy.
        </p>
        <button type="button" className="daily-btn-danger" disabled={busy} onClick={() => void erase()}>
          Erase all data on this device
        </button>
      </Section>

      <Section title="Separate trackers" hint="Gym sessions and groceries stay in their own apps. Daily Tracker only reads the five metrics above.">
        <p className="daily-hint">
          When a Gym Tracker is available it can be linked here as a small read-only summary. Nothing from it is duplicated or logged
          inside this app.
        </p>
      </Section>

      <p className="daily-footnote">Daily Tracker · local-first · no reminders, notifications or health-kit access.</p>
    </div>
  );
}
