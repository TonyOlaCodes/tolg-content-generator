"use client";

import { useState } from "react";
import { defaultCtx } from "@/money/actions";
import {
  loanOutstandingCents,
  repayLoan,
  saveLoan,
  type Location,
} from "@/money/banking";
import { formatDateIE, formatEUR, parseEuroToCents, todayISO } from "@/money/money";
import type { Loan } from "@/money/types";
import type { MoneyApi } from "./MoneyApp";
import { ErrorLine, LocationPicker, Sheet, TransactionRow, useSaving } from "./ui";

export function LoansSheet({
  api,
  onAdd,
  onOpen,
  onClose,
}: {
  api: MoneyApi;
  onAdd: (direction: Loan["direction"]) => void;
  onOpen: (loanId: string) => void;
  onClose: () => void;
}) {
  const { snap } = api;
  const [filter, setFilter] = useState<"all" | Loan["direction"]>("all");
  const loans = snap.loans
    .filter((loan) => filter === "all" || loan.direction === filter)
    .sort((a, b) => (a.direction < b.direction ? -1 : a.date < b.date ? 1 : -1));
  const lent = snap.loans.filter((loan) => loan.direction === "lent").reduce((sum, loan) => sum + loanOutstandingCents(snap, loan), 0);
  const borrowed = snap.loans.filter((loan) => loan.direction === "borrowed").reduce((sum, loan) => sum + loanOutstandingCents(snap, loan), 0);

  return (
    <Sheet title="Loans & IOUs" onClose={onClose}>
      <div className="mm-form">
        <div className="mm-loan-summary">
          <div>
            <span>Owed to me</span>
            <strong>{formatEUR(lent)}</strong>
          </div>
          <div>
            <span>I owe</span>
            <strong>{formatEUR(borrowed)}</strong>
          </div>
        </div>
        <div className="mm-actions is-compact">
          <button type="button" className="mm-action" onClick={() => onAdd("lent")}>
            <span aria-hidden>→</span>Lend
          </button>
          <button type="button" className="mm-action" onClick={() => onAdd("borrowed")}>
            <span aria-hidden>←</span>Borrow
          </button>
        </div>
        <div className="mm-chips">
          {(["all", "lent", "borrowed"] as const).map((value) => (
            <button key={value} type="button" className={`mm-chip${filter === value ? " is-active" : ""}`} onClick={() => setFilter(value)}>
              {value === "all" ? "All" : value === "lent" ? "Lent out" : "Borrowed"}
            </button>
          ))}
        </div>
        {loans.length === 0 ? (
          <p className="mm-caption">No IOUs yet. Money you lend is removed from cash and tracked separately. Borrowed money is added to cash with a debt.</p>
        ) : (
          <ul className="mm-mini-list">
            {loans.map((loan) => {
              const outstanding = loanOutstandingCents(snap, loan);
              return (
                <li key={loan.id}>
                  <button type="button" className="mm-mini-row is-button" onClick={() => onOpen(loan.id)}>
                    <span className="mm-account-mark" aria-hidden>
                      {loan.direction === "lent" ? "→" : "←"}
                    </span>
                    <span className="mm-mini-main">
                      <strong>{loan.person}</strong>
                      <em>
                        {loan.direction === "lent" ? "Owes me" : "I owe"} · {formatDateIE(loan.date)}
                        {loan.dueDate ? ` · due ${formatDateIE(loan.dueDate)}` : ""}
                      </em>
                    </span>
                    <span className={`mm-mini-amount${outstanding === 0 ? " is-settled" : ""}`}>
                      {outstanding === 0 ? "Settled" : formatEUR(outstanding)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Sheet>
  );
}

export function LoanEditor({
  api,
  direction,
  onClose,
  notify,
}: {
  api: MoneyApi;
  direction: Loan["direction"];
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const { snap } = api;
  const first = snap.accounts.find((a) => !a.archived);
  const [person, setPerson] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState("");
  const [location, setLocation] = useState<Location | null>(first ? { accountId: first.id, pocketId: null } : null);
  const [note, setNote] = useState("");
  const { busy, error, setError, run } = useSaving();
  const lent = direction === "lent";

  const submit = async () => {
    const cents = parseEuroToCents(amount);
    if (!person.trim()) return setError("Add the person's name.");
    if (cents === null || cents <= 0) return setError("Enter an amount above zero.");
    if (!location) return setError("Choose an account or pocket.");
    const ok = await run(() =>
      api.commit(
        saveLoan(
          snap,
          {
            direction,
            person,
            amountCents: cents,
            date,
            accountId: location.accountId,
            pocketId: location.pocketId,
            dueDate: dueDate || null,
            notes: note,
          },
          defaultCtx(),
        ),
      ),
    );
    if (ok) {
      notify(lent ? "Money lent recorded" : "Borrowed money recorded");
      onClose();
    }
  };

  return (
    <Sheet
      title={lent ? "Lend money" : "Borrowed money"}
      onClose={onClose}
      footer={
        <button type="button" className="mm-primary mm-wide" disabled={busy || !person.trim()} onClick={() => void submit()}>
          {busy ? "Saving…" : lent ? "Record loan" : "Record borrowing"}
        </button>
      }
    >
      <div className="mm-form">
        <label className="mm-field">
          <span>Person</span>
          <input className="mm-input" value={person} onChange={(event) => setPerson(event.target.value)} maxLength={60} placeholder="Name" autoFocus />
        </label>
        <label className="mm-field">
          <span>Amount</span>
          <input className="mm-input mm-input-lg" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />
        </label>
        <LocationPicker
          snap={snap}
          label={lent ? "Paid from" : "Money went into"}
          value={location}
          onChange={setLocation}
        />
        <div className="mm-grid2">
          <label className="mm-field">
            <span>{lent ? "Date lent" : "Date borrowed"}</span>
            <input className="mm-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label className="mm-field">
            <span>Expected back (optional)</span>
            <input className="mm-input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </label>
        </div>
        <label className="mm-field">
          <span>Note (optional)</span>
          <input className="mm-input" value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} placeholder="Optional" />
        </label>
        <p className="mm-caption">
          {lent
            ? "This reduces cash now and creates a separate receivable. Repayments are not counted as income."
            : "This adds cash now and creates a separate debt. Repaying it is not counted as spending."}
        </p>
        <ErrorLine message={error} />
      </div>
    </Sheet>
  );
}

export function LoanDetailSheet({
  api,
  loanId,
  onClose,
  notify,
  onOpenTransaction,
}: {
  api: MoneyApi;
  loanId: string;
  onClose: () => void;
  notify: (message: string) => void;
  onOpenTransaction: (id: string) => void;
}) {
  const { snap, commit } = api;
  const loan = snap.loans.find((item) => item.id === loanId);
  const [repaying, setRepaying] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [location, setLocation] = useState<Location | null>(
    snap.accounts.find((a) => !a.archived) ? { accountId: snap.accounts.find((a) => !a.archived)!.id, pocketId: null } : null,
  );
  const [note, setNote] = useState("");
  const { busy, error, setError, run } = useSaving();
  if (!loan) return null;

  const outstanding = loanOutstandingCents(snap, loan);
  const lent = loan.direction === "lent";
  const movements = snap.transactions
    .filter((tx) => tx.loanId === loan.id && tx.status === "confirmed")
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const submit = async () => {
    const cents = parseEuroToCents(amount);
    if (!location) return setError("Choose an account or pocket.");
    if (cents === null || cents <= 0) return setError("Enter an amount above zero.");
    if (cents > outstanding) return setError(`Only ${formatEUR(outstanding)} remains.`);
    const ok = await run(() =>
      commit(
        repayLoan(
          snap,
          { loanId, amountCents: cents, date, accountId: location.accountId, pocketId: location.pocketId, note },
          defaultCtx(),
        ),
      ),
    );
    if (ok) {
      notify(lent ? "Repayment received" : "Repayment recorded");
      setRepaying(false);
      setAmount("");
      setNote("");
    }
  };

  return (
    <Sheet
      title={loan.person}
      kicker={lent ? "Money I lent" : "Money I borrowed"}
      onClose={onClose}
      footer={
        outstanding > 0 ? (
          <button type="button" className="mm-primary mm-wide" onClick={() => setRepaying((v) => !v)}>
            {repaying ? "Close repayment" : lent ? "Record repayment received" : "Record repayment"}
          </button>
        ) : undefined
      }
    >
      <div className="mm-form">
        <div className="mm-account-hero">
          <p className="mm-balance">{outstanding === 0 ? "Settled" : formatEUR(outstanding)}</p>
          <p className="mm-caption">
            {lent ? "Owed to me" : "I owe"} · {formatEUR(loan.principalCents)} original
          </p>
        </div>
        <dl className="mm-detail-list">
          <div>
            <dt>{lent ? "Lent on" : "Borrowed on"}</dt>
            <dd>{formatDateIE(loan.date)}</dd>
          </div>
          {loan.dueDate ? (
            <div>
              <dt>Expected back</dt>
              <dd>{formatDateIE(loan.dueDate)}</dd>
            </div>
          ) : null}
          {loan.notes ? (
            <div>
              <dt>Note</dt>
              <dd>{loan.notes}</dd>
            </div>
          ) : null}
        </dl>

        {repaying && outstanding > 0 ? (
          <div className="mm-inline-panel">
            <label className="mm-field">
              <span>Amount repaid</span>
              <input className="mm-input mm-input-lg" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" autoFocus />
            </label>
            <LocationPicker
              snap={snap}
              label={lent ? "Received into" : "Paid from"}
              value={location}
              onChange={setLocation}
            />
            <label className="mm-field">
              <span>Date</span>
              <input className="mm-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <label className="mm-field">
              <span>Note (optional)</span>
              <input className="mm-input" value={note} onChange={(event) => setNote(event.target.value)} maxLength={120} />
            </label>
            <div className="mm-quick">
              <button type="button" className="mm-chip" onClick={() => setAmount((outstanding / 100).toFixed(2))}>
                Full {formatEUR(outstanding)}
              </button>
              <button type="button" className="mm-chip" onClick={() => setAmount((Math.round(outstanding / 2) / 100).toFixed(2))}>
                Half {formatEUR(Math.round(outstanding / 2))}
              </button>
            </div>
            <button type="button" className="mm-primary" disabled={busy} onClick={() => void submit()}>
              {busy ? "Saving…" : "Save repayment"}
            </button>
            <ErrorLine message={error} />
          </div>
        ) : null}

        <div className="mm-section">
          <h3 className="mm-subhead">History</h3>
          {movements.length === 0 ? (
            <p className="mm-caption">No movements yet.</p>
          ) : (
            <ul className="mm-tx-list">
              {movements.map((tx) => (
                <li key={tx.id}>
                  <TransactionRow snap={snap} tx={tx} showDate onClick={() => onOpenTransaction(tx.id)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Sheet>
  );
}
