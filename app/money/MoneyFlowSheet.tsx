"use client";

import { useEffect, useMemo, useState } from "react";
import { saveTransaction, accountNowCents, defaultCtx } from "@/money/actions";
import { formatEUR, parseEuroToCents, todayISO } from "@/money/money";
import type { MoneyApi } from "./MoneyApp";
import { SheetPortal } from "./SheetPortal";
import { locationOptions, parseLocation } from "./locations";

export type FlowMode = "add" | "send" | "transfer";

type AddKind = "income" | "refund" | "other" | "adjustment";

const TITLES: Record<FlowMode, string> = {
  add: "Add Money",
  send: "Spend / Send",
  transfer: "Transfer",
};

/** Compact Add / Spend / Transfer with live balance preview. */
export function MoneyFlowSheet({
  api,
  mode,
  onClose,
  notify,
  presetFrom,
  presetTo,
  preferAccountId,
}: {
  api: MoneyApi;
  mode: FlowMode;
  onClose: () => void;
  notify: (m: string) => void;
  presetFrom?: string;
  presetTo?: string;
  preferAccountId?: string | null;
}) {
  const { snap, commit } = api;
  const locations = locationOptions(snap, preferAccountId);
  const categories = snap.categories.filter((c) => !c.archived && c.kind === "spending");
  const first = locations[0]?.value ?? "";
  const second = locations.find((l) => l.value !== (presetFrom ?? first))?.value ?? first;

  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState(presetFrom ?? first);
  const [to, setTo] = useState(presetTo ?? (mode === "add" ? first : second));
  const [addKind, setAddKind] = useState<AddKind>("income");
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

  const cents = parseEuroToCents(amount) ?? 0;
  const fromLoc = locations.find((l) => l.value === from);
  const toLoc = locations.find((l) => l.value === to);

  const preview = useMemo(() => {
    if (mode === "add" && toLoc) {
      const next = toLoc.balanceCents + Math.max(0, cents);
      const parent = accountNowCents(snap, toLoc.accountId);
      const parentNext = parent + Math.max(0, cents);
      return { lines: [
        { label: "Current", value: formatEUR(toLoc.balanceCents) },
        { label: "Adding", value: cents > 0 ? `+${formatEUR(cents)}` : "—" },
        { label: "New balance", value: formatEUR(next), strong: true },
        { label: "Account total", value: `${formatEUR(parent)} → ${formatEUR(parentNext)}` },
      ]};
    }
    if (mode === "send" && fromLoc) {
      const next = fromLoc.balanceCents - Math.max(0, cents);
      return { lines: [
        { label: "Current", value: formatEUR(fromLoc.balanceCents) },
        { label: "Spending", value: cents > 0 ? `−${formatEUR(cents)}` : "—" },
        { label: "New balance", value: formatEUR(next), strong: true },
      ]};
    }
    if (mode === "transfer" && fromLoc && toLoc) {
      return { lines: [
        { label: "From", value: `${formatEUR(fromLoc.balanceCents)} → ${formatEUR(fromLoc.balanceCents - Math.max(0, cents))}` },
        { label: "To", value: `${formatEUR(toLoc.balanceCents)} → ${formatEUR(toLoc.balanceCents + Math.max(0, cents))}` },
        { label: "Overall money", value: "Unchanged", strong: true },
      ]};
    }
    return { lines: [] as { label: string; value: string; strong?: boolean }[] };
  }, [mode, cents, fromLoc, toLoc, snap]);

  const submit = async () => {
    if (busy) return;
    if (cents <= 0) return setError("Enter an amount above zero.");
    setBusy(true);
    setError(null);

    let result;
    if (mode === "add") {
      const dest = parseLocation(to);
      const kind = addKind === "adjustment" ? "adjustment" : addKind === "refund" ? "refund" : "income";
      const desc =
        description.trim() ||
        (addKind === "adjustment" ? "Balance correction" : addKind === "refund" ? "Refund" : addKind === "other" ? "Money in" : "Income");
      result = saveTransaction(
        snap,
        {
          kind,
          status: "confirmed",
          date,
          amountCents: cents,
          accountId: dest.accountId,
          pocketId: dest.pocketId,
          toAccountId: null,
          categoryId: null,
          description: desc,
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

  const confirmLabel =
    mode === "add" && cents > 0
      ? `Add ${formatEUR(cents)}`
      : mode === "send" && cents > 0
        ? `Spend ${formatEUR(cents)}`
        : mode === "transfer" && cents > 0
          ? `Transfer ${formatEUR(cents)}`
          : "Confirm";

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
              <input inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" aria-label="Amount" />
            </label>

            {mode !== "add" && (
              <label className="money-field">
                <span>{mode === "transfer" ? "From" : "Pay from"}</span>
                <select value={from} onChange={(e) => setFrom(e.target.value)}>
                  {locations.map((o) => (
                    <option key={o.value} value={o.value}>{o.label} · {formatEUR(o.balanceCents)}</option>
                  ))}
                </select>
              </label>
            )}

            {mode !== "send" && (
              <label className="money-field">
                <span>{mode === "transfer" ? "To" : "Add to"}</span>
                <select value={to} onChange={(e) => setTo(e.target.value)}>
                  {locations.map((o) => (
                    <option key={o.value} value={o.value}>{o.label} · {formatEUR(o.balanceCents)}</option>
                  ))}
                </select>
              </label>
            )}

            {mode === "add" && (
              <label className="money-field">
                <span>Type</span>
                <select value={addKind} onChange={(e) => setAddKind(e.target.value as AddKind)}>
                  <option value="income">Income</option>
                  <option value="refund">Gift / refund</option>
                  <option value="other">Other external money</option>
                  <option value="adjustment">Correct balance</option>
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

            {preview.lines.length > 0 && (
              <div className="money-preview" aria-live="polite">
                {preview.lines.map((l) => (
                  <div key={l.label} className={`money-preview-row${l.strong ? " is-strong" : ""}`}>
                    <span>{l.label}</span>
                    <strong>{l.value}</strong>
                  </div>
                ))}
              </div>
            )}

            <details className="money-more">
              <summary className="money-link">More options</summary>
              <label className="money-field">
                <span>{mode === "send" ? "Merchant / note" : "Description"}</span>
                <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} placeholder={mode === "add" ? "Salary, gift…" : mode === "send" ? "Groceries, coffee…" : "Transfer note"} />
              </label>
              <label className="money-field">
                <span>Date</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
            </details>

            {error && <p className="money-error" role="alert">{error}</p>}
            <button type="button" className="money-btn-primary money-confirm" disabled={busy || locations.length === 0} onClick={submit}>
              {busy ? "Saving…" : confirmLabel}
            </button>
            {locations.length === 0 && <p className="money-muted money-small">Add an account first.</p>}
          </div>
        </div>
      </div>
    </SheetPortal>
  );
}
