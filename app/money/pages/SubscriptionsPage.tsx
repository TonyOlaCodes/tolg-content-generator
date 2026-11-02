"use client";

import { useState } from "react";
import {
  saveRecurring,
  confirmRecurring,
  skipRecurring,
  rescheduleRecurring,
  setRecurringStatus,
  defaultCtx,
  type RecurringInput,
  type Result,
} from "@/money/actions";
import { dueLabel, formatEUR, formatDateIE, parseEuroToCents, todayISO, monthlyEquivalentCents } from "@/money/money";
import type { Recurring } from "@/money/types";
import type { MoneyApi } from "../MoneyApp";

const INTERVALS: { id: Recurring["interval"]; label: string }[] = [
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
  { id: "weekly", label: "Weekly" },
  { id: "custom", label: "Every N days" },
];

const PERIOD: Record<Recurring["interval"], string> = {
  monthly: "/ month",
  yearly: "/ year",
  weekly: "/ week",
  custom: "",
};

export default function SubscriptionsPage({ api, notify, onSetup }: { api: MoneyApi; notify: (m: string) => void; onSetup?: () => void }) {
  const { snap, commit } = api;
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftAmt, setDraftAmt] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [rescheduling, setRescheduling] = useState<string | null>(null);

  const bills = snap.recurring.filter((r) => r.kind === "bill");
  const active = bills.filter((r) => r.status === "active").sort((a, b) => (a.nextDue < b.nextDue ? -1 : 1));
  const paused = bills.filter((r) => r.status === "paused");
  const cancelled = bills.filter((r) => r.status === "cancelled");
  const monthlyTotal = active.reduce((s, r) => s + monthlyEquivalentCents(r.amountCents, r), 0);
  const hasAccount = snap.accounts.some((a) => !a.archived);

  const accountName = (id: string | null) => snap.accounts.find((a) => a.id === id)?.name ?? "No account";

  const act = async (id: string, build: () => Result, ok: string) => {
    if (busy) return;
    setBusy(id);
    const err = await commit(build());
    setBusy(null);
    notify(err ?? ok);
  };

  const statusOf = (r: Recurring) => {
    if (r.status === "paused") return { label: "Paused", tone: "muted" };
    if (r.status === "cancelled") return { label: "Cancelled", tone: "muted" };
    const due = dueLabel(r.nextDue);
    if (due.overdue) return { label: "Overdue", tone: "neg" };
    if (due.text.toLowerCase().includes("today")) return { label: "Due today", tone: "warn" };
    return { label: "Upcoming", tone: "muted" };
  };

  const renderCard = (r: Recurring) => {
    const status = statusOf(r);
    const isDue = r.status === "active" && status.tone !== "muted";
    const isBusy = busy === r.id;
    return (
      <li key={r.id} className={`money-sub${r.status !== "active" ? " is-inactive" : ""}`}>
        <div className="money-sub-top">
          <span className="money-sub-icon" aria-hidden>{r.icon || "↻"}</span>
          <div className="money-sub-main">
            <strong>{r.name}</strong>
            <span className="money-small money-muted">
              {formatEUR(r.amountCents)} {PERIOD[r.interval]} · {accountName(r.accountId)}
            </span>
          </div>
          <span className={`money-pill is-${status.tone}`}>{status.label}</span>
        </div>

        {r.status === "active" && (
          <p className="money-small money-muted money-sub-next">
            Next {formatDateIE(r.nextDue)}
          </p>
        )}

        {r.status === "active" && isDue && (
          <button type="button" className="money-btn-primary money-confirm-paid" disabled={isBusy} onClick={() => act(r.id, () => confirmRecurring(snap, r.id, defaultCtx()), "Marked as paid")}>
            {isBusy ? "Saving…" : "Confirm Paid"}
          </button>
        )}

        {r.status === "active" && (
          <div className="money-sub-actions">
            <button type="button" className="money-link" disabled={isBusy} onClick={() => act(r.id, () => skipRecurring(snap, r.id, defaultCtx()), "Skipped this payment")}>Skip</button>
            <button type="button" className="money-link" disabled={isBusy} onClick={() => { setRescheduling(rescheduling === r.id ? null : r.id); setDraftDate(r.nextDue); }}>Reschedule</button>
            <button type="button" className="money-link" disabled={isBusy} onClick={() => { setEditing(editing === r.id ? null : r.id); setDraftAmt((r.amountCents / 100).toFixed(2)); }}>Edit</button>
            <button type="button" className="money-link" disabled={isBusy} onClick={() => act(r.id, () => setRecurringStatus(snap, r.id, "paused", defaultCtx()), "Paused")}>Pause</button>
            <button type="button" className="money-link is-danger" disabled={isBusy} onClick={() => {
              if (!window.confirm(`Cancel ${r.name}? It will stop being scheduled.`)) return;
              void act(r.id, () => setRecurringStatus(snap, r.id, "cancelled", defaultCtx()), "Cancelled");
            }}>Cancel</button>
          </div>
        )}

        {r.status === "active" && rescheduling === r.id && (
          <div className="money-inline">
            <input type="date" aria-label={`New date for ${r.name}`} value={draftDate} onChange={(e) => setDraftDate(e.target.value)} />
            <button type="button" className="money-btn-small" disabled={isBusy || !draftDate} onClick={() => { setRescheduling(null); void act(r.id, () => rescheduleRecurring(snap, r.id, draftDate, defaultCtx()), "Rescheduled"); }}>Save date</button>
          </div>
        )}

        {r.status === "active" && editing === r.id && (
          <div className="money-inline">
            <input inputMode="decimal" aria-label={`Amount for ${r.name}`} value={draftAmt} onChange={(e) => setDraftAmt(e.target.value)} />
            <button type="button" className="money-btn-small" disabled={isBusy} onClick={() => {
              const cents = parseEuroToCents(draftAmt);
              if (cents === null || cents <= 0) return notify("Enter a valid amount");
              setEditing(null);
              void act(r.id, () => saveRecurring(snap, { ...r, id: r.id, amountCents: cents }, defaultCtx()), "Amount updated");
            }}>Save amount</button>
          </div>
        )}

        {r.status !== "active" && (
          <div className="money-sub-actions">
            <button type="button" className="money-link" disabled={isBusy} onClick={() => act(r.id, () => setRecurringStatus(snap, r.id, "active", defaultCtx()), "Resumed")}>
              {r.status === "paused" ? "Resume" : "Reactivate"}
            </button>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="money-page">
      <section className="money-block">
        <p className="money-kicker">Subscriptions</p>
        <p className="money-big">{formatEUR(monthlyTotal)} <span className="money-muted">a month</span></p>
        <p className="money-muted money-small">About {formatEUR(monthlyTotal * 12)} a year</p>
        <button type="button" className="money-btn-primary money-add" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
          {adding ? "Close" : "+ Add Subscription"}
        </button>
        {adding && (
          hasAccount
            ? <AddSubscription api={api} notify={notify} onDone={() => setAdding(false)} />
            : <p className="money-setup-note">Add an account first. {onSetup && <button type="button" className="money-link" onClick={onSetup}>Set up</button>}</p>
        )}
      </section>

      {bills.length === 0 && !adding && (
        <p className="money-muted money-empty">No subscriptions yet.</p>
      )}

      {active.length > 0 && (
        <section className="money-stack">
          <h2 className="money-h2">Active</h2>
          <ul className="money-sub-list">{active.map(renderCard)}</ul>
        </section>
      )}

      {paused.length > 0 && (
        <section className="money-stack">
          <h2 className="money-h2">Paused</h2>
          <ul className="money-sub-list">{paused.map(renderCard)}</ul>
        </section>
      )}

      {cancelled.length > 0 && (
        <section className="money-stack">
          <h2 className="money-h2">Cancelled</h2>
          <ul className="money-sub-list">{cancelled.map(renderCard)}</ul>
        </section>
      )}
    </div>
  );
}

function AddSubscription({ api, notify, onDone }: { api: MoneyApi; notify: (m: string) => void; onDone: () => void }) {
  const { snap, commit } = api;
  const accounts = snap.accounts.filter((a) => !a.archived);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [interval, setInterval] = useState<Recurring["interval"]>("monthly");
  const [customDays, setCustomDays] = useState("30");
  const [nextDue, setNextDue] = useState(todayISO());
  const [accountId, setAccountId] = useState(accounts[0] ? `${accounts[0].id}|` : "");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const cents = parseEuroToCents(amount);
    if (!name.trim()) return setError("Add a name.");
    if (cents === null || cents <= 0) return setError("Enter an amount above zero.");
    if (interval === "custom" && !(Number(customDays) > 0)) return setError("Enter a number of days.");
    const [srcAccount, srcPocket] = accountId.split("|");
    const input: RecurringInput = {
      kind: "bill",
      name: name.trim(),
      icon: "",
      amountCents: cents,
      interval,
      customDays: interval === "custom" ? Number(customDays) : null,
      dayOfMonth: Number(nextDue.slice(8, 10)),
      nextDue,
      categoryId: null,
      accountId: srcAccount || null,
      pocketId: srcPocket || null,
      notes: "",
    };
    const err = await commit(saveRecurring(snap, input, defaultCtx()));
    if (err) return setError(err);
    notify("Subscription added");
    onDone();
  };

  return (
    <div className="money-form">
      <label className="money-field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Cursor, Netflix…" /></label>
      <div className="money-grid2">
        <label className="money-field"><span>Price (€)</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></label>
        <label className="money-field"><span>Billed</span>
          <select value={interval} onChange={(e) => setInterval(e.target.value as Recurring["interval"])}>
            {INTERVALS.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
          </select>
        </label>
      </div>
      {interval === "custom" && <label className="money-field"><span>Every (days)</span><input inputMode="numeric" value={customDays} onChange={(e) => setCustomDays(e.target.value)} /></label>}
      <details className="money-more">
        <summary className="money-link">More options</summary>
        <label className="money-field"><span>Next payment</span><input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} /></label>
        <label className="money-field"><span>Paid from</span>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.flatMap((a) => [
              <option key={`${a.id}|`} value={`${a.id}|`}>{a.name} · Main</option>,
              ...snap.pockets.filter((p) => p.accountId === a.id && !p.archived).map((p) => (
                <option key={`${a.id}|${p.id}`} value={`${a.id}|${p.id}`}>{a.name} · {p.name}</option>
              )),
            ])}
          </select>
        </label>
      </details>
      {error && <p className="money-error" role="alert">{error}</p>}
      <button type="button" className="money-btn-primary" onClick={submit}>Save subscription</button>
    </div>
  );
}
