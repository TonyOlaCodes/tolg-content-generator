"use client";

import { useCallback, useEffect, useState } from "react";
import "./money.css";
import { applyChange, ensureSeeded, loadSnapshot } from "@/money/store";
import type { Change, Result } from "@/money/actions";
import { EMPTY_SNAPSHOT, type Account, type Loan, type Pocket, type Snapshot, type Transaction } from "@/money/types";
import type { Location } from "@/money/banking";
import HomePage from "./HomePage";
import AccountsPage, { AccountDetail, PocketDetail, type HistoryFilter } from "./AccountsPage";
import BillsPage from "./BillsPage";
import SettingsPage from "./pages/SettingsPage";
import { MoneySheet, type MovementMode } from "./MoneySheet";
import { AccountEditor, BalanceEditor, PocketEditor } from "./AccountSheets";
import { BillEditor, PayBillSheet, ReceiveSheet } from "./BillSheets";
import { LoanDetailSheet, LoanEditor, LoansSheet } from "./LoanSheets";
import { HistorySheet, RefundPickerSheet, RefundSheet, TransactionSheet } from "./TransactionSheets";
import { Sheet } from "./ui";
import { IncomeSplitSheet } from "./IncomeSheet";

export type MoneyApi = {
  snap: Snapshot;
  commit: (result: Result) => Promise<string | null>;
  reload: () => Promise<void>;
};

type Tab = "home" | "accounts" | "bills" | "settings";

type SheetState =
  | { type: MovementMode; from?: Location | null; to?: Location | null }
  | { type: "more" }
  | { type: "account"; account?: Account }
  | { type: "pocket"; accountId: string; pocket?: Pocket }
  | { type: "balance"; location: Location; currentCents: number }
  | { type: "bill"; kind: "bill" | "income"; existing?: import("@/money/types").Recurring }
  | { type: "pay"; billId: string }
  | { type: "receive"; recurringId: string }
  | { type: "loans" }
  | { type: "loan"; direction: Loan["direction"] }
  | { type: "loanDetail"; loanId: string }
  | { type: "tx"; txId: string }
  | { type: "history"; filter: HistoryFilter; title: string }
  | { type: "refundPicker" }
  | { type: "refund"; originalId: string }
  | { type: "incomeSplit" }
  | null;

const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "◎" },
  { id: "accounts", label: "Accounts", icon: "▤" },
  { id: "bills", label: "Bills", icon: "↻" },
];

