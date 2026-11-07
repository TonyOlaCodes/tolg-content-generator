"use client";

import { useMemo } from "react";
import type { GroceriesApi } from "../GroceriesApp";
import { statusOf, listEstimate, reorderPacks, STATUS_LABEL, estimateDailyUse } from "@/groceries/logic";
import { formatBase } from "@/groceries/model";
import { formatEUR } from "@/money/money";
import { todayLocal } from "@/groceries/actions";
import { addLowStockToList, activeList } from "./shared";

export default function HomePage({ api }: { api: GroceriesApi }) {
  const { snap, setPage, notify } = api;
  const today = todayLocal();

  const pantryFoods = useMemo(() => snap.foods.filter((f) => !f.archived), [snap.foods]);
  const rows = useMemo(
    () =>
      pantryFoods.map((f) => {
        const daily = f.dailyUseBase ?? estimateDailyUse(f.id, snap.logs, today);
        return { food: f, daily, status: statusOf(f, daily) };
      }),
    [pantryFoods, snap.logs, today],
  );
  const low = rows.filter((r) => r.status === "low" || r.status === "critical" || r.status === "empty");
  const empty = rows.filter((r) => r.status === "empty").length;
  const list = activeList(snap);
  const listItems = snap.items.filter((i) => i.listId === list?.id);
  const est = listEstimate(listItems);
  const recentMeals = [...snap.logs].filter((l) => l.kind === "eat").sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 4);

  const addLow = async (foodId: string) => {
    const err = await addLowStockToList(api, foodId);
    notify(err ?? "Added to your shopping list");
  };

  return (
    <div className="gr-stack">
      <section className="gr-hero">
        <p className="gr-kicker">My Pantry</p>
        <h2 className="gr-hero-title">
          {pantryFoods.length === 0
            ? "No foods yet"
            : low.length === 0
              ? "You are stocked up"
              : `${low.length} ${low.length === 1 ? "item needs" : "items need"} restocking`}
        </h2>
        <div className="gr-stats">
          <Stat label="Items" value={pantryFoods.length} />
          <Stat label="Running low" value={low.length} tone="warn" />
          <Stat label="Empty" value={empty} tone="bad" />
        </div>
        <p className="gr-muted">
          Shopping total: <strong>{formatEUR(est.cents)}</strong>
          {est.missing > 0 && <> · {est.missing} without a saved price</>}
        </p>
      </section>

      <div className="gr-actions">
        <button className="gr-primary" onClick={() => setPage("meals")}>Log meal</button>
        <button className="gr-secondary" onClick={() => setPage("pantry")}>Add food</button>
        <button className="gr-secondary" onClick={() => setPage("shopping")}>Shopping list</button>
      </div>

      <section className="gr-card">
        <h3 className="gr-h3">Running low</h3>
        {pantryFoods.length === 0 ? (
          <p className="gr-muted">Nothing to show yet.</p>
        ) : low.length === 0 ? (
          <p className="gr-muted">No foods are running low.</p>
        ) : (
          <ul className="gr-list">
            {low.slice(0, 6).map(({ food, status, daily }) => {
              const packs = reorderPacks(food.stockBase, food.targetBase, food.packBase);
              const onList = listItems.some((i) => i.foodId === food.id && !i.purchased);
              return (
                <li key={food.id} className="gr-row">
                  <div className="gr-row-main">
                    <span className="gr-name">{food.name}</span>
                    <span className={`gr-badge is-${status}`}>{STATUS_LABEL[status]}</span>
                    <span className="gr-muted">
                      {formatBase(food.stockBase, food.measure)}
                      {daily ? ` · about ${Math.floor(food.stockBase / daily)} days left` : " · not enough data for days left"}
                    </span>
                  </div>
                  <button
                    className="gr-chip"
                    disabled={onList}
                    onClick={() => addLow(food.id)}
                    aria-label={`Add ${food.name} to shopping list`}
                  >
                    {onList ? "On list" : packs > 0 ? `Add ${packs}` : "Add"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="gr-card">
        <h3 className="gr-h3">Recently eaten</h3>
        {recentMeals.length === 0 ? (
          <p className="gr-muted">Nothing logged yet.</p>
        ) : (
          <ul className="gr-list">
            {recentMeals.map((l) => (
              <li key={l.id} className="gr-row">
                <span className="gr-name">{l.title}</span>
                <span className="gr-muted">{l.date}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" | "bad" }) {
  return (
    <div className={`gr-stat${tone ? ` is-${tone}` : ""}`}>
      <span className="gr-stat-value">{value}</span>
      <span className="gr-stat-label">{label}</span>
    </div>
  );
}
