"use client";

import { useMemo, useState } from "react";
import type { GroceriesApi } from "../GroceriesApp";
import { SLOTS, SLOT_LABEL, formatBase, type Food, type LogLine, type Meal, type Slot } from "@/groceries/model";
import { logEat, undoLog, todayLocal, newId, upsertMeal, deleteMeal } from "@/groceries/actions";

export default function MealsPage({ api }: { api: GroceriesApi }) {
  const { snap, act, notify, openMealSheet } = api;
  const today = todayLocal();
  const [busy, setBusy] = useState<string | null>(null);
  const [quickFood, setQuickFood] = useState<string>("");
  const [quickQty, setQuickQty] = useState<string>("");

  const todaysLogs = snap.logs.filter((l) => l.kind === "eat" && l.date === today).sort((a, b) => (a.at < b.at ? 1 : -1));
  const foodById = useMemo(() => new Map(snap.foods.map((f) => [f.id, f])), [snap.foods]);

  // Each tap uses its own log id, so a double-tap is refused by the store.
  const eatMeal = async (meal: Meal) => {
    if (busy) return;
    setBusy(meal.id);
    const lines: LogLine[] = meal.ingredients.map((i) => ({ foodId: i.foodId, name: foodById.get(i.foodId)?.name, qtyBase: i.qtyBase }));
    const err = await act(logEat(newId(), meal.name, lines, meal.id, today));
    setBusy(null);
    notify(err ?? `Logged ${meal.name}`);
  };

  const quickLog = async () => {
    const food = foodById.get(quickFood);
    const qty = Math.round(Number(quickQty));
    if (!food) return notify("Choose a food.");
    if (!qty || qty <= 0) return notify("Enter the amount eaten.");
    const err = await act(logEat(newId(), food.name, [{ foodId: food.id, name: food.name, qtyBase: qty }], null, today));
    notify(err ?? `Logged ${food.name}`);
    if (!err) setQuickQty("");
  };

  const undo = async (logId: string, title: string) => {
    const err = await act(undoLog(logId));
    notify(err ?? `Undid ${title}`);
  };

  const duplicate = async (meal: Meal) => {
    const copy: Meal = { ...meal, id: newId(), name: `${meal.name} (copy)`, createdAt: new Date().toISOString(), version: 1 };
    const err = await act(upsertMeal(copy));
    notify(err ?? "Meal duplicated");
  };

  const remove = async (meal: Meal) => {
    if (!window.confirm(`Delete the saved meal "${meal.name}"? Past logs are kept.`)) return;
    const err = await act(deleteMeal(meal.id));
    notify(err ?? "Meal deleted");
  };

  const bySlot = (slot: Slot) => snap.meals.filter((m) => m.slot === slot);

  return (
    <div className="gr-stack">
      <section className="gr-card">
        <div className="gr-row-head">
          <h3 className="gr-h3">Saved meals</h3>
          <button className="gr-chip" onClick={() => openMealSheet(null)}>+ New meal</button>
        </div>
        {snap.meals.length === 0 ? (
          <p className="gr-muted">No meals yet.</p>
        ) : (
          SLOTS.map((slot) =>
            bySlot(slot).length === 0 ? null : (
              <div key={slot} className="gr-group">
                <p className="gr-kicker">{SLOT_LABEL[slot]}</p>
                {bySlot(slot).map((m) => (
                  <div key={m.id} className="gr-meal">
                    <button className="gr-meal-main" onClick={() => openMealSheet(m)} aria-label={`Edit ${m.name}`}>
                      <span className="gr-name">{m.name}</span>
                      <span className="gr-muted">
                        {m.ingredients.map((i) => `${foodById.get(i.foodId)?.name ?? "Removed food"} ${formatFor(foodById.get(i.foodId), i.qtyBase)}`).join(" · ") || "No ingredients"}
                      </span>
                    </button>
                    <div className="gr-meal-actions">
                      <button className="gr-primary is-small" onClick={() => eatMeal(m)} disabled={busy === m.id || m.ingredients.length === 0}>
                        I Ate This
                      </button>
                      <button className="gr-chip" onClick={() => duplicate(m)}>Copy</button>
                      <button className="gr-chip is-danger" onClick={() => remove(m)} aria-label={`Delete ${m.name}`}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            ),
          )
        )}
      </section>

      <section className="gr-card">
        <h3 className="gr-h3">Quick log a food</h3>
        {snap.foods.length === 0 ? (
          <p className="gr-muted">No foods in pantry.</p>
        ) : (
          <div className="gr-quick">
            <select className="gr-input" value={quickFood} onChange={(e) => setQuickFood(e.target.value)} aria-label="Food">
              <option value="">Choose food</option>
              {snap.foods.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <input className="gr-input" inputMode="decimal" value={quickQty} onChange={(e) => setQuickQty(e.target.value)} placeholder={quickFood ? `Amount (${unitHint(foodById.get(quickFood))})` : "Amount"} aria-label="Amount eaten" />
            <button className="gr-primary is-small" onClick={quickLog}>Log</button>
          </div>
        )}
      </section>

      <section className="gr-card">
        <h3 className="gr-h3">Today</h3>
        {todaysLogs.length === 0 ? (
          <p className="gr-muted">Nothing eaten yet today.</p>
        ) : (
          <ul className="gr-list">
            {todaysLogs.map((l) => (
              <li key={l.id} className="gr-row">
                <div className="gr-row-main">
                  <span className="gr-name">{l.title}</span>
                  <span className="gr-muted">
                    {l.lines.map((x) => `${x.name ?? foodById.get(x.foodId)?.name ?? "Food"} ${formatFor(foodById.get(x.foodId), x.qtyBase)}`).join(" · ")}
                  </span>
                </div>
                <button className="gr-chip is-danger" onClick={() => undo(l.id, l.title)}>Undo</button>
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  );
}

function formatFor(food: Food | undefined, qtyBase: number): string {
  return food ? formatBase(qtyBase, food.measure) : `${qtyBase}`;
}

function unitHint(food: Food | undefined): string {
  if (!food) return "";
  return food.measure === "count" ? "pieces" : food.measure === "mass" ? "g" : "ml";
}
