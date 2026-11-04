import type { ChartPeriod, Highlight, Settings, Snapshot, WeightUnit } from "./model";
import { CHART_PERIODS, DEFAULT_SETTINGS, LIMITS, METRIC_KEYS } from "./model";
import { isDateKey } from "./date";
import { validateCalories, validateSleepMinutes, validateSteps, validateWaterMl, validateWeightKg } from "./actions";

export const BACKUP_FORMAT = "detailflows-daily";
export const BACKUP_VERSION = 1;

export type Backup = { format: string; version: number; exportedAt: string; data: Snapshot };

export function exportSnapshot(snapshot: Snapshot, now: Date = new Date()): string {
  const backup: Backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    data: {
      days: snapshot.days,
      weights: snapshot.weights,
      water: snapshot.water,
      highlights: snapshot.highlights,
      settings: snapshot.settings,
    },
  };
  return JSON.stringify(backup);
}

const isObj = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isStr = (value: unknown): value is string => typeof value === "string";
const isNum = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function settingsFrom(raw: unknown): Settings | null {
  if (!isObj(raw)) return null;
  const stepGoal = raw.stepGoal;
  const waterGoalMl = raw.waterGoalMl;
  const calorieGoal = raw.calorieGoal;
  if (typeof stepGoal !== "number" || !Number.isInteger(stepGoal) || stepGoal < LIMITS.stepGoal.min || stepGoal > LIMITS.stepGoal.max) return null;
  if (typeof waterGoalMl !== "number" || !Number.isInteger(waterGoalMl) || waterGoalMl < LIMITS.waterGoalMl.min || waterGoalMl > LIMITS.waterGoalMl.max) return null;
  if (calorieGoal !== null && (typeof calorieGoal !== "number" || !Number.isInteger(calorieGoal) || calorieGoal < LIMITS.calorieGoal.min || calorieGoal > LIMITS.calorieGoal.max)) return null;
  const weightGoalRaw = raw.weightGoalKg ?? null;
  if (weightGoalRaw !== null && (typeof weightGoalRaw !== "number" || !Number.isFinite(weightGoalRaw) || weightGoalRaw < LIMITS.weightKg.min || weightGoalRaw > LIMITS.weightKg.max)) return null;
  const sleepGoalRaw = raw.sleepGoalMinutes ?? DEFAULT_SETTINGS.sleepGoalMinutes;
  if (typeof sleepGoalRaw !== "number" || !Number.isInteger(sleepGoalRaw) || sleepGoalRaw < LIMITS.sleepGoalMinutes.min || sleepGoalRaw > LIMITS.sleepGoalMinutes.max) return null;
  const weightUnit: WeightUnit = raw.weightUnit === "lb" ? "lb" : "kg";
  const chartPeriod = CHART_PERIODS.some((p) => p.value === raw.chartPeriod) ? (raw.chartPeriod as ChartPeriod) : DEFAULT_SETTINGS.chartPeriod;
  const orderRaw = Array.isArray(raw.metricOrder) ? raw.metricOrder : [];
  const order = orderRaw.filter((k): k is Settings["metricOrder"][number] => METRIC_KEYS.includes(k as (typeof METRIC_KEYS)[number]));
  const uniqueOrder = [...new Set(order)];
  for (const key of METRIC_KEYS) if (!uniqueOrder.includes(key)) uniqueOrder.push(key);
  const hiddenRaw = Array.isArray(raw.hiddenMetrics) ? raw.hiddenMetrics : [];
  const hidden = METRIC_KEYS.filter((key) => hiddenRaw.includes(key));
  if (hidden.length === METRIC_KEYS.length) return null;
  return {
    id: "main",
    stepGoal,
    calorieGoal: calorieGoal as number | null,
    waterGoalMl,
    sleepGoalMinutes: sleepGoalRaw,
    weightGoalKg: weightGoalRaw as number | null,
    weightUnit,
    chartPeriod,
    metricOrder: uniqueOrder,
    hiddenMetrics: hidden,
  };
}

