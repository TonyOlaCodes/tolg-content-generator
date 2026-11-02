"use client";

import { useEffect, useState } from "react";
import { saveAccount, saveCategory, saveRecurring, defaultCtx, type RecurringInput, type Change } from "@/money/actions";
import { ACCOUNT_KINDS, type AccountKind } from "@/money/types";
import { formatEUR, parseEuroToCents, todayISO } from "@/money/money";
import type { MoneyApi } from "./MoneyApp";

const STEPS = ["Accounts", "Salary", "Plan"] as const;
const SUGGESTED: Record<string, number> = { Food: 30000, Transport: 25000, Subscriptions: 25000, Discretionary: 25000 };
const RESUME_KEY = "money.setup.step.v1";

/**
 * Optional, skippable setup. Every step writes through the normal actions, so no
 * step ever changes a balance except the opening amount the user types in.
 */
export function SetupSheet({ api, onClose, notify }: { api: MoneyApi; onClose: () => void; notify: (m: string) => void }) {
  const { snap } = api;
  const [step, setStep] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const saved = Number(window.localStorage.getItem(RESUME_KEY));
    return Number.isInteger(saved) && saved >= 0 && saved < STEPS.length ? saved : 0;
  });
  const goTo = (n: number) => {
    setStep(n);
    try { window.localStorage.setItem(RESUME_KEY, String(n)); } catch { /* storage unavailable: resume is optional */ }
  };
  const finish = () => {
    try { window.localStorage.removeItem(RESUME_KEY); } catch { /* optional */ }
    onClose();
  };
  const skip = () => {
    if (step < STEPS.length - 1) goTo(step + 1);
    else finish();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      try { window.localStorage.removeItem(RESUME_KEY); } catch { /* optional */ }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="money-sheet-backdrop" role="presentation" onClick={finish}>
      <div className="money-sheet" role="dialog" aria-modal="true" aria-label="Guided setup" onClick={(e) => e.stopPropagation()}>
        <div className="money-sheet-grip" aria-hidden />
        <div className="money-sheet-head">
          <strong>Set up · {step + 1} of {STEPS.length}</strong>
          <button type="button" className="money-link" onClick={finish}>Later</button>
        </div>
        <div className="money-progress-steps" aria-hidden>
          {STEPS.map((s, i) => <span key={s} className={i <= step ? "is-on" : ""} />)}
        </div>

        <div className="money-sheet-body">
          {step === 0 && <AccountsStep api={api} notify={notify} onNext={() => goTo(1)} onSkip={skip} />}
          {step === 1 && <SalaryStep api={api} notify={notify} onNext={() => goTo(2)} onSkip={skip} />}
          {step === 2 && <PlanStep api={api} notify={notify} onDone={finish} onSkip={skip} />}
          {snap.accounts.length === 0 && step > 0 && <p className="money-muted money-small">No accounts yet.</p>}
        </div>
      </div>
    </div>
  );
}

function AccountsStep({ api, notify, onNext, onSkip }: { api: MoneyApi; notify: (m: string) => void; onNext: () => void; onSkip: () => void }) {
  const { snap, commit } = api;
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("current");
  const [balance, setBalance] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const accounts = snap.accounts.filter((a) => !a.archived);

  const add = async () => {
    const cents = balance.trim() === "" ? 0 : parseEuroToCents(balance);
    if (!name.trim()) return setError("Give the account a name, like Revolut or Bank.");
    if (cents === null) return setError("Enter the balance as a number, like 1250.00.");
    setBusy(true);
    const err = await commit(saveAccount(snap, { name, kind, openingCents: cents, excludeFromSpendable: ACCOUNT_KINDS[kind].excludeFromSpendable }, defaultCtx()));
    setBusy(false);
    if (err) return setError(err);
    setName("");
    setBalance("");
    setError(null);
    notify("Account added");
  };

  return (
    <div className="money-setup-step">
      <h2 className="money-h2">Where is your money?</h2>
      {accounts.length > 0 && (
        <ul className="money-list">
          {accounts.map((a) => <li key={a.id} className="money-row"><span>{a.name}</span><strong>{formatEUR(a.openingCents)}</strong></li>)}
        </ul>
      )}
      <div className="money-form">
        <label className="money-field"><span>Account name</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Revolut, AIB…" /></label>
        <div className="money-grid2">
          <label className="money-field"><span>Type</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as AccountKind)}>
              {(Object.keys(ACCOUNT_KINDS) as AccountKind[]).map((k) => <option key={k} value={k}>{ACCOUNT_KINDS[k].label}</option>)}
            </select>
          </label>
          <label className="money-field"><span>Balance (€)</span><input inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0.00" /></label>
        </div>
        {error && <p className="money-error" role="alert">{error}</p>}
        <button type="button" className="money-btn-small" disabled={busy} onClick={add}>{busy ? "Saving…" : "Add account"}</button>
      </div>
      <div className="money-setup-nav">
        <button type="button" className="money-link" onClick={onSkip}>Skip for now</button>
        <button type="button" className="money-btn-primary" onClick={onNext}>{accounts.length ? "Next" : "Continue"}</button>
      </div>
    </div>
  );
}

