// Shared helpers for Groceries pages: the active list, price lookup and list-item creation.
import type { GroceriesApi } from "../GroceriesApp";
import type { Food, Snapshot, ListItem, ShopList } from "@/groceries/model";
import type { Op } from "@/groceries/store";
import { DEFAULT_LIST_NAME, PRICE_ID } from "@/groceries/model";
import { newId, todayLocal } from "@/groceries/actions";
import { estimateDailyUse, reorderPacks, statusOf } from "@/groceries/logic";

export function activeList(snap: Snapshot): ShopList | undefined {
  const id = snap.settings?.activeListId;
  const byId = id ? snap.lists.find((l) => l.id === id) : undefined;
  // Never keep writing into a finished list — fall back to any open list.
  if (byId && !byId.finishedAt) return byId;
  return snap.lists.find((l) => !l.finishedAt);
}

/** Saved price for a food at a shop and package size. Null when none was entered. */
export function savedPrice(snap: Snapshot, foodId: string, shopId: string, packBase: number): number | null {
  const p = snap.prices.find((x) => x.id === PRICE_ID(foodId, shopId, packBase));
  return p ? p.cents : null;
}

/** Foods that are at or below their low-stock point, or empty. Archived foods never count. */
export function lowStockFoods(snap: Snapshot, today = todayLocal()): Food[] {
  return snap.foods.filter((f) => {
    if (f.archived) return false;
    const daily = f.dailyUseBase ?? estimateDailyUse(f.id, snap.logs, today);
    const status = statusOf(f, daily);
    return status === "low" || status === "critical" || status === "empty";
  });
}

/** The active list, created (and selected in settings) when there is none yet. */
function ensureList(s: Snapshot, ops: Op[]): ShopList {
  const existing = activeList(s);
  const base = s.settings ?? { id: "main" as const, defaultShopId: null, activeListId: null, routine: [], version: 1 };
  if (existing) {
    if (s.settings?.activeListId !== existing.id) ops.push({ store: "settings", put: { ...base, activeListId: existing.id } });
    return existing;
  }
  const list: ShopList = {
    id: newId(),
    name: DEFAULT_LIST_NAME,
    shopId: s.settings?.defaultShopId ?? s.shops[0]?.id ?? "",
    createdAt: new Date().toISOString(),
    finishedAt: null,
    version: 1,
  };
  ops.push({ store: "lists", put: list });
  ops.push({ store: "settings", put: { ...base, activeListId: list.id } });
  return list;
}

/** Queues one list line for a food, unless it is already waiting on the list. */
function queueFood(s: Snapshot, food: Food, list: ShopList, ops: Op[], queued: Set<string>) {
  if (queued.has(food.id)) return;
  queued.add(food.id);
  const packBase = food.packBase ?? 1;
  const item: ListItem = {
    id: newId(),
    listId: list.id,
    foodId: food.id,
    name: food.name,
    measure: food.measure,
    packs: Math.max(1, reorderPacks(food.stockBase, food.targetBase, food.packBase)),
    packBase,
    unitCents: savedPrice(s, food.id, list.shopId, packBase),
    purchased: false,
    actualCents: null,
    purchaseId: null,
    version: 1,
    createdAt: new Date().toISOString(),
  };
  ops.push({ store: "items", put: item });
}

function listedFoodIds(s: Snapshot, list: ShopList): Set<string> {
  return new Set(
    s.items
      .filter((i) => i.listId === list.id && !i.purchased && i.foodId)
      .map((i) => i.foodId as string),
  );
}

/**
 * Adds a food to the active list with the reorder quantity (at least one pack).
 * Only runs on an explicit tap. Returns an error message or null.
 */
export async function addLowStockToList(api: GroceriesApi, foodId: string): Promise<string | null> {
  return api.act((s) => {
    const food = s.foods.find((f) => f.id === foodId);
    if (!food) return { error: "That food no longer exists." };
    const ops: Op[] = [];
    const list = ensureList(s, ops);
    const queued = listedFoodIds(s, list);
    if (queued.has(food.id)) return { error: "Already on your list." };
    queueFood(s, food, list, ops, queued);
    return { ops };
  });
}

/** Puts every low or empty food on the active list in one tap, skipping what is already there. */
export async function addLowStockFoods(api: GroceriesApi): Promise<string | null> {
  const today = todayLocal();
  return api.act((s) => {
    const low = lowStockFoods(s, today);
    if (low.length === 0) return { error: "No foods are running low." };
    const ops: Op[] = [];
    const list = ensureList(s, ops);
    const queued = listedFoodIds(s, list);
    for (const food of low) queueFood(s, food, list, ops, queued);
    return { ops };
  });
}
