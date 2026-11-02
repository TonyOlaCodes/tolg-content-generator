"use client";

import { useEffect, useState } from "react";
import { confirmRecurring, remainingRecurringCents, defaultCtx } from "@/money/actions";
import { formatEUR, parseEuroToCents } from "@/money/money";
import type { Recurring } from "@/money/types";
import type { MoneyApi } from "./MoneyApp";
import { SheetPortal } from "./SheetPortal";
import { locationBalanceLabel, locationOptions, parseLocation } from "./locations";

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
  const locations = locationOptions(snap);
  const defaultLoc = `${bill.accountId ?? locations[0]?.accountId ?? ""}|${bill.pocketId ?? ""}`;
  const [amount, setAmount] = useState((remaining / 100).toFixed(2));
  const [location, setLocation] = useState(defaultLoc);
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

  const submit = async () => {
    if (busy) return;
    const cents = parseEuroToCents(amount);
    if (cents === null || cents <= 0) return setError("Enter an amount above zero.");
    if (cents > remaining) return setError("That is more than what is left.");
    const loc = parseLocation(location);
    setBusy(true);
    const err = await commit(
      confirmRecurring(snap, bill.id, defaultCtx(), {
        amountCents: cents,
        accountId: loc.accountId,
        pocketId: loc.pocketId,
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
        <div className="money-sheet money-sheet-compact" role="dialog" aria-modal="true" aria-label={`Confirm ${bill.name}`} onClick={(e) => e.stopPropagation()}>
          <div className="money-sheet-grip" aria-hidden />
          <div className="money-sheet-head">
            <strong>Confirm {bill.name}</strong>
            <button type="button" className="money-link" onClick={onClose}>Cancel</button>
          </div>
          <div className="money-sheet-body">
            <p className="money-muted money-small">{formatEUR(remaining)} left of {formatEUR(bill.amountCents)}</p>
            <label className="money-amount-field">
              <span className="money-sr">Amount</span>
              <span className="money-amount-prefix">€</span>
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label className="money-field">
              <span>Pay from</span>
              <select value={location} onChange={(e) => setLocation(e.target.value)}>
                {locations.map((o) => (
                  <option key={o.value} value={o.value}>{locationBalanceLabel(o)}</option>
                ))}
              </select>
            </label>
            <label className="money-check">
              <input type="checkbox" checked={saveDefault} onChange={(e) => setSaveDefault(e.target.checked)} />
              <span>Save as default for next time</span>
            </label>
            {error && <p className="money-error" role="alert">{error}</p>}
            <button type="button" className="money-btn-primary money-confirm" disabled={busy} onClick={submit}>
              {busy ? "Saving…" : "Confirm Paid"}
            </button>
          </div>
        </div>
      </div>
    </SheetPortal>
  );
}
