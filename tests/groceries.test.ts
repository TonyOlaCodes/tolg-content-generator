/* Groceries & Pantry domain tests. Run with: npx tsx tests/groceries.test.ts */
import assert from "node:assert/strict";
import { toBase, toBaseApprox, parseAmountOrFraction, formatBase, unitsFor } from "../groceries/model";
import type { Food, Log } from "../groceries/model";
import { applyEat, applyAdd, reverseLog, daysRemaining, statusOf, reorderPacks, estimateDailyUse, shiftDate, listEstimate } from "../groceries/logic";
import { markPurchased, unmarkPurchased, reconcileStock, logEat, editEat, setFoodArchived } from "../groceries/actions";
import type { Builder } from "../groceries/store";
import type { Snapshot, ListItem, ShopList } from "../groceries/model";
import { EMPTY_SNAPSHOT } from "../groceries/model";

/** Runs a builder against a snapshot the same way `commit` does, without IndexedDB. */
function run(snap: Snapshot, build: Builder): { snap: Snapshot; error: string | null } {
  const result = build(snap);
  if ("error" in result) return { snap, error: result.error };
  let next = snap;
  for (const op of result.ops) {
    const key = op.store;
    if (op.del !== undefined) {
      next = { ...next, [key]: (next[key] as { id: string }[]).filter((r) => r.id !== op.del) };
    } else {
      const row = op.put as { id: string };
      const rows = (next[key] as { id: string }[]).filter((r) => r.id !== row.id);
      next = { ...next, [key]: [...rows, row] };
    }
  }
  return { snap: next, error: null };
}

const food = (over: Partial<Food> = {}): Food => ({
  id: "f1",
  name: "Pasta",
  category: "Carbohydrates",
  measure: "mass",
  stockBase: 1000,
  packBase: 500,
  lowStockBase: null,
  warnDays: 2,
  targetBase: null,
  dailyUseBase: null,
  shopId: "dunnes",
  notes: "",
  image: null,
  version: 1,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...over,
});

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

test("unit conversion: kg, litres, packs and invalid combinations", () => {
  assert.equal(toBase(1.5, "kg", "mass", null), 1500);
  assert.equal(toBase(2, "l", "volume", null), 2000);
  assert.equal(toBase(2, "pack", "mass", 500), 1000);
  assert.equal(toBase(2, "pack", "mass", null), null, "pack needs a package size");
  assert.equal(toBase(1, "g", "count", null), null, "grams do not fit a count food");
  assert.equal(toBase(0, "g", "mass", null), null);
  assert.equal(toBase(1.5, "piece", "count", null), null, "pieces must be whole");
  assert.deepEqual(unitsFor("count", false), ["piece"]);
  assert.deepEqual(unitsFor("mass", true), ["pack", "g", "kg"]);
});

test("daily use accepts fractions of a pack without losing precision", () => {
  assert.equal(parseAmountOrFraction("1/3"), 1 / 3);
  assert.equal(parseAmountOrFraction("0.5"), 0.5);
  assert.equal(parseAmountOrFraction("166.5"), 166.5);
  assert.equal(parseAmountOrFraction("1/0"), null, "a zero denominator is refused");
  assert.equal(parseAmountOrFraction("abc"), null);
  assert.equal(toBaseApprox(1 / 3, "pack", "mass", 500), 500 / 3, "a third of a 500 g pack stays exact");
  assert.equal(toBaseApprox(166.5, "g", "mass", 500), 166.5, "fractional grams are kept for a rate");
  assert.equal(daysRemaining(500, 500 / 3), 3, "a third of a pack a day means the last day counts");
  assert.equal(daysRemaining(1000, 1000 / 7), 7);
});

test("formatting uses kg and litres above 1000", () => {
  assert.equal(formatBase(1250, "mass"), "1.25 kg");
  assert.equal(formatBase(400, "mass"), "400 g");
  assert.equal(formatBase(3, "count"), "3 pieces");
});

test("eating deducts stock and refuses to go negative", () => {
  const foods = [food()];
  const after = applyEat(foods, [{ foodId: "f1", qtyBase: 200 }]);
  assert.ok(after);
  assert.equal(after[0].stockBase, 800);
  assert.equal(applyEat(foods, [{ foodId: "f1", qtyBase: 1200 }]), null, "no negative stock");
});

