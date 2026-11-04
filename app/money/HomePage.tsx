"use client";

import { useState } from "react";
import {
  balances,
  billRemainingCents,
  billSource,
  loanOutstandingCents,
  sortAccounts,
  upcomingBills,
  type Location,
} from "@/money/banking";
import { currentMonth, daysInMonth, dueLabel, formatEUR, todayISO } from "@/money/money";
import type { MoneyApi } from "./MoneyApp";
import { TransactionRow } from "./ui";
import { EmptyState } from "./AccountsPage";

export default function HomePage({
  api,
  onAddAccount,
  onOpenAccount,
  onAdd,
  onSend,
  onMove,
  onMore,
  onOpenBills,
  onPayBill,
  onOpenTransaction,
  onHistory,
  onOpenLoans,
}: {
  api: MoneyApi;
  onAddAccount: () => void;
  onOpenAccount: (id: string) => void;
  onAdd: () => void;
  onSend: () => void;
  onMove: () => void;
  onMore: () => void;
  onOpenBills: () => void;
  onPayBill: (billId: string) => void;
  onOpenTransaction: (id: string) => void;
  onHistory: () => void;
  onOpenLoans: () => void;
}) {
  const { snap } = api;
  const [showTotal, setShowTotal] = useState(false);
  const b = balances(snap);
  const accounts = sortAccounts(snap, snap.accounts.filter((a) => !a.archived));
  const total = accounts.reduce((sum, account) => sum + (b.account[account.id] ?? 0), 0);
  const cash = accounts.filter((a) => !a.excludeFromSpendable).reduce((sum, account) => sum + (b.account[account.id] ?? 0), 0);
  const month = currentMonth();
  const monthEnd = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  const bills = upcomingBills(snap);
  const billsThisMonth = bills.filter((bill) => bill.nextDue <= monthEnd && billRemainingCents(snap, bill) > 0);
  const billsLeft = billsThisMonth.reduce((sum, bill) => sum + billRemainingCents(snap, bill), 0);
  const owedToMe = snap.loans
    .filter((loan) => loan.direction === "lent")
    .reduce((sum, loan) => sum + loanOutstandingCents(snap, loan), 0);
  const recent = snap.transactions
    .filter((tx) => tx.status === "confirmed")
    .sort((a, c) => (a.date === c.date ? (a.createdAt < c.createdAt ? 1 : -1) : a.date < c.date ? 1 : -1))
    .slice(0, 5);

  if (accounts.length === 0) {
    return (
      <div className="mm-page">
        <header className="mm-page-head">
          <div>
            <p className="mm-kicker">Money Tracker</p>
            <h1>Your money, in one place</h1>
          </div>
        </header>
        <EmptyState
          title="Add your first account"
          body="Track Revolut, your bank, cash or savings manually. Nothing connects to a bank and nothing leaves this device."
          action="Add an account"
          onAction={onAddAccount}
        />
      </div>
    );
  }

  return (
    <div className="mm-page mm-home">
      <section className="mm-hero">
        <button type="button" className="mm-total" onClick={() => setShowTotal((v) => !v)} aria-expanded={showTotal}>
          <span className="mm-kicker">Total money</span>
          <strong>{formatEUR(total)}</strong>
          <em>{showTotal ? "Hide accounts" : `Across ${accounts.length} ${accounts.length === 1 ? "account" : "accounts"}`}</em>
        </button>
        {showTotal ? (
          <ul className="mm-total-breakdown">
            {accounts.map((account) => (
              <li key={account.id}>
                <span>{account.name}</span>
                <strong>{formatEUR(b.account[account.id] ?? 0)}</strong>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="mm-summary" aria-label="Money summary">
        <button type="button" className="mm-summary-row" onClick={() => setShowTotal(true)}>
          <span>Available cash</span>
          <strong>{formatEUR(cash)}</strong>
        </button>
        <button type="button" className="mm-summary-row" onClick={onOpenBills}>
          <span>Bills left to pay</span>
          <strong>{formatEUR(billsLeft)}</strong>
        </button>
        <button type="button" className="mm-summary-row" onClick={onOpenLoans}>
          <span>Money owed to me</span>
          <strong>{formatEUR(owedToMe)}</strong>
        </button>
      </section>

      <div className="mm-actions is-main">
        <button type="button" className="mm-action" onClick={onAdd}>
          <span aria-hidden>＋</span>Add
        </button>
        <button type="button" className="mm-action" onClick={onSend}>
          <span aria-hidden>↗</span>Send
        </button>
        <button type="button" className="mm-action" onClick={onMove}>
          <span aria-hidden>⇄</span>Move
        </button>
        <button type="button" className="mm-action is-more" onClick={onMore} aria-label="More money actions">
          <span aria-hidden>⋯</span>More
        </button>
      </div>

      <section className="mm-section">
        <div className="mm-section-head">
          <h2>Accounts</h2>
          <button type="button" className="mm-link" onClick={onAddAccount}>
            + Add
          </button>
        </div>
        <ul className="mm-accounts">
          {accounts.map((account) => (
            <li key={account.id}>
              <button type="button" className="mm-account-row" onClick={() => onOpenAccount(account.id)}>
                <span className="mm-account-mark" aria-hidden>
                  {account.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="mm-account-main">
                  <strong>{account.name}</strong>
                  <em>
                    Main {formatEUR(b.main[account.id] ?? 0)}
                    {snap.pockets.filter((p) => p.accountId === account.id && !p.archived).length > 0
                      ? ` · ${snap.pockets.filter((p) => p.accountId === account.id && !p.archived).length} pockets`
                      : ""}
                  </em>
                </span>
                <span className="mm-account-total">{formatEUR(b.account[account.id] ?? 0)}</span>
                <span className="mm-chevron" aria-hidden>
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="mm-section">
        <div className="mm-section-head">
          <h2>Upcoming bills</h2>
          <button type="button" className="mm-link" onClick={onOpenBills}>
            See all
          </button>
        </div>
        {bills.length === 0 ? (
          <button type="button" className="mm-inline-empty" onClick={onOpenBills}>
            No bills yet. Add subscriptions and recurring payments.
          </button>
        ) : (
          <ul className="mm-mini-list">
            {bills.slice(0, 3).map((bill) => {
              const remaining = billRemainingCents(snap, bill);
              const due = dueLabel(bill.nextDue, todayISO());
              const source = billSource(snap, bill);
              return (
                <li key={bill.id} className="mm-mini-row">
                  <span className="mm-mini-main">
                    <strong>{bill.name}</strong>
                    <em className={due.overdue ? "is-neg" : ""}>
                      {due.text} · {source ? sourceLabel(api, source) : "No source"}
                    </em>
                  </span>
                  <span className="mm-mini-amount">{formatEUR(remaining)}</span>
                  <button type="button" className="mm-small-btn" onClick={() => onPayBill(bill.id)} disabled={remaining <= 0}>
                    Pay
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mm-section">
        <div className="mm-section-head">
          <h2>Recent</h2>
          <button type="button" className="mm-link" onClick={onHistory}>
            See all
          </button>
        </div>
        {recent.length === 0 ? (
          <p className="mm-caption">Money movements will appear here.</p>
        ) : (
          <ul className="mm-tx-list">
            {recent.map((tx) => (
              <li key={tx.id}>
                <TransactionRow snap={snap} tx={tx} onClick={() => onOpenTransaction(tx.id)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function sourceLabel(api: MoneyApi, location: Location): string {
  const account = api.snap.accounts.find((a) => a.id === location.accountId);
  const pocket = location.pocketId ? api.snap.pockets.find((p) => p.id === location.pocketId) : null;
  return pocket ? `${account?.name ?? ""} · ${pocket.name}` : `${account?.name ?? ""} · Main`;
}
