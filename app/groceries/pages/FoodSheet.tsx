"use client";

import { useState } from "react";
import type { GroceriesApi } from "../GroceriesApp";
import { CATEGORIES, unitsFor, toBase, PRICE_ID, type Food, type Measure, type Unit, UNIT_LABEL } from "@/groceries/model";
import { newId, setFoodArchived } from "@/groceries/actions";
import type { Builder, Op } from "@/groceries/store";
import { parseEuroToCents } from "@/money/money";
import { savedPrice } from "./shared";

export function FoodSheet({
  api,
  food,
  onClose,
  onDelete,
}: {
  api: GroceriesApi;
  food: Food | null;
  onClose: () => void;
  onDelete: (f: Food) => void;
}) {
  const { snap, act, notify } = api;
  const [name, setName] = useState(food?.name ?? "");
  const [category, setCategory] = useState<string>(food?.category ?? CATEGORIES[0]);
  const [measure, setMeasure] = useState<Measure>(food?.measure ?? "mass");
  // Existing stock is edited in base units (g, ml or pieces) so no conversion can lose precision.
  const [stockText, setStockText] = useState(food ? String(food.stockBase) : "0");
  const [unit, setUnit] = useState<Unit>(food ? baseUnit(food) : "g");
  const [usePack, setUsePack] = useState(food?.packBase != null);
  const [packText, setPackText] = useState(food?.packBase ? String(food.packBase) : "");
  // Prices are saved against the shop already on the food, or the app's default shop.
  const shopId = food?.shopId ?? snap.settings?.defaultShopId ?? snap.shops[0]?.id ?? "";
  const [priceText, setPriceText] = useState(food && food.packBase ? priceFor(snap, food) : "");
  const [dailyText, setDailyText] = useState(food?.dailyUseBase != null ? String(food.dailyUseBase) : "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const units = unitsFor(measure, usePack);
  const packBase = usePack ? Math.round(Number(packText)) : null;

  const save = async () => {
    if (saving) return;
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) return setError("Give the food a name.");
    const stock = Number(stockText === "" ? 0 : stockText);
    if (!Number.isFinite(stock) || stock < 0) return setError("Stock cannot be negative.");
    if (usePack && (!packBase || packBase <= 0)) return setError("Enter the package size.");
    const pack = usePack ? packBase : null;
    // Zero stock is allowed; any other amount must fit the chosen unit.
    const stockBase = stock === 0 ? 0 : toBase(stock, unit, measure, pack);
    if (stockBase === null) return setError(`Stock does not fit ${UNIT_LABEL[unit]} for this food.`);
    const daily = dailyText === "" ? null : toBase(Number(dailyText), unit, measure, pack);
    if (dailyText !== "" && daily === null) return setError("Daily use does not fit the unit.");

    const priceCents = priceText.trim() === "" ? null : parseEuroToCents(priceText);
    if (priceText.trim() !== "" && priceCents === null) return setError("Enter the price in euro, e.g. 1.75.");

    const record: Food = {
      id: food?.id ?? newId(),
      name: trimmed,
      category,
      measure,
      stockBase,
      packBase: pack,
      // Kept from the existing food; this form no longer exposes them.
      lowStockBase: food?.lowStockBase ?? null,
      warnDays: food?.warnDays ?? 2,
      targetBase: food?.targetBase ?? null,
      dailyUseBase: daily,
      shopId,
      notes: food?.notes ?? "",
      image: food?.image ?? null,
      archived: food?.archived,
      version: (food?.version ?? 0) + 1,
      createdAt: food?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSaving(true);
    const err = await act(saveFood(record, priceCents, shopId));
    setSaving(false);
    if (err) return setError(err);
    notify(food ? "Saved" : "Food added");
    onClose();
  };

  const setArchived = async (archived: boolean) => {
    if (!food) return;
    setError(null);
    const err = await act(setFoodArchived(food.id, archived));
    if (err) return setError(err);
    notify(archived ? "Food archived" : "Food back in the pantry");
    onClose();
  };

  return (
    <div className="gr-sheet-wrap" role="dialog" aria-modal="true" aria-label={food ? "Edit food" : "Add food"}>
      <button className="gr-scrim" onClick={onClose} aria-label="Close" />
      <div className="gr-sheet">
        <div className="gr-sheet-head">
          <button className="gr-link" onClick={onClose}>Cancel</button>
          <h2 className="gr-h3">{food ? "Edit food" : "Add food"}</h2>
          <button className="gr-link is-strong" onClick={() => void save()} disabled={saving}>Save</button>
        </div>

        <div className="gr-form">
          <label className="gr-field">
            <span>Name</span>
            <input className="gr-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pasta" />
          </label>
          <label className="gr-field">
            <span>Category</span>
            <select className="gr-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <div className="gr-field-row">
            <label className="gr-field">
              <span>Type</span>
              <select className="gr-input" value={measure} onChange={(e) => { const m = e.target.value as Measure; setMeasure(m); setUnit(unitsFor(m, usePack)[0]); }}>
                <option value="mass">Weight</option>
                <option value="volume">Volume</option>
                <option value="count">Count</option>
              </select>
            </label>
            <label className="gr-field">
              <span>Unit</span>
              <select
                className="gr-input"
                value={unit}
                onChange={(e) => {
                  const next = e.target.value as Unit;
                  const pack = usePack ? Math.round(Number(packText)) || food?.packBase || null : null;
                  const convert = (text: string) => {
                    if (text.trim() === "") return text;
                    const n = Number(text);
                    if (!Number.isFinite(n) || n < 0) return text;
                    if (n === 0) return "0";
                    const base = toBase(n, unit, measure, pack);
                    if (base === null) return text;
                    return displayFromBase(base, next, pack);
                  };
                  setStockText((t) => convert(t));
                  setDailyText((t) => convert(t));
                  setUnit(next);
                }}
              >
                {units.map((u) => <option key={u} value={u}>{u === "pack" ? "packs" : u}</option>)}
              </select>
            </label>
          </div>

          <div className="gr-field-row">
            <label className="gr-field">
              <span>Stock now</span>
              <input className="gr-input" inputMode="decimal" value={stockText} onChange={(e) => setStockText(e.target.value)} placeholder="0" />
            </label>
            <label className="gr-field">
              <span>Use per day</span>
              <input className="gr-input" inputMode="decimal" value={dailyText} onChange={(e) => setDailyText(e.target.value)} placeholder="optional" />
            </label>
          </div>
          <p className="gr-muted gr-small">Use per day is optional. It turns stock into “days left” and flags foods running low.</p>

          <label className="gr-toggle">
            <input type="checkbox" checked={usePack} onChange={(e) => { setUsePack(e.target.checked); if (!e.target.checked && unit === "pack") setUnit(unitsFor(measure, false)[0]); }} />
            <span>Sold in packages</span>
          </label>
          {usePack && (
            <div className="gr-field-row">
              <label className="gr-field">
                <span>Package size ({measure === "volume" ? "ml" : measure === "count" ? "pieces" : "g"})</span>
                <input className="gr-input" inputMode="numeric" value={packText} onChange={(e) => setPackText(e.target.value)} placeholder="e.g. 500" />
              </label>
              <label className="gr-field">
                <span>Price per package (€)</span>
                <input className="gr-input" inputMode="decimal" value={priceText} onChange={(e) => setPriceText(e.target.value)} placeholder="optional" />
              </label>
            </div>
          )}

          {error && <p className="gr-error" role="alert">{error}</p>}

          {food && (
            <div className="gr-field-row">
              <button className="gr-secondary" onClick={() => void setArchived(!food.archived)}>
                {food.archived ? "Bring back" : "Archive"}
              </button>
              <button className="gr-danger" onClick={() => onDelete(food)}>Delete food</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Saves the food and, when a price was entered, that price for this shop and package size. */
function saveFood(record: Food, priceCents: number | null, shopId: string): Builder {
  return () => {
    const ops: Op[] = [{ store: "foods", put: { ...record, updatedAt: new Date().toISOString() } }];
    if (priceCents !== null && record.packBase) {
      ops.push({
        store: "prices",
        put: {
          id: PRICE_ID(record.id, shopId, record.packBase),
          foodId: record.id,
          shopId,
          packBase: record.packBase,
          cents: priceCents,
          version: 1,
          updatedAt: new Date().toISOString(),
        },
      });
    }
    return { ops };
  };
}

function priceFor(snap: GroceriesApi["snap"], food: Food): string {
  if (!food.packBase) return "";
  const cents = savedPrice(snap, food.id, food.shopId, food.packBase);
  return cents === null ? "" : (cents / 100).toFixed(2);
}

function baseUnit(food: Food): Unit {
  if (food.measure === "count") return "piece";
  return food.measure === "mass" ? "g" : "ml";
}

function displayFromBase(base: number, unit: Unit, packBase: number | null): string {
  switch (unit) {
    case "pack":
      return packBase ? String(base / packBase) : String(base);
    case "kg":
    case "l":
      return String(base / 1000);
    default:
      return String(base);
  }
}
