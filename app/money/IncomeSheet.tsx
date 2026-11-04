"use client";

import { useState } from "react";
import { defaultCtx, saveIncomeSplit, saveSplitTemplate } from "@/money/actions";
import type { Location } from "@/money/banking";
import { formatEUR, parseEuroToCents, todayISO } from "@/money/money";
import type { MoneyApi } from "./MoneyApp";
import { ErrorLine, LocationPicker, Sheet, useSaving } from "./ui";

type Row = { id: string; destination: Location | null; value: string };
/** One arrival split across accounts and pockets. The income is counted once, then moved internally. */
export function IncomeSplitSheet({
  api,
  onClose,
  notify,
}: {
  api: MoneyApi;
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const { snap, commit } = api;
  const first = snap.accounts.find((a) => !a.archived);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("Incoming money");
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<Row[]>([
    { id: "r1", destination: first ? { accountId: first.id, pocketId: null } : null, value: "" },
  ]);
  const [templateSaved, setTemplateSaved] = useState(false);
  const { busy, error, setError, run } = useSaving();

  const total = parseEuroToCents(amount) ?? 0;
  const allocated = rows.reduce((sum, row) => sum + (parseEuroToCents(row.value) ?? 0), 0);
  const remaining = total - allocated;

  async function saveTemplate() {
    const lines = rows
      .filter((row) => row.destination && (parseEuroToCents(row.value) ?? 0) > 0)
      .map((row) => ({ accountId: row.destination!.accountId, pocketId: row.destination!.pocketId, cents: parseEuroToCents(row.value) ?? 0 }));
    if (lines.length === 0) return setError("Add an amount to save this split.");
    const err = await commit(saveSplitTemplate(snap, lines));
    if (err) return setError(err);
    setTemplateSaved(true);
    notify("Split saved for next time");
  }

  function loadTemplate() {
    const saved = snap.settings?.splitTemplate ?? [];
    if (!saved.length) return setError("No saved split yet.");
    setRows(
      saved.map((line, index) => ({
        id: `t${index}`,
        destination: { accountId: line.accountId, pocketId: line.pocketId },
        value: (line.cents / 100).toFixed(2),
      })),
    );
    setError(null);
  }

  const submit = async () => {
    if (total <= 0) return setError("Enter the amount that arrived.");
    if (rows.some((row) => !row.destination)) return setError("Choose where every part went.");
    if (remaining !== 0) return setError("The split must add up to the full amount.");
    const firstLine = rows.find((row) => row.destination && (parseEuroToCents(row.value) ?? 0) > 0);
    if (!firstLine?.destination) return setError("Enter at least one amount.");
    const ok = await run(() =>
      commit(
        saveIncomeSplit(
          snap,
          {
            description,
            date,
            amountCents: total,
            receiveAccountId: firstLine.destination!.accountId,
            lines: rows.map((row) => ({
              accountId: row.destination!.accountId,
              pocketId: row.destination!.pocketId,
              cents: parseEuroToCents(row.value) ?? 0,
            })),
          },
          defaultCtx(),
        ),
      ),
    );
    if (ok) {
      notify("Incoming money split and recorded");
      onClose();
    }
  };

  return (
    <Sheet
      title="Split incoming"
      onClose={onClose}
      tall
      footer={
        <button type="button" className="mm-primary mm-wide" disabled={busy || total <= 0 || remaining !== 0} onClick={() => void submit()}>
          {busy ? "Saving…" : `Record ${formatEUR(total)}`}
        </button>
      }
    >
      <div className="mm-form">
        <label className="mm-field">
          <span>Amount received</span>
          <input className="mm-input mm-input-lg" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" autoFocus />
        </label>
        <div className="mm-grid2">
          <label className="mm-field">
            <span>Description</span>
            <input className="mm-input" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={120} />
          </label>
          <label className="mm-field">
            <span>Date</span>
            <input className="mm-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
        </div>

        {rows.map((row, index) => (
          <div key={row.id} className="mm-split-row">
            <LocationPicker
              snap={snap}
              label={index === 0 ? "Lands in" : `Split ${index + 1}`}
              value={row.destination}
              onChange={(destination) => setRows((list) => list.map((item) => (item.id === row.id ? { ...item, destination } : item)))}
            />
            <label className="mm-field mm-split-amount">
              <span>Amount</span>
              <input
                className="mm-input"
                inputMode="decimal"
                value={row.value}
                onChange={(event) => setRows((list) => list.map((item) => (item.id === row.id ? { ...item, value: event.target.value } : item)))}
              />
            </label>
          </div>
        ))}

        <div className="mm-split-controls">
          <button
            type="button"
            className="mm-link"
            onClick={() => setRows((list) => [...list, { id: `r${Date.now()}`, destination: first ? { accountId: first.id, pocketId: null } : null, value: "0" }])}
          >
            + Split into another place
          </button>
          {remaining > 0 ? (
            <button type="button" className="mm-link" onClick={() => setRows((list) => list.map((row, index) => (index === 0 ? { ...row, value: (((parseEuroToCents(row.value) ?? 0) + remaining) / 100).toFixed(2) } : row)))}>
              Put remaining {formatEUR(remaining)} in first
            </button>
          ) : null}
        </div>

        <div className={`mm-remaining${remaining < 0 ? " is-over" : remaining === 0 && total > 0 ? " is-done" : ""}`}>
          <span>{remaining < 0 ? "Over by" : "Unallocated"}</span>
          <strong>{formatEUR(Math.abs(remaining))}</strong>
        </div>

        <div className="mm-split-controls">
          <button type="button" className="mm-link" onClick={saveTemplate}>
            Save this split
          </button>
          <button type="button" className="mm-link" onClick={loadTemplate}>
            Use saved split
          </button>
        </div>
        {templateSaved ? <p className="mm-caption">Saved with your data for next time.</p> : null}
        <p className="mm-caption">The arrival is counted once. Moving parts into pockets is an internal transfer.</p>
        <ErrorLine message={error} />
      </div>
    </Sheet>
  );
}
