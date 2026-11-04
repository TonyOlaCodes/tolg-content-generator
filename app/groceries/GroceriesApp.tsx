"use client";

import { useCallback, useEffect, useState } from "react";
import "./groceries.css";
import { loadSnapshot, commit, type Builder } from "@/groceries/store";
import { EMPTY_SNAPSHOT, type Food, type Meal, type Snapshot } from "@/groceries/model";
import HomePage from "./pages/HomePage";
import PantryPage from "./pages/PantryPage";
import MealsPage from "./pages/MealsPage";
import ShoppingPage from "./pages/ShoppingPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import { ensureDefaults } from "./defaults";
import { BackupSheet } from "./pages/BackupSheet";
import { FoodSheet } from "./pages/FoodSheet";
import { MealSheet } from "./pages/MealSheet";
import { FinishSheet } from "./pages/FinishSheet";
import { deleteFood } from "@/groceries/actions";

export type PageId = "home" | "pantry" | "meals" | "shopping" | "analytics";

const NAV: { id: PageId; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "pantry", label: "Pantry", icon: "▦" },
  { id: "meals", label: "Meals", icon: "◷" },
  { id: "shopping", label: "Shopping", icon: "🛒" },
  { id: "analytics", label: "Analytics", icon: "∿" },
];

type AppSheet =
  | { type: "backup" }
  | { type: "food"; food: Food | null }
  | { type: "meal"; meal: Meal | null }
  | { type: "finish"; listId: string };

/** Handle every page uses to read the data and run guarded changes. */
export type GroceriesApi = {
  snap: Snapshot;
  /** Runs a guarded change. Returns an error message to show, or null on success. */
  act: (build: Builder) => Promise<string | null>;
  setPage: (p: PageId) => void;
  /** Shows a short confirmation at the bottom of the screen. */
  notify: (message: string) => void;
  openFoodSheet: (food: Food | null) => void;
  openMealSheet: (meal: Meal | null) => void;
  openFinishSheet: (listId: string) => void;
  closeSheet: () => void;
};

export default function GroceriesApp({ onBack }: { onBack: () => void }) {
  const [snap, setSnap] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState<PageId>("home");
  const [notice, setNotice] = useState<string | null>(null);
  const [sheet, setSheet] = useState<AppSheet | null>(null);

  const reload = useCallback(async () => {
    setSnap(await loadSnapshot());
  }, []);
  const notify = useCallback((message: string) => setNotice(message), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await ensureDefaults();
        const s = await loadSnapshot();
        if (alive) setSnap(s);
      } catch (e) {
        if (alive) setLoadError(e instanceof Error ? e.message : "Could not open local storage.");
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const act = useCallback(
    async (build: Builder) => {
      const err = await commit(build);
      await reload();
      return err;
    },
    [reload],
  );

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(t);
  }, [notice]);

  const removeFood = useCallback(
    async (food: Food) => {
      if (!window.confirm(`Delete ${food.name}? Its saved prices and meal links are removed too. Past logs keep their names.`)) return;
      const err = await act(deleteFood(food.id));
      notify(err ?? "Deleted");
      if (!err) closeSheet();
    },
    [act, notify, closeSheet],
  );

  const api: GroceriesApi = {
    snap,
    act,
    setPage,
    notify,
    openFoodSheet: (food) => setSheet({ type: "food", food }),
    openMealSheet: (meal) => setSheet({ type: "meal", meal }),
    openFinishSheet: (listId) => setSheet({ type: "finish", listId }),
    closeSheet,
  };

  const sheetOpen = sheet !== null;

  return (
    <div className="groceries">
      <header className="groceries-top" inert={sheetOpen ? true : undefined}>
        <button className="groceries-back" onClick={onBack} aria-label="Back to apps">
          ‹ Apps
        </button>
        <h1 className="groceries-title">Groceries &amp; Pantry</h1>
        {ready && !loadError ? (
          <button className="groceries-back" onClick={() => setSheet({ type: "backup" })} aria-label="Backup and data">
            Data
          </button>
        ) : (
          <span />
        )}
      </header>

      {!ready ? (
        <p className="groceries-hint">Opening…</p>
      ) : loadError ? (
        <div className="groceries-card">
          <p>Could not open pantry: {loadError}</p>
        </div>
      ) : (
        <main className="groceries-body" inert={sheetOpen ? true : undefined}>
          {page === "home" && <HomePage api={api} />}
          {page === "pantry" && <PantryPage api={api} />}
          {page === "meals" && <MealsPage api={api} />}
          {page === "shopping" && <ShoppingPage api={api} />}
          {page === "analytics" && <AnalyticsPage api={api} />}
        </main>
      )}

      {sheet?.type === "backup" && <BackupSheet api={api} onClose={closeSheet} />}
      {sheet?.type === "food" && (
        <FoodSheet api={api} food={sheet.food} onClose={closeSheet} onDelete={removeFood} />
      )}
      {sheet?.type === "meal" && <MealSheet api={api} meal={sheet.meal} onClose={closeSheet} />}
      {sheet?.type === "finish" && <FinishSheet api={api} listId={sheet.listId} onClose={closeSheet} />}

      {notice && (
        <div className="groceries-toast" role="status" inert={sheetOpen ? true : undefined}>
          {notice}
        </div>
      )}

      <nav className="groceries-nav" aria-label="Groceries sections" inert={sheetOpen ? true : undefined}>
        {NAV.map((n) => (
          <button
            key={n.id}
            className={`groceries-nav-btn${page === n.id ? " is-on" : ""}`}
            onClick={() => setPage(n.id)}
            aria-current={page === n.id ? "page" : undefined}
          >
            <span className="groceries-nav-icon" aria-hidden>{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
