"use client";

import { useEffect, useState } from "react";
import { saveTransaction, defaultCtx } from "@/money/actions";
import { formatEUR, parseEuroToCents, todayISO } from "@/money/money";
import type { MoneyApi } from "./MoneyApp";
import { SheetPortal } from "./SheetPortal";
import { locationBalanceLabel, locationOptions, parseLocation } from "./locations";

export type FlowMode = "add" | "send" | "transfer";

const TITLES: Record<FlowMode, string> = {
  add: "Add Money",
  send: "Send Money",
  transfer: "Transfer",
};

/** Compact Add / Send / Transfer sheet — amount first, destination second, optional extras. */
export function MoneyFlowSheet({
  api,
  mode,
  onClose,
  notify,
  presetFrom,
  presetTo,
}: {
  api: MoneyApi;
  mode: FlowMode;
  onClose: () => void;
  notify: (m: string) => void;
  presetFrom?: string;
  presetTo?: string;
}) {
  const { snap, commit } = api;
  const locations = locationOptions(snap);
  const categories = snap.categories.filter((c) => !c.archived && c.kind === "spending");
  const first = locations[0]?.value ?? "";
  const second = locations[1]?.value ?? first;

  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState(presetFrom ?? first);
  const [to, setTo] = useState(presetTo ?? (mode === "add" ? first : second));
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    if (busy) return;
    const cents = parseEuroToCents(amount);
    if (cents === null || cents <= 0) return setError("Enter an amount above zero.");
    setBusy(true);
    setError(null);

    let result;
    if (mode === "add") {
      const dest = parseLocation(to);
      result = saveTransaction(
        snap,
        {
          kind: "income",
          status: "confirmed",
          date,
          amountCents: cents,
          accountId: dest.accountId,
          pocketId: dest.pocketId,
          toAccountId: null,
          categoryId: null,
          description: description.trim() || "Money in",
          notes: "",
        },
        defaultCtx(),
      );
    } else if (mode === "send") {
      const src = parseLocation(from);
      result = saveTransaction(
        snap,
        {
          kind: "expense",
          status: "confirmed",
          date,
          amountCents: cents,
          accountId: src.accountId,
          pocketId: src.pocketId,
          toAccountId: null,
          categoryId: categoryId || null,
          description: description.trim() || "Purchase",
          notes: "",
        },
        defaultCtx(),
      );
    } else {
      if (from === to) {
        setBusy(false);
        return setError("Choose two different places.");
      }
      const src = parseLocation(from);
      const dst = parseLocation(to);
      result = saveTransaction(
        snap,
        {
          kind: "transfer",
          status: "confirmed",
          date,
          amountCents: cents,
          accountId: src.accountId,
          pocketId: src.pocketId,
          toAccountId: dst.accountId,
          toPocketId: dst.pocketId,
          categoryId: null,
          description: description.trim() || "Transfer",
          notes: "",
        },
        defaultCtx(),
      );
    }

    const err = await commit(result);
    setBusy(false);
    if (err) return setError(err);
    notify(mode === "add" ? "Money added" : mode === "send" ? "Money sent" : "Transferred");
    onClose();
  };

  const selectOpts = locations.map((o) => ({ value: o.value, label: locationBalanceLabel(o) }));

  return (
    <SheetPortal>
      <div className="money-sheet-backdrop" role="presentation" onClick={onClose}>
        <div className="money-sheet money-sheet-compact" role="dialog" aria-modal="true" aria-label={TITLES[mode]} onClick={(e) => e.stopPropagation()}>
          <div className="money-sheet-grip" aria-hidden />
          <div className="money-sheet-head">
            <strong>{TITLES[mode]}</strong>
            <button type="button" className="money-link" onClick={onClose}>Cancel</button>
          </div>
          <div className="money-sheet-body">
            <label className="money-amount-field">
              <span className="money-sr">Amount</span>
              <span className="money-amount-prefix">€</span>
              <input
                inputMode="decimal"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                aria-label="Amount"
              />
            </label>

            {mode !== "add" && (
              <label className="money-field">
                <span>{mode === "transfer" ? "From" : "Pay from"}</span>
                <select value={from} onChange={(e) => setFrom(e.target.value)}>
                  {selectOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            )}

            {mode !== "send" && (
              <label className="money-field">
                <span>{mode === "transfer" ? "To" : "Add to"}</span>
                <select value={to} onChange={(e) => setTo(e.target.value)}>
                  {selectOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            )}

            {mode === "send" && categories.length > 0 && (
              <label className="money-field">
                <span>Category</span>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">None</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}

            <details className="money-more">
              <summary className="money-link">More options</summary>
              <label className="money-field">
                <span>Description</span>
                <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} placeholder={mode === "add" ? "Salary, gift…" : mode === "send" ? "Groceries, coffee…" : "Transfer note"} />
              </label>
              <label className="money-field">
                <span>Date</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
            </details>

            {error && <p className="money-error" role="alert">{error}</p>}
            <button type="button" className="money-btn-primary money-confirm" disabled={busy || locations.length === 0} onClick={submit}>
              {busy
                ? "Saving…"
                : (() => {
                    const cents = parseEuroToCents(amount) ?? 0;
                    return cents > 0 ? `Confirm ${formatEUR(cents)}` : "Confirm";
                  })()}
            </button>
            {locations.length === 0 && <p className="money-muted money-small">Add an account first.</p>}
          </div>
        </div>
      </div>
    </SheetPortal>
  );
}
