// Groceries & Pantry: types and unit rules. Pure: no browser APIs.
//
// Stock is always stored in base units: pieces (count), grams (mass) or millilitres (volume).
// A food's package size is stored in the same base units, so "2 packs of 500 g" becomes 1000 g.

export const CATEGORIES = [
  "Meat & fish",
  "Carbohydrates",
  "Dairy & eggs",
  "Fruit & veg",
  "Snacks",
  "Drinks",
  "Tins & jars",
  "Frozen",
  "Condiments & spices",
  "Household",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type Measure = "count" | "mass" | "volume";
export type Unit = "piece" | "pack" | "g" | "kg" | "ml" | "l";

export const UNIT_LABEL: Record<Unit, string> = {
  piece: "pieces",
  pack: "packs",
  g: "g",
  kg: "kg",
  ml: "ml",
  l: "litres",
};

export const SLOTS = ["breakfast", "lunch", "dinner", "snack", "custom"] as const;
export type Slot = (typeof SLOTS)[number];
export const SLOT_LABEL: Record<Slot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  custom: "Custom",
};

/** Units a person can type for a food. "pack" only works when a package size is set. */
export function unitsFor(measure: Measure, hasPack: boolean): Unit[] {
  const base: Unit[] = measure === "count" ? ["piece"] : measure === "mass" ? ["g", "kg"] : ["ml", "l"];
  return hasPack ? ["pack", ...base] : base;
}

/**
 * Converts a typed quantity into base units. Returns null when the unit does not fit the food,
 * the amount is not positive, or the result is not a whole number of pieces.
 */
export function toBase(qty: number, unit: Unit, measure: Measure, packBase: number | null): number | null {
  if (!Number.isFinite(qty) || qty <= 0) return null;
  let base: number;
  switch (unit) {
    case "pack":
      if (!packBase) return null;
      base = qty * packBase;
      break;
    case "piece":
      if (measure !== "count") return null;
      base = qty;
      break;
    case "g":
      if (measure !== "mass") return null;
      base = qty;
      break;
    case "kg":
      if (measure !== "mass") return null;
      base = qty * 1000;
      break;
    case "ml":
      if (measure !== "volume") return null;
      base = qty;
      break;
    case "l":
      if (measure !== "volume") return null;
      base = qty * 1000;
      break;
  }
  // Counts must be whole pieces. Mass and volume are kept to whole grams or millilitres.
  const rounded = Math.round(base);
  if (measure === "count" && Math.abs(base - rounded) > 1e-9) return null;
  return rounded > 0 ? rounded : null;
}

/** Like toBase, but keeps a fractional rate (daily use) instead of rounding to whole grams. */
export function toBaseApprox(qty: number, unit: Unit, measure: Measure, packBase: number | null): number | null {
  if (!Number.isFinite(qty) || qty <= 0) return null;
  switch (unit) {
    case "pack":
      return packBase ? qty * packBase : null;
    case "piece":
      return measure === "count" ? qty : null;
    case "g":
      return measure === "mass" ? qty : null;
    case "kg":
      return measure === "mass" ? qty * 1000 : null;
    case "ml":
      return measure === "volume" ? qty : null;
    case "l":
      return measure === "volume" ? qty * 1000 : null;
  }
}

/** Reads "1/3", "0.5" or "166.5". Null when the text is not a positive amount. */
export function parseAmountOrFraction(text: string): number | null {
  const value = text.trim();
  if (!value) return null;
  const fraction = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(value);
  if (fraction) {
    const top = Number(fraction[1]);
    const bottom = Number(fraction[2]);
    return bottom > 0 && top > 0 ? top / bottom : null;
  }
  return /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : null;
}

const trimNumber = (n: number) => Number(n.toFixed(2)).toString();

/** Human text for a base quantity, e.g. 1250 g -> "1.25 kg", 3 pieces -> "3 pieces". */
export function formatBase(base: number, measure: Measure): string {
  if (measure === "count") return `${base} ${base === 1 ? "piece" : "pieces"}`;
  if (measure === "mass") return base >= 1000 ? `${trimNumber(base / 1000)} kg` : `${base} g`;
  return base >= 1000 ? `${trimNumber(base / 1000)} l` : `${base} ml`;
}