/** Validates a parsed backup file. Everything is checked before any data is replaced. */
export function validateBackup(raw: unknown): { ok: true; data: Snapshot } | { ok: false; error: string } {
  if (!isObj(raw)) return { ok: false, error: "This file is not a Daily Tracker backup." };
  if (raw.format !== BACKUP_FORMAT) return { ok: false, error: "This file is not a Daily Tracker backup." };
  if (raw.version !== BACKUP_VERSION) return { ok: false, error: `Unsupported backup version: ${String(raw.version)}.` };
  if (!isObj(raw.data)) return { ok: false, error: "The backup contains no data." };
  const data = raw.data;
  for (const name of ["days", "weights", "water", "highlights"] as const) {
    if (!Array.isArray(data[name])) return { ok: false, error: `The backup is missing "${name}".` };
  }

  const days: Snapshot["days"] = [];
  const dayKeys = new Set<string>();
  for (const item of data.days as unknown[]) {
    if (!isObj(item) || !isDateKey(item.date) || !isStr(item.updatedAt)) return { ok: false, error: "A daily entry in the backup is malformed." };
    if (dayKeys.has(item.date)) return { ok: false, error: "The backup has duplicate daily entries." };
    dayKeys.add(item.date);
    const steps = item.steps ?? null;
    const calories = item.calories ?? null;
    const sleepMinutes = item.sleepMinutes ?? null;
    if (steps !== null && (typeof steps !== "number" || validateSteps(steps) !== null)) return { ok: false, error: `A steps value in the backup is invalid (${item.date}).` };
    if (calories !== null && (typeof calories !== "number" || validateCalories(calories) !== null)) return { ok: false, error: `A calories value in the backup is invalid (${item.date}).` };
    if (sleepMinutes !== null && (typeof sleepMinutes !== "number" || validateSleepMinutes(sleepMinutes) !== null)) return { ok: false, error: `A sleep value in the backup is invalid (${item.date}).` };
    days.push({ date: item.date, steps: steps as number | null, calories: calories as number | null, sleepMinutes: sleepMinutes as number | null, updatedAt: item.updatedAt });
  }

  // One weigh-in per date: older backups may hold several for the same day, so keep the newest.
  const weightByDate = new Map<string, Snapshot["weights"][number]>();
  const weightIds = new Set<string>();
  for (const item of data.weights as unknown[]) {
    if (!isObj(item) || !isStr(item.id) || !isDateKey(item.date) || !isNum(item.kg) || !isStr(item.createdAt)) return { ok: false, error: "A weigh-in in the backup is malformed." };
    if (weightIds.has(item.id)) return { ok: false, error: "The backup has duplicate weigh-in IDs." };
    weightIds.add(item.id);
    if (validateWeightKg(item.kg) !== null) return { ok: false, error: "A weigh-in in the backup is outside the allowed range." };
    const entry = { id: item.id, date: item.date, kg: item.kg, createdAt: item.createdAt };
    const current = weightByDate.get(item.date);
    if (!current || entry.createdAt >= current.createdAt) weightByDate.set(item.date, entry);
  }
  const weights = [...weightByDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));

  const water: Snapshot["water"] = [];
  const waterIds = new Set<string>();
  for (const item of data.water as unknown[]) {
    if (!isObj(item) || !isStr(item.id) || !isDateKey(item.date) || !isNum(item.ml) || !isStr(item.createdAt)) return { ok: false, error: "A water entry in the backup is malformed." };
    if (waterIds.has(item.id)) return { ok: false, error: "The backup has duplicate water entry IDs." };
    waterIds.add(item.id);
    if (validateWaterMl(item.ml) !== null) return { ok: false, error: "A water entry in the backup is outside the allowed range." };
    water.push({ id: item.id, date: item.date, ml: item.ml, createdAt: item.createdAt });
  }

  const highlights: Highlight[] = [];
  const highlightIds = new Set<string>();
  for (const item of data.highlights as unknown[]) {
    if (!isObj(item) || !isStr(item.id) || !isDateKey(item.date) || !isStr(item.title) || !isStr(item.description)) return { ok: false, error: "A highlight in the backup is malformed." };
    if (highlightIds.has(item.id)) return { ok: false, error: "The backup has duplicate highlight IDs." };
    highlightIds.add(item.id);
    if (!item.title.trim() || item.title.length > LIMITS.highlightTitle) return { ok: false, error: "A highlight title in the backup is invalid." };
    if (item.description.length > LIMITS.highlightDescription) return { ok: false, error: "A highlight description in the backup is too long." };
    const tags = Array.isArray(item.tags) ? item.tags : [];
    if (tags.some((tag) => !isStr(tag) || tag.length > LIMITS.highlightTagLength)) return { ok: false, error: "A highlight tag in the backup is invalid." };
    if (tags.length > LIMITS.highlightTags) return { ok: false, error: "A highlight in the backup has too many tags." };
    const photo = item.photo ?? null;
    if (photo !== null && (!isStr(photo) || !photo.startsWith("data:image/") || photo.length > LIMITS.highlightPhotoChars)) return { ok: false, error: "A highlight photo in the backup is invalid or too large." };
    if (!isStr(item.createdAt) || !isStr(item.updatedAt)) return { ok: false, error: "A highlight in the backup is missing timestamps." };
    highlights.push({
      id: item.id,
      date: item.date,
      title: item.title,
      description: item.description,
      tags: tags as string[],
      photo: photo as string | null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  }

  const settings = settingsFrom(data.settings ?? DEFAULT_SETTINGS);
  if (!settings) return { ok: false, error: "The settings in the backup are invalid." };

  return {
    ok: true,
    data: { days, weights, water, highlights, settings },
  };
}
