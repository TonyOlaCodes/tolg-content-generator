"use client";

import { useState, type ReactNode } from "react";
import { saveSettings, type Result } from "@/daily/actions";
import { exportSnapshot, validateBackup } from "@/daily/backup";
import { todayKey } from "@/daily/date";
import { kgToUnit, unitToKg } from "@/daily/format";
import { CHART_PERIODS, EMPTY_SNAPSHOT, METRIC_META, settingsOf, type MetricKey } from "@/daily/model";
import { parseDecimal, parseWhole, type DailyApi } from "./api";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="daily-settings-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default function SettingsPage({ api }: { api: DailyApi }) {
  const settings = settingsOf(api.snap);
  const [stepGoal, setStepGoal] = useState(String(settings.stepGoal));
  const [calorieGoal, setCalorieGoal] = useState(settings.calorieGoal !== null ? String(settings.calorieGoal) : "");
  const [waterGoal, setWaterGoal] = useState(String(settings.waterGoalMl));
  const [weightGoal, setWeightGoal] = useState(
    settings.weightGoalKg !== null
      ? String(Math.round(kgToUnit(settings.weightGoalKg, settings.weightUnit) * 100) / 100)
      : "",
  );
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
    const trimmedWeight = weightGoal.trim();
    let weightKg: number | null = null;
    if (trimmedWeight) {
      const parsedWeight = parseDecimal(trimmedWeight);
      if (parsedWeight === null) return setError(`Enter a weight goal in ${settings.weightUnit}, or leave it blank.`);
      weightKg = unitToKg(parsedWeight, settings.weightUnit);
    }
    setBusy(true);
    const message = await api.commit(
      saveSettings(api.snap, { stepGoal: steps, waterGoalMl: water, calorieGoal: calories, weightGoalKg: weightKg }),
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

  const changeUnit = (unit: "kg" | "lb") => {
    if (unit === settings.weightUnit) return;
    if (weightGoal.trim()) {
      const parsed = parseDecimal(weightGoal);
      if (parsed !== null) {
        const kg = unitToKg(parsed, settings.weightUnit);
        setWeightGoal(String(Math.round(kgToUnit(kg, unit) * 100) / 100));
      }
    }
    void apply(saveSettings(api.snap, { weightUnit: unit }), unit === "kg" ? "Showing kilograms" : "Showing pounds");
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
    if (!window.confirm("Final confirmation: every day, weigh-in and water entry here will be permanently deleted.")) return;
    setBusy(true);
    const message = await api.replace(EMPTY_SNAPSHOT);
    setBusy(false);
    if (message) setError(message);
  };

  const stepCount = api.snap.days.length;
  const weighInCount = api.snap.weights.length;
  const waterCount = api.snap.water.length;
  return (
    <div className="daily-page">
      <header className="daily-hero">
        <p className="daily-eyebrow">Settings</p>
        <h1 className="daily-hero-title">Preferences</h1>
      </header>

      {error ? (
        <p className="daily-error" role="alert">
          {error}
        </p>
      ) : null}

      <Section title="Goals">
        <label className="daily-field">
          <span>Steps</span>
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
          <span>Calories</span>
          <span className="daily-input-wrap">
            <input
              className="daily-input"
              type="text"
              inputMode="numeric"
              placeholder="None"
              value={calorieGoal}
              onChange={(event) => setCalorieGoal(event.target.value)}
            />
            <em className="daily-input-suffix">kcal</em>
          </span>
        </label>
        <label className="daily-field">
          <span>Water</span>
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
        <label className="daily-field">
          <span>Weight</span>
          <span className="daily-input-wrap">
            <input
              className="daily-input"
              type="text"
              inputMode="decimal"
              placeholder="None"
              value={weightGoal}
              onChange={(event) => setWeightGoal(event.target.value)}
            />
            <em className="daily-input-suffix">{settings.weightUnit}</em>
          </span>
        </label>
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
                onClick={() => changeUnit(unit)}
              >
                {unit}
              </button>
            ))}
          </div>
        </div>
        <div className="daily-settings-row">
          <span>Chart period</span>
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
      </Section>

      <Section title="Cards">
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

      <Section title="Data">
        <div className="daily-data-counts">
          <span>{stepCount} days</span>
          <span>{weighInCount} weigh-ins</span>
          <span>{waterCount} water</span>
        </div>
        <button type="button" className="daily-btn-primary" onClick={download}>
          Export backup
        </button>
        <label className="daily-field">
          <span>Restore</span>
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
        <button type="button" className="daily-btn-danger" disabled={busy} onClick={() => void erase()}>
          Erase all data
        </button>
      </Section>
    </div>
  );
}
