"use client";

import { useCallback, useEffect, useState } from "react";
import "./groceries.css";
import { loadSnapshot, commit, type Builder } from "@/groceries/store";
import { EMPTY_SNAPSHOT, type Snapshot } from "@/groceries/model";
import HomePage from "./pages/HomePage";
import PantryPage from "./pages/PantryPage";
import MealsPage from "./pages/MealsPage";
import ShoppingPage from "./pages/ShoppingPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import { ensureDefaults } from "./defaults";
import { BackupSheet } from "./pages/BackupSheet";

export type PageId = "home" | "pantry" | "meals" | "shopping" | "analytics";

const NAV: { id: PageId; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "pantry", label: "Pantry", icon: "▦" },
  { id: "meals", label: "Meals", icon: "◷" },
  { id: "shopping", label: "Shopping", icon: "🛒" },
  { id: "analytics", label: "Analytics", icon: "∿" },
];

/** Handle every page uses to read the data and run guarded changes. */
export type GroceriesApi = {
  snap: Snapshot;
  /** Runs a guarded change. Returns an error message to show, or null on success. */
  act: (build: Builder) => Promise<string | null>;
  setPage: (p: PageId) => void;
  /** Shows a short confirmation at the bottom of the screen. */
  notify: (message: string) => void;
};

export default function GroceriesApp({ onBack }: { onBack: () => void }) {
  const [snap, setSnap] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState<PageId>("home");
  const [notice, setNotice] = useState<string | null>(null);
  const [showBackup, setShowBackup] = useState(false);

  const reload = useCallback(async () => {
    setSnap(await loadSnapshot());
  }, []);
  const notify = useCallback((message: string) => setNotice(message), []);

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

  const api: GroceriesApi = { snap, act, setPage, notify };

  return (
    <div className="groceries">
      <header className="groceries-top">
        <button className="groceries-back" onClick={onBack} aria-label="Back to apps">
          ‹ Apps
        </button>
        <h1 className="groceries-title">Groceries &amp; Pantry</h1>
        {ready && !loadError ? (
          <button className="groceries-back" onClick={() => setShowBackup(true)} aria-label="Backup and data">
            Data
          </button>
        ) : (
          <span />
        )}
      </header>

      {!ready ? (
        <p className="groceries-hint">Opening your local pantry…</p>
      ) : loadError ? (
        <div className="groceries-card">
          <p>Your pantry could not be opened: {loadError}</p>
          <p className="groceries-hint">Nothing has been changed. Reload the page to try again.</p>
        </div>
      ) : (
        <main className="groceries-body">
          {page === "home" && <HomePage api={api} />}
          {page === "pantry" && <PantryPage api={api} />}
          {page === "meals" && <MealsPage api={api} />}
          {page === "shopping" && <ShoppingPage api={api} />}
          {page === "analytics" && <AnalyticsPage api={api} />}
        </main>
      )}

      {showBackup && <BackupSheet api={api} onClose={() => setShowBackup(false)} />}

      {notice && <div className="groceries-toast" role="status">{notice}</div>}

      <nav className="groceries-nav" aria-label="Groceries sections">
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

