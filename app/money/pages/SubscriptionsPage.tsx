"use client";

import { useEffect, useState } from "react";
import {
  saveRecurring,
  skipRecurring,
  setRecurringStatus,
  deleteRecurring,
  remainingRecurringCents,
  defaultCtx,
  type RecurringInput,
  type Result,
} from "@/money/actions";
import { computeBillTotals, billPurpose } from "@/money/bills";
import { dueLabel, formatEUR, formatDateIE, parseEuroToCents, todayISO, currentMonth } from "@/money/money";
import type { BillPurpose, Recurring } from "@/money/types";
import type { MoneyApi } from "../MoneyApp";
import { locationLabel } from "../locations";

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
  onOpenSource,
}: {
  api: MoneyApi;
  notify: (m: string) => void;
  onSetup?: () => void;
  onConfirmBill?: (id: string) => void;
  onOpenSource?: (accountId: string) => void;
}) {
  const { snap, commit } = api;
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const bills = snap.recurring.filter((r) => r.kind === "bill");
  const active = bills.filter((r) => r.status === "active").sort((a, b) => (a.nextDue < b.nextDue ? -1 : 1));
  const paused = bills.filter((r) => r.status === "paused");
  const deleted = bills.filter((r) => r.status === "cancelled");
  const totals = computeBillTotals(snap, currentMonth());
  const hasAccount = snap.accounts.some((a) => !a.archived);

  const overdue = active.filter((r) => dueLabel(r.nextDue).overdue && remainingRecurringCents(snap, r) > 0);
  const dueSoon = active.filter((r) => {
    const d = dueLabel(r.nextDue);
    return !d.overdue && remainingRecurringCents(snap, r) > 0 && (d.text.toLowerCase().includes("today") || d.text.toLowerCase().includes("tomorrow") || /in \d+ day/.test(d.text.toLowerCase()));
  });
  const partial = active.filter((r) => {
    const rem = remainingRecurringCents(snap, r);
    return rem > 0 && rem < r.amountCents && !overdue.includes(r) && !dueSoon.includes(r);
  });
  const later = active.filter((r) => remainingRecurringCents(snap, r) > 0 && !overdue.includes(r) && !dueSoon.includes(r) && !partial.includes(r));

  const act = async (id: string, build: () => Result, ok: string): Promise<boolean> => {
    if (busy) return false;
    setBusy(id);
    const err = await commit(build());
    setBusy(null);
    notify(err ?? ok);
    return !err;
  };

  const sourceLabel = (r: Recurring) => locationLabel(snap, r.accountId, r.pocketId ?? null).replace(" · ", " → ");

  const meaningfulStatus = (r: Recurring) => {
    const rem = remainingRecurringCents(snap, r);
    if (rem > 0 && rem < r.amountCents) return { label: "Partially paid", tone: "warn" as const };
    const due = dueLabel(r.nextDue);
    if (due.overdue) return { label: "Overdue", tone: "neg" as const };
    if (due.text.toLowerCase().includes("today")) return { label: "Due today", tone: "warn" as const };
    return null;
  };

  const renderRow = (r: Recurring) => {
    const rem = remainingRecurringCents(snap, r);
    const status = meaningfulStatus(r);
    const isBusy = busy === r.id;
    const open = menuId === r.id;
    return (
      <li key={r.id} className="money-bill-row">
        <div className="money-bill-main">
          <div className="money-bill-text">
            <strong>{r.name}</strong>
            <span className="money-muted money-small">
              {formatEUR(r.amountCents)} {PERIOD[r.interval]} · Due {formatDateIE(r.nextDue)}
              {rem > 0 && rem < r.amountCents ? ` · ${formatEUR(rem)} left` : ""}
            </span>
            <button
              type="button"
              className="money-source-link"
              onClick={() => r.accountId && onOpenSource?.(r.accountId)}
              disabled={!r.accountId || !onOpenSource}
            >
              {sourceLabel(r)}
            </button>
          </div>
          {status && <span className={`money-pill is-${status.tone}`}>{status.label}</span>}
        </div>
        {r.status === "active" && rem > 0 && (
          <div className="money-bill-actions">
            <button type="button" className="money-btn-small" disabled={isBusy} onClick={() => onConfirmBill?.(r.id)}>
              Pay Now
            </button>
            <button type="button" className="money-icon-btn money-icon-btn-sm" aria-label="More" onClick={() => setMenuId(open ? null : r.id)}>⋯</button>
          </div>
        )}
        {open && r.status === "active" && (
          <div className="money-menu-panel">
            <button type="button" className="money-link" disabled={isBusy} onClick={() => { setMenuId(null); void act(r.id, () => skipRecurring(snap, r.id, defaultCtx()), "Skipped"); }}>Skip</button>
            <button type="button" className="money-link" disabled={isBusy} onClick={() => { setMenuId(null); setEditing(editing === r.id ? null : r.id); }}>Edit</button>
            <button type="button" className="money-link" disabled={isBusy} onClick={() => { setMenuId(null); void act(r.id, () => setRecurringStatus(snap, r.id, "paused", defaultCtx()), "Paused"); }}>Pause</button>
            <button type="button" className="money-link is-danger" disabled={isBusy} onClick={() => {
              if (!window.confirm(`Delete ${r.name}?`)) return;
              setMenuId(null);
              void act(r.id, () => deleteRecurring(snap, r.id, defaultCtx()), "Deleted");
            }}>Delete</button>
          </div>
        )}
        {editing === r.id && (
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
          <div className="money-bill-actions">
            <button type="button" className="money-link" disabled={isBusy} onClick={() => act(r.id, () => setRecurringStatus(snap, r.id, "active", defaultCtx()), "Resumed")}>
              {r.status === "paused" ? "Resume" : "Restore"}
            </button>
          </div>
        )}
      </li>
    );
  };

  const section = (title: string, items: Recurring[]) =>
    items.length > 0 ? (
      <section className="money-stack" key={title}>
        <h2 className="money-h2">{title}</h2>
        <ul className="money-bill-list">{items.map(renderRow)}</ul>
      </section>
    ) : null;

  return (
    <div className="money-page">
      <section className="money-block">
        <p className="money-kicker">Bills</p>
        <button type="button" className="money-totals-card" onClick={() => setShowBreakdown((v) => !v)} aria-expanded={showBreakdown}>
          <div>
            <span className="money-muted money-small">Avg monthly expenses</span>
            <strong className="money-big" style={{ display: "block", fontSize: "1.8rem" }}>{formatEUR(totals.averageMonthlyExpenseCents)}</strong>
          </div>
          <div className="money-totals-meta">
            <span>Due this month {formatEUR(totals.dueThisMonthCents)}</span>
            <span>Remaining {formatEUR(totals.remainingThisMonthCents)}</span>
            <span>~{formatEUR(totals.annualExpenseCents)} / year</span>
          </div>
        </button>
        {showBreakdown && (
          <div className="money-breakdown">
            <p className="money-muted money-small">Active expense bills in the average (paused, cancelled, transfers and savings excluded):</p>
            <ul className="money-breakdown-list">
              {totals.contributions
                .filter((c) => c.countsInAverage)
                .map((c) => (
                  <li key={c.id}>
                    <span>{c.name} · {c.interval} · {billPurpose({ purpose: c.purpose } as Recurring)}</span>
                    <strong>{formatEUR(c.monthlyEquivalentCents)}/mo</strong>
                  </li>
                ))}
              {totals.contributions.filter((c) => c.status === "active" && !c.countsInAverage).map((c) => (
                <li key={c.id} className="is-muted">
                  <span>{c.name} · {c.purpose} (not in expense average)</span>
                  <strong>{formatEUR(c.monthlyEquivalentCents)}/mo</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button type="button" className="money-btn-primary money-add" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
          {adding ? "Close" : "+ Add Bill"}
        </button>
        {adding && (
          hasAccount
            ? <AddSubscription api={api} notify={notify} onDone={() => setAdding(false)} />
            : <p className="money-setup-note">Add an account first. {onSetup && <button type="button" className="money-link" onClick={onSetup}>Set up</button>}</p>
        )}
      </section>

      {bills.length === 0 && !adding && <p className="money-muted money-empty">No bills yet.</p>}

      {section("Overdue", overdue)}
      {section("Due soon", dueSoon)}
      {section("Partially paid", partial)}
      {section("Later", later)}
      {section("Paused", paused)}
      {section("Deleted", deleted)}
    </div>
  );
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
  const [purpose, setPurpose] = useState<BillPurpose>(billPurpose(rec));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(rec.name);
    setAmount((rec.amountCents / 100).toFixed(2));
    setInterval(rec.interval);
    setCustomDays(String(rec.customDays ?? 30));
    setNextDue(rec.nextDue);
    setAccountId(`${rec.accountId ?? ""}|${rec.pocketId ?? ""}`);
    setPurpose(billPurpose(rec));
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
      purpose,
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
      <label className="money-field"><span>Classification</span>
        <select value={purpose} onChange={(e) => setPurpose(e.target.value as BillPurpose)}>
          <option value="expense">Expense</option>
          <option value="transfer">Internal transfer</option>
          <option value="savings">Savings allocation</option>
          <option value="other">Other</option>
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
  const [purpose, setPurpose] = useState<BillPurpose>("expense");
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
      purpose,
      notes: "",
    };
    const err = await commit(saveRecurring(snap, input, defaultCtx()));
    if (err) return setError(err);
    notify("Bill added");
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
      <label className="money-field"><span>Classification</span>
        <select value={purpose} onChange={(e) => setPurpose(e.target.value as BillPurpose)}>
          <option value="expense">Expense</option>
          <option value="transfer">Internal transfer</option>
          <option value="savings">Savings allocation</option>
          <option value="other">Other</option>
        </select>
      </label>
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
      <button type="button" className="money-btn-primary" onClick={submit}>Save bill</button>
    </div>
  );
}
