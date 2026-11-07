"use client";

import { useState } from "react";
import {
  deleteRecurring,
  setRecurringStatus,
  skipRecurring,
  defaultCtx,
} from "@/money/actions";
import {
  billRemainingCents,
  billSource,
  loanOutstandingCents,
  scheduledIncome,
  upcomingBills,
  type Location,
} from "@/money/banking";
import { currentMonth, daysInMonth, dueLabel, formatEUR, formatDateIE, formatMonthIE, monthlyEquivalentCents, todayISO } from "@/money/money";
import type { Recurring } from "@/money/types";
import type { MoneyApi } from "./MoneyApp";

export default function BillsPage({
  api,
  notify,
  onAddBill,
  onEditBill,
  onPayBill,
  onAddIncoming,
  onEditIncoming,
  onReceive,
  onOpenLoans,
}: {
  api: MoneyApi;
  notify: (message: string) => void;
  onAddBill: (kind: "bill" | "income") => void;
  onEditBill: (bill: Recurring) => void;
  onPayBill: (billId: string) => void;
  onAddIncoming: () => void;
  onEditIncoming: (item: Recurring) => void;
  onReceive: (id: string) => void;
  onOpenLoans: () => void;
}) {
  const { snap, commit } = api;
  const [busy, setBusy] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const bills = upcomingBills(snap).slice().sort((a, b) => (a.nextDue < b.nextDue ? -1 : a.nextDue > b.nextDue ? 1 : 0));
  const allBills = snap.recurring
    .filter((r) => r.kind === "bill" && r.status !== "cancelled")
    .sort((a, b) => (a.nextDue < b.nextDue ? -1 : a.nextDue > b.nextDue ? 1 : 0));
  // One section per month of the next due date, so the list visibly breaks when the month changes.
  const billMonths = bills.reduce<{ month: string; items: Recurring[] }[]>((acc, bill) => {
    const key = bill.nextDue.slice(0, 7);
    const last = acc[acc.length - 1];
    if (last && last.month === key) last.items.push(bill);
    else acc.push({ month: key, items: [bill] });
    return acc;
  }, []);
  const pausedBills = snap.recurring.filter((r) => r.kind === "bill" && r.status === "paused");
  const incoming = scheduledIncome(snap);
  const pausedIncoming = snap.recurring.filter((r) => r.kind === "income" && r.status === "paused");
  const month = currentMonth();
  const monthEnd = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  const dueThisMonth = bills.filter((bill) => bill.nextDue <= monthEnd && billRemainingCents(snap, bill) > 0);
  const leftCents = dueThisMonth.reduce((sum, bill) => sum + billRemainingCents(snap, bill), 0);
  const paidCents = snap.transactions
    .filter((tx) => tx.status === "confirmed" && tx.kind === "expense" && !!tx.recurringId && tx.date.startsWith(month))
    .reduce((sum, tx) => sum + (tx.reverses ? -tx.amountCents : tx.amountCents), 0);
  const scheduledCents = leftCents + paidCents;
  const progress = scheduledCents > 0 ? Math.min(100, Math.round((paidCents / scheduledCents) * 100)) : 0;
  const lent = snap.loans.filter((loan) => loan.direction === "lent").reduce((sum, loan) => sum + loanOutstandingCents(snap, loan), 0);
  const borrowed = snap.loans.filter((loan) => loan.direction === "borrowed").reduce((sum, loan) => sum + loanOutstandingCents(snap, loan), 0);

  async function act(id: string, run: () => ReturnType<typeof setRecurringStatus>, ok: string) {
    if (busy) return;
    setBusy(id);
    const err = await commit(run());
    setBusy(null);
    notify(err ?? ok);
  }

  return (
    <div className="mm-page">
      <header className="mm-page-head">
        <div>
          <p className="mm-kicker">Bills & scheduled</p>
          <h1>Bills</h1>
        </div>
        <div className="mm-head-actions">
          <button type="button" className="mm-ghost-btn" onClick={onAddIncoming}>
            + Incoming
          </button>
          <button type="button" className="mm-primary mm-small-primary" onClick={() => onAddBill("bill")}>
            + Bill
          </button>
        </div>
      </header>

      <section className="mm-bills-hero">
        <p className="mm-kicker">Left to pay this month</p>
        <p className="mm-balance">{formatEUR(leftCents)}</p>
        <div className="mm-progress" role="img" aria-label={`${progress}% of this month's bills paid`}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <p className="mm-caption">
          {formatEUR(paidCents)} paid of {formatEUR(scheduledCents)}
          {dueThisMonth.length > 0 ? ` · ${dueThisMonth.length} ${dueThisMonth.length === 1 ? "bill" : "bills"}` : " · Nothing due"}
        </p>
      </section>

      <section className="mm-section">
        <div className="mm-section-head">
          <h2>Bills</h2>
          <div className="mm-head-actions">
            <button type="button" className="mm-link" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "By month" : "All bills"}
            </button>
            <button type="button" className="mm-link" onClick={() => onAddBill("bill")}>
              + Add
            </button>
          </div>
        </div>
        {showAll ? (
          allBills.length === 0 ? (
            <button type="button" className="mm-inline-empty" onClick={() => onAddBill("bill")}>
              Add subscriptions, rent or any recurring bill.
            </button>
          ) : (
            <ul className="mm-bill-list">
              {allBills.map((bill) => (
                <li key={bill.id} className="mm-mini-row">
                  <span className="mm-mini-main">
                    <strong>{bill.name}</strong>
                    <em>
                      {formatDateIE(bill.nextDue)} · {frequencyText(bill)}
                      {bill.status === "paused" ? " · Paused" : ""}
                    </em>
                  </span>
                  <span className="mm-mini-amount">{formatEUR(bill.amountCents)}</span>
                </li>
              ))}
            </ul>
          )
        ) : bills.length === 0 ? (
          <button type="button" className="mm-inline-empty" onClick={() => onAddBill("bill")}>
            Add subscriptions, rent or any recurring bill.
          </button>
        ) : (
          billMonths.map((group) => (
            <div key={group.month}>
              <p className="mm-month-head">{formatMonthIE(group.month)}</p>
              <ul className="mm-bill-list">
            {group.items.map((bill) => (
              <BillRow
                key={bill.id}
                api={api}
                bill={bill}
                busy={busy === bill.id}
                onPay={() => onPayBill(bill.id)}
                onEdit={() => onEditBill(bill)}
                onSkip={() => void act(bill.id, () => skipRecurring(snap, bill.id, defaultCtx()), "Skipped this payment")}
                onPause={() => void act(bill.id, () => setRecurringStatus(snap, bill.id, "paused", defaultCtx()), "Bill paused")}
                onDelete={() => {
                  if (!window.confirm(`Delete ${bill.name}? Bills with payment history are cancelled instead, so records stay.`)) return;
                  void (async () => {
                    const err = await commit(deleteRecurring(snap, bill.id));
                    if (err) {
                      const cancelled = await commit(setRecurringStatus(snap, bill.id, "cancelled", defaultCtx()));
                      notify(cancelled ?? "Bill cancelled and history kept");
                    } else notify("Bill deleted");
                  })();
                }}
              />
            ))}
              </ul>
            </div>
          ))
        )}
        {!showAll && pausedBills.length > 0 ? (
          <div className="mm-paused">
            <p className="mm-kicker">Paused</p>
            {pausedBills.map((bill) => (
              <div key={bill.id} className="mm-mini-row">
                <span className="mm-mini-main">
                  <strong>{bill.name}</strong>
                  <em>{formatEUR(bill.amountCents)}</em>
                </span>
                <button type="button" className="mm-link" onClick={() => void act(bill.id, () => setRecurringStatus(snap, bill.id, "active", defaultCtx()), "Bill resumed")}>
                  Resume
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="mm-section">
        <div className="mm-section-head">
          <h2>Upcoming incoming</h2>
          <button type="button" className="mm-link" onClick={onAddIncoming}>
            + Add
          </button>
        </div>
        {incoming.length === 0 ? (
          <button type="button" className="mm-inline-empty" onClick={onAddIncoming}>
            Schedule salary, allowance or money you expect back.
          </button>
        ) : (
          <ul className="mm-bill-list">
            {incoming.map((item) => (
              <li key={item.id} className="mm-bill">
                <div className="mm-bill-top">
                  <span className="mm-bill-icon" aria-hidden>
                    ↓
                  </span>
                  <span className="mm-mini-main">
                    <strong>{item.name}</strong>
                    <em>
                      {formatDateIE(item.nextDue)} · {sourceText(api, billSource(snap, item))}
                    </em>
                  </span>
                  <span className="mm-bill-amount">{formatEUR(item.amountCents)}</span>
                </div>
                <div className="mm-bill-foot">
                  <span className="mm-caption">{periodText(item)}</span>
                  <div className="mm-bill-controls">
                    <button type="button" className="mm-small-btn is-primary" onClick={() => onReceive(item.id)}>
                      Mark received
                    </button>
                    <details className="mm-menu">
                      <summary aria-label={`Options for ${item.name}`}>⋯</summary>
                      <div className="mm-menu-pop">
                        <button type="button" onClick={() => onEditIncoming(item)}>
                          Edit
                        </button>
                        <button type="button" onClick={() => void act(item.id, () => skipRecurring(snap, item.id, defaultCtx()), "Skipped this occurrence")}>
                          Skip this one
                        </button>
                        <button type="button" onClick={() => void act(item.id, () => setRecurringStatus(snap, item.id, "paused", defaultCtx()), "Schedule paused")}>
                          Pause
                        </button>
                        <button type="button" onClick={() => void act(item.id, () => setRecurringStatus(snap, item.id, "cancelled", defaultCtx()), "Schedule cancelled")}>
                          Cancel
                        </button>
                      </div>
                    </details>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {pausedIncoming.length > 0 ? (
          <div className="mm-paused">
            <p className="mm-kicker">Paused incoming</p>
            {pausedIncoming.map((item) => (
              <div key={item.id} className="mm-mini-row">
                <span className="mm-mini-main">
                  <strong>{item.name}</strong>
                  <em>{formatEUR(item.amountCents)}</em>
                </span>
                <button type="button" className="mm-link" onClick={() => void act(item.id, () => setRecurringStatus(snap, item.id, "active", defaultCtx()), "Schedule resumed")}>
                  Resume
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="mm-section">
        <button type="button" className="mm-loan-row" onClick={onOpenLoans}>
          <span className="mm-account-mark" aria-hidden>
            ⇆
          </span>
          <span className="mm-account-main">
            <strong>Loans & IOUs</strong>
            <em>
              Owed to me {formatEUR(lent)} · I owe {formatEUR(borrowed)}
            </em>
          </span>
          <span className="mm-chevron" aria-hidden>
            ›
          </span>
        </button>
      </section>
    </div>
  );
}

function BillRow({
  api,
  bill,
  busy,
  onPay,
  onEdit,
  onSkip,
  onPause,
  onDelete,
}: {
  api: MoneyApi;
  bill: Recurring;
  busy: boolean;
  onPay: () => void;
  onEdit: () => void;
  onSkip: () => void;
  onPause: () => void;
  onDelete: () => void;
}) {
  const { snap } = api;
  const remaining = billRemainingCents(snap, bill);
  const paid = bill.amountCents - remaining;
  const due = dueLabel(bill.nextDue, todayISO());
  const source = billSource(snap, bill);
  return (
    <li className="mm-bill">
      <div className="mm-bill-top">
        <span className="mm-bill-icon" aria-hidden>
          {bill.icon || "↻"}
        </span>
        <span className="mm-mini-main">
          <strong>{bill.name}</strong>
          <em className={due.overdue ? "is-neg" : ""}>
            {due.text} · {sourceText(api, source)}
          </em>
        </span>
        <span className="mm-bill-amount">
          {formatEUR(remaining)}
          {paid > 0 && remaining > 0 ? <small>{formatEUR(paid)} paid</small> : null}
        </span>
      </div>
      <div className="mm-bill-foot">
        <span className="mm-caption">{periodText(bill)}</span>
        <div className="mm-bill-controls">
          <button type="button" className="mm-small-btn is-primary" onClick={onPay} disabled={busy || remaining <= 0}>
            {remaining <= 0 ? "Paid" : "Pay"}
          </button>
          <details className="mm-menu">
            <summary aria-label={`Options for ${bill.name}`}>⋯</summary>
            <div className="mm-menu-pop">
              <button type="button" onClick={onEdit}>
                Edit
              </button>
              <button type="button" onClick={onSkip}>
                Skip this one
              </button>
              <button type="button" onClick={onPause}>
                Pause
              </button>
              <button type="button" className="is-danger" onClick={onDelete}>
                Delete
              </button>
            </div>
          </details>
        </div>
      </div>
    </li>
  );
}

function sourceText(api: MoneyApi, location: Location | null): string {
  if (!location) return "No source";
  const account = api.snap.accounts.find((a) => a.id === location.accountId);
  const pocket = location.pocketId ? api.snap.pockets.find((p) => p.id === location.pocketId) : null;
  return pocket ? `${account?.name ?? ""} → ${pocket.name}` : `${account?.name ?? ""} → Main`;
}

function frequencyText(item: Recurring): string {
  if (item.interval === "once") return "One time";
  if (item.interval === "monthly") return "Monthly";
  if (item.interval === "yearly") return "Yearly";
  if (item.interval === "weekly") return "Weekly";
  return `Every ${item.customDays ?? 30} days`;
}

function periodText(item: Recurring): string {
  if (item.interval === "once") return "One time";
  if (item.interval === "monthly") return `${formatEUR(monthlyEquivalentCents(item.amountCents, item))} monthly`;
  if (item.interval === "yearly") return `${formatEUR(monthlyEquivalentCents(item.amountCents, item))} / month billed yearly`;
  if (item.interval === "weekly") return "Weekly";
  return `Every ${item.customDays ?? 30} days`;
}
