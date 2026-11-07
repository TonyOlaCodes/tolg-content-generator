// Guarded actions for Groceries & Pantry. Each one runs as a builder inside `commit`, so it sees the
// latest data and can refuse a duplicate. Repeated taps reuse the same client id, so they are refused.
import type { Builder, Op } from "./store";
import type { Food, Log, LogLine, ListItem, Meal, Measure, Price, Purchase, ShopList } from "./model";
import { PRICE_ID } from "./model";
import { applyEat, reverseLog, applyAdd, lineCents } from "./logic";

const uid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
export const newId = uid;
const nowIso = () => new Date().toISOString();
export const todayLocal = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function upsertFood(food: Food): Builder {
  return () => ({ ops: [{ store: "foods", put: { ...food, updatedAt: nowIso() } }] });
}

export function setFoodArchived(foodId: string, archived: boolean): Builder {
  return (s) => {
    const f = s.foods.find((x) => x.id === foodId);
    if (!f) return { error: "That food no longer exists." };
    return { ops: [{ store: "foods", put: { ...f, archived, version: f.version + 1, updatedAt: nowIso() } }] };
  };
}

export function deleteFood(id: string): Builder {
  return (s) => {
    const ops: Op[] = [{ store: "foods", del: id }];
    for (const m of s.meals) {
      if (m.ingredients.some((i) => i.foodId === id)) {
        ops.push({ store: "meals", put: { ...m, ingredients: m.ingredients.filter((i) => i.foodId !== id) } });
      }
    }
    for (const p of s.prices) if (p.foodId === id) ops.push({ store: "prices", del: p.id });
    return { ops };
  };
}

/** Manual stock change, e.g. the +/- buttons. Refuses to go below zero: that needs a reconciliation. */
export function adjustStock(foodId: string, deltaBase: number): Builder {
  return (s) => {
    const f = s.foods.find((x) => x.id === foodId);
    if (!f) return { error: "That food no longer exists." };
    const stockBase = f.stockBase + deltaBase;
    if (stockBase < 0) return { error: "Stock cannot go below zero. Use Reconcile to correct it." };
    return { ops: [{ store: "foods", put: { ...f, stockBase, version: f.version + 1, updatedAt: nowIso() } }] };
  };
}

/** Stock reconciliation: set the counted amount directly. Used only from the explicit reconcile flow. */
export function reconcileStock(foodId: string, stockBase: number): Builder {
  return (s) => {
    const f = s.foods.find((x) => x.id === foodId);
    if (!f) return { error: "That food no longer exists." };
    if (stockBase < 0) return { error: "A counted stock cannot be negative." };
    return { ops: [{ store: "foods", put: { ...f, stockBase, version: f.version + 1, updatedAt: nowIso() } }] };
  };
}

export function upsertMeal(meal: Meal): Builder {
  return () => ({ ops: [{ store: "meals", put: meal }] });
}

export function deleteMeal(id: string): Builder {
  return () => ({ ops: [{ store: "meals", del: id }] });
}

/**
 * Logs eating (a meal or individual foods) and deducts stock. `logId` is created once per user action,
 * so a repeated tap finds the log already saved and is refused.
 */
export function logEat(logId: string, title: string, lines: LogLine[], mealId: string | null, date: string): Builder {
  return (s) => {
    if (s.logs.some((l) => l.id === logId)) return { error: "Already logged." };
    const next = applyEat(s.foods, lines);
    if (!next) return { error: "Not enough stock to log this. Check the amounts." };
    const log: Log = { id: logId, kind: "eat", date, at: nowIso(), title, mealId, listId: null, lines, version: 1 };
    return { ops: [...changedFoods(s.foods, next), { store: "logs", put: log }] };
  };
}

/**
 * Edits an eaten log in one change: the old amounts go back into stock and the new amounts come out.
 * The log keeps its id and date, so it is still the same meal for that day.
 */
export function editEat(logId: string, title: string, lines: LogLine[]): Builder {
  return (s) => {
    const log = s.logs.find((l) => l.id === logId);
    if (!log || log.kind !== "eat") return { error: "That log no longer exists." };
    const restored = reverseLog(s.foods, log);
    if (!restored) return { error: "This log can no longer be edited." };
    const next = applyEat(restored, lines);
    if (!next) return { error: "Not enough stock for these amounts." };
    const ops: Op[] = [];
    s.foods.forEach((f, i) => {
      if (next[i].stockBase !== f.stockBase) {
        ops.push({ store: "foods", put: { ...next[i], version: f.version + 1, updatedAt: nowIso() } });
      }
    });
    ops.push({ store: "logs", put: { ...log, title, lines, version: log.version + 1 } });
    return { ops };
  };
}