function SalaryStep({ api, notify, onNext, onSkip }: { api: MoneyApi; notify: (m: string) => void; onNext: () => void; onSkip: () => void }) {
  const { snap, commit } = api;
  const existing = snap.recurring.find((r) => r.kind === "income" && r.status === "active");
  const [amount, setAmount] = useState(existing ? (existing.amountCents / 100).toFixed(2) : "");
  const [day, setDay] = useState(existing ? String(existing.dayOfMonth) : "25");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const cents = parseEuroToCents(amount);
    const dom = Number(day);
    if (cents === null || cents <= 0) return setError("Enter your monthly take-home pay, like 2400.00.");
    if (!Number.isInteger(dom) || dom < 1 || dom > 31) return setError("Pick a day of the month from 1 to 31.");
    const next = nextPayday(dom);
    const input: RecurringInput = {
      id: existing?.id,
      kind: "income",
      name: existing?.name ?? "Salary",
      icon: existing?.icon ?? "💼",
      amountCents: cents,
      interval: "monthly",
      customDays: null,
      dayOfMonth: dom,
      nextDue: existing?.nextDue ?? next,
      categoryId: null,
      accountId: existing?.accountId ?? snap.accounts.find((a) => !a.archived)?.id ?? null,
      notes: existing?.notes ?? "",
    };
    setBusy(true);
    const err = await commit(saveRecurring(snap, input, defaultCtx()));
    setBusy(false);
    if (err) return setError(err);
    notify("Salary saved");
    onNext();
  };

  return (
    <div className="money-setup-step">
      <h2 className="money-h2">When do you get paid?</h2>
      <div className="money-form">
        <label className="money-field"><span>Monthly take-home (€)</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="2400.00" /></label>
        <label className="money-field"><span>Payday (day of month)</span><input inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} /></label>
        {error && <p className="money-error" role="alert">{error}</p>}
      </div>
      <div className="money-setup-nav">
        <button type="button" className="money-link" onClick={onSkip}>Skip for now</button>
        <button type="button" className="money-btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save & continue"}</button>
      </div>
    </div>
  );
}

function PlanStep({ api, notify, onDone, onSkip }: { api: MoneyApi; notify: (m: string) => void; onDone: () => void; onSkip: () => void }) {
  const { snap, commit } = api;
  const cats = snap.categories.filter((c) => !c.archived && c.kind === "spending").sort((a, b) => a.order - b.order);
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(cats.map((c) => [c.id, ((SUGGESTED[c.name] ?? c.targetCents) / 100).toFixed(2)])),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const useSuggested = () => {
    setAmounts(Object.fromEntries(cats.map((c) => [c.id, ((SUGGESTED[c.name] ?? c.targetCents) / 100).toFixed(2)])));
  };

  const save = async () => {
    // Validate all amounts first, then write them as one change set so nothing is half-saved.
    const parsed: Record<string, number> = {};
    for (const c of cats) {
      const raw = amounts[c.id] ?? "";
      const cents = raw.trim() === "" ? 0 : parseEuroToCents(raw);
      if (cents === null || cents < 0) return setError(`Enter a valid amount for ${c.name}.`);
      parsed[c.id] = cents;
    }
    setBusy(true);
    const ctx = defaultCtx();
    let working = snap;
    const puts: Change["puts"] = [];
    for (const c of cats) {
      if (parsed[c.id] === c.targetCents) continue;
      const r = saveCategory(working, { id: c.id, name: c.name, icon: c.icon, color: c.color, kind: c.kind, targetCents: parsed[c.id], goalCents: c.goalCents }, ctx);
      if (!r.ok) { setBusy(false); return setError(r.error); }
      puts.push(...r.change.puts);
      working = { ...working, categories: working.categories.map((x) => (x.id === c.id ? { ...x, targetCents: parsed[c.id] } : x)) };
    }
    const err = puts.length ? await commit({ ok: true, change: { puts, deletes: [] } }) : null;
    setBusy(false);
    if (err) return setError(err);
    notify("Plan saved");
    onDone();
  };

  return (
    <div className="money-setup-step">
      <h2 className="money-h2">Your monthly plan</h2>
      {cats.length === 0 ? (
        <p className="money-muted">No categories yet.</p>
      ) : (
        <div className="money-form">
          {cats.map((c) => (
            <label key={c.id} className="money-field money-plan-row">
              <span><span aria-hidden>{c.icon}</span> {c.name}</span>
              <input
                inputMode="decimal"
                aria-label={`Monthly plan for ${c.name} in euros`}
                value={amounts[c.id] ?? ""}
                onChange={(e) => setAmounts((s) => ({ ...s, [c.id]: e.target.value }))}
              />
            </label>
          ))}
          <button type="button" className="money-link" onClick={useSuggested}>Use suggested amounts</button>
          {error && <p className="money-error" role="alert">{error}</p>}
        </div>
      )}
      <div className="money-setup-nav">
        <button type="button" className="money-link" onClick={onSkip}>Skip for now</button>
        <button type="button" className="money-btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Finish"}</button>
      </div>
    </div>
  );
}

/** Next date on or after today that falls on the given day of the month. */
function nextPayday(dayOfMonth: number): string {
  const today = new Date(todayISO() + "T00:00:00");
  const y = today.getFullYear();
  const m = today.getMonth();
  const clamp = (year: number, month: number) => Math.min(dayOfMonth, new Date(year, month + 1, 0).getDate());
  const thisMonth = new Date(y, m, clamp(y, m));
  const base = thisMonth >= today ? thisMonth : new Date(y, m + 1, clamp(y, m + 1));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
}
