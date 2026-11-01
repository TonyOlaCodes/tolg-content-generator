// JSON backup export and validated import for Groceries & Pantry.
import { EMPTY_SNAPSHOT, type Snapshot } from "./model";
import { BACKUP_APP } from "./store";

export const BACKUP_VERSION = 1;

export type BackupFile = { app: string; backupVersion: number; exportedAt: string; data: Snapshot };

export function exportSnapshot(snap: Snapshot, now = new Date()): string {
  const file: BackupFile = { app: BACKUP_APP, backupVersion: BACKUP_VERSION, exportedAt: now.toISOString(), data: snap };
  return JSON.stringify(file, null, 2);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => typeof v === "string";
const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const nullOr = (v: unknown, ok: (x: unknown) => boolean) => v === null || ok(v);

const isFood = (x: unknown) =>
  isObj(x) && str(x.id) && str(x.name) && str(x.category) && ["count", "mass", "volume"].includes(x.measure as string) &&
  num(x.stockBase) && (x.stockBase as number) >= 0 && nullOr(x.packBase, (v) => num(v) && (v as number) > 0) &&
  nullOr(x.lowStockBase, num) && num(x.warnDays) && nullOr(x.targetBase, num) && nullOr(x.dailyUseBase, num) &&
  str(x.shopId) && str(x.notes) && nullOr(x.image, str);

const isMeal = (x: unknown) =>
  isObj(x) && str(x.id) && str(x.name) && str(x.slot) && Array.isArray(x.ingredients) &&
  x.ingredients.every((i) => isObj(i) && str(i.foodId) && num(i.qtyBase) && (i.qtyBase as number) > 0);

const isLog = (x: unknown) =>
  isObj(x) && str(x.id) && ["eat", "add", "buy"].includes(x.kind as string) && str(x.date) && str(x.at) && str(x.title) &&
  Array.isArray(x.lines) && x.lines.every((l) => isObj(l) && str(l.foodId) && num(l.qtyBase));

const isPrice = (x: unknown) => isObj(x) && str(x.id) && str(x.foodId) && str(x.shopId) && num(x.packBase) && num(x.cents);

/**
 * Parses and checks a backup file. Returns the data or a readable error.
 * Every reference (meal ingredient, log line, list item, price) must point at a record in the file.
 */
export function validateBackup(text: string): { ok: true; data: Snapshot } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file is not valid JSON." };
  }
  if (!isObj(raw) || raw.app !== BACKUP_APP) return { ok: false, error: "This is not a Groceries & Pantry backup." };
  if (raw.backupVersion !== BACKUP_VERSION) return { ok: false, error: "This backup was made by a different app version." };
  const d = raw.data;
  if (!isObj(d)) return { ok: false, error: "The backup has no data section." };

  const lists: [keyof Snapshot, unknown[], (x: unknown) => boolean][] = [
    ["foods", Array.isArray(d.foods) ? d.foods : [], isFood],
    ["meals", Array.isArray(d.meals) ? d.meals : [], isMeal],
    ["logs", Array.isArray(d.logs) ? d.logs : [], isLog],
    ["prices", Array.isArray(d.prices) ? d.prices : [], isPrice],
  ];
  for (const [name, rows, ok] of lists) {
    if (!rows.every(ok)) return { ok: false, error: `The ${name} section contains invalid records.` };
  }
  const foods = d.foods as Snapshot["foods"];
  const foodIds = new Set(foods.map((f) => f.id));
  const bad = (rows: { foodId?: string }[]) => rows.some((r) => r.foodId !== undefined && !foodIds.has(r.foodId));
  if ((d.meals as Snapshot["meals"]).some((m) => m.ingredients.some((i) => !foodIds.has(i.foodId)))) {
    return { ok: false, error: "A saved meal refers to a food that is not in the backup." };
  }
  if ((d.logs as Snapshot["logs"]).some((l) => bad(l.lines))) return { ok: false, error: "A log refers to a missing food." };
  if (bad(d.prices as Snapshot["prices"])) return { ok: false, error: "A saved price refers to a missing food." };

  const data: Snapshot = {
    ...EMPTY_SNAPSHOT,
    foods,
    meals: d.meals as Snapshot["meals"],
    logs: d.logs as Snapshot["logs"],
    prices: d.prices as Snapshot["prices"],
    lists: (Array.isArray(d.lists) ? d.lists : []) as Snapshot["lists"],
    items: (Array.isArray(d.items) ? d.items : []) as Snapshot["items"],
    shops: (Array.isArray(d.shops) ? d.shops : []) as Snapshot["shops"],
    purchases: (Array.isArray(d.purchases) ? d.purchases : []) as Snapshot["purchases"],
    settings: (isObj(d.settings) ? d.settings : null) as Snapshot["settings"],
  };
  return { ok: true, data };
}
