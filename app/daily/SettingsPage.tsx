"use client";

import { useEffect, useState, type ReactNode } from "react";
import { saveSettings, type Result } from "@/daily/actions";
import { exportSnapshot, validateBackup } from "@/daily/backup";
import { todayKey } from "@/daily/date";
import { formatDuration, kgToUnit, unitToKg } from "@/daily/format";
import { EMPTY_SNAPSHOT, settingsOf } from "@/daily/model";
import { parseDecimal, parseWhole, type DailyApi } from "./api";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="daily-settings-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function goalsFromSettings(settings: ReturnType<typeof settingsOf>) {
  return {
    stepGoal: String(settings.stepGoal),
    calorieGoal: settings.calorieGoal !== null ? String(settings.calorieGoal) : "",
    waterGoal: String(settings.waterGoalMl),
    sleepHours: String(Math.floor(settings.sleepGoalMinutes / 60)),
    sleepMinutes: String(settings.sleepGoalMinutes % 60),
    weightGoal:
      settings.weightGoalKg !== null
        ? String(Math.round(kgToUnit(settings.weightGoalKg, settings.weightUnit) * 100) / 100)
        : "",
  };
}

export default function SettingsPage({ api }: { api: DailyApi }) {
  const settings = settingsOf(api.snap);
  const [stepGoal, setStepGoal] = useState(() => goalsFromSettings(settings).stepGoal);
  const [calorieGoal, setCalorieGoal] = useState(() => goalsFromSettings(settings).calorieGoal);
  const [waterGoal, setWaterGoal] = useState(() => goalsFromSettings(settings).waterGoal);
  const [sleepHours, setSleepHours] = useState(() => goalsFromSettings(settings).sleepHours);
  const [sleepMinutes, setSleepMinutes] = useState(() => goalsFromSettings(settings).sleepMinutes);
  const [weightGoal, setWeightGoal] = useState(() => goalsFromSettings(settings).weightGoal);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // After restore/erase, snap settings change while this page stays mounted — resync the inputs.
  useEffect(() => {
    const next = goalsFromSettings(settings);
    setStepGoal(next.stepGoal);
    setCalorieGoal(next.calorieGoal);
    setWaterGoal(next.waterGoal);
    setSleepHours(next.sleepHours);
    setSleepMinutes(next.sleepMinutes);
    setWeightGoal(next.weightGoal);
  }, [settings.stepGoal, settings.calorieGoal, settings.waterGoalMl, settings.sleepGoalMinutes, settings.weightGoalKg, settings.weightUnit]);

  const saveGoals = async () => {
    setError(null);
    const steps = parseWhole(stepGoal);
    if (steps === null) return setError("Enter your daily step goal as a whole number.");
    const water = parseWhole(waterGoal);
    if (water === null) return setError("Enter your daily water goal in millilitres.");
    const hours = parseWhole(sleepHours);
    const mins = sleepMinutes.trim() === "" ? 0 : parseWhole(sleepMinutes);
    if (hours === null || mins === null || mins < 0 || mins > 59) {
      return setError("Enter sleep as hours and minutes (0–59).");
    }
    const sleepGoalMinutes = hours * 60 + mins;
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
      saveSettings(api.snap, {
        stepGoal: steps,
        waterGoalMl: water,
        sleepGoalMinutes,
        calorieGoal: calories,
        weightGoalKg: weightKg,
      }),
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
        <div className="daily-field">
          <span>Sleep · {formatDuration(settings.sleepGoalMinutes)}</span>
          <div className="daily-grid2">
            <span className="daily-input-wrap">
              <input
                className="daily-input"
                type="text"
                inputMode="numeric"
                value={sleepHours}
                onChange={(event) => setSleepHours(event.target.value)}
                aria-label="Sleep goal hours"
              />
              <em className="daily-input-suffix">h</em>
            </span>
            <span className="daily-input-wrap">
              <input
                className="daily-input"
                type="text"
                inputMode="numeric"
                value={sleepMinutes}
                onChange={(event) => setSleepMinutes(event.target.value)}
                aria-label="Sleep goal minutes"
              />
              <em className="daily-input-suffix">m</em>
            </span>
          </div>
        </div>
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
        <button type="button" className="daily-btn-primary" disabled={busy} onClick={() => void saveGoals()}>
          Save goals
        </button>
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
