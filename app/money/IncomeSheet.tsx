"use client";

import { useEffect, useState } from "react";
import { saveIncomeSplit, defaultCtx, type IncomeSplitLine } from "@/money/actions";
import { formatEUR, parseEuroToCents, todayISO } from "@/money/money";
import type { MoneyApi } from "./MoneyApp";
import { SheetPortal } from "./SheetPortal";

type Row = { key: string; value: string; destination: string };

/**
 * Splits one income into accounts and pockets. The income lands in the receiving account first, then
 * each allocated part moves out with internal transfers, so nothing is counted twice.
 * Any unallocated remainder goes to the chosen remainder destination.
 */
export function IncomeSheet({ api, onClose, notify }: { api: MoneyApi; onClose: () => void; notify: (m: string) => void }) {
  const { snap, commit } = api;
  const accounts = snap.accounts.filter((a) => !a.archived);
  const pockets = snap.pockets.filter((p) => !p.archived);
  const destinations = accounts.flatMap((a) => [
    { value: `${a.id}|`, label: `${a.name} · Main` },
    ...pockets.filter((p) => p.accountId === a.id).map((p) => ({ value: `${a.id}|${p.id}`, label: `${a.name} · ${p.name}` })),
  ]);
  // Income always lands in an account Main first; pockets are only allocation destinations.
  const receiveOptions = accounts.map((a) => ({ value: `${a.id}|`, label: a.name }));
  const firstDest = destinations[0]?.value ?? "";
  const [description, setDescription] = useState("Salary");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [receive, setReceive] = useState(accounts[0] ? `${accounts[0].id}|` : "");
  const [rows, setRows] = useState<Row[]>([{ key: "r0", value: "", destination: firstDest }]);
  const [remainderTo, setRemainderTo] = useState(receive);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const totalCents = parseEuroToCents(amount) ?? 0;
  const allocated = rows.reduce((s, r) => s + (parseEuroToCents(r.value) ?? 0), 0);
  const remaining = totalCents - allocated;
  const overAllocated = totalCents > 0 && remaining < 0;

  const update = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const submit = async () => {
    if (busy) return;
    if (totalCents <= 0) return setError("Enter the amount you received.");
    if (overAllocated) return setError("The allocations are more than the amount. Reduce them.");
    const split = (v: string) => {
      const [accountId, pocketId] = v.split("|");
      return { accountId, pocketId: pocketId || null };
    };
    const lines = new Map<string, IncomeSplitLine>();
    const add = (dest: string, cents: number) => {
      if (cents <= 0) return;
      const s = split(dest);
      const k = `${s.accountId}|${s.pocketId ?? ""}`;
      const prev = lines.get(k);
      lines.set(k, { accountId: s.accountId, pocketId: s.pocketId, cents: (prev?.cents ?? 0) + cents });
    };
    for (const r of rows) add(r.destination, parseEuroToCents(r.value) ?? 0);
    if (remaining > 0) add(remainderTo, remaining);

    setBusy(true);
    const err = await commit(
      saveIncomeSplit(
        snap,
        {
          description: description.trim() || "Income",
          date,
          amountCents: totalCents,
          receiveAccountId: split(receive).accountId,
          lines: [...lines.values()],
        },
        defaultCtx(),
      ),
    );
    setBusy(false);
    if (err) return setError(err);
    notify("Income recorded");
    onClose();
  };

  const select = (
    value: string,
    onChange: (v: string) => void,
    title: string,
    options: { value: string; label: string }[] = destinations,
  ) => (
    <label className="money-field">
      <span>{title}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );

  return (
    <SheetPortal>
    <div className="money-sheet-backdrop" role="presentation" onClick={onClose}>
      <div className="money-sheet" role="dialog" aria-modal="true" aria-label="Split income" onClick={(e) => e.stopPropagation()}>
        <div className="money-sheet-grip" aria-hidden />
        <div className="money-sheet-head">
          <strong>Income</strong>
          <button type="button" className="money-link" onClick={onClose}>Cancel</button>
        </div>

        <div className="money-sheet-body">
          <label className="money-amount">
            <span className="sr-only">Amount received in euros</span>
            <span className="money-amount-sign" aria-hidden>€</span>
            <input inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" aria-label="Amount received in euros" />
          </label>

          {accounts.length === 0 ? (
            <p className="money-muted">Add an account first.</p>
          ) : (
            <>
              <div className="money-grid2">
                <label className="money-field">
                  <span>Note</span>
                  <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} />
                </label>
                <label className="money-field">
                  <span>Date</span>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </label>
              </div>
              {select(receive, (v) => { setReceive(v); if (remainderTo === receive) setRemainderTo(v); }, "Received into", receiveOptions)}

              <div className="money-split-remaining" aria-live="polite" data-state={overAllocated ? "over" : remaining === 0 && totalCents > 0 ? "done" : "open"}>
                <span className="money-muted money-small">{overAllocated ? "Over-allocated by" : "Remaining"}</span>
                <strong>{formatEUR(Math.abs(remaining))}</strong>
              </div>

              {rows.map((r, i) => (
                <div key={r.key} className="money-split-row">
                  <label className="money-field">
                    <span>Allocation {i + 1} €</span>
                    <input inputMode="decimal" value={r.value} onChange={(e) => update(r.key, { value: e.target.value })} placeholder="0.00" />
                  </label>
                  <label className="money-field">
                    <span>Into</span>
                    <select value={r.destination} onChange={(e) => update(r.key, { destination: e.target.value })}>
                      {destinations.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                  {rows.length > 1 && (
                    <button type="button" className="money-link" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label={`Remove allocation ${i + 1}`}>Remove</button>
                  )}
                </div>
              ))}
              <button type="button" className="money-link" onClick={() => setRows((rs) => [...rs, { key: `r${Date.now()}`, value: "", destination: firstDest }])}>
                + Add allocation
              </button>

              {remaining > 0 && totalCents > 0 && (
                <>
                  {select(remainderTo, setRemainderTo, `Remaining ${formatEUR(remaining)} goes to`)}
                </>
              )}
            </>
          )}

          {error && <p className="money-error" role="alert">{error}</p>}
        </div>

        <div className="money-sheet-foot">
          <button type="button" className="money-btn-primary money-confirm" onClick={submit} disabled={busy || accounts.length === 0 || overAllocated || totalCents <= 0}>
            {busy ? "Saving…" : "Confirm income"}
          </button>
        </div>
      </div>
    </div>
  );
}