/** "1 pack", "2 packs", "1.5 packs". Null when the food has no package size. */
export function formatPackCount(stockBase: number, packBase: number | null): string | null {
  if (!packBase) return null;
  const packs = Math.round((stockBase / packBase) * 10) / 10;
  return `${packs} ${packs === 1 ? "pack" : "packs"}`;
}

export type Food = {
  id: string;
  name: string;
  category: string;
  measure: Measure;
  /** Current stock in base units. Never negative. */
  stockBase: number;
  /** Base units in one package, or null when packages are not used. */
  packBase: number | null;
  /** Optional absolute low-stock threshold in base units. */
  lowStockBase: number | null;
  /** Warn when this many days (or fewer) remain. */
  warnDays: number;
  /** Target stock in base units for reorder suggestions. */
  targetBase: number | null;
  /** Manually entered daily use in base units. Overrides estimates when set. */
  dailyUseBase: number | null;
  /** Supermarket this food is usually bought from. */
  shopId: string;
  notes: string;
  /** Small data-URL thumbnail, or null. */
  image: string | null;
  /** Hidden from the pantry and pickers but kept for history. Can be brought back any time. */
  archived?: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type MealIngredient = { foodId: string; qtyBase: number };

export type Meal = {
  id: string;
  name: string;
  slot: Slot;
  ingredients: MealIngredient[];
  version: number;
  createdAt: string;
};

export type LogKind = "eat" | "add" | "buy";

export type LogLine = { foodId: string; name?: string; qtyBase: number };

/** A dated record of stock movement. Every stock change is one log, so it can be undone or edited. */
export type Log = {
  id: string;
  kind: LogKind;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  at: string;
  title: string;
  mealId: string | null;
  listId: string | null;
  lines: LogLine[];
  version: number;
};

export type Shop = { id: string; name: string; version: number };

export type ShopList = {
  id: string;
  name: string;
  shopId: string;
  createdAt: string;
  finishedAt: string | null;
  version: number;
};

export type ListItem = {
  id: string;
  listId: string;
  foodId: string | null;
  name: string;
  measure: Measure | null;
  /** Packages to buy. */
  packs: number;
  /** Base units per package. Non-food items use 1. */
  packBase: number;
  /** Price per package in cents, or null when no price is known. */
  unitCents: number | null;
  purchased: boolean;
  /** Total amount paid for this line, in cents, once purchased. */
  actualCents: number | null;
  purchaseId: string | null;
  version: number;
  createdAt: string;
};

/** Saved price for a food at one supermarket and package size. */
export type Price = {
  id: string;
  foodId: string;
  shopId: string;
  packBase: number;
  cents: number;
  version: number;
  updatedAt: string;
};

export type Purchase = {
  id: string;
  date: string;
  at: string;
  listId: string;
  shopId: string;
  foodId: string | null;
  name: string;
  packs: number;
  packBase: number;
  qtyBase: number;
  costCents: number;
  /** True when the cost is only the saved estimate, not an amount entered as paid. */
  costIsEstimate: boolean;
  logId: string | null;
  version: number;
};

export type Settings = {
  id: "main";
  defaultShopId: string | null;
  activeListId: string | null;
  /** Meal ids eaten every day, used only to estimate daily demand. */
  routine: string[];
  version: number;
};

export type Snapshot = {
  foods: Food[];
  meals: Meal[];
  logs: Log[];
  lists: ShopList[];
  items: ListItem[];
  shops: Shop[];
  prices: Price[];
  purchases: Purchase[];
  settings: Settings | null;
};

export const EMPTY_SNAPSHOT: Snapshot = {
  foods: [],
  meals: [],
  logs: [],
  lists: [],
  items: [],
  shops: [],
  prices: [],
  purchases: [],
  settings: null,
};

export const DEFAULT_SHOP_NAME = "Dunnes Stores";
export const DEFAULT_LIST_NAME = "Shopping list";
export const PRICE_ID = (foodId: string, shopId: string, packBase: number) => `${foodId}|${shopId}|${packBase}`;