export default function MoneyApp({ onBack }: { onBack: () => void }) {
  const [snap, setSnap] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [pocketId, setPocketId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setSnap(await loadSnapshot());
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await ensureSeeded();
        const loaded = await loadSnapshot();
        if (alive) setSnap(loaded);
      } catch (error) {
        if (alive) setLoadError(error instanceof Error ? error.message : "Could not open local storage.");
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
      } catch (error) {
        await reload();
        return error instanceof Error ? error.message : "Could not save. Nothing was changed.";
      }
    },
    [reload],
  );

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [notice]);

  const api: MoneyApi = { snap, commit, reload };
  const notify = (message: string) => setNotice(message);

  function go(next: Tab) {
    setTab(next);
    setAccountId(null);
    setPocketId(null);
  }

  function openAccount(id: string) {
    setTab("accounts");
    setAccountId(id);
    setPocketId(null);
  }

  function openPocket(nextAccountId: string, nextPocketId: string) {
    setTab("accounts");
    setAccountId(nextAccountId);
    setPocketId(nextPocketId);
  }

  function openTransaction(id: string) {
    setSheet({ type: "tx", txId: id });
  }

  if (loadError) {
    return (
      <div className="mm-app">
        <header className="mm-top">
          <button type="button" className="mm-top-btn" onClick={onBack}>
            ← Apps
          </button>
          <strong>Money</strong>
          <span />
        </header>
        <p className="mm-error mm-pad">{loadError}. Nothing has been changed.</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="mm-app">
        <p className="mm-muted mm-pad">Loading…</p>
      </div>
    );
  }

  const headerTitle = tab === "settings" ? "Settings" : "Money";

  return (
    <div className="mm-app">
      <header className="mm-top">
        <button type="button" className="mm-top-btn" onClick={onBack}>
          ← Apps
        </button>
        <strong>{headerTitle}</strong>
        <button
          type="button"
          className="mm-top-icon"
          onClick={() => (tab === "settings" ? go("home") : setTab("settings"))}
          aria-label={tab === "settings" ? "Close settings" : "Settings and backup"}
        >
          {tab === "settings" ? "×" : "⚙"}
        </button>
      </header>

      {notice ? (
        <div className="mm-toast" role="status">
          {notice}
        </div>
      ) : null}

      <main className="mm-main">
        {tab === "home" ? (
          <HomePage
            api={api}
            onAddAccount={() => setSheet({ type: "account" })}
            onOpenAccount={openAccount}
            onAdd={() => setSheet({ type: "add" })}
            onSend={() => setSheet({ type: "send" })}
            onMove={() => setSheet({ type: "move" })}
            onMore={() => setSheet({ type: "more" })}
            onOpenBills={() => go("bills")}
            onPayBill={(billId) => setSheet({ type: "pay", billId })}
            onOpenTransaction={openTransaction}
            onHistory={() => setSheet({ type: "history", filter: null, title: "Everything" })}
            onOpenLoans={() => setSheet({ type: "loans" })}
          />
        ) : null}

        {tab === "accounts" ? (
          pocketId && accountId ? (
            <PocketDetail
              api={api}
              accountId={accountId}
              pocketId={pocketId}
              onBack={() => setPocketId(null)}
              onEditPocket={(nextAccountId, pocket) => setSheet({ type: "pocket", accountId: nextAccountId, pocket })}
              onEditBalance={(location, cents) => setSheet({ type: "balance", location, currentCents: cents })}
              onAdd={(destination) => setSheet({ type: "add", to: destination })}
              onSend={(source) => setSheet({ type: "send", from: source })}
              onMove={(source) => setSheet({ type: "move", from: source })}
              onOpenTransaction={openTransaction}
              onHistory={(filter) =>
                setSheet({ type: "history", filter, title: filter?.title ?? "Transactions" })
              }
              notify={notify}
            />
          ) : accountId ? (
            <AccountDetail
              api={api}
              accountId={accountId}
              onBack={() => setAccountId(null)}
              onOpenPocket={openPocket}
              onAddPocket={(id) => setSheet({ type: "pocket", accountId: id })}
              onEditAccount={(account) => setSheet({ type: "account", account })}
              onEditBalance={(location, cents) => setSheet({ type: "balance", location, currentCents: cents })}
              onAdd={(destination) => setSheet({ type: "add", to: destination })}
              onSend={(source) => setSheet({ type: "send", from: source })}
              onMove={(source) => setSheet({ type: "move", from: source })}
              onOpenTransaction={openTransaction}
              onHistory={(filter) => setSheet({ type: "history", filter, title: filter?.title ?? "Transactions" })}
              notify={notify}
            />
          ) : (
            <AccountsPage api={api} onOpenAccount={openAccount} onAddAccount={() => setSheet({ type: "account" })} />
          )
        ) : null}

        {tab === "bills" ? (
          <BillsPage
            api={api}
            notify={notify}
            onAddBill={(kind) => setSheet({ type: "bill", kind })}
            onEditBill={(bill) => setSheet({ type: "bill", kind: "bill", existing: bill })}
            onPayBill={(billId) => setSheet({ type: "pay", billId })}
            onAddIncoming={() => setSheet({ type: "bill", kind: "income" })}
            onEditIncoming={(item) => setSheet({ type: "bill", kind: "income", existing: item })}
            onReceive={(recurringId) => setSheet({ type: "receive", recurringId })}
            onOpenLoans={() => setSheet({ type: "loans" })}
          />
        ) : null}

        {tab === "settings" ? <SettingsPage api={api} notify={notify} onClose={() => go("home")} /> : null}
      </main>

      <nav className="mm-nav" aria-label="Money sections">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`mm-nav-item${tab === item.id ? " is-active" : ""}`}
            onClick={() => go(item.id)}
            aria-current={tab === item.id ? "page" : undefined}
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {sheet?.type === "add" || sheet?.type === "send" || sheet?.type === "move" ? (
        <MoneySheet
          api={api}
          mode={sheet.type}
          initialFrom={sheet.from}
          initialTo={sheet.to}
          onClose={() => setSheet(null)}
          notify={notify}
        />
      ) : null}

      {sheet?.type === "more" ? (
        <MoreSheet
          onClose={() => setSheet(null)}
          onSplit={() => setSheet({ type: "incomeSplit" })}
          onRefund={() => setSheet({ type: "refundPicker" })}
          onLend={() => setSheet({ type: "loan", direction: "lent" })}
          onBorrow={() => setSheet({ type: "loan", direction: "borrowed" })}
          onScheduleIncoming={() => setSheet({ type: "bill", kind: "income" })}
          onLoans={() => setSheet({ type: "loans" })}
          onAddBill={() => setSheet({ type: "bill", kind: "bill" })}
          onAddAccount={() => setSheet({ type: "account" })}
        />
      ) : null}

      {sheet?.type === "account" ? (
        <AccountEditor api={api} account={sheet.account} onClose={() => setSheet(null)} notify={notify} />
      ) : null}
      {sheet?.type === "pocket" ? (
        <PocketEditor api={api} accountId={sheet.accountId} pocket={sheet.pocket} onClose={() => setSheet(null)} notify={notify} />
      ) : null}
      {sheet?.type === "balance" ? (
        <BalanceEditor
          api={api}
          location={sheet.location}
          currentCents={sheet.currentCents}
          onClose={() => setSheet(null)}
          notify={notify}
        />
      ) : null}
      {sheet?.type === "bill" ? (
        <BillEditor api={api} kind={sheet.kind} existing={sheet.existing} onClose={() => setSheet(null)} notify={notify} />
      ) : null}
      {sheet?.type === "pay" ? <PayBillSheet api={api} billId={sheet.billId} onClose={() => setSheet(null)} notify={notify} /> : null}
      {sheet?.type === "receive" ? <ReceiveSheet api={api} recurringId={sheet.recurringId} onClose={() => setSheet(null)} notify={notify} /> : null}
      {sheet?.type === "loans" ? (
        <LoansSheet
          api={api}
          onClose={() => setSheet(null)}
          onAdd={(direction) => setSheet({ type: "loan", direction })}
          onOpen={(loanId) => setSheet({ type: "loanDetail", loanId })}
        />
      ) : null}
      {sheet?.type === "loan" ? (
        <LoanEditor api={api} direction={sheet.direction} onClose={() => setSheet(null)} notify={notify} />
      ) : null}
      {sheet?.type === "loanDetail" ? (
        <LoanDetailSheet
          api={api}
          loanId={sheet.loanId}
          onClose={() => setSheet(null)}
          notify={notify}
          onOpenTransaction={openTransaction}
        />
      ) : null}
      {sheet?.type === "history" ? (
        <HistorySheet
          api={api}
          filter={sheet.filter}
          onClose={() => setSheet(null)}
          onOpenTransaction={openTransaction}
        />
      ) : null}
      {sheet?.type === "refundPicker" ? (
        <RefundPickerSheet
          api={api}
          onClose={() => setSheet(null)}
          onPick={(tx: Transaction) => setSheet({ type: "refund", originalId: tx.id })}
        />
      ) : null}
      {sheet?.type === "refund" ? (
        <RefundSheet api={api} originalId={sheet.originalId} onClose={() => setSheet(null)} notify={notify} />
      ) : null}
      {sheet?.type === "incomeSplit" ? (
        <IncomeSplitSheet api={api} onClose={() => setSheet(null)} notify={notify} />
      ) : null}
      {sheet?.type === "tx" ? (
        <TransactionSheet
          api={api}
          txId={sheet.txId}
          onClose={() => setSheet(null)}
          notify={notify}
          onRefund={(tx) => setSheet({ type: "refund", originalId: tx.id })}
          onOpenTransaction={openTransaction}
          onOpenLoan={(loanId) => setSheet({ type: "loanDetail", loanId })}
        />
      ) : null}
    </div>
  );
}

