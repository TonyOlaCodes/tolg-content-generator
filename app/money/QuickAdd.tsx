"use client";

import { useState } from "react";
import { saveTransaction, defaultCtx, type TxInput } from "@/money/actions";
import { parseEuroToCents, todayISO } from "@/money/money";
import type { TxKind } from "@/money/types";
import type { MoneyApi } from "./MoneyApp";

const KINDS: { id: TxKind | "planned"; label: string }[] = [
  { id: "expense", label: "Spent" },
  { id: "income", label: "Money in" },
  { id: "transfer", label: "Transfer" },
  { id: "refund", label: "Refund" },
  { id: "planned", label: "Planned" },
  { id: "adjustment", label: "Adjust balance" },
];

/** Fast entry sheet: amount, then category, then confirm. Everything else sits under "More". */
export function QuickAdd({ api, onClose, notify }: { api: MoneyApi; onClose: () => void; notify: (m: string) => void }) {
  const { snap, commit } = api;
  const accounts = snap.accounts.filter((a) => !a.archived);
  const categories = snap.categories.filter((c) => !c.archived && c.kind === "spending");
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayISO());
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id ?? "");
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isTransfer = kind === "transfer";
  const isIncome = kind === "income";
  const usesCategory = !isTransfer && !isIncome && kind !== "adjustment";

  const submit = async () => {
    if (busy) return;
    if (accounts.length === 0) return setError("Add an account first, so the balance can change.");
    const raw = amount.trim();
    const cents = parseEuroToCents(raw);
    if (cents === null || cents === 0) return setError("Enter an amount like 12.50.");
    if (kind !== "adjustment" && cents < 0) return setError("Enter a positive amount.");
    const category = categories.find((c) => c.id === categoryId);
    const fallback = isTransfer ? "Transfer" : isIncome ? "Money in" : category?.name ?? KINDS.find((k) => k.id === kind)?.label ?? "Spent";
    const input: TxInput = {
      kind: kind === "planned" ? "expense" : kind,
      status: kind === "planned" ? "planned" : "confirmed",
      date,
      amountCents: Math.abs(cents),
      accountId: accountId || null,
      toAccountId: isTransfer ? toAccountId || null : null,
      categoryId: usesCategory ? categoryId || null : null,
      description: description.trim() || fallback,
      notes: "",
    };
    setBusy(true);
    const err = await commit(saveTransaction(snap, input, defaultCtx()));
    setBusy(false);
    if (err) return setError(err);
    notify(kind === "planned" ? "Planned item saved" : "Saved");
    onClose();
  };

  return (
    <div className="money-sheet-backdrop" role="presentation" onClick={onClose}>
      <div className="money-sheet" role="dialog" aria-modal="true" aria-label="Add transaction" onClick={(e) => e.stopPropagation()}>
        <div className="money-sheet-grip" aria-hidden />
        <div className="money-sheet-head">
          <strong>Add</strong>
          <button type="button" className="money-link" onClick={onClose}>Cancel</button>
        </div>

        <label className="money-amount">
          <span className="sr-only">Amount in euros</span>
          <span className="money-amount-sign" aria-hidden>€</span>
          <input
            inputMode="decimal"
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            aria-label="Amount in euros"
          />
        </label>

        {usesCategory && (
          <div className="money-chips" role="radiogroup" aria-label="Category">
            <button type="button" role="radio" aria-checked={categoryId === ""} className={`money-chip${categoryId === "" ? " is-active" : ""}`} onClick={() => setCategoryId("")}>
              No category
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={categoryId === c.id}
                className={`money-chip${categoryId === c.id ? " is-active" : ""}`}
                onClick={() => setCategoryId(c.id)}
              >
                <span aria-hidden>{c.icon}</span> {c.name}
              </button>
            ))}
          </div>
        )}

        {more && (
          <div className="money-more">
            <div className="money-seg" role="radiogroup" aria-label="Type">
              {KINDS.map((k) => (
                <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} className={`money-seg-btn${kind === k.id ? " is-active" : ""}`} onClick={() => setKind(k.id)}>
                  {k.label}
                </button>
              ))}
            </div>
            <label className="money-field">
              <span>Note</span>
              <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} placeholder={isIncome ? "Salary, refund…" : "Lidl, bus ticket…"} />
            </label>
            <div className="money-grid2">
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
            </div>
            {isTransfer && (
              <label className="money-field">
                <span>To</span>
                <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
            )}
          </div>
        )}

        <button type="button" className="money-link money-more-toggle" onClick={() => setMore((v) => !v)} aria-expanded={more}>
          {more ? "Less" : "More options"}
        </button>

        {error && <p className="money-error" role="alert">{error}</p>}
        {accounts.length === 0 && <p className="money-error" role="alert">Add an account first in the guided setup, so the balance can change.</p>}

        <button type="button" className="money-btn-primary money-confirm" onClick={submit} disabled={busy || accounts.length === 0}>
          {busy ? "Saving…" : kind === "planned" ? "Save planned item" : "Confirm"}
        </button>
      </div>
    </div>
  );
}
