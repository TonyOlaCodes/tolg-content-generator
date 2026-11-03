"use client";

import { useEffect, useMemo, useState } from "react";
import { confirmRecurring, remainingRecurringCents, defaultCtx } from "@/money/actions";
import { formatEUR, parseEuroToCents, todayISO } from "@/money/money";
import type { Recurring } from "@/money/types";
import type { MoneyApi } from "./MoneyApp";
import { SheetPortal } from "./SheetPortal";
import { locationOptions, parseLocation } from "./locations";

export function ConfirmBillSheet({
  api,
  bill,
  onClose,
  notify,
}: {
  api: MoneyApi;
  bill: Recurring;
  onClose: () => void;
  notify: (m: string) => void;
}) {
  const { snap, commit } = api;
  const remaining = remainingRecurringCents(snap, bill);
  const paid = bill.amountCents - remaining;
  const locations = locationOptions(snap, bill.accountId);
  const defaultLoc = `${bill.accountId ?? locations[0]?.accountId ?? ""}|${bill.pocketId ?? ""}`;
  const [amount, setAmount] = useState((remaining / 100).toFixed(2));
  const [location, setLocation] = useState(
    locations.some((l) => l.value === defaultLoc) ? defaultLoc : locations[0]?.value ?? "",
  );
  const [date, setDate] = useState(todayISO());
  const [saveDefault, setSaveDefault] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const cents = parseEuroToCents(amount) ?? 0;
  const loc = locations.find((l) => l.value === location);

  const preview = useMemo(() => {
    if (!loc) return [];
    const next = loc.balanceCents - Math.max(0, cents);
    return [
      { label: "Bill total", value: formatEUR(bill.amountCents) },
      { label: "Already paid", value: formatEUR(paid) },
      { label: "Remaining", value: formatEUR(remaining) },
      { label: "Paying now", value: cents > 0 ? formatEUR(cents) : "—" },
      { label: "Source now", value: formatEUR(loc.balanceCents) },
      { label: "Source after", value: formatEUR(next), strong: true },
    ];
  }, [loc, cents, bill.amountCents, paid, remaining]);

  const submit = async () => {
    if (busy) return;
    if (cents <= 0) return setError("Enter an amount above zero.");
    if (cents > remaining) return setError("That is more than what is left.");
    const parsed = parseLocation(location);
    setBusy(true);
    const err = await commit(
      confirmRecurring(snap, bill.id, defaultCtx(), {
        amountCents: cents,
        accountId: parsed.accountId,
        pocketId: parsed.pocketId,
        saveAsDefault: saveDefault,
      }),
    );
    setBusy(false);
    if (err) return setError(err);
    notify(cents < remaining ? `Paid ${formatEUR(cents)}` : "Marked as paid");
    onClose();
  };

  return (
    <SheetPortal>
      <div className="money-sheet-backdrop" role="presentation" onClick={onClose}>
        <div className="money-sheet money-sheet-compact" role="dialog" aria-modal="true" aria-label={`Pay ${bill.name}`} onClick={(e) => e.stopPropagation()}>
          <div className="money-sheet-grip" aria-hidden />
          <div className="money-sheet-head">
            <strong>Pay {bill.name}</strong>
            <button type="button" className="money-link" onClick={onClose}>Cancel</button>
          </div>
          <div className="money-sheet-body">
            <div className="money-pay-shortcuts">
              <button type="button" className="money-btn-secondary" onClick={() => setAmount((remaining / 100).toFixed(2))}>
                Pay remaining {formatEUR(remaining)}
              </button>
            </div>
            <label className="money-amount-field">
              <span className="money-sr">Amount</span>
              <span className="money-amount-prefix">€</span>
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label className="money-field">
              <span>Pay from</span>
              <select value={location} onChange={(e) => setLocation(e.target.value)}>
                {locations.map((o) => (
                  <option key={o.value} value={o.value}>{o.label} · {formatEUR(o.balanceCents)}</option>
                ))}
              </select>
            </label>
            <div className="money-preview" aria-live="polite">
              {preview.map((l) => (
                <div key={l.label} className={`money-preview-row${l.strong ? " is-strong" : ""}`}>
                  <span>{l.label}</span>
                  <strong>{l.value}</strong>
                </div>
              ))}
            </div>
            <details className="money-more">
              <summary className="money-link">More options</summary>
              <label className="money-field">
                <span>Payment date</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="money-check">
                <input type="checkbox" checked={saveDefault} onChange={(e) => setSaveDefault(e.target.checked)} />
                <span>Update default payment source</span>
              </label>
            </details>
            {error && <p className="money-error" role="alert">{error}</p>}
            <button type="button" className="money-btn-primary money-confirm" disabled={busy || remaining <= 0} onClick={submit}>
              {busy ? "Saving…" : cents > 0 ? `Pay ${formatEUR(cents)}` : "Pay"}
            </button>
          </div>
        </div>
      </div>
    </SheetPortal>
  );
}
