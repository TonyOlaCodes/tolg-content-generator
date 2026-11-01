export type AppId = "weather" | "fuel";

export type Category = "Productivity" | "Utilities" | "Fitness" | "Finance" | "Entertainment";

export const CATEGORIES: Category[] = ["Productivity", "Utilities", "Fitness", "Finance", "Entertainment"];

export type Glyph = "weather" | "fuel";

export type AppEntry = {
  id: AppId;
  title: string;
  subtitle: string;
  category: Category;
  /** Icon gradient, top-left to bottom-right. */
  gradient: [string, string];
  glyph: Glyph;
  /** Only "ready" apps appear on the homepage. Unfinished apps are never shown as working. */
  status: "ready" | "planned";
};

/** Add new mini-apps here; the homepage picks them up automatically. */
export const APPS: AppEntry[] = [
  {
    id: "weather",
    title: "Weather",
    subtitle: "Forecasts worldwide",
    category: "Utilities",
    gradient: ["#7cc7ff", "#3b82f6"],
    glyph: "weather",
    status: "ready",
  },
  {
    id: "fuel",
    title: "Fuel Tracker",
    subtitle: "Car fuel and costs",
    category: "Finance",
    gradient: ["#34d399", "#059669"],
    glyph: "fuel",
    status: "ready",
  },
];

export function readyApps(): AppEntry[] {
  return APPS.filter((a) => a.status === "ready");
}

export function appById(id: AppId): AppEntry | undefined {
  return APPS.find((a) => a.id === id);
}

/** Case-insensitive match against title, subtitle and category. */
export function matchesQuery(app: AppEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [app.title, app.subtitle, app.category].some((s) => s.toLowerCase().includes(q));
}