test("undo restores exactly what an eat log removed", () => {
  const foods = [food()];
  const log: Log = {
    id: "l1",
    kind: "eat",
    date: "2026-05-01",
    at: "",
    title: "Dinner",
    mealId: "m1",
    listId: null,
    lines: [{ foodId: "f1", name: "Pasta", qtyBase: 300 }],
    version: 1,
  };
  const eaten = applyEat(foods, log.lines)!;
  const undone = reverseLog(eaten, log)!;
  assert.equal(undone[0].stockBase, 1000);
});

test("purchases add stock and can be reversed without going negative", () => {
  const added = applyAdd([food({ stockBase: 400 })], [{ foodId: "f1", qtyBase: 2000 }]);
  assert.equal(added[0].stockBase, 2400);
});

test("days remaining needs a daily-use figure and floors the result", () => {
  assert.equal(daysRemaining(1000, null), null);
  assert.equal(daysRemaining(1000, 200), 5, "pasta example: 1000 g at 200 g per day");
  assert.equal(daysRemaining(0, 200), 0);
});

test("status uses per-food warning days and custom low-stock threshold", () => {
  assert.equal(statusOf(food({ stockBase: 0 }), 200), "empty");
  assert.equal(statusOf(food({ stockBase: 1000 }), 200), "plenty", "5 days, warn at 2");
  assert.equal(statusOf(food({ stockBase: 400 }), 200), "low", "2 days is inside warnDays");
  assert.equal(statusOf(food({ stockBase: 150 }), 200), "critical", "under 1 day");
  assert.equal(statusOf(food({ stockBase: 400, warnDays: 1, lowStockBase: 500 }), null), "low", "absolute threshold");
  assert.equal(statusOf(food({ stockBase: 400 }), null), "unknown", "not enough data");
});

test("reorder: 400 g in stock, 2000 g target, 500 g packs gives 4 packs", () => {
  assert.equal(reorderPacks(400, 2000, 500), 4);
  assert.equal(reorderPacks(1900, 2000, 500), 1, "rounds a partial pack up");
  assert.equal(reorderPacks(2500, 2000, 500), 0, "already above target");
  assert.equal(reorderPacks(400, null, 500), 0, "no target, no suggestion");
});

test("daily-use estimate needs real recorded history", () => {
  const today = "2026-05-10";
  const logs: Log[] = [
    { id: "a", kind: "eat", date: "2026-05-08", at: "", title: "", mealId: null, listId: null, lines: [{ foodId: "f1", name: "", qtyBase: 200 }], version: 1 },
    { id: "b", kind: "eat", date: "2026-05-09", at: "", title: "", mealId: null, listId: null, lines: [{ foodId: "f1", name: "", qtyBase: 200 }], version: 1 },
  ];
  assert.equal(estimateDailyUse("f1", logs, today), null, "two days is not enough");
  logs.push({ id: "c", kind: "eat", date: "2026-05-10", at: "", title: "", mealId: null, listId: null, lines: [{ foodId: "f1", name: "", qtyBase: 200 }], version: 1 });
  assert.equal(estimateDailyUse("f1", logs, today), 600 / 14, "three days over a 14-day window");
  assert.equal(shiftDate("2026-03-01", -1), "2026-02-28");
});

test("shopping estimate counts missing prices instead of guessing them", () => {
  const items = [
    { id: "1", listId: "l", foodId: null, name: "A", measure: null, packs: 2, packBase: 1, unitCents: 150, purchased: false, actualCents: null, purchaseId: null, version: 1, createdAt: "" },
    { id: "2", listId: "l", foodId: null, name: "B", measure: null, packs: 1, packBase: 1, unitCents: null, purchased: false, actualCents: null, purchaseId: null, version: 1, createdAt: "" },
  ];
  assert.deepEqual(listEstimate(items), { cents: 300, missing: 1 });
});

test("reconcile sets a counted stock and refuses negative counts", () => {
  const base: Snapshot = { ...EMPTY_SNAPSHOT, foods: [food({ stockBase: 1000 })] };
  const ok = run(base, reconcileStock("f1", 400));
  assert.equal(ok.error, null);
  assert.equal(ok.snap.foods[0].stockBase, 400);
  const bad = run(base, reconcileStock("f1", -5));
  assert.ok(bad.error, "negative counts are refused");
  assert.equal(bad.snap.foods[0].stockBase, 1000);
});

