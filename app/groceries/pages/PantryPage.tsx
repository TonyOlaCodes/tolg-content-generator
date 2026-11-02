"use client";

import { useMemo, useState } from "react";
import type { GroceriesApi } from "../GroceriesApp";
import { CATEGORIES, type Food, formatBase } from "@/groceries/model";
import { statusOf, STATUS_LABEL, estimateDailyUse, type Status } from "@/groceries/logic";
import { adjustStock, deleteFood, todayLocal } from "@/groceries/actions";
import { FoodSheet } from "./FoodSheet";

type Filter = "all" | "low" | "empty";

export default function PantryPage({ api }: { api: GroceriesApi }) {
  const { snap, act, notify } = api;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Food | "new" | null>(null);
  const today = todayLocal();

  const rows = useMemo(
    () =>
      snap.foods.map((f) => {
        const daily = f.dailyUseBase ?? estimateDailyUse(f.id, snap.logs, today);
        return { food: f, daily, status: statusOf(f, daily) as Status };
      }),
    [snap.foods, snap.logs, today],
  );

  const visible = rows
    .filter(({ food, status }) => {
      if (category !== "All" && food.category !== category) return false;
      if (filter === "low" && status !== "low" && status !== "critical") return false;
      if (filter === "empty" && status !== "empty") return false;
      if (query && !food.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => a.food.name.localeCompare(b.food.name));

  const nudge = async (food: Food, delta: number) => {
    const err = await act(adjustStock(food.id, delta));
    if (err) notify(err);
  };

  const remove = async (food: Food) => {
    if (!window.confirm(`Delete ${food.name}? Its saved prices and meal links are removed too. Past logs keep their names.`)) return;
    const err = await act(deleteFood(food.id));
    notify(err ?? "Deleted");
    if (!err) setEditing(null);
  };

  return (
    <div className="gr-stack">
      <div className="gr-search">
        <input
          className="gr-input"
          type="search"
          placeholder="Search foods"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search foods"
        />
      </div>
      <div className="gr-chips-row" role="tablist" aria-label="Filter">
        {(["all", "low", "empty"] as Filter[]).map((f) => (
          <button key={f} className={`gr-pill${filter === f ? " is-on" : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f === "low" ? "Running low" : "Empty"}
          </button>
        ))}
      </div>
      <div className="gr-chips-row">
        {["All", ...CATEGORIES].map((c) => (
          <button key={c} className={`gr-pill${category === c ? " is-on" : ""}`} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>

      <button className="gr-primary" onClick={() => setEditing("new")}>+ Add food</button>

      {snap.foods.length === 0 ? (
        <div className="gr-card gr-empty">
          <p className="gr-h3">Your pantry is empty</p>
          <p className="gr-muted">No foods yet.</p>
        </div>
      ) : visible.length === 0 ? (
        <p className="gr-muted gr-center">No foods match these filters.</p>
      ) : (
        <ul className="gr-food-list">
          {visible.map(({ food, status, daily }) => (
            <li key={food.id} className="gr-food">
              <button className="gr-food-main" onClick={() => setEditing(food)} aria-label={`Edit ${food.name}`}>
                <span className="gr-food-name">{food.name}</span>
                <span className="gr-muted">
                  {formatBase(food.stockBase, food.measure)}
                  {food.packBase ? ` · packs of ${formatBase(food.packBase, food.measure)}` : ""}
                </span>
                <span className={`gr-badge is-${status}`}>
                  {STATUS_LABEL[status]}
                  {daily && status !== "empty" ? ` · ${Math.floor(food.stockBase / daily)} days` : ""}
                </span>
              </button>
              <div className="gr-stepper" aria-label={`Adjust ${food.name}`}>
                <button onClick={() => nudge(food, -stepFor(food))} disabled={food.stockBase <= 0} aria-label="Remove one">−</button>
                <button onClick={() => nudge(food, stepFor(food))} aria-label="Add one">+</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <FoodSheet
          api={api}
          food={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDelete={remove}
        />
      )}
    </div>
  );
}

/** One tap moves stock by one package when packs are used, otherwise by one unit step. */
export function stepFor(food: Food): number {
  if (food.packBase) return food.packBase;
  return food.measure === "count" ? 1 : 100;
}
