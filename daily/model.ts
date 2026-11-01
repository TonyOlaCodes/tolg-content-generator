/**
 * Daily Tracker data model.
 *
 * Every record is keyed by a *local calendar date* (`YYYY-MM-DD`) for days,
 * and by a generated id (or the day key) for measurements. `null` always means
 * "not recorded"; a real zero is stored as 0 and is never treated as missing.
 *
 * The store is local-first (IndexedDB). `Snapshot` is the full document that a
 * future account-based cloud sync would push or pull; nothing here depends on
 * a server.
 */

export type MetricKey = "steps" | "weight" | "calories" | "sleep" | "water";

export const METRIC_KEYS: MetricKey[] = ["steps", "weight", "calories", "sleep", "water"];

export const METRIC_META: Record<
  MetricKey,
  { label: string; short: string; accent: string; ring: string; unit: string }
> = {
  steps: { label: "Steps", short: "Steps", accent: "#7cc7ff", ring: "#5aa8ff", unit: "steps" },
  weight: { label: "Bodyweight", short: "Weight", accent: "#c4b5fd", ring: "#a78bfa", unit: "kg" },
  calories: { label: "Calories", short: "Calories", accent: "#ffb347", ring: "#fb923c", unit: "kcal" },
  sleep: { label: "Sleep", short: "Sleep", accent: "#a78bfa", ring: "#8b7cff", unit: "h" },
  water: { label: "Water", short: "Water", accent: "#4dd4ff", ring: "#22b8e6", unit: "ml" },
};

/** One day's single-value metrics. Water and weight live in their own stores. */
export type DayEntry = {
  date: string;
  /** Total steps walked that day. */
  steps: number | null;
  /** Total calories eaten that day. */
  calories: number | null;
  /** Total sleep in whole minutes (decimals only at display time). */
  sleepMinutes: number | null;
  updatedAt: string;
};

export type WeightEntry = {
  id: string;
  date: string;
  /** Always stored in kilograms; the display unit is a setting. */
  kg: number;
  /** Local 24-hour time ("HH:mm") when the measurement was taken, if given. */
  time: string | null;
  createdAt: string;
};

/** Each quick-add is its own record so every entry can be edited or undone. */
export type WaterEntry = {
  id: string;
  date: string;
  ml: number;
  createdAt: string;
};

export type Highlight = {
  id: string;
  date: string;
  title: string;
  description: string;
  tags: string[];
  /** Optional downscaled data URL. Photos stay inside this device's storage. */
  photo: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WeightUnit = "kg" | "lb";

/** 0 means "all time" in the chart period selector. */
export type ChartPeriod = 7 | 30 | 90 | 365 | 0;

export const CHART_PERIODS: { value: ChartPeriod; label: string }[] = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 365, label: "1 year" },
  { value: 0, label: "All" },
];

export type Settings = {
  id: "main";
  stepGoal: number;
  /** Optional: `null` hides goal comparison for calories without hiding the metric. */
  calorieGoal: number | null;
  waterGoalMl: number;
  weightUnit: WeightUnit;
  chartPeriod: ChartPeriod;
  metricOrder: MetricKey[];
  hiddenMetrics: MetricKey[];
};

export const DEFAULT_SETTINGS: Settings = {
  id: "main",
  stepGoal: 10_000,
  calorieGoal: null,
  waterGoalMl: 3_000,
  weightUnit: "kg",
  chartPeriod: 30,
  metricOrder: [...METRIC_KEYS],
  hiddenMetrics: [],
};

export type Snapshot = {
  days: DayEntry[];
  weights: WeightEntry[];
  water: WaterEntry[];
  highlights: Highlight[];
  settings: Settings;
};

export function emptySnapshot(): Snapshot {
  return {
    days: [],
    weights: [],
    water: [],
    highlights: [],
    settings: { ...DEFAULT_SETTINGS, metricOrder: [...METRIC_KEYS], hiddenMetrics: [] },
  };
}

export const EMPTY_SNAPSHOT: Snapshot = emptySnapshot();

/** Realistic input boundaries. The UI and the actions both use these. */
export const LIMITS = {
  steps: { min: 0, max: 200_000 },
  calories: { min: 0, max: 20_000 },
  sleepMinutes: { min: 0, max: 1_440 },
  weightKg: { min: 20, max: 400 },
  waterMl: { min: 1, max: 10_000 },
  stepGoal: { min: 100, max: 100_000 },
  calorieGoal: { min: 500, max: 15_000 },
  waterGoalMl: { min: 250, max: 10_000 },
  highlightTitle: 80,
  highlightDescription: 500,
  highlightTags: 8,
  highlightTagLength: 24,
  highlightPhotoChars: 2_000_000,
} as const;

export const STORE_NAMES = ["days", "weights", "water", "highlights", "settings"] as const;
export type StoreName = (typeof STORE_NAMES)[number];

export const STORE_KEY: Record<StoreName, string> = {
  days: "date",
  weights: "id",
  water: "id",
  highlights: "id",
  settings: "id",
};

/** Settings are always present in memory, even before they are first saved. */
export function settingsOf(snapshot: Snapshot): Settings {
  return snapshot.settings ?? DEFAULT_SETTINGS;
}

/** Metric cards in the user's chosen order, without hidden metrics. */
export function visibleMetrics(settings: Settings): MetricKey[] {
  const hidden = new Set(settings.hiddenMetrics);
  const order = settings.metricOrder.filter((k) => METRIC_KEYS.includes(k));
  const missing = METRIC_KEYS.filter((k) => !order.includes(k));
  return [...order, ...missing].filter((k) => !hidden.has(k));
}
