"use client";

import { useState } from "react";
import {
  saveTransaction,
  recordRefund,
  refundableCents,
  reverseTransaction,
  deleteTransaction,
  defaultCtx,
} from "@/money/actions";
import { formatEUR, formatDateIE, parseEuroToCents, todayISO } from "@/money/money";
import type { Transaction } from "@/money/types";
import type { MoneyApi } from "../MoneyApp";
import { locationLabel, locationOptions } from "../locations";

export function TransactionDetail({
  api,
  tx,
  notify,
  onBack,
}: {
  api: MoneyApi;
  tx: Transaction;
  notify: (m: string) => void;
  onBack: () => void;
}) {
  const { snap, commit } = api;
  const live = snap.transactions.find((t) => t.id === tx.id) ?? tx;
  const [mode, setMode] = useState<"view" | "edit" | "refund">("view");
  const [busy, setBusy] = useState(false);

  const catName = snap.categories.find((c) => c.id === live.categoryId)?.name ?? "Uncategorised";
  const refundable = live.kind === "expense" ? refundableCents(snap, live.id) : 0;
  const inactive = live.reverses || !!live.reversedBy;

  if (mode === "edit" && live.kind === "expense" && !inactive) {
    return (
      <EditExpense
        api={api}
        tx={live}
        notify={notify}
        onCancel={() => setMode("view")}
        onSaved={() => { notify("Expense updated"); setMode("view"); }}
      />
    );
  }

  if (mode === "refund" && live.kind === "expense" && refundable > 0) {
    return (
      <RefundForm
        api={api}
        tx={live}
        maxCents={refundable}
        notify={notify}
        onCancel={() => setMode("view")}
        onSaved={() => { notify("Refund recorded"); setMode("view"); }}
      />
    );
  }

  return (
    <div className="money-page">
      <button type="button" className="money-link" onClick={onBack}>← Back</button>
      <section className="money-hero money-hero-left">
        <p className="money-kicker">{live.kind}</p>
        <p className="money-big">{live.description}</p>
        <p className={`money-balance${live.kind === "expense" ? " is-neg-text" : ""}`}>
          {live.kind === "expense" ? "−" : live.kind === "income" || live.kind === "refund" ? "+" : ""}
          {formatEUR(Math.abs(live.amountCents))}
        </p>
      </section>

      <dl className="money-detail-dl">
        <div><dt>Date</dt><dd>{formatDateIE(live.date)}</dd></div>
        <div><dt>Category</dt><dd>{catName}</dd></div>
        <div><dt>From</dt><dd>{locationLabel(snap, live.accountId, live.pocketId ?? null)}</dd></div>
        {live.notes ? <div><dt>Notes</dt><dd>{live.notes}</dd></div> : null}
        {inactive && <div><dt>Status</dt><dd>{live.reverses ? "Reversal" : "Reversed"}</dd></div>}
        {refundable > 0 && live.kind === "expense" && (
          <div><dt>Still refundable</dt><dd>{formatEUR(refundable)}</dd></div>
        )}
      </dl>

      {live.kind === "expense" && live.status === "confirmed" && !inactive && (
        <div className="money-stack">
          <button type="button" className="money-btn-primary" onClick={() => setMode("edit")}>Edit expense</button>
          {refundable > 0 && (
            <button type="button" className="money-btn-secondary" onClick={() => setMode("refund")}>Record refund</button>
          )}
          <button
            type="button"
            className="money-link is-danger"
            disabled={busy}
            onClick={async () => {
              if (!window.confirm(`Reverse "${live.description}"? A linked reversal will be recorded.`)) return;
              setBusy(true);
              const err = await commit(reverseTransaction(snap, live.id, defaultCtx()));
              setBusy(false);
              if (err) return notify(err);
              notify("Reversed");
              onBack();
            }}
          >
            Reverse transaction
          </button>
          <button
            type="button"
            className="money-link is-danger"
            disabled={busy}
            onClick={async () => {
              if (!window.confirm(`Delete "${live.description}"? Its balance effect will be removed.`)) return;
              setBusy(true);
              const err = await commit(deleteTransaction(snap, live.id, defaultCtx()));
              setBusy(false);
              if (err) return notify(err);
              notify("Deleted");
              onBack();
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function EditExpense({
  api,
  tx,
  onCancel,
  onSaved,
}: {
  api: MoneyApi;
  tx: Transaction;
  notify: (m: string) => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { snap, commit } = api;
  const locations = locationOptions(snap);
  const cats = snap.categories.filter((c) => !c.archived && c.kind === "spending");
  const [amount, setAmount] = useState((tx.amountCents / 100).toFixed(2));
  const [description, setDescription] = useState(tx.description);
  const [date, setDate] = useState(tx.date);
  const [categoryId, setCategoryId] = useState(tx.categoryId ?? "");
  const [location, setLocation] = useState(`${tx.accountId ?? ""}|${tx.pocketId ?? ""}`);
  const [notes, setNotes] = useState(tx.notes);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const cents = parseEuroToCents(amount);
    if (cents === null || cents <= 0) return setError("Enter an amount above zero.");
    if (!description.trim()) return setError("Add a description.");
    const [accountId, pocketId] = location.split("|");
    setBusy(true);
    const err = await commit(
      saveTransaction(
        snap,
        {
          id: tx.id,
          kind: "expense",
          status: "confirmed",
          date,
          amountCents: cents,
          accountId,
          pocketId: pocketId || null,
          toAccountId: null,
          categoryId: categoryId || null,
          description: description.trim(),
          notes,
        },
        defaultCtx(),
      ),
    );
    setBusy(false);
    if (err) return setError(err);
    onSaved();
  };

  return (
    <div className="money-page">
      <button type="button" className="money-link" onClick={onCancel}>← Cancel</button>
      <h2 className="money-h2">Edit expense</h2>
      <div className="money-form">
        <label className="money-amount-field">
          <span className="money-sr">Amount</span>
          <span className="money-amount-prefix">€</span>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="money-field"><span>Description</span><input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} /></label>
        <label className="money-field"><span>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="money-field"><span>Category</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Uncategorised</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="money-field"><span>Paid from</span>
          <select value={location} onChange={(e) => setLocation(e.target.value)}>
            {locations.map((o) => <option key={o.value} value={o.value}>{o.label} · {formatEUR(o.balanceCents)}</option>)}
          </select>
        </label>
        <label className="money-field"><span>Notes</span><input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></label>
        {error && <p className="money-error">{error}</p>}
        <button type="button" className="money-btn-primary" disabled={busy} onClick={submit}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function RefundForm({
  api,
  tx,
  maxCents,
  notify,
  onCancel,
  onSaved,
}: {
  api: MoneyApi;
  tx: Transaction;
  maxCents: number;
  notify: (m: string) => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { snap, commit } = api;
  const locations = locationOptions(snap);
  const [amount, setAmount] = useState((maxCents / 100).toFixed(2));
  const [location, setLocation] = useState(`${tx.accountId ?? ""}|${tx.pocketId ?? ""}`);
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  void notify;

  const submit = async () => {
    const cents = parseEuroToCents(amount);
    if (cents === null || cents <= 0) return setError("Enter a refund amount.");
    if (cents > maxCents) return setError("That is more than is still refundable.");
    const [accountId, pocketId] = location.split("|");
    setBusy(true);
    const err = await commit(
      recordRefund(snap, tx.id, cents, defaultCtx(), {
        accountId,
        pocketId: pocketId || null,
        date,
      }),
    );
    setBusy(false);
    if (err) return setError(err);
    onSaved();
  };

  return (
    <div className="money-page">
      <button type="button" className="money-link" onClick={onCancel}>← Cancel</button>
      <h2 className="money-h2">Record refund</h2>
      <p className="money-muted money-small">Up to {formatEUR(maxCents)} of “{tx.description}”</p>
      <div className="money-form">
        <label className="money-amount-field">
          <span className="money-sr">Refund amount</span>
          <span className="money-amount-prefix">€</span>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="money-field"><span>Receive into</span>
          <select value={location} onChange={(e) => setLocation(e.target.value)}>
            {locations.map((o) => <option key={o.value} value={o.value}>{o.label} · {formatEUR(o.balanceCents)}</option>)}
          </select>
        </label>
        <label className="money-field"><span>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        {error && <p className="money-error">{error}</p>}
        <button type="button" className="money-btn-primary" disabled={busy} onClick={submit}>
          {busy ? "Saving…" : "Confirm refund"}
        </button>
      </div>
    </div>
  );
}