/** Undoes a log exactly once: the stock change is reversed and the log is removed. */
export function undoLog(logId: string): Builder {
  return (s) => {
    const log = s.logs.find((l) => l.id === logId);
    if (!log) return { error: "This log was already undone." };
    const next = reverseLog(s.foods, log);
    if (!next) return { error: "Undoing this would make stock negative." };
    return { ops: [...changedFoods(s.foods, next), { store: "logs", del: logId }] };
  };
}

function changedFoods(before: Food[], after: Food[]): Op[] {
  const ops: Op[] = [];
  after.forEach((f, i) => {
    if (f.stockBase !== before[i].stockBase) ops.push({ store: "foods", put: { ...f, version: f.version + 1, updatedAt: nowIso() } });
  });
  return ops;
}

export function upsertList(list: ShopList): Builder {
  return () => ({ ops: [{ store: "lists", put: list }] });
}

export function upsertItem(item: ListItem): Builder {
  return () => ({ ops: [{ store: "items", put: { ...item, version: item.version + 1 } }] });
}

export function removeItem(id: string): Builder {
  return () => ({ ops: [{ store: "items", del: id }] });
}

export function upsertPrice(p: Price): Builder {
  return () => ({ ops: [{ store: "prices", put: { ...p, id: PRICE_ID(p.foodId, p.shopId, p.packBase), updatedAt: nowIso() } }] });
}

/**
 * Ticks an item as purchased: adds the purchased quantity to stock once, saves the actual cost,
 * and records a purchase row. An already purchased item is refused, so stock cannot rise twice.
 */
export function markPurchased(itemId: string, actualCents: number | null, date = todayLocal()): Builder {
  return (s) => {
    const item = s.items.find((i) => i.id === itemId);
    if (!item) return { error: "That item no longer exists." };
    if (item.purchased) return { error: "This item was already marked as bought." };
    const cost = actualCents ?? lineCents(item) ?? 0;
    const estimate = actualCents === null;
    const ops: Op[] = [];
    const qtyBase = item.packs * item.packBase;
    const logId = newId();
    const list = s.lists.find((l) => l.id === item.listId);
    if (item.foodId) {
      const food = s.foods.find((f) => f.id === item.foodId);
      if (food) {
        const next = applyAdd([food], [{ foodId: food.id, qtyBase }]);
        ops.push({ store: "foods", put: { ...next[0], version: food.version + 1, updatedAt: nowIso() } });
      }
      const log: Log = {
        id: logId,
        kind: "buy",
        date,
        at: nowIso(),
        title: item.name,
        mealId: null,
        listId: item.listId,
        lines: [{ foodId: item.foodId, name: item.name, qtyBase }],
        version: 1,
      };
      ops.push({ store: "logs", put: log });
    }
    const purchase: Purchase = {
      id: newId(),
      date,
      at: nowIso(),
      listId: item.listId,
      shopId: list?.shopId ?? "",
      foodId: item.foodId,
      name: item.name,
      packs: item.packs,
      packBase: item.packBase,
      qtyBase,
      costCents: cost,
      costIsEstimate: estimate,
      logId: item.foodId ? logId : null,
      version: 1,
    };
    ops.push({ store: "purchases", put: purchase });
    ops.push({ store: "items", put: { ...item, purchased: true, actualCents: cost, purchaseId: purchase.id, version: item.version + 1 } });
    return { ops };
  };
}

/** Reverses a purchase: removes the stock that was added and marks the line as not bought. */
export function unmarkPurchased(itemId: string): Builder {
  return (s) => {
    const item = s.items.find((i) => i.id === itemId);
    if (!item || !item.purchased) return { error: "This item is not marked as bought." };
    const ops: Op[] = [];
    const purchase = s.purchases.find((p) => p.id === item.purchaseId);
    if (purchase?.logId) {
      const log = s.logs.find((l) => l.id === purchase.logId);
      if (log) {
        const next = reverseLog(s.foods, log);
        if (!next) return { error: "Stock has already been used, so this purchase cannot be undone." };
        ops.push(...changedFoods(s.foods, next), { store: "logs", del: log.id });
      }
    }
    if (purchase) ops.push({ store: "purchases", del: purchase.id });
    ops.push({ store: "items", put: { ...item, purchased: false, actualCents: null, purchaseId: null, version: item.version + 1 } });
    return { ops };
  };
}

export const MEASURE_NAME: Record<Measure, string> = { count: "Count", mass: "Weight", volume: "Volume" };
