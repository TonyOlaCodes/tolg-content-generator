"use client";

import { useCallback, useEffect, useState } from "react";
import "./money.css";
import { ensureSeeded, loadSnapshot, applyChange } from "@/money/store";
import type { Change, Result } from "@/money/actions";
import { EMPTY_SNAPSHOT, type Snapshot } from "@/money/types";
import OverviewPage from "./pages/OverviewPage";
import TransactionsPage from "./pages/TransactionsPage";
import BudgetPage from "./pages/BudgetPage";
import SubscriptionsPage from "./pages/SubscriptionsPage";
import ForecastPage from "./pages/ForecastPage";
import SettingsPage from "./pages/SettingsPage";
import { QuickAdd } from "./QuickAdd";
import { ManageSheet } from "./ManageSheet";
import { IncomeSheet } from "./IncomeSheet";
import { SetupSheet } from "./SetupSheet";

export type PageId = "overview" | "activity" | "budget" | "upcoming" | "future" | "settings";

const NAV: { id: PageId; label: string; icon: string }[] = [
  { id: "overview", label: "Home", icon: "◎" },
  { id: "activity", label: "Activity", icon: "≡" },
  { id: "budget", label: "Budget", icon: "◔" },
  { id: "upcoming", label: "Bills", icon: "↻" },
  { id: "future", label: "Future", icon: "∿" },
];

/** Shared handle every page uses to read the snapshot and commit validated changes. */
export type MoneyApi = {
  snap: Snapshot;
  /** Applies a validated change atomically. Returns an error message on failure. */
  commit: (result: Result) => Promise<string | null>;
  reload: () => Promise<void>;
};

export default function MoneyApp({ onBack }: { onBack: () => void }) {
  const [snap, setSnap] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState<PageId>("overview");
  const [quickOpen, setQuickOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setSnap(await loadSnapshot());
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await ensureSeeded();
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

  const commit = useCallback(
    async (result: Result): Promise<string | null> => {
      if (!result.ok) return result.error;
      try {
        await applyChange(result.change as Change);
        await reload();
        return null;
      } catch (e) {
        await reload();
        return e instanceof Error ? e.message : "Could not save. Nothing was changed.";
      }
    },
    [reload],
  );

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const api: MoneyApi = { snap, commit, reload };
  const notify = (msg: string) => setNotice(msg);

  if (loadError) {
    return (
      <div className="money">
        <header className="money-top">
          <button type="button" className="money-back" onClick={onBack}>← Apps</button>
          <h1 className="money-title">Money Tracker</h1>
          <span />
        </header>
        <p className="money-error">Your local data could not be opened: {loadError}. Nothing has been changed.</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="money">
        <p className="money-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="money">
      <header className="money-top">
        <button type="button" className="money-back" onClick={onBack}>← Apps</button>
        <h1 className="money-title">Money Tracker</h1>
        <div className="money-top-actions">
          <button type="button" className="money-icon-btn" onClick={() => setQuickOpen(true)} aria-label="Add transaction">+</button>
          <button type="button" className="money-icon-btn" onClick={() => setPage("settings")} aria-label="Settings & backup">
            ⚙
          </button>
        </div>
      </header>

      {notice && (
        <div className="money-toast" role="status">
          {notice}
        </div>
      )}

      <div className="money-body">
        {page === "overview" && (
          <OverviewPage
            api={api}
            onNavigate={setPage}
            onSetup={() => setSetupOpen(true)}
            onManage={() => setManageOpen(true)}
            onIncome={() => setIncomeOpen(true)}
            notify={notify}
          />
        )}
        {page === "activity" && <TransactionsPage api={api} notify={notify} />}
        {page === "budget" && <BudgetPage api={api} notify={notify} />}
        {page === "upcoming" && <SubscriptionsPage api={api} notify={notify} onSetup={() => setSetupOpen(true)} />}
        {page === "future" && <ForecastPage api={api} onSetup={() => setSetupOpen(true)} />}
        {page === "settings" && <SettingsPage api={api} notify={notify} onClose={() => setPage("overview")} />}
      </div>

      {quickOpen && <QuickAdd api={api} onClose={() => setQuickOpen(false)} notify={notify} />}
      {manageOpen && <ManageSheet api={api} onClose={() => setManageOpen(false)} notify={notify} />}
      {incomeOpen && <IncomeSheet api={api} onClose={() => setIncomeOpen(false)} notify={notify} />}
      {setupOpen && <SetupSheet api={api} onClose={() => setSetupOpen(false)} notify={notify} />}

      <nav className="money-nav" aria-label="Money Tracker sections">
        {NAV.map((n) => (
          <button
            key={n.id}
            type="button"
            className={`money-nav-item${page === n.id ? " is-active" : ""}`}
            onClick={() => setPage(n.id)}
            aria-current={page === n.id ? "page" : undefined}
          >
            <span className="money-nav-icon" aria-hidden>{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