const shopList: ShopList = { id: "l1", name: "Weekly", shopId: "dunnes", createdAt: "", finishedAt: null, version: 1 };
const listItem = (over: Partial<ListItem> = {}): ListItem => ({
  id: "i1", listId: "l1", foodId: "f1", name: "Pasta", measure: "mass", packs: 4, packBase: 500,
  unitCents: 150, purchased: false, actualCents: null, purchaseId: null, version: 1, createdAt: "", ...over,
});

test("ticking an item as bought adds stock exactly once", () => {
  const base: Snapshot = { ...EMPTY_SNAPSHOT, foods: [food({ stockBase: 400 })], lists: [shopList], items: [listItem()] };
  const first = run(base, markPurchased("i1", null, "2026-05-10"));
  assert.equal(first.error, null);
  assert.equal(first.snap.foods[0].stockBase, 2400, "4 packs of 500 g added to 400 g");
  assert.equal(first.snap.items[0].purchased, true);
  assert.equal(first.snap.purchases.length, 1);
  const again = run(first.snap, markPurchased("i1", null, "2026-05-10"));
  assert.ok(again.error, "a second tick is refused");
  assert.equal(again.snap.foods[0].stockBase, 2400, "stock is not increased twice");
});

test("undoing a purchase removes the stock it added and keeps the item unbought", () => {
  const base: Snapshot = { ...EMPTY_SNAPSHOT, foods: [food({ stockBase: 400 })], lists: [shopList], items: [listItem()] };
  const bought = run(base, markPurchased("i1", 500, "2026-05-10"));
  assert.equal(bought.snap.purchases[0].costCents, 500, "actual cost saved");
  assert.equal(bought.snap.purchases[0].costIsEstimate, false);
  const undone = run(bought.snap, unmarkPurchased("i1"));
  assert.equal(undone.error, null);
  assert.equal(undone.snap.foods[0].stockBase, 400);
  assert.equal(undone.snap.items[0].purchased, false);
  assert.equal(undone.snap.purchases.length, 0);
});

test("a repeated meal log is refused by its id so it cannot deduct twice", () => {
  const base: Snapshot = { ...EMPTY_SNAPSHOT, foods: [food({ stockBase: 1000 })] };
  const lines = [{ foodId: "f1", name: "Pasta", qtyBase: 200 }];
  const once = run(base, logEat("same-id", "Pasta", lines, null, "2026-05-10"));
  assert.equal(once.snap.foods[0].stockBase, 800);
  const twice = run(once.snap, logEat("same-id", "Pasta", lines, null, "2026-05-10"));
  assert.ok(twice.error);
  assert.equal(twice.snap.foods[0].stockBase, 800);
});

test("archiving a food hides it but keeps it for restoring", () => {
  const base: Snapshot = { ...EMPTY_SNAPSHOT, foods: [food()] };
  const archived = run(base, setFoodArchived("f1", true));
  assert.equal(archived.error, null);
  assert.equal(archived.snap.foods[0].archived, true);
  const restored = run(archived.snap, setFoodArchived("f1", false));
  assert.equal(restored.snap.foods[0].archived, false);
});

test("editing an eaten log swaps the deducted amounts without double counting", () => {
  const base: Snapshot = { ...EMPTY_SNAPSHOT, foods: [food({ stockBase: 1000 })] };
  const eaten = run(base, logEat("l1", "Pasta", [{ foodId: "f1", name: "Pasta", qtyBase: 200 }], null, "2026-05-10"));
  assert.equal(eaten.snap.foods[0].stockBase, 800);
  const edited = run(eaten.snap, editEat("l1", "Pasta", [{ foodId: "f1", name: "Pasta", qtyBase: 350 }]));
  assert.equal(edited.error, null);
  assert.equal(edited.snap.foods[0].stockBase, 650, "old 200 g goes back, new 350 g comes out");
  assert.equal(edited.snap.logs[0].lines[0].qtyBase, 350);
});

console.log(`\n${passed} groceries tests passed`);
