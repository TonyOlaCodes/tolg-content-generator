"use client";

import { useState } from "react";
import { saveTransaction, defaultCtx, type TxInput } from "@/money/actions";
import { parseEuroToCents, todayISO } from "@/money/money";
import type { TxKind } from "@/money/types";
import type { MoneyApi } from "./MoneyApp";

const KINDS: { id: TxKind | "planned"; label: string }[] = [
  { id: "expense", label: "Expense" },
  { id: "income", label: "Income" },
  { id: "transfer", label: "Transfer" },
  { id: "refund", label: "Refund" },
  { id: "planned", label: "Planned" },
  { id: "adjustment", label: "Adjustment" },
];

export function QuickAdd({ api, onClose, notify }: { api: MoneyApi; onClose: () => void; notify: (m: string) => void }) {
  const { snap, commit } = api;
  const accounts = snap.accounts.filter((a) => !a.archived);
  const categories = snap.categories.filter((c) => !c.archived && c.kind === "spending");
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayISO());
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id ?? "");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isTransfer = kind === "transfer";
  const isIncome = kind === "income";

  const submit = async () => {
    if (busy) return;
    const cents = parseEuroToCents(amount);
    if (cents === null) return setError("Enter an amount like 12.50");
    const txKind: TxKind = kind === "planned" ? "expense" : kind;
    const input: TxInput = {
      kind: txKind,
      status: kind === "planned" ? "planned" : "confirmed",
      date,
      amountCents: cents,
      accountId: accountId || null,
      toAccountId: isTransfer ? toAccountId || null : null,
      categoryId: isTransfer || isIncome ? null : categoryId || null,
      description,
      notes: "",
    };
    setBusy(true);
    const err = await commit(saveTransaction(snap, input, defaultCtx()));
    setBusy(false);
    if (err) return setError(err);
    notify("Saved");
    onClose();
  };

  return (
    <div className="money-sheet-backdrop" role="presentation" onClick={onClose}>
      <div className="money-sheet" role="dialog" aria-modal="true" aria-label="Quick add" onClick={(e) => e.stopPropagation()}>
        <div className="money-sheet-head">
          <strong>Add</strong>
          <button type="button" className="money-link" onClick={onClose}>Cancel</button>
        </div>
        <div className="money-seg" role="radiogroup" aria-label="Type">
          {KINDS.map((k) => (
            <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} className={`money-seg-btn${kind === k.id ? " is-active" : ""}`} onClick={() => setKind(k.id)}>
              {k.label}
            </button>
          ))}
        </div>
        <label className="money-field">
          <span>Amount (€)</span>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </label>
        <label className="money-field">
          <span>Description</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} placeholder={isIncome ? "Salary, refund…" : "What for?"} />
        </label>
        <label className="money-field">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="money-field">
          <span>{isTransfer ? "From" : "Account"}</span>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        {isTransfer && (
          <label className="money-field">
            <span>To</span>
            <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
        )}
        {!isTransfer && !isIncome && (
          <label className="money-field">
            <span>Category</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">None</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </label>
        )}
        {error && <p className="money-error" role="alert">{error}</p>}
        <button type="button" className="money-btn-primary" onClick={submit} disabled={busy}>
          {busy ? "Saving…" : kind === "planned" ? "Save planned item" : "Save"}
        </button>
      </div>
    </div>
  );
}