function MoreSheet({
  onClose,
  onSplit,
  onRefund,
  onLend,
  onBorrow,
  onScheduleIncoming,
  onLoans,
  onAddBill,
  onAddAccount,
}: {
  onClose: () => void;
  onSplit: () => void;
  onRefund: () => void;
  onLend: () => void;
  onBorrow: () => void;
  onScheduleIncoming: () => void;
  onLoans: () => void;
  onAddBill: () => void;
  onAddAccount: () => void;
}) {
  const items = [
    { label: "Split incoming money", hint: "One arrival into several pockets", icon: "⑂", action: onSplit },
    { label: "Record refund", hint: "Link money back to a payment", icon: "↩", action: onRefund },
    { label: "Lend money", hint: "Track what someone owes you", icon: "→", action: onLend },
    { label: "Borrowed money", hint: "Track what you owe someone", icon: "←", action: onBorrow },
    { label: "Schedule incoming", hint: "Salary, allowance or expected money", icon: "↓", action: onScheduleIncoming },
    { label: "Loans & IOUs", hint: "All money owed in both directions", icon: "⇆", action: onLoans },
    { label: "Add a bill", hint: "Subscription or recurring payment", icon: "↻", action: onAddBill },
    { label: "Add an account", hint: "Bank, cash, savings or investment", icon: "＋", action: onAddAccount },
  ];
  return (
    <Sheet title="More" onClose={onClose}>
      <div className="mm-more-list">
        {items.map((item) => (
          <button key={item.label} type="button" className="mm-more-row" onClick={item.action}>
            <span className="mm-more-icon" aria-hidden>
              {item.icon}
            </span>
            <span className="mm-mini-main">
              <strong>{item.label}</strong>
              <em>{item.hint}</em>
            </span>
            <span className="mm-chevron" aria-hidden>
              ›
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
