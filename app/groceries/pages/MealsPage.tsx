"use client";

import { useMemo, useState } from "react";
import type { GroceriesApi } from "../GroceriesApp";
import {
  SLOTS,
  SLOT_LABEL,
  formatBase,
  toBase,
  unitsFor,
  type Food,
  type Log,
  type LogLine,
  type Meal,
  type Slot,
  type Unit,
} from "@/groceries/model";
import { deleteMeal, editEat, logEat, newId, todayLocal, undoLog, upsertMeal } from "@/groceries/actions";

type EatTarget = { meal: Meal } | { log: Log };
type Row = { foodId: string; qty: string; unit: Unit };

export default function MealsPage({ api }: { api: GroceriesApi }) {
  const { snap, act, notify, openMealSheet } = api;
  const today = todayLocal();
  const [quickFood, setQuickFood] = useState("");
  const [quickQty, setQuickQty] = useState("");
  const [eating, setEating] = useState<EatTarget | null>(null);

  const foods = useMemo(() => snap.foods.filter((f) => !f.archived), [snap.foods]);
  const foodById = useMemo(() => new Map(snap.foods.map((f) => [f.id, f])), [snap.foods]);
  const todaysLogs = snap.logs.filter((l) => l.kind === "eat" && l.date === today).sort((a, b) => (a.at < b.at ? 1 : -1));

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
          <p className="gr-muted">No meals yet. Build one from foods in your pantry.</p>
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
                      <button className="gr-primary is-small" onClick={() => setEating({ meal: m })} disabled={m.ingredients.length === 0}>
                        I Ate This
                      </button>
                      <button className="gr-chip" onClick={() => void duplicate(m)}>Copy</button>
                      <button className="gr-chip is-danger" onClick={() => void remove(m)} aria-label={`Delete ${m.name}`}>Delete</button>
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
        {foods.length === 0 ? (
          <p className="gr-muted">No foods in pantry.</p>
        ) : (
          <div className="gr-quick">
            <select className="gr-input" value={quickFood} onChange={(e) => setQuickFood(e.target.value)} aria-label="Food">
              <option value="">Choose food</option>
              {foods.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <input className="gr-input" inputMode="decimal" value={quickQty} onChange={(e) => setQuickQty(e.target.value)} placeholder={quickFood ? `Amount (${unitHint(foodById.get(quickFood))})` : "Amount"} aria-label="Amount eaten" />
            <button className="gr-primary is-small" onClick={() => void quickLog()}>Log</button>
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
                <div className="gr-meal-actions">
                  <button className="gr-chip" onClick={() => setEating({ log: l })}>Edit</button>
                  <button className="gr-chip is-danger" onClick={() => void undo(l.id, l.title)}>Undo</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {eating ? <EatSheet api={api} target={eating} onClose={() => setEating(null)} /> : null}
    </div>
  );
}

/**
 * Confirms a meal or an eaten entry with editable amounts. The same sheet edits a log afterwards,
 * putting the old amounts back before taking the new ones out.
 */
function EatSheet({ api, target, onClose }: { api: GroceriesApi; target: EatTarget; onClose: () => void }) {
  const { snap, act, notify } = api;
  const today = todayLocal();
  const isLog = "log" in target;
  const title = isLog ? target.log.title : target.meal.name;
  const initialLines: LogLine[] = isLog
    ? target.log.lines
    : target.meal.ingredients.map((i) => ({
        foodId: i.foodId,
        name: snap.foods.find((f) => f.id === i.foodId)?.name ?? "Food",
        qtyBase: i.qtyBase,
      }));
  const [rows, setRows] = useState<Row[]>(() =>
    initialLines.filter((l) => snap.foods.some((f) => f.id === l.foodId)).map((l) => rowFor(snap.foods, l)),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  const save = async () => {
    if (saving) return;
    setError(null);
    const lines: LogLine[] = [];
    for (const r of rows) {
      if (!r.foodId && !r.qty) continue;
      const food = snap.foods.find((f) => f.id === r.foodId);
      if (!food) return setError("Choose a food for every line.");
      const qty = toBase(Number(r.qty), r.unit, food.measure, food.packBase);
      if (qty === null) return setError(`${food.name}: enter a valid amount.`);
      lines.push({ foodId: food.id, name: food.name, qtyBase: qty });
    }
    if (lines.length === 0) return setError("Add at least one food.");
    setSaving(true);
    const err = isLog
      ? await act(editEat(target.log.id, target.log.title, lines))
      : await act(logEat(newId(), target.meal.name, lines, target.meal.id, today));
    setSaving(false);
    if (err) return setError(err);
    notify(isLog ? "Entry updated" : `Logged ${title}`);
    onClose();
  };

  return (
    <div className="gr-sheet-wrap" role="dialog" aria-modal="true" aria-label={isLog ? "Edit what you ate" : "I ate this"}>
      <button className="gr-scrim" onClick={onClose} aria-label="Close" />
      <div className="gr-sheet">
        <div className="gr-sheet-head">
          <button className="gr-link" onClick={onClose}>Cancel</button>
          <h2 className="gr-h3">{isLog ? "Edit entry" : "I ate this"}</h2>
          <button className="gr-link is-strong" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        <div className="gr-form">
          <p className="gr-kicker">{title}</p>
          <p className="gr-muted gr-small">Change any amounts, then save. They come out of your pantry.</p>
          {rows.map((r, i) => {
            const food = snap.foods.find((f) => f.id === r.foodId);
            const units = food ? unitsFor(food.measure, food.packBase != null) : [];
            return (
              <div key={i} className="gr-ingredient">
                <select
                  className="gr-input"
                  value={r.foodId}
                  onChange={(e) => update(i, { foodId: e.target.value, unit: firstUnit(snap.foods.find((f) => f.id === e.target.value)), qty: "" })}
                  aria-label="Food"
                >
                  <option value="">Choose food</option>
                  {snap.foods.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}{f.archived ? " (archived)" : ""} · {formatBase(f.stockBase, f.measure)}
                    </option>
                  ))}
                </select>
                <input className="gr-input" inputMode="decimal" value={r.qty} onChange={(e) => update(i, { qty: e.target.value })} placeholder="Amount" aria-label="Amount" />
                <select className="gr-input" value={r.unit} onChange={(e) => update(i, { unit: e.target.value as Unit })} aria-label="Unit">
                  {units.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <button className="gr-chip is-danger" onClick={() => setRows((rs) => rs.filter((_, k) => k !== i))} disabled={rows.length === 1} aria-label="Remove food">×</button>
              </div>
            );
          })}
          <button className="gr-secondary" onClick={() => setRows((rs) => [...rs, { foodId: "", qty: "", unit: "g" }])}>+ Add food</button>
          {error && <p className="gr-error" role="alert">{error}</p>}
          <button className="gr-primary" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : isLog ? "Save changes" : "Log it"}
          </button>
        </div>
      </div>
    </div>
  );
}

function rowFor(foods: Food[], line: LogLine): Row {
  const food = foods.find((f) => f.id === line.foodId);
  const unit = baseUnit(food);
  return { foodId: line.foodId, qty: String(line.qtyBase), unit };
}

function formatFor(food: Food | undefined, qtyBase: number): string {
  return food ? formatBase(qtyBase, food.measure) : `${qtyBase}`;
}

function unitHint(food: Food | undefined): string {
  if (!food) return "";
  return food.measure === "count" ? "pieces" : food.measure === "mass" ? "g" : "ml";
}

function firstUnit(food: Food | undefined): Unit {
  if (!food) return "g";
  return unitsFor(food.measure, food.packBase != null)[0];
}

function baseUnit(food: Food | undefined): Unit {
  if (!food) return "g";
  return food.measure === "count" ? "piece" : food.measure === "mass" ? "g" : "ml";
}
