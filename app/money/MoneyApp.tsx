"use client";

import { useCallback, useEffect, useState } from "react";
import "./money.css";
import { ensureSeeded, loadSnapshot, applyChange } from "@/money/store";
import type { Change, Result } from "@/money/actions";
import { EMPTY_SNAPSHOT, type Snapshot } from "@/money/types";
import HomePage from "./pages/HomePage";
import AccountsPage from "./pages/AccountsPage";
import SubscriptionsPage from "./pages/SubscriptionsPage";
import MorePage from "./pages/MorePage";
import TransactionsPage from "./pages/TransactionsPage";
import BudgetPage from "./pages/BudgetPage";
import ForecastPage from "./pages/ForecastPage";
import SettingsPage from "./pages/SettingsPage";
import WealthPage from "./pages/WealthPage";
import SpendingPage from "./pages/SpendingPage";
import { MoneyFlowSheet, type FlowMode } from "./MoneyFlowSheet";
import { IncomeSheet } from "./IncomeSheet";
import { SetupSheet } from "./SetupSheet";
import { ConfirmBillSheet } from "./ConfirmBillSheet";

export type PageId =
  | "home"
  | "accounts"
  | "bills"
  | "more"
  | "activity"
  | "budget"
  | "future"
  | "settings"
  | "wealth"
  | "spending";

const NAV: { id: PageId; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "◎" },
  { id: "accounts", label: "Accounts", icon: "▭" },
  { id: "bills", label: "Bills", icon: "↻" },
  { id: "more", label: "More", icon: "···" },
];

export type MoneyApi = {
  snap: Snapshot;
  commit: (result: Result) => Promise<string | null>;
  reload: () => Promise<void>;
};

export default function MoneyApp({ onBack }: { onBack: () => void }) {
  const [snap, setSnap] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState<PageId>("home");
  const [focusAccountId, setFocusAccountId] = useState<string | null>(null);
  const [flow, setFlow] = useState<{ mode: FlowMode; from?: string; to?: string; preferAccountId?: string } | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [confirmBillId, setConfirmBillId] = useState<string | null>(null);
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
  const sheetOpen = !!flow || setupOpen || incomeOpen || !!confirmBillId;
  const confirmBill = confirmBillId ? snap.recurring.find((r) => r.id === confirmBillId) : null;

  const go = (p: PageId, accountId?: string) => {
    setPage(p);
    setFocusAccountId(accountId ?? null);
  };

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

  const mainTab = page === "home" || page === "accounts" || page === "bills" || page === "more";

  return (
    <div className={`money${sheetOpen ? " is-sheet-open" : ""}`}>
      <header className="money-top" inert={sheetOpen ? true : undefined}>
        <button type="button" className="money-back" onClick={onBack}>← Apps</button>
        <h1 className="money-title">Money Tracker</h1>
        <div className="money-top-actions">
          {page !== "home" && page !== "more" ? (
            <button type="button" className="money-icon-btn" onClick={() => setFlow({ mode: "add" })} aria-label="Add money">+</button>
          ) : (
            <span />
          )}
        </div>
      </header>

      {notice && (
        <div className="money-toast" role="status" inert={sheetOpen ? true : undefined}>
          {notice}
        </div>
      )}

      <div className="money-body" inert={sheetOpen ? true : undefined}>
        {page === "home" && (
          <HomePage
            api={api}
            onNavigate={go}
            onFlow={(mode) => setFlow({ mode })}
            onIncome={() => setIncomeOpen(true)}
            onSetup={() => setSetupOpen(true)}
            onConfirmBill={setConfirmBillId}
          />
        )}
        {page === "wealth" && (
          <WealthPage
            api={api}
            onBack={() => go("home")}
            onOpenAccount={(accountId) => go("accounts", accountId)}
          />
        )}
        {page === "spending" && (
          <SpendingPage
            api={api}
            notify={notify}
            onBack={() => go("home")}
          />
        )}
        {page === "accounts" && (
          <AccountsPage
            api={api}
            notify={notify}
            focusAccountId={focusAccountId}
            onFlow={(mode, preset, preferAccountId) => setFlow({ mode, from: preset?.from, to: preset?.to, preferAccountId })}
          />
        )}
        {page === "bills" && (
          <SubscriptionsPage
            api={api}
            notify={notify}
            onSetup={() => setSetupOpen(true)}
            onConfirmBill={setConfirmBillId}
            onOpenSource={(accountId) => go("accounts", accountId)}
          />
        )}
        {page === "more" && <MorePage api={api} onNavigate={go} />}
        {page === "activity" && (
          <div className="money-page">
            <button type="button" className="money-link" onClick={() => setPage("more")}>← More</button>
            <TransactionsPage api={api} notify={notify} />
          </div>
        )}
        {page === "budget" && (
          <div className="money-page">
            <button type="button" className="money-link" onClick={() => setPage("more")}>← More</button>
            <BudgetPage api={api} notify={notify} />
          </div>
        )}
        {page === "future" && (
          <div className="money-page">
            <button type="button" className="money-link" onClick={() => setPage("more")}>← More</button>
            <ForecastPage api={api} onSetup={() => setSetupOpen(true)} />
          </div>
        )}
        {page === "settings" && <SettingsPage api={api} notify={notify} onClose={() => setPage("more")} />}
      </div>

      {flow && (
        <MoneyFlowSheet
          api={api}
          mode={flow.mode}
          presetFrom={flow.from}
          presetTo={flow.to}
          preferAccountId={flow.preferAccountId}
          onClose={() => setFlow(null)}
          notify={notify}
        />
      )}
      {incomeOpen && <IncomeSheet api={api} onClose={() => setIncomeOpen(false)} notify={notify} />}
      {setupOpen && <SetupSheet api={api} onClose={() => setSetupOpen(false)} notify={notify} />}
      {confirmBill && (
        <ConfirmBillSheet api={api} bill={confirmBill} onClose={() => setConfirmBillId(null)} notify={notify} />
      )}

      {mainTab && (
        <nav className="money-nav" aria-label="Money Tracker sections" inert={sheetOpen ? true : undefined}>
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`money-nav-item${page === n.id ? " is-active" : ""}`}
              onClick={() => go(n.id)}
              aria-current={page === n.id ? "page" : undefined}
            >
              <span className="money-nav-icon" aria-hidden>{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
