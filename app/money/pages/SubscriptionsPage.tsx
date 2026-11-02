"use client";

import { useEffect, useState } from "react";
import {
  saveRecurring,
  confirmRecurring,
  skipRecurring,
  setRecurringStatus,
  deleteRecurring,
  remainingRecurringCents,
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

export default function SubscriptionsPage({
  api,
  notify,
  onSetup,
  onConfirmBill,
}: {
  api: MoneyApi;
  notify: (m: string) => void;
  onSetup?: () => void;
  onConfirmBill?: (id: string) => void;
}) {
  const { snap, commit } = api;
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [payDraft, setPayDraft] = useState<Record<string, string>>({});

  const bills = snap.recurring.filter((r) => r.kind === "bill");
  const active = bills.filter((r) => r.status === "active").sort((a, b) => (a.nextDue < b.nextDue ? -1 : 1));
  const paused = bills.filter((r) => r.status === "paused");
  const deleted = bills.filter((r) => r.status === "cancelled");
  const monthlyTotal = active.reduce((s, r) => s + monthlyEquivalentCents(r.amountCents, r), 0);
  const hasAccount = snap.accounts.some((a) => !a.archived);

  const accountName = (id: string | null) => snap.accounts.find((a) => a.id === id)?.name ?? "No account";

  const act = async (id: string, build: () => Result, ok: string): Promise<boolean> => {
    if (busy) return false;
    setBusy(id);
    const err = await commit(build());
    setBusy(null);
    notify(err ?? ok);
    return !err;
  };

  const statusOf = (r: Recurring) => {
    if (r.status === "paused") return { label: "Paused", tone: "muted" };
    if (r.status === "cancelled") return { label: "Deleted", tone: "muted" };
    const due = dueLabel(r.nextDue);
    if (due.overdue) return { label: "Overdue", tone: "neg" };
    if (due.text.toLowerCase().includes("today")) return { label: "Due today", tone: "warn" };
    return { label: "Upcoming", tone: "muted" };
  };

  const payValue = (r: Recurring, remaining: number) =>
    payDraft[r.id] ?? (remaining / 100).toFixed(2);

  const renderCard = (r: Recurring) => {
    const status = statusOf(r);
    const remaining = remainingRecurringCents(snap, r);
    const isDue = r.status === "active" && status.tone !== "muted";
    const isBusy = busy === r.id;
    const paidToward = r.amountCents - remaining;
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
            {paidToward > 0 && remaining > 0 ? ` · ${formatEUR(remaining)} left` : ""}
          </p>
        )}

        {r.status === "active" && isDue && remaining > 0 && (
          onConfirmBill ? (
            <button type="button" className="money-btn-primary money-confirm-paid" disabled={isBusy} onClick={() => onConfirmBill(r.id)}>
              Confirm Paid
            </button>
          ) : (
            <div className="money-pay-row">
              <label className="money-pay-amount">
                <span className="money-sr">Amount to pay</span>
                <span className="money-pay-prefix" aria-hidden>€</span>
                <input
                  inputMode="decimal"
                  aria-label={`Pay amount for ${r.name}`}
                  value={payValue(r, remaining)}
                  onChange={(e) => setPayDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                />
              </label>
              <button
                type="button"
                className="money-btn-primary money-confirm-paid"
                disabled={isBusy}
                onClick={() => {
                  const cents = parseEuroToCents(payValue(r, remaining));
                  if (cents === null || cents <= 0) return notify("Enter an amount above zero");
                  if (cents > remaining) return notify("That is more than what is left");
                  void (async () => {
                    const okPay = await act(
                      r.id,
                      () => confirmRecurring(snap, r.id, defaultCtx(), cents),
                      cents < remaining ? `Paid ${formatEUR(cents)}` : "Marked as paid",
                    );
                    if (!okPay) return;
                    setPayDraft((d) => {
                      const next = { ...d };
                      delete next[r.id];
                      return next;
                    });
                  })();
                }}
              >
                {isBusy ? "Saving…" : centsLabel(payValue(r, remaining), remaining)}
              </button>
            </div>
          )
        )}

        {r.status === "active" && (
          <div className="money-sub-actions">
            <button type="button" className="money-link" disabled={isBusy} onClick={() => act(r.id, () => skipRecurring(snap, r.id, defaultCtx()), "Skipped this payment")}>Skip</button>
            <button type="button" className="money-link" disabled={isBusy} onClick={() => setEditing(editing === r.id ? null : r.id)}>Edit</button>
            <button type="button" className="money-link" disabled={isBusy} onClick={() => act(r.id, () => setRecurringStatus(snap, r.id, "paused", defaultCtx()), "Paused")}>Pause</button>
            <button type="button" className="money-link is-danger" disabled={isBusy} onClick={() => {
              if (!window.confirm(`Delete ${r.name}?`)) return;
              void act(r.id, () => deleteRecurring(snap, r.id, defaultCtx()), "Deleted");
            }}>Delete</button>
          </div>
        )}

        {r.status === "active" && editing === r.id && (
          <EditSubscription
            api={api}
            rec={r}
            notify={notify}
            busy={isBusy}
            onBusy={(v) => setBusy(v ? r.id : null)}
            onDone={() => setEditing(null)}
          />
        )}

        {r.status !== "active" && (
          <div className="money-sub-actions">
            <button type="button" className="money-link" disabled={isBusy} onClick={() => act(r.id, () => setRecurringStatus(snap, r.id, "active", defaultCtx()), "Resumed")}>
              {r.status === "paused" ? "Resume" : "Restore"}
            </button>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="money-page">
      <section className="money-block">
        <p className="money-kicker">Bills</p>
        <p className="money-big">{formatEUR(monthlyTotal)} <span className="money-muted">a month</span></p>
        <p className="money-muted money-small">About {formatEUR(monthlyTotal * 12)} a year</p>
        <button type="button" className="money-btn-primary money-add" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
          {adding ? "Close" : "+ Add Bill"}
        </button>
        {adding && (
          hasAccount
            ? <AddSubscription api={api} notify={notify} onDone={() => setAdding(false)} />
            : <p className="money-setup-note">Add an account first. {onSetup && <button type="button" className="money-link" onClick={onSetup}>Set up</button>}</p>
        )}
      </section>

      {bills.length === 0 && !adding && (
        <p className="money-muted money-empty">No bills yet.</p>
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

      {deleted.length > 0 && (
        <section className="money-stack">
          <h2 className="money-h2">Deleted</h2>
          <ul className="money-sub-list">{deleted.map(renderCard)}</ul>
        </section>
      )}
    </div>
  );
}

function centsLabel(raw: string, remaining: number): string {
  const cents = parseEuroToCents(raw);
  if (cents === null || cents <= 0) return "Confirm Paid";
  if (cents < remaining) return `Pay ${formatEUR(cents)}`;
  return "Confirm Paid";
}

function EditSubscription({
  api,
  rec,
  notify,
  busy,
  onBusy,
  onDone,
}: {
  api: MoneyApi;
  rec: Recurring;
  notify: (m: string) => void;
  busy: boolean;
  onBusy: (v: boolean) => void;
  onDone: () => void;
}) {
  const { snap, commit } = api;
  const accounts = snap.accounts.filter((a) => !a.archived);
  const [name, setName] = useState(rec.name);
  const [amount, setAmount] = useState((rec.amountCents / 100).toFixed(2));
  const [interval, setInterval] = useState<Recurring["interval"]>(rec.interval);
  const [customDays, setCustomDays] = useState(String(rec.customDays ?? 30));
  const [nextDue, setNextDue] = useState(rec.nextDue);
  const [accountId, setAccountId] = useState(`${rec.accountId ?? ""}|${rec.pocketId ?? ""}`);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(rec.name);
    setAmount((rec.amountCents / 100).toFixed(2));
    setInterval(rec.interval);
    setCustomDays(String(rec.customDays ?? 30));
    setNextDue(rec.nextDue);
    setAccountId(`${rec.accountId ?? ""}|${rec.pocketId ?? ""}`);
  }, [rec]);

  const save = async () => {
    const cents = parseEuroToCents(amount);
    if (!name.trim()) return setError("Add a name.");
    if (cents === null || cents <= 0) return setError("Enter an amount above zero.");
    if (interval === "custom" && !(Number(customDays) > 0)) return setError("Enter a number of days.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDue)) return setError("Choose a valid next date.");
    const [srcAccount, srcPocket] = accountId.split("|");
    const input: RecurringInput = {
      id: rec.id,
      kind: "bill",
      name: name.trim(),
      icon: rec.icon,
      amountCents: cents,
      interval,
      customDays: interval === "custom" ? Number(customDays) : null,
      dayOfMonth: Number(nextDue.slice(8, 10)),
      nextDue,
      categoryId: rec.categoryId,
      accountId: srcAccount || null,
      pocketId: srcPocket || null,
      notes: rec.notes,
    };
    onBusy(true);
    const err = await commit(saveRecurring(snap, input, defaultCtx()));
    onBusy(false);
    if (err) return setError(err);
    notify("Updated");
    onDone();
  };

  return (
    <div className="money-inline-panel money-edit-sub">
      <label className="money-field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></label>
      <div className="money-grid2">
        <label className="money-field"><span>Price (€)</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        <label className="money-field"><span>Billed</span>
          <select value={interval} onChange={(e) => setInterval(e.target.value as Recurring["interval"])}>
            {INTERVALS.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
          </select>
        </label>
      </div>
      {interval === "custom" && (
        <label className="money-field"><span>Every (days)</span><input inputMode="numeric" value={customDays} onChange={(e) => setCustomDays(e.target.value)} /></label>
      )}
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
      {error && <p className="money-error" role="alert">{error}</p>}
      <div className="money-row-actions">
        <button type="button" className="money-btn-secondary" disabled={busy} onClick={onDone}>Close</button>
        <button type="button" className="money-btn-small" disabled={busy} onClick={save}>Save</button>
      </div>
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
