// Pure stock, prediction and shopping rules. No browser APIs, so it is unit tested directly.
import type { Food, Log, LogLine, ListItem } from "./model";

export type Status = "plenty" | "low" | "critical" | "empty" | "unknown";

export const STATUS_LABEL: Record<Status, string> = {
  plenty: "Plenty in stock",
  low: "Running low",
  critical: "Critical",
  empty: "Empty",
  unknown: "Not enough data",
};

/** Applies stock changes. Refuses (returns null) if any food would go below zero. */
export function applyEat(foods: Food[], lines: LogLine[]): Food[] | null {
  const next = new Map(foods.map((f) => [f.id, { ...f }]));
  for (const l of lines) {
    const f = next.get(l.foodId);
    if (!f || l.qtyBase <= 0) return null;
    if (f.stockBase - l.qtyBase < 0) return null;
    f.stockBase -= l.qtyBase;
  }
  return foods.map((f) => next.get(f.id) ?? f);
}

/** Adds stock for purchases or manual adds. Never reduces stock. */
export function applyAdd(foods: Food[], lines: LogLine[]): Food[] {
  const add = new Map<string, number>();
  for (const l of lines) add.set(l.foodId, (add.get(l.foodId) ?? 0) + l.qtyBase);
  return foods.map((f) => (add.has(f.id) ? { ...f, stockBase: f.stockBase + (add.get(f.id) ?? 0) } : f));
}

/**
 * Undoing a log reverses its stock movement exactly. "eat" logs give stock back,
 * "add" and "buy" logs remove the stock they added. Returns null if that would go negative.
 */
export function reverseLog(foods: Food[], log: Log): Food[] | null {
  if (log.kind === "eat") return applyAdd(foods, log.lines);
  return applyEat(foods, log.lines);
}

/** Days of stock left, or null when daily use is unknown. */
export function daysRemaining(stockBase: number, dailyBase: number | null): number | null {
  if (dailyBase === null || dailyBase <= 0) return null;
  return Math.max(0, Math.floor(stockBase / dailyBase));
}

/** Status for one food. Warnings use the food's own warnDays and low-stock threshold. */
export function statusOf(food: Food, dailyBase: number | null): Status {
  if (food.stockBase <= 0) return "empty";
  const days = daysRemaining(food.stockBase, dailyBase);
  const belowAbsolute = food.lowStockBase !== null && food.stockBase <= food.lowStockBase;
  if (days === null) return belowAbsolute ? "low" : "unknown";
  if (days <= 1) return "critical";
  if (days <= food.warnDays || belowAbsolute) return "low";
  return "plenty";
}

/** Packages needed to reach target, rounding up because packs cannot be split. */
export function reorderPacks(stockBase: number, targetBase: number | null, packBase: number | null): number {
  if (targetBase === null || !packBase || packBase <= 0) return 0;
  const missing = targetBase - stockBase;
  return missing <= 0 ? 0 : Math.ceil(missing / packBase);
}

/** Daily use estimated from recorded "eat" logs. Needs at least `minDays` distinct eating days. */
export function estimateDailyUse(
  foodId: string,
  logs: Log[],
  today: string,
  windowDays = 14,
  minDays = 3,
): number | null {
  const start = shiftDate(today, -(windowDays - 1));
  const days = new Map<string, number>();
  for (const log of logs) {
    if (log.kind !== "eat" || log.date < start || log.date > today) continue;
    for (const l of log.lines) {
      if (l.foodId === foodId) days.set(log.date, (days.get(log.date) ?? 0) + l.qtyBase);
    }
  }
  if (days.size < minDays) return null;
  const total = [...days.values()].reduce((a, b) => a + b, 0);
  return total / windowDays;
}

/** Local calendar date arithmetic on YYYY-MM-DD strings. */
export function shiftDate(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

/** Estimated cost of unbought list items, using saved package prices. Missing prices are counted, not guessed. */
export function listEstimate(items: ListItem[]): { cents: number; missing: number } {
  let cents = 0;
  let missing = 0;
  for (const it of items) {
    if (it.purchased) continue;
    if (it.unitCents === null) missing += 1;
    else cents += it.unitCents * it.packs;
  }
  return { cents, missing };
}

/** Item total for one line: packs x price per pack, or null when no price is known. */
export function lineCents(it: Pick<ListItem, "packs" | "unitCents">): number | null {
  return it.unitCents === null ? null : it.unitCents * it.packs;
}
