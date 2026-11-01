// Shared helpers for Groceries pages: the active list, price lookup and list-item creation.
import type { GroceriesApi } from "../GroceriesApp";
import type { Snapshot, ListItem, ShopList } from "@/groceries/model";
import type { Op } from "@/groceries/store";
import { DEFAULT_LIST_NAME, PRICE_ID } from "@/groceries/model";
import { newId } from "@/groceries/actions";
import { reorderPacks } from "@/groceries/logic";

export function activeList(snap: Snapshot): ShopList | undefined {
  const id = snap.settings?.activeListId;
  return snap.lists.find((l) => l.id === id) ?? snap.lists.find((l) => !l.finishedAt);
}

/** Saved price for a food at a shop and package size. Null when none was entered. */
export function savedPrice(snap: Snapshot, foodId: string, shopId: string, packBase: number): number | null {
  const p = snap.prices.find((x) => x.id === PRICE_ID(foodId, shopId, packBase));
  return p ? p.cents : null;
}

/**
 * Adds a food to the active list with the reorder quantity (at least one pack).
 * Only runs on an explicit tap. Returns an error message or null.
 */
export async function addLowStockToList(api: GroceriesApi, foodId: string): Promise<string | null> {
  const { act } = api;
  // The whole decision runs inside one builder against the latest data, so a repeated tap is refused.
  return act((s) => {
    const food = s.foods.find((f) => f.id === foodId);
    if (!food) return { error: "That food no longer exists." };
    const ops: Op[] = [];
    let list = activeList(s);
    if (!list) {
      const shopId = s.settings?.defaultShopId ?? s.shops[0]?.id ?? "";
      list = { id: newId(), name: DEFAULT_LIST_NAME, shopId, createdAt: new Date().toISOString(), finishedAt: null, version: 1 };
      ops.push({ store: "lists", put: list });
    }
    if (s.settings?.activeListId !== list.id) {
      const base = s.settings ?? { id: "main" as const, defaultShopId: null, activeListId: null, routine: [], version: 1 };
      ops.push({ store: "settings", put: { ...base, activeListId: list.id } });
    }
    const duplicate = s.items.some((i) => i.listId === list!.id && i.foodId === food.id && !i.purchased);
    if (duplicate) return { error: "Already on your list." };
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
    return { ops };
  });
}
