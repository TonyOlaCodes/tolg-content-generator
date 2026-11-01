/**
 * Validated mutations for the Daily Tracker.
 *
 * Actions are pure: they never touch storage. They return an atomic change
 * (one IndexedDB transaction) that the caller applies, which keeps validation,
 * undo and tests independent from the browser. Every mutation also knows how to
 * be inverted, so an accidental tap can be undone.
 */

import type { ChartPeriod, DayEntry, Highlight, MetricKey, Settings, Snapshot, StoreName, WaterEntry, WeightEntry, WeightUnit } from "./model";
import { CHART_PERIODS, LIMITS, METRIC_KEYS, STORE_KEY, settingsOf } from "./model";
import { isDateKey } from "./date";

export type Change = {
  puts: { store: StoreName; value: unknown }[];
  deletes: { store: StoreName; key: string }[];
};

export type Result = { ok: true; change: Change } | { ok: false; error: string };

export type Ctx = {
  /** Local calendar date for "today". */
  today: string;
  /** ISO timestamp used for createdAt/updatedAt. */
  now: string;
  newId: () => string;
};

export function defaultCtx(now: Date = new Date()): Ctx {
  return {
    today: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
    now: now.toISOString(),
    newId: () =>
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`,
  };
}

const fail = (error: string): Result => ({ ok: false, error });
const change = (puts: Change["puts"], deletes: Change["deletes"] = []): Result => ({ ok: true, change: { puts, deletes } });

const isNum = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const round2 = (value: number) => Math.round(value * 100) / 100;
const round0 = (value: number) => Math.round(value);
const keyOf = (store: StoreName, value: unknown): string => {
  const record = value as Record<string, unknown>;
  return String(record[STORE_KEY[store]]);
};

function checkDate(date: unknown, today: string): string | null {
  if (!isDateKey(date)) return "Choose a valid date.";
  if (date > today) return "Future dates cannot be recorded.";
  return null;
}

function inRange(value: unknown, min: number, max: number): value is number {
  return isNum(value) && value >= min && value <= max;
}

export function validateSteps(value: number): string | null {
  if (!isNum(value) || !Number.isInteger(value)) return "Steps must be a whole number.";
  if (!inRange(value, LIMITS.steps.min, LIMITS.steps.max)) return "Steps must be between 0 and 200,000.";
  return null;
}

export function validateCalories(value: number): string | null {
  if (!isNum(value) || !Number.isInteger(value)) return "Calories must be a whole number.";
  if (!inRange(value, LIMITS.calories.min, LIMITS.calories.max)) return "Calories must be between 0 and 20,000.";
  return null;
}

export function validateSleepMinutes(value: number): string | null {
  if (!isNum(value) || !Number.isInteger(value)) return "Sleep must be whole minutes.";
  if (!inRange(value, LIMITS.sleepMinutes.min, LIMITS.sleepMinutes.max))
    return "Sleep must be between 0 and 24 hours.";
  return null;
}

export function validateWeightKg(value: number): string | null {
  if (!isNum(value)) return "Enter a weight.";
  if (!inRange(value, LIMITS.weightKg.min, LIMITS.weightKg.max))
    return `Weight must be between ${LIMITS.weightKg.min} and ${LIMITS.weightKg.max} kg.`;
  return null;
}

export function validateWaterMl(value: number): string | null {
  if (!isNum(value) || !Number.isInteger(value)) return "Water must be a whole number of millilitres.";
  if (!inRange(value, LIMITS.waterMl.min, LIMITS.waterMl.max))
    return "Water must be between 1 ml and 10 L in one entry.";
  return null;
}

export function validateStepGoal(value: number): string | null {
  if (!isNum(value) || !Number.isInteger(value) || !inRange(value, LIMITS.stepGoal.min, LIMITS.stepGoal.max))
    return "Step goal must be a whole number between 100 and 100,000.";
  return null;
}

export function validateCalorieGoal(value: number): string | null {
  if (!isNum(value) || !Number.isInteger(value) || !inRange(value, LIMITS.calorieGoal.min, LIMITS.calorieGoal.max))
    return "Calorie goal must be a whole number between 500 and 15,000.";
  return null;
}

export function validateWaterGoal(value: number): string | null {
  if (!isNum(value) || !Number.isInteger(value) || !inRange(value, LIMITS.waterGoalMl.min, LIMITS.waterGoalMl.max))
    return "Water goal must be between 250 ml and 10 L.";
  return null;
}

type DayMetric = "steps" | "calories" | "sleepMinutes";

/**
 * Replaces one day's total. Passing `null` clears just that metric; a zero is
 * stored as a real recorded zero. Clearing the last metric removes the day row.
 */
export function setDayMetric(
  snapshot: Snapshot,
  date: string,
  metric: DayMetric,
  value: number | null,
  ctx: Ctx,
): Result {
  return setDayMetrics(snapshot, date, { [metric]: value }, ctx);
}

/**
 * Writes several single-value metrics for one day in a single record.
 * Omitted keys are left untouched; `null` clears a metric.
 */
export function setDayMetrics(
  snapshot: Snapshot,
  date: string,
  patch: Partial<Record<DayMetric, number | null>>,
  ctx: Ctx,
): Result {
  const dateError = checkDate(date, ctx.today);
  if (dateError) return fail(dateError);
  const existing = snapshot.days.find((d) => d.date === date) ?? null;
  const day: DayEntry = {
    date,
    steps: patch.steps !== undefined ? patch.steps : (existing?.steps ?? null),
    calories: patch.calories !== undefined ? patch.calories : (existing?.calories ?? null),
    sleepMinutes: patch.sleepMinutes !== undefined ? patch.sleepMinutes : (existing?.sleepMinutes ?? null),
    updatedAt: ctx.now,
  };
  if (day.steps !== null) {
    const error = validateSteps(day.steps);
    if (error) return fail(error);
    day.steps = round0(day.steps);
  }
  if (day.calories !== null) {
    const error = validateCalories(day.calories);
    if (error) return fail(error);
    day.calories = round0(day.calories);
  }
  if (day.sleepMinutes !== null) {
    const error = validateSleepMinutes(day.sleepMinutes);
    if (error) return fail(error);
    day.sleepMinutes = round0(day.sleepMinutes);
  }
  const empty = day.steps === null && day.calories === null && day.sleepMinutes === null;
  if (empty) return existing ? change([], [{ store: "days", key: date }]) : change([]);
  if (
    existing &&
    existing.steps === day.steps &&
    existing.calories === day.calories &&
    existing.sleepMinutes === day.sleepMinutes
  ) {
    return change([]);
  }
  return change([{ store: "days", value: day }]);
}

export function addWater(snapshot: Snapshot, input: { date: string; ml: number }, ctx: Ctx): Result {
  const dateError = checkDate(input.date, ctx.today);
  if (dateError) return fail(dateError);
  const error = validateWaterMl(input.ml);
  if (error) return fail(error);
  void snapshot;
  const entry: WaterEntry = {
    id: ctx.newId(),
    date: input.date,
    ml: round0(input.ml),
    createdAt: ctx.now,
  };
  return change([{ store: "water", value: entry }]);
}

export function updateWater(snapshot: Snapshot, id: string, ml: number): Result {
  const entry = snapshot.water.find((w) => w.id === id);
  if (!entry) return fail("That water entry no longer exists.");
  const error = validateWaterMl(ml);
  if (error) return fail(error);
  if (entry.ml === round0(ml)) return change([]);
  return change([{ store: "water", value: { ...entry, ml: round0(ml) } }]);
}

export function deleteWater(snapshot: Snapshot, id: string): Result {
  const entry = snapshot.water.find((w) => w.id === id);
  if (!entry) return fail("That water entry no longer exists.");
  return change([], [{ store: "water", key: id }]);
}

/** A day holds exactly one weigh-in: logging again replaces that day's value. */
export function addWeight(snapshot: Snapshot, input: { date: string; kg: number }, ctx: Ctx): Result {
  const dateError = checkDate(input.date, ctx.today);
  if (dateError) return fail(dateError);
  const error = validateWeightKg(input.kg);
  if (error) return fail(error);
  const existing = snapshot.weights.find((w) => w.date === input.date);
  if (existing) {
    return change([{ store: "weights", value: { ...existing, kg: round2(input.kg) } }]);
  }
  const entry: WeightEntry = {
    id: ctx.newId(),
    date: input.date,
    kg: round2(input.kg),
    createdAt: ctx.now,
  };
  return change([{ store: "weights", value: entry }]);
}

export function updateWeight(snapshot: Snapshot, id: string, input: { kg: number }): Result {
  const entry = snapshot.weights.find((w) => w.id === id);
  if (!entry) return fail("That weigh-in no longer exists.");
  const error = validateWeightKg(input.kg);
  if (error) return fail(error);
  return change([{ store: "weights", value: { ...entry, kg: round2(input.kg) } }]);
}

export function deleteWeight(snapshot: Snapshot, id: string): Result {
  const entry = snapshot.weights.find((w) => w.id === id);
  if (!entry) return fail("That weigh-in no longer exists.");
  return change([], [{ store: "weights", key: id }]);
}

export type HighlightInput = {
  id?: string;
  date: string;
  title: string;
  description: string;
  tags: string[];
  photo: string | null;
};

export function saveHighlight(snapshot: Snapshot, input: HighlightInput, ctx: Ctx): Result {
  const dateError = checkDate(input.date, ctx.today);
  if (dateError) return fail(dateError);
  const title = input.title.trim();
  if (!title) return fail("Add a short title.");
  if (title.length > LIMITS.highlightTitle) return fail(`Titles are limited to ${LIMITS.highlightTitle} characters.`);
  const description = input.description.trim();
  if (description.length > LIMITS.highlightDescription)
    return fail(`Descriptions are limited to ${LIMITS.highlightDescription} characters.`);
  const tags: string[] = [];
  for (const raw of input.tags) {
    const tag = raw.trim().replace(/\s+/g, " ");
    if (!tag) continue;
    if (tag.length > LIMITS.highlightTagLength) return fail(`Each tag is limited to ${LIMITS.highlightTagLength} characters.`);
    if (!tags.some((t) => t.toLowerCase() === tag.toLowerCase())) tags.push(tag);
  }
  if (tags.length > LIMITS.highlightTags) return fail(`Use up to ${LIMITS.highlightTags} tags.`);
  if (input.photo !== null) {
    if (!input.photo.startsWith("data:image/")) return fail("That photo could not be read.");
    if (input.photo.length > LIMITS.highlightPhotoChars)
      return fail("That photo is too large. Try a smaller image.");
  }

  const existing = input.id ? snapshot.highlights.find((h) => h.id === input.id) : null;
  if (input.id && !existing) return fail("That highlight no longer exists.");
  const highlight: Highlight = {
    id: existing?.id ?? ctx.newId(),
    date: input.date,
    title,
    description,
    tags,
    photo: input.photo,
    createdAt: existing?.createdAt ?? ctx.now,
    updatedAt: ctx.now,
  };
  return change([{ store: "highlights", value: highlight }]);
}

export function deleteHighlight(snapshot: Snapshot, id: string): Result {
  if (!snapshot.highlights.some((h) => h.id === id)) return fail("That highlight no longer exists.");
  return change([], [{ store: "highlights", key: id }]);
}

export type SettingsPatch = Partial<Omit<Settings, "id">>;

export function saveSettings(snapshot: Snapshot, patch: SettingsPatch): Result {
  const current = settingsOf(snapshot);
  const next: Settings = { ...current, ...patch, id: "main" };

  if (patch.stepGoal !== undefined) {
    const error = validateStepGoal(patch.stepGoal);
    if (error) return fail(error);
    next.stepGoal = round0(patch.stepGoal);
  }
  if (patch.waterGoalMl !== undefined) {
    const error = validateWaterGoal(patch.waterGoalMl);
    if (error) return fail(error);
    next.waterGoalMl = round0(patch.waterGoalMl);
  }
  if (patch.calorieGoal !== undefined && patch.calorieGoal !== null) {
    const error = validateCalorieGoal(patch.calorieGoal);
    if (error) return fail(error);
    next.calorieGoal = round0(patch.calorieGoal);
  }
  if (patch.weightGoalKg !== undefined && patch.weightGoalKg !== null) {
    const error = validateWeightKg(patch.weightGoalKg);
    if (error) return fail(error);
    next.weightGoalKg = round2(patch.weightGoalKg);
  }
  if (patch.weightUnit !== undefined && patch.weightUnit !== "kg" && patch.weightUnit !== "lb") {
    return fail("Choose kilograms or pounds.");
  }
  if (patch.chartPeriod !== undefined) {
    if (!CHART_PERIODS.some((p) => p.value === patch.chartPeriod)) return fail("Choose a valid chart period.");
  }
  if (patch.metricOrder !== undefined) {
    const seen = new Set<MetricKey>();
    const order: MetricKey[] = [];
    for (const key of patch.metricOrder) {
      if (METRIC_KEYS.includes(key) && !seen.has(key)) {
        seen.add(key);
        order.push(key);
      }
    }
    for (const key of METRIC_KEYS) if (!seen.has(key)) order.push(key);
    next.metricOrder = order;
  }
  if (patch.hiddenMetrics !== undefined) {
    next.hiddenMetrics = METRIC_KEYS.filter((key) => patch.hiddenMetrics?.includes(key));
    if (next.hiddenMetrics.length === METRIC_KEYS.length) return fail("Keep at least one metric card visible.");
  }

  const same =
    next.stepGoal === current.stepGoal &&
    next.calorieGoal === current.calorieGoal &&
    next.waterGoalMl === current.waterGoalMl &&
    next.weightGoalKg === current.weightGoalKg &&
    next.weightUnit === current.weightUnit &&
    next.chartPeriod === current.chartPeriod &&
    next.metricOrder.join(",") === current.metricOrder.join(",") &&
    next.hiddenMetrics.join(",") === current.hiddenMetrics.join(",");
  if (same) return change([]);
  return change([{ store: "settings", value: next }]);
}

export function saveWeightUnit(snapshot: Snapshot, unit: WeightUnit): Result {
  return saveSettings(snapshot, { weightUnit: unit });
}

export function saveChartPeriod(snapshot: Snapshot, period: ChartPeriod): Result {
  return saveSettings(snapshot, { chartPeriod: period });
}

/** Combines several validated changes into one atomic save (Save All). */
export function mergeChanges(results: Result[]): Result {
  const puts: Change["puts"] = [];
  const deletes: Change["deletes"] = [];
  for (const result of results) {
    if (!result.ok) return result;
    for (const put of result.change.puts) {
      const key = keyOf(put.store, put.value);
      const index = puts.findIndex((p) => p.store === put.store && keyOf(p.store, p.value) === key);
      if (index >= 0) puts[index] = put;
      else puts.push(put);
    }
    for (const del of result.change.deletes) {
      const index = puts.findIndex((p) => p.store === del.store && keyOf(p.store, p.value) === del.key);
      if (index >= 0) puts.splice(index, 1);
      if (!deletes.some((d) => d.store === del.store && d.key === del.key)) deletes.push(del);
    }
  }
  return { ok: true, change: { puts, deletes } };
}

/** Applies a change to an in-memory snapshot. Used by tests and for undo maths. */
export function applyChangeLocally(snapshot: Snapshot, change: Change): Snapshot {
  const next: Snapshot = {
    days: [...snapshot.days],
    weights: [...snapshot.weights],
    water: [...snapshot.water],
    highlights: [...snapshot.highlights],
    settings: snapshot.settings,
  };
  const listFor = (store: StoreName): unknown[] => {
    switch (store) {
      case "days":
        return next.days;
      case "weights":
        return next.weights;
      case "water":
        return next.water;
      case "highlights":
        return next.highlights;
      case "settings":
        return [next.settings];
    }
  };
  for (const put of change.puts) {
    const list = listFor(put.store) as Record<string, unknown>[];
    const key = keyOf(put.store, put.value);
    const record = put.value as Record<string, unknown>;
    if (put.store === "settings") {
      next.settings = record as unknown as Settings;
      continue;
    }
    const index = list.findIndex((item) => String(item[STORE_KEY[put.store]]) === key);
    if (index >= 0) list[index] = record;
    else list.push(record);
  }
  for (const del of change.deletes) {
    const list = listFor(del.store) as Record<string, unknown>[];
    const index = list.findIndex((item) => String(item[STORE_KEY[del.store]]) === del.key);
    if (index >= 0) list.splice(index, 1);
  }
  return next;
}

/** Builds the exact inverse of `change` from the snapshot taken before it. */
export function invertChange(before: Snapshot, change: Change): Change {
  const puts: Change["puts"] = [];
  const deletes: Change["deletes"] = [];
  const keys = new Set<string>();
  for (const put of change.puts) {
    const store = put.store;
    const key = keyOf(store, put.value);
    if (keys.has(`${store}:${key}`)) continue;
    keys.add(`${store}:${key}`);
    const previous = findRecord(before, store, key);
    if (previous) puts.push({ store, value: previous });
    else deletes.push({ store, key });
  }
  for (const del of change.deletes) {
    const store = del.store;
    if (keys.has(`${store}:${del.key}`)) continue;
    keys.add(`${store}:${del.key}`);
    const previous = findRecord(before, store, del.key);
    if (previous) puts.push({ store, value: previous });
  }
  return { puts, deletes };
}

function findRecord(snapshot: Snapshot, store: StoreName, key: string): unknown | null {
  switch (store) {
    case "days":
      return snapshot.days.find((d) => d.date === key) ?? null;
    case "weights":
      return snapshot.weights.find((w) => w.id === key) ?? null;
    case "water":
      return snapshot.water.find((w) => w.id === key) ?? null;
    case "highlights":
      return snapshot.highlights.find((h) => h.id === key) ?? null;
    case "settings":
      return settingsOf(snapshot);
  }
}

export function isEmptyChange(change: Change): boolean {
  return change.puts.length === 0 && change.deletes.length === 0;
}

/** Applies a change to a snapshot only if it is not empty. */
export function previewChange(snapshot: Snapshot, result: Result): Snapshot {
  return result.ok ? applyChangeLocally(snapshot, result.change) : snapshot;
}
