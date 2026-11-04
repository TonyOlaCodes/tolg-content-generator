"use client";

import { useState } from "react";
import { defaultCtx, saveRecurring } from "@/money/actions";
import {
  billPaidCents,
  billRemainingCents,
  billSource,
  payBill as payBillAction,
  receiveScheduled,
  type Location,
} from "@/money/banking";
import { formatDateIE, formatEUR, parseEuroToCents, todayISO } from "@/money/money";
import type { Recurring } from "@/money/types";
import type { MoneyApi } from "./MoneyApp";
import { ErrorLine, LocationPicker, Sheet, useSaving } from "./ui";

const INTERVALS: { id: Recurring["interval"]; label: string }[] = [
  { id: "once", label: "One time" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
  { id: "weekly", label: "Weekly" },
  { id: "custom", label: "Every N days" },
];

export function BillEditor({
  api,
  kind,
  existing,
  onClose,
  notify,
}: {
  api: MoneyApi;
  kind: "bill" | "income";
  existing?: Recurring;
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const { snap } = api;
  const accounts = snap.accounts.filter((a) => !a.archived);
  const defaultAccount = existing?.accountId ?? accounts[0]?.id ?? "";
  const [name, setName] = useState(existing?.name ?? "");
  const [amount, setAmount] = useState(existing ? (existing.amountCents / 100).toFixed(2) : "");
  const [interval, setInterval] = useState<Recurring["interval"]>(existing?.interval ?? "monthly");
  const [customDays, setCustomDays] = useState(existing?.customDays ? String(existing.customDays) : "30");
  const [nextDue, setNextDue] = useState(existing?.nextDue ?? todayISO());
  const [source, setSource] = useState<Location | null>(
    existing?.accountId ? { accountId: existing.accountId, pocketId: existing.pocketId ?? null } : defaultAccount ? { accountId: defaultAccount, pocketId: null } : null,
  );
  const { busy, error, setError, run } = useSaving();

  const save = async () => {
    const cents = parseEuroToCents(amount);
    if (!source) return setError("Choose where it is paid from.");
    if (cents === null || cents <= 0) return setError("Enter an amount above zero.");
    if (interval === "custom" && !(Number(customDays) > 0)) return setError("Enter a number of days.");
    const discount = existing?.notes ?? "";
    const ok = await run(() =>
      api.commit(
        saveRecurring(
          snap,
          {
            id: existing?.id,
            kind,
            name,
            icon: existing?.icon ?? (kind === "bill" ? "↻" : "↓"),
            amountCents: cents,
            interval,
            customDays: interval === "custom" ? Number(customDays) : null,
            dayOfMonth: Number(nextDue.slice(8, 10)) || 1,
            nextDue,
            categoryId: existing?.categoryId ?? null,
            accountId: source.accountId,
            pocketId: source.pocketId,
            notes: discount,
          },
          defaultCtx(),
        ),
      ),
    );
    if (ok) {
      notify(existing ? "Updated" : kind === "bill" ? "Bill added" : "Incoming money scheduled");
      onClose();
    }
  };

  return (
    <Sheet
      title={existing ? `Edit ${kind === "bill" ? "bill" : "incoming"}` : kind === "bill" ? "New bill" : "Scheduled incoming"}
      onClose={onClose}
      footer={
        <button type="button" className="mm-primary mm-wide" disabled={busy || !name.trim()} onClick={() => void save()}>
          {busy ? "Saving…" : existing ? "Save changes" : kind === "bill" ? "Add bill" : "Schedule money"}
        </button>
      }
    >
      <div className="mm-form">
        <label className="mm-field">
          <span>Name</span>
          <input className="mm-input" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder={kind === "bill" ? "ChatGPT, rent, phone…" : "Salary, allowance, refund…"} autoFocus />
        </label>
        <div className="mm-grid2">
          <label className="mm-field">
            <span>Amount</span>
            <input className="mm-input" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />
          </label>
          <label className="mm-field">
            <span>Repeats</span>
            <select className="mm-input" value={interval} onChange={(event) => setInterval(event.target.value as Recurring["interval"])}>
              {INTERVALS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {interval === "custom" ? (
          <label className="mm-field">
            <span>Every how many days?</span>
            <input className="mm-input" inputMode="numeric" value={customDays} onChange={(event) => setCustomDays(event.target.value)} />
          </label>
        ) : null}
        <label className="mm-field">
          <span>{existing ? "Next date" : kind === "bill" ? "First due date" : "Expected date"}</span>
          <input className="mm-input" type="date" value={nextDue} onChange={(event) => setNextDue(event.target.value)} />
        </label>
        <LocationPicker
          snap={snap}
          label={kind === "bill" ? "Pay from" : "Expected into"}
          value={source}
          onChange={setSource}
        />
        <p className="mm-caption">
          {kind === "bill"
            ? "This is the default source. Any individual payment can use another account or pocket without changing it."
            : "Expected money is not added to your balance until you mark it received."}
        </p>
        <ErrorLine message={error} />
      </div>
    </Sheet>
  );
}

export function PayBillSheet({
  api,
  billId,
  onClose,
  notify,
}: {
  api: MoneyApi;
  billId: string;
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const { snap, commit } = api;
  const bill = snap.recurring.find((r) => r.id === billId);
  const remaining = bill ? billRemainingCents(snap, bill) : 0;
  const paid = bill ? billPaidCents(snap, bill) : 0;
  const [amount, setAmount] = useState((remaining / 100).toFixed(2));
  const [source, setSource] = useState<Location | null>(bill ? billSource(snap, bill) : null);
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const { busy, error, setError, run } = useSaving();
  if (!bill) return null;
  const cents = parseEuroToCents(amount) ?? 0;

  const submit = async () => {
    if (!source) return setError("Choose the account or pocket to pay from.");
    if (cents <= 0) return setError("Enter an amount above zero.");
    if (cents > remaining) return setError(`Only ${formatEUR(remaining)} remains on this bill.`);
    const ok = await run(() =>
      commit(
        // Imported lazily below to keep the sheet's imports grouped with its siblings.
        payBillAction(snap, { billId, amountCents: cents, date, accountId: source.accountId, pocketId: source.pocketId, note }, defaultCtx()),
      ),
    );
    if (ok) {
      notify(cents >= remaining ? `${bill!.name} paid` : `Part payment recorded for ${bill!.name}`);
      onClose();
    }
  };

  return (
    <Sheet
      title="Pay bill"
      kicker={bill.name}
      onClose={onClose}
      footer={
        <button type="button" className="mm-primary mm-wide" disabled={busy || cents <= 0 || cents > remaining} onClick={() => void submit()}>
          {busy ? "Saving…" : `Pay ${formatEUR(cents)}`}
        </button>
      }
    >
      <div className="mm-form">
        <div className="mm-bill-summary">
          <span>
            Total <strong>{formatEUR(bill.amountCents)}</strong>
          </span>
          <span>
            Paid <strong>{formatEUR(paid)}</strong>
          </span>
          <span>
            Remaining <strong>{formatEUR(remaining)}</strong>
          </span>
        </div>
        <label className="mm-field">
          <span>Amount to pay now</span>
          <input className="mm-input mm-input-lg" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </label>
        <div className="mm-quick">
          {[remaining, Math.round(remaining / 2)].filter((value, index, list) => value > 0 && list.indexOf(value) === index).map((value) => (
            <button key={value} type="button" className="mm-chip" onClick={() => setAmount((value / 100).toFixed(2))}>
              {value === remaining ? "Full" : "Half"} {formatEUR(value)}
            </button>
          ))}
        </div>
        <LocationPicker snap={snap} label="Pay from" value={source} onChange={setSource} />
        <label className="mm-field">
          <span>Date</span>
          <input className="mm-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="mm-field">
          <span>Note (optional)</span>
          <input className="mm-input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional" maxLength={120} />
        </label>
        <p className="mm-caption">
          Paying early or part of the bill is fine. Only this payment leaves your balance, once. The bill&apos;s default source stays the same.
        </p>
        <ErrorLine message={error} />
      </div>
    </Sheet>
  );
}


export function ReceiveSheet({
  api,
  recurringId,
  onClose,
  notify,
}: {
  api: MoneyApi;
  recurringId: string;
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const { snap, commit } = api;
  const rec = snap.recurring.find((r) => r.id === recurringId);
  const defaultDest = rec ? billSource(snap, rec) : null;
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<{ id: string; destination: Location | null; value: string }[]>(() => [
    { id: "r1", destination: defaultDest, value: rec ? (rec.amountCents / 100).toFixed(2) : "" },
  ]);
  const { busy, error, setError, run } = useSaving();

  if (!rec) return null;
  const total = rec.amountCents;
  const allocated = rows.reduce((sum, row) => sum + (parseEuroToCents(row.value) ?? 0), 0);
  const remaining = total - allocated;

  const submit = async () => {
    if (remaining !== 0) return setError("The split must add up to the full amount.");
    if (rows.some((row) => !row.destination)) return setError("Choose where each part arrived.");
    const ok = await run(() =>
      commit(
        receiveScheduled(
          snap,
          {
            recurringId,
            date,
            lines: rows.map((row) => ({ ...row.destination!, cents: parseEuroToCents(row.value) ?? 0 })),
          },
          defaultCtx(),
        ),
      ),
    );
    if (ok) {
      notify("Incoming money received");
      onClose();
    }
  };

  return (
    <Sheet
      title="Mark received"
      kicker={`${rec.name} · ${formatEUR(total)}`}
      onClose={onClose}
      footer={
        <button type="button" className="mm-primary mm-wide" disabled={busy || remaining !== 0} onClick={() => void submit()}>
          {busy ? "Saving…" : `Receive ${formatEUR(total)}`}
        </button>
      }
    >
      <div className="mm-form">
        <label className="mm-field">
          <span>Date received</span>
          <input className="mm-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        {rows.map((row, index) => (
          <div key={row.id} className="mm-split-row">
            <LocationPicker
              snap={snap}
              label={index === 0 ? "Received into" : `Split ${index + 1}`}
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
            onClick={() => setRows((list) => [...list, { id: `r${Date.now()}`, destination: defaultDest, value: "0" }])}
          >
            + Split into another place
          </button>
          {rows.length > 1 ? (
            <button type="button" className="mm-link" onClick={() => setRows((list) => list.slice(0, -1))}>
              Remove last split
            </button>
          ) : null}
        </div>
        <div className={`mm-remaining${remaining < 0 ? " is-over" : remaining === 0 ? " is-done" : ""}`}>
          <span>{remaining < 0 ? "Over by" : "Unallocated"}</span>
          <strong>{formatEUR(Math.abs(remaining))}</strong>
        </div>
        <p className="mm-caption">
          {formatDateIE(rec.nextDue)} · Expected money only affects your balance after you confirm it here.
        </p>
        <ErrorLine message={error} />
      </div>
    </Sheet>
  );
}
