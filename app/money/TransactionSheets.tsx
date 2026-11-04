"use client";

import { useMemo, useState } from "react";
import {
  confirmPlannedTransaction,
  defaultCtx,
  deleteTransaction,
  reverseTransaction,
} from "@/money/actions";
import {
  editTransaction,
  recordRefund,
  refundableCents,
  type Location,
} from "@/money/banking";
import { formatDateIE, formatEUR, parseEuroToCents, todayISO } from "@/money/money";
import type { Transaction } from "@/money/types";
import type { MoneyApi } from "./MoneyApp";
import { ErrorLine, KIND_LABEL, LocationPicker, Sheet, TransactionRow, cashDelta, useSaving } from "./ui";
import type { HistoryFilter } from "./AccountsPage";

export function TransactionSheet({
  api,
  txId,
  onClose,
  notify,
  onRefund,
  onOpenTransaction,
  onOpenLoan,
}: {
  api: MoneyApi;
  txId: string;
  onClose: () => void;
  notify: (message: string) => void;
  onRefund: (tx: Transaction) => void;
  onOpenTransaction: (id: string) => void;
  onOpenLoan: (id: string) => void;
}) {
  const { snap, commit } = api;
  const tx = snap.transactions.find((t) => t.id === txId);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(tx ? (tx.amountCents / 100).toFixed(2) : "");
  const [date, setDate] = useState(tx?.date ?? "");
  const [description, setDescription] = useState(tx?.description ?? "");
  const [notes, setNotes] = useState(tx?.notes ?? "");
  const [categoryId, setCategoryId] = useState(tx?.categoryId ?? "");
  const [source, setSource] = useState<Location | null>(tx?.accountId ? { accountId: tx.accountId, pocketId: tx.pocketId } : null);
  const { busy, error, setError, run } = useSaving();

  if (!tx) return null;
  const account = snap.accounts.find((a) => a.id === tx.accountId);
  const pocket = tx.pocketId ? snap.pockets.find((p) => p.id === tx.pocketId) : null;
  const destination = tx.kind === "transfer" ? snap.accounts.find((a) => a.id === tx.toAccountId) : null;
  const destinationPocket = tx.toPocketId ? snap.pockets.find((p) => p.id === tx.toPocketId) : null;
  const delta = cashDelta(tx);
  const refundable = tx.kind === "expense" ? refundableCents(snap, tx.id) : 0;
  const immutable = tx.reverses || !!tx.reversedBy;
  const originals = snap.transactions.filter((t) => t.refundOf === tx.id && !t.reverses);

  const saveEdit = async () => {
    const cents = parseEuroToCents(amount);
    if (cents === null) return setError("Enter a valid amount.");
    if (tx.kind !== "adjustment" && cents <= 0) return setError("Enter an amount above zero.");
    if (!source) return setError("Choose an account or pocket.");
    const ok = await run(() =>
      commit(
        editTransaction(
          snap,
          tx.id,
          {
            amountCents: tx.kind === "adjustment" ? cents : Math.abs(cents),
            date,
            description,
            notes,
            categoryId: categoryId || null,
            accountId: source.accountId,
            pocketId: source.pocketId,
          },
          defaultCtx(),
        ),
      ),
    );
    if (ok) {
      notify("Transaction updated");
      setEditing(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${tx.description}"? Its effect on balances will be removed.`)) return;
    const ok = await run(() => commit(deleteTransaction(snap, tx.id, defaultCtx())));
    if (ok) {
      notify("Transaction deleted");
      onClose();
    }
  };

  const reverse = async () => {
    if (!window.confirm(`Reverse "${tx.description}"? The original stays in history and a linked reversal is recorded.`)) return;
    const ok = await run(() => commit(reverseTransaction(snap, tx.id, defaultCtx())));
    if (ok) {
      notify("Transaction reversed");
      onClose();
    }
  };

  const confirmPlanned = async () => {
    const ok = await run(() => commit(confirmPlannedTransaction(snap, tx.id, defaultCtx())));
    if (ok) notify("Transaction confirmed");
  };

  return (
    <Sheet
      title={tx.description}
      kicker={KIND_LABEL[tx.kind]}
      onClose={onClose}
      footer={
        editing ? (
          <div className="mm-footer-row">
            <button type="button" className="mm-ghost-btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="button" className="mm-primary" disabled={busy} onClick={() => void saveEdit()}>
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="mm-form">
        <div className={`mm-tx-detail-amount${delta !== null && delta < 0 ? " is-neg" : delta !== null && delta > 0 ? " is-pos" : ""}`}>
          {delta === null ? formatEUR(tx.amountCents) : `${delta < 0 ? "−" : delta > 0 ? "+" : ""}${formatEUR(Math.abs(delta))}`}
          <span>{tx.kind === "transfer" ? "moved" : ""}</span>
        </div>

        {!editing ? (
          <>
            <dl className="mm-detail-list">
              <div>
                <dt>Date</dt>
                <dd>{formatDateIE(tx.date)}</dd>
              </div>
              <div>
                <dt>{tx.kind === "transfer" ? "From" : "Account"}</dt>
                <dd>{account?.name ?? "—"} · {pocket?.name ?? "Main"}</dd>
              </div>
              {tx.kind === "transfer" ? (
                <div>
                  <dt>To</dt>
                  <dd>{destination?.name ?? "—"} · {destinationPocket?.name ?? "Main"}</dd>
                </div>
              ) : null}
              {tx.categoryId ? (
                <div>
                  <dt>Label</dt>
                  <dd>{snap.categories.find((c) => c.id === tx.categoryId)?.name ?? "—"}</dd>
                </div>
              ) : null}
              {tx.notes ? (
                <div>
                  <dt>Note</dt>
                  <dd>{tx.notes}</dd>
                </div>
              ) : null}
              <div>
                <dt>Status</dt>
                <dd>{tx.status === "planned" ? "Planned" : immutable ? "Reversed" : "Confirmed"}</dd>
              </div>
            </dl>

            {originals.length > 0 ? (
              <div className="mm-section">
                <p className="mm-kicker">Refunds</p>
                <ul className="mm-mini-list">
                  {originals.map((refund) => (
                    <li key={refund.id}>
                      <button type="button" className="mm-mini-row is-button" onClick={() => onOpenTransaction(refund.id)}>
                        <span className="mm-mini-main">
                          <strong>{refund.description}</strong>
                          <em>{formatDateIE(refund.date)}</em>
                        </span>
                        <span className="mm-mini-amount">{formatEUR(refund.amountCents)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {tx.refundOf ? (
              <button type="button" className="mm-link" onClick={() => onOpenTransaction(tx.refundOf!)}>
                View original payment
              </button>
            ) : null}
            {tx.loanId ? (
              <button type="button" className="mm-link" onClick={() => onOpenLoan(tx.loanId!)}>
                View linked IOU
              </button>
            ) : null}

            {refundable > 0 ? (
              <button type="button" className="mm-secondary mm-wide" onClick={() => onRefund(tx)}>
                Record refund · {formatEUR(refundable)} available
              </button>
            ) : null}

            {tx.status === "planned" ? (
              <button type="button" className="mm-primary mm-wide" disabled={busy} onClick={() => void confirmPlanned()}>
                Confirm planned payment
              </button>
            ) : null}

            {!immutable && tx.status === "confirmed" ? (
              <div className="mm-tx-actions">
                <button type="button" className="mm-link" onClick={() => setEditing(true)}>
                  Edit
                </button>
                <button type="button" className="mm-link" onClick={() => void reverse()}>
                  Reverse
                </button>
                <button type="button" className="mm-link is-danger" onClick={() => void remove()}>
                  Delete
                </button>
              </div>
            ) : null}
            {tx.status === "planned" ? (
              <div className="mm-tx-actions">
                <button type="button" className="mm-link is-danger" onClick={() => void remove()}>
                  Delete
                </button>
              </div>
            ) : null}
            <p className="mm-error">{error}</p>
          </>
        ) : (
          <>
            <div className="mm-grid2">
              <label className="mm-field">
                <span>Amount</span>
                <input className="mm-input" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
              </label>
              <label className="mm-field">
                <span>Date</span>
                <input className="mm-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </label>
            </div>
            <label className="mm-field">
              <span>Description</span>
              <input className="mm-input" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={120} />
            </label>
            {source ? (
              <LocationPicker
                snap={snap}
                label={tx.kind === "transfer" ? "Move from" : "Account or pocket"}
                value={source}
                onChange={setSource}
              />
            ) : null}
            <label className="mm-field">
              <span>Label (optional)</span>
              <select className="mm-input" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">None</option>
                {snap.categories.filter((c) => !c.archived).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mm-field">
              <span>Note</span>
              <input className="mm-input" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} />
            </label>
            <p className="mm-caption">Changing the source moves the whole balance effect to that account or pocket.</p>
            <p className="mm-error">{error}</p>
          </>
        )}
      </div>
    </Sheet>
  );
}

export function HistorySheet({
  api,
  filter,
  onClose,
  onOpenTransaction,
}: {
  api: MoneyApi;
  filter: HistoryFilter;
  onClose: () => void;
  onOpenTransaction: (id: string) => void;
}) {
  const { snap } = api;
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "in" | "out" | "transfers" | "loans">("all");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const accountName = (id: string | null) => snap.accounts.find((a) => a.id === id)?.name ?? "";
    const list = snap.transactions
      .filter((tx) => (filter?.accountId ? tx.accountId === filter.accountId || tx.toAccountId === filter.accountId : true))
      .filter((tx) => (filter?.pocketId ? tx.pocketId === filter.pocketId || tx.toPocketId === filter.pocketId : true))
      .filter((tx) => {
        if (kind === "in") return ["income", "refund", "borrow", "loan_repayment"].includes(tx.kind);
        if (kind === "out") return ["expense", "lend", "debt_repayment"].includes(tx.kind);
        if (kind === "transfers") return tx.kind === "transfer";
        if (kind === "loans") return ["lend", "borrow", "loan_repayment", "debt_repayment"].includes(tx.kind);
        return true;
      })
      .filter((tx) => {
        if (!q) return true;
        return (
          tx.description.toLowerCase().includes(q) ||
          accountName(tx.accountId).toLowerCase().includes(q) ||
          String(tx.amountCents / 100).includes(q)
        );
      })
      .sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1));
    const map = new Map<string, Transaction[]>();
    for (const tx of list) {
      const bucket = map.get(tx.date);
      if (bucket) bucket.push(tx);
      else map.set(tx.date, [tx]);
    }
    return Array.from(map.entries());
  }, [snap, filter, query, kind]);

  return (
    <Sheet title="Transactions" kicker={filter?.title ?? "Everything"} onClose={onClose} tall>
      <div className="mm-form">
        {filter ? (
          <p className="mm-caption">
            Showing {filter.pocketId ? "this pocket" : "this account"} only. All values are real euro amounts.
          </p>
        ) : null}
        <input
          className="mm-input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search description, account or amount"
          aria-label="Search transactions"
        />
        <div className="mm-chips">
          {([
            ["all", "All"],
            ["in", "In"],
            ["out", "Out"],
            ["transfers", "Transfers"],
            ["loans", "Loans"],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" className={`mm-chip${kind === value ? " is-active" : ""}`} onClick={() => setKind(value)}>
              {label}
            </button>
          ))}
        </div>
        {groups.length === 0 ? (
          <p className="mm-caption">No transactions match.</p>
        ) : (
          groups.map(([date, items]) => (
            <section key={date} className="mm-day">
              <h3 className="mm-day-head">{formatDateIE(date)}</h3>
              <ul className="mm-tx-list">
                {items.map((tx) => (
                  <li key={tx.id}>
                    <TransactionRow snap={snap} tx={tx} onClick={() => onOpenTransaction(tx.id)} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </Sheet>
  );
}

export function RefundPickerSheet({
  api,
  onPick,
  onClose,
}: {
  api: MoneyApi;
  onPick: (tx: Transaction) => void;
  onClose: () => void;
}) {
  const { snap } = api;
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const expenses = snap.transactions
    .filter((tx) => tx.kind === "expense" && tx.status === "confirmed" && !tx.reverses && !tx.reversedBy)
    .filter((tx) => refundableCents(snap, tx.id) > 0)
    .filter((tx) => !q || tx.description.toLowerCase().includes(q))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 50);

  return (
    <Sheet title="Record refund" kicker="Choose the original payment" onClose={onClose}>
      <div className="mm-form">
        <input className="mm-input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search payments" aria-label="Search payments" />
        {expenses.length === 0 ? (
          <p className="mm-caption">No refundable payments. A refund must be linked to a recorded payment.</p>
        ) : (
          <ul className="mm-mini-list">
            {expenses.map((tx) => (
              <li key={tx.id}>
                <button type="button" className="mm-mini-row is-button" onClick={() => onPick(tx)}>
                  <span className="mm-mini-main">
                    <strong>{tx.description}</strong>
                    <em>
                      {formatDateIE(tx.date)} · {formatEUR(refundableCents(snap, tx.id))} refundable
                    </em>
                  </span>
                  <span className="mm-mini-amount">{formatEUR(tx.amountCents)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}

export function RefundSheet({
  api,
  originalId,
  onClose,
  notify,
}: {
  api: MoneyApi;
  originalId: string;
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const { snap, commit } = api;
  const original = snap.transactions.find((tx) => tx.id === originalId);
  const available = original ? refundableCents(snap, original.id) : 0;
  const [amount, setAmount] = useState((available / 100).toFixed(2));
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [destination, setDestination] = useState<Location | null>(
    original?.accountId ? { accountId: original.accountId, pocketId: original.pocketId } : null,
  );
  const { busy, error, setError, run } = useSaving();
  if (!original) return null;
  const cents = parseEuroToCents(amount) ?? 0;

  const submit = async () => {
    if (!destination) return setError("Choose where the refund arrived.");
    if (cents <= 0) return setError("Enter an amount above zero.");
    if (cents > available) return setError(`Only ${formatEUR(available)} can still be refunded.`);
    const ok = await run(() =>
      commit(
        recordRefund(
          snap,
          { originalId, amountCents: cents, date, accountId: destination.accountId, pocketId: destination.pocketId, note },
          defaultCtx(),
        ),
      ),
    );
    if (ok) {
      notify("Refund recorded");
      onClose();
    }
  };

  return (
    <Sheet
      title="Refund"
      kicker={original.description}
      onClose={onClose}
      footer={
        <button type="button" className="mm-primary mm-wide" disabled={busy || cents <= 0} onClick={() => void submit()}>
          {busy ? "Saving…" : `Refund ${formatEUR(cents)}`}
        </button>
      }
    >
      <div className="mm-form">
        <div className="mm-bill-summary">
          <span>
            Original <strong>{formatEUR(original.amountCents)}</strong>
          </span>
          <span>
            Available <strong>{formatEUR(available)}</strong>
          </span>
        </div>
        <label className="mm-field">
          <span>Refund amount</span>
          <input className="mm-input mm-input-lg" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </label>
        <div className="mm-quick">
          <button type="button" className="mm-chip" onClick={() => setAmount((available / 100).toFixed(2))}>
            Full {formatEUR(available)}
          </button>
          <button type="button" className="mm-chip" onClick={() => setAmount((Math.round(available / 2) / 100).toFixed(2))}>
            Half {formatEUR(Math.round(available / 2))}
          </button>
        </div>
        <LocationPicker snap={snap} label="Refund into" value={destination} onChange={setDestination} />
        <label className="mm-field">
          <span>Refund date</span>
          <input className="mm-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="mm-field">
          <span>Description (optional)</span>
          <input className="mm-input" value={note} onChange={(event) => setNote(event.target.value)} maxLength={120} placeholder="Optional" />
        </label>
        <p className="mm-caption">The refund credits one place once and stays linked to the original payment. Over-refunding is blocked.</p>
        <ErrorLine message={error} />
      </div>
    </Sheet>
  );
}
