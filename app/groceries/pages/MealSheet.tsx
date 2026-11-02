"use client";

import { useState } from "react";
import type { GroceriesApi } from "../GroceriesApp";
import { SLOTS, SLOT_LABEL, toBase, unitsFor, type Meal, type MealIngredient, type Slot, type Unit } from "@/groceries/model";
import { upsertMeal, newId } from "@/groceries/actions";

type Row = { foodId: string; qty: string; unit: Unit };

export function MealSheet({ api, meal, onClose }: { api: GroceriesApi; meal: Meal | null; onClose: () => void }) {
  const { snap, act, notify } = api;
  const [name, setName] = useState(meal?.name ?? "");
  const [slot, setSlot] = useState<Slot>(meal?.slot ?? "lunch");
  const [rows, setRows] = useState<Row[]>(() =>
    meal?.ingredients.length
      ? meal.ingredients.map((i) => {
          const f = snap.foods.find((x) => x.id === i.foodId);
          // Edit in base units so pack foods are not shown as "packs" of gram totals.
          const unit = baseUnit(f);
          return { foodId: i.foodId, qty: displayFromBase(i.qtyBase, unit, f?.packBase ?? null), unit };
        })
      : [{ foodId: "", qty: "", unit: "g" }],
  );
  const [error, setError] = useState<string | null>(null);

  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError("Name the meal.");
    const ingredients: MealIngredient[] = [];
    for (const r of rows) {
      if (!r.foodId && !r.qty) continue;
      const food = snap.foods.find((f) => f.id === r.foodId);
      if (!food) return setError("Choose a food for every ingredient.");
      const qty = toBase(Number(r.qty), r.unit, food.measure, food.packBase);
      if (qty === null) return setError(`${food.name}: enter a valid amount in a unit that fits this food.`);
      ingredients.push({ foodId: food.id, qtyBase: qty });
    }
    if (ingredients.length === 0) return setError("Add at least one ingredient.");
    const record: Meal = {
      id: meal?.id ?? newId(),
      name: name.trim(),
      slot: slot as Slot,
      ingredients,
      version: (meal?.version ?? 0) + 1,
      createdAt: meal?.createdAt ?? new Date().toISOString(),
    };
    const err = await act(upsertMeal(record));
    if (err) return setError(err);
    notify("Meal saved");
    onClose();
  };

  return (
    <div className="gr-sheet-wrap" role="dialog" aria-modal="true" aria-label={meal ? "Edit meal" : "New meal"}>
      <button className="gr-scrim" onClick={onClose} aria-label="Close" />
      <div className="gr-sheet">
        <div className="gr-sheet-head">
          <button className="gr-link" onClick={onClose}>Cancel</button>
          <h2 className="gr-h3">{meal ? "Edit meal" : "New meal"}</h2>
          <button className="gr-link is-strong" onClick={save}>Save</button>
        </div>
        <div className="gr-form">
          {snap.foods.length === 0 ? (
            <p className="gr-muted">No foods in pantry.</p>
          ) : (
            <>
              <label className="gr-field">
                <span>Name</span>
                <input className="gr-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pasta bolognese" />
              </label>
              <label className="gr-field">
                <span>Meal</span>
                <select className="gr-input" value={slot} onChange={(e) => setSlot(e.target.value as Slot)}>
                  {SLOTS.map((s) => <option key={s} value={s}>{SLOT_LABEL[s]}</option>)}
                </select>
              </label>
              <p className="gr-kicker">Ingredients</p>
              {rows.map((r, i) => {
                const food = snap.foods.find((f) => f.id === r.foodId);
                const units = food ? unitsFor(food.measure, food.packBase != null) : [];
                return (
                  <div key={i} className="gr-ingredient">
                    <select className="gr-input" value={r.foodId} onChange={(e) => update(i, { foodId: e.target.value, unit: firstUnit(snap.foods.find((f) => f.id === e.target.value)) })} aria-label="Ingredient food">
                      <option value="">Choose food</option>
                      {snap.foods.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    <input className="gr-input" inputMode="decimal" value={r.qty} onChange={(e) => update(i, { qty: e.target.value })} placeholder="Amount" aria-label="Amount" />
                    <select className="gr-input" value={r.unit} onChange={(e) => update(i, { unit: e.target.value as Unit })} aria-label="Unit">
                      {units.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <button className="gr-chip is-danger" onClick={() => setRows((rs) => rs.filter((_, k) => k !== i))} disabled={rows.length === 1} aria-label="Remove ingredient">×</button>
                  </div>
                );
              })}
              <button className="gr-secondary" onClick={() => setRows((rs) => [...rs, { foodId: "", qty: "", unit: "g" }])}>+ Add ingredient</button>
            </>
          )}
          {error && <p className="gr-error" role="alert">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function firstUnit(food: { measure: "count" | "mass" | "volume"; packBase: number | null } | undefined): Unit {
  if (!food) return "g";
  return unitsFor(food.measure, food.packBase != null)[0];
}

function baseUnit(food: { measure: "count" | "mass" | "volume" } | undefined): Unit {
  if (!food) return "g";
  return food.measure === "count" ? "piece" : food.measure === "mass" ? "g" : "ml";
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
