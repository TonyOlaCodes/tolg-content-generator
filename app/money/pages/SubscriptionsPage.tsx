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
} from "@/money/actions";
import { dueLabel, formatEUR, formatDateIE, parseEuroToCents, todayISO, monthlyEquivalentCents } from "@/money/money";
import type { Recurring } from "@/money/types";
import type { Result } from "@/money/actions";
import type { MoneyApi } from "../MoneyApp";

const INTERVALS: { id: Recurring["interval"]; label: string }[] = [
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
  { id: "weekly", label: "Weekly" },
  { id: "custom", label: "Every N days" },
];

export default function SubscriptionsPage({ api, notify }: { api: MoneyApi; notify: (m: string) => void }) {
  const { snap, commit } = api;
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [editAmt, setEditAmt] = useState<Record<string, string>>({});
  const [reschedule, setReschedule] = useState<Record<string, string>>({});

  const bills = snap.recurring.filter((r) => r.kind === "bill");
  const active = bills.filter((r) => r.status === "active");
  const paused = bills.filter((r) => r.status === "paused");
  const cancelled = bills.filter((r) => r.status === "cancelled");
  const monthlyTotal = active.reduce((s, r) => s + monthlyEquivalentCents(r.amountCents, r), 0);

  const accountName = (id: string | null) => snap.accounts.find((a) => a.id === id)?.name ?? "—";

  const act = async (id: string, build: () => Result, ok: string) => {
    if (busy) return;
    setBusy(id);
    const err = await commit(build());
    setBusy(null);
    notify(err ?? ok);
  };

  const renderRow = (r: Recurring) => {
    const due = dueLabel(r.nextDue);
    return (
      <li key={r.id} className="money-sub">
        <div className="money-env-head">
          <span><span aria-hidden>{r.icon || "↻"}</span> {r.name}</span>
          <strong>{formatEUR(r.amountCents)}</strong>
        </div>
        <p className="money-muted">
          {INTERVALS.find((i) => i.id === r.interval)?.label ?? r.interval} · {accountName(r.accountId)} ·{" "}
          <span className={due.overdue ? "is-neg" : ""}>Next {formatDateIE(r.nextDue)} · {due.text}</span>
        </p>
        {r.status === "active" && (
          <div className="money-sub-actions">
            <button type="button" className="money-btn-small" disabled={busy === r.id} onClick={() => act(r.id, () => confirmRecurring(snap, r.id, defaultCtx()), "Recorded as paid once")}>Confirm Paid</button>
            <button type="button" className="money-link" disabled={busy === r.id} onClick={() => act(r.id, () => skipRecurring(snap, r.id, defaultCtx()), "Occurrence skipped")}>Skip</button>
            <button type="button" className="money-link" disabled={busy === r.id} onClick={() => {
              const d = reschedule[r.id];
              if (!d) return setReschedule((s) => ({ ...s, [r.id]: r.nextDue }));
              act(r.id, () => rescheduleRecurring(snap, r.id, d, defaultCtx()), "Rescheduled");
            }}>{reschedule[r.id] ? "Save date" : "Reschedule"}</button>
            {reschedule[r.id] && (
              <input type="date" aria-label={`New date for ${r.name}`} value={reschedule[r.id]} onChange={(e) => setReschedule((s) => ({ ...s, [r.id]: e.target.value }))} />
            )}
            <button type="button" className="money-link" disabled={busy === r.id} onClick={() => {
              const raw = editAmt[r.id];
              if (raw === undefined) return setEditAmt((s) => ({ ...s, [r.id]: (r.amountCents / 100).toFixed(2) }));
              const cents = parseEuroToCents(raw);
              if (cents === null || cents <= 0) return notify("Enter a valid amount");
              const input: RecurringInput = { ...r, id: r.id, amountCents: cents };
              void act(r.id, () => saveRecurring(snap, input, defaultCtx()), "Amount updated");
            }}>{editAmt[r.id] !== undefined ? "Save amount" : "Edit amount"}</button>
            {editAmt[r.id] !== undefined && (
              <input inputMode="decimal" aria-label={`Amount for ${r.name}`} value={editAmt[r.id]} onChange={(e) => setEditAmt((s) => ({ ...s, [r.id]: e.target.value }))} />
            )}
          </div>
        )}
        {r.status !== "active" && (
          <div className="money-sub-actions">
            <button type="button" className="money-link" disabled={busy === r.id} onClick={() => act(r.id, () => setRecurringStatus(snap, r.id, "active", defaultCtx()), "Resumed")}>Resume</button>
          </div>
        )}
        {r.status === "active" && (
          <div className="money-sub-actions">
            <button type="button" className="money-link" disabled={busy === r.id} onClick={() => act(r.id, () => setRecurringStatus(snap, r.id, "paused", defaultCtx()), "Paused")}>Pause</button>
            <button type="button" className="money-link is-danger" disabled={busy === r.id} onClick={() => {
              if (!window.confirm(`Cancel ${r.name}? It will stop being scheduled.`)) return;
              void act(r.id, () => setRecurringStatus(snap, r.id, "cancelled", defaultCtx()), "Cancelled");
            }}>Cancel subscription</button>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="money-page">
      <section className="money-panel">
        <div className="money-grid2">
          <div className="money-stat"><span className="money-muted">Monthly</span><strong>{formatEUR(monthlyTotal)}</strong></div>
          <div className="money-stat"><span className="money-muted">Annual</span><strong>{formatEUR(monthlyTotal * 12)}</strong></div>
        </div>
        <p className="money-muted">Scheduled, not paid. Bills change your balance only when you confirm them.</p>
        <button type="button" className="money-btn-primary" onClick={() => setAdding((v) => !v)}>
          {adding ? "Close" : "+ Add New Subscription"}
        </button>
        {adding && <AddSubscription api={api} notify={notify} onDone={() => setAdding(false)} />}
      </section>

      <section className="money-panel">
        <h2 className="money-h2">Due and upcoming</h2>
        {active.length === 0 ? <p className="money-muted">No active subscriptions or bills.</p> : <ul className="money-list">{active.sort((a, b) => (a.nextDue < b.nextDue ? -1 : 1)).map(renderRow)}</ul>}
      </section>

      {paused.length > 0 && <section className="money-panel"><h2 className="money-h2">Paused</h2><ul className="money-list">{paused.map(renderRow)}</ul></section>}
      {cancelled.length > 0 && <section className="money-panel"><h2 className="money-h2">Cancelled</h2><ul className="money-list">{cancelled.map(renderRow)}</ul></section>}
      <p className="money-muted">Today is {formatDateIE(todayISO())}.</p>
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
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const cents = parseEuroToCents(amount);
    if (!name.trim()) return setError("Add a name.");
    if (cents === null || cents <= 0) return setError("Enter an amount above zero.");
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
      accountId: accountId || null,
      notes: "",
    };
    const err = await commit(saveRecurring(snap, input, defaultCtx()));
    if (err) return setError(err);
    notify("Subscription added");
    onDone();
  };

  return (
    <div className="money-form">
      <label className="money-field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></label>
      <label className="money-field"><span>Amount (€)</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></label>
      <label className="money-field"><span>Interval</span>
        <select value={interval} onChange={(e) => setInterval(e.target.value as Recurring["interval"])}>
          {INTERVALS.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
        </select>
      </label>
      {interval === "custom" && <label className="money-field"><span>Every (days)</span><input inputMode="numeric" value={customDays} onChange={(e) => setCustomDays(e.target.value)} /></label>}
      <label className="money-field"><span>Next payment</span><input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} /></label>
      <label className="money-field"><span>Payment account</span>
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>
      {error && <p className="money-error" role="alert">{error}</p>}
      <button type="button" className="money-btn-primary" onClick={submit}>Save subscription</button>
    </div>
  );
}
