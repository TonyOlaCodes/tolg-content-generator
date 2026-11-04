"use client";

import { useState } from "react";
import { saveTransaction, defaultCtx } from "@/money/actions";
import { locationCents, type Location } from "@/money/banking";
import { formatEUR, parseEuroToCents, todayISO } from "@/money/money";
import type { MoneyApi } from "./MoneyApp";
import { AmountPad, ErrorLine, LocationPicker, Sheet, useSaving } from "./ui";

export type MovementMode = "add" | "send" | "move";

export function MoneySheet({
  api,
  mode,
  initialFrom,
  initialTo,
  onClose,
  notify,
}: {
  api: MoneyApi;
  mode: MovementMode;
  initialFrom?: Location | null;
  initialTo?: Location | null;
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const { snap, commit } = api;
  const accounts = snap.accounts.filter((a) => !a.archived);
  const firstAccount = accounts[0];
  const first: Location | null = initialFrom ?? (firstAccount ? { accountId: firstAccount.id, pocketId: null } : null);
  const allLocations: Location[] = accounts.flatMap((account) => [
    { accountId: account.id, pocketId: null },
    ...snap.pockets.filter((p) => p.accountId === account.id && !p.archived).map((p) => ({ accountId: account.id, pocketId: p.id })),
  ]);
  const second: Location | null =
    initialTo ?? allLocations.find((place) => place.accountId !== first?.accountId || (place.pocketId ?? null) !== (first?.pocketId ?? null)) ?? first;

  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState<Location | null>(first);
  const [to, setTo] = useState<Location | null>(mode === "add" ? first : second);
  const [recipient, setRecipient] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [details, setDetails] = useState(false);
  const [recipients, setRecipients] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(window.localStorage.getItem("money.recipients.v1") ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const { busy, error, setError, run } = useSaving();

  const cents = parseEuroToCents(amount) ?? 0;
  const title = mode === "add" ? "Add money" : mode === "send" ? "Send money" : "Move money";
  const categories = snap.categories.filter((c) => !c.archived);
  const samePlace = !!from && !!to && from.accountId === to.accountId && (from.pocketId ?? null) === (to.pocketId ?? null);

  const swap = () => {
    if (mode !== "move") return;
    setFrom(to);
    setTo(from);
  };

  const submit = async () => {
    if (cents <= 0) return setError("Enter an amount above zero.");
    if (!from && mode !== "add") return setError("Choose where the money comes from.");
    if (!to) return setError("Choose where the money goes.");
    if (mode === "move" && samePlace) return setError("Choose two different places.");
    if (mode === "add" && !to) return setError("Choose where the money arrived.");
    if (mode === "send" && !from) return setError("Choose the account it left.");

    let input;
    if (mode === "move") {
      input = {
        kind: "transfer" as const,
        status: "confirmed" as const,
        date,
        amountCents: cents,
        accountId: from!.accountId,
        pocketId: from!.pocketId,
        toAccountId: to!.accountId,
        toPocketId: to!.pocketId,
        categoryId: null,
        description: note.trim() || "Move",
        notes: "",
      };
    } else if (mode === "add") {
      input = {
        kind: "income" as const,
        status: "confirmed" as const,
        date,
        amountCents: cents,
        accountId: to!.accountId,
        pocketId: to!.pocketId,
        toAccountId: null,
        categoryId: null,
        description: note.trim() || "Money added",
        notes: "",
      };
    } else {
      input = {
        kind: "expense" as const,
        status: "confirmed" as const,
        date,
        amountCents: cents,
        accountId: from!.accountId,
        pocketId: from!.pocketId,
        toAccountId: null,
        categoryId: categoryId || null,
        description: recipient.trim() || note.trim() || "Payment",
        notes: note.trim() && recipient.trim() ? note.trim() : "",
      };
    }

    const ok = await run(() => commit(saveTransaction(snap, input, defaultCtx())));
    if (ok) {
      if (mode === "send" && recipient.trim()) {
        const cleaned = recipient.trim();
        const next = [cleaned, ...recipients.filter((name) => name.toLowerCase() !== cleaned.toLowerCase())].slice(0, 8);
        setRecipients(next);
        try {
          window.localStorage.setItem("money.recipients.v1", JSON.stringify(next));
        } catch {
          /* quick reuse is optional when storage is unavailable */
        }
      }
      notify(mode === "add" ? "Money added" : mode === "send" ? "Payment recorded" : "Money moved");
      onClose();
    }
  };

  const amountText = cents > 0 ? formatEUR(cents) : "";

  return (
    <Sheet
      title={title}
      onClose={onClose}
      tall
      footer={
        <button type="button" className="mm-primary mm-wide" disabled={busy || cents <= 0 || (mode === "move" && samePlace)} onClick={() => void submit()}>
          {busy ? "Saving…" : `${mode === "add" ? "Add" : mode === "send" ? "Send" : "Move"}${amountText ? ` ${amountText}` : ""}`}
        </button>
      }
    >
      <div className="mm-move">
        {mode === "move" ? (
          <>
            <div className="mm-panel mm-panel-from">
              <p className="mm-kicker">From</p>
              <LocationPicker
                snap={snap}
                label="Source"
                value={from}
                onChange={setFrom}
                exclude={(location) => !!to && location.accountId === to.accountId && (location.pocketId ?? null) === (to.pocketId ?? null)}
              />
              <div className="mm-panel-figure">
                <span>Current balance</span>
                <strong className="mm-balance-sm">{from ? formatEUR(locationCents(snap, from)) : "—"}</strong>
                <em className={cents > 0 ? "is-neg" : ""}>{cents > 0 ? `−${amountText}` : "−€0.00"}</em>
              </div>
            </div>

            <button type="button" className="mm-swap" onClick={swap} aria-label="Swap source and destination">
              ↓
            </button>

            <div className="mm-panel mm-panel-to">
              <p className="mm-kicker">To</p>
              <LocationPicker
                snap={snap}
                label="Destination"
                value={to}
                onChange={setTo}
                exclude={(location) => !!from && location.accountId === from.accountId && (location.pocketId ?? null) === (from.pocketId ?? null)}
              />
              <div className="mm-panel-figure">
                <span>Current balance</span>
                <strong className="mm-balance-sm">{to ? formatEUR(locationCents(snap, to)) : "—"}</strong>
                <em className={cents > 0 ? "is-pos" : ""}>{cents > 0 ? `+${amountText}` : "+€0.00"}</em>
              </div>
            </div>
          </>
        ) : mode === "add" ? (
          <div className="mm-panel mm-panel-to">
            <p className="mm-kicker">Add to</p>
            <LocationPicker
              snap={snap}
              label="Destination"
              value={to}
              onChange={setTo}
            />
            <div className="mm-panel-figure">
              <span>Current balance</span>
              <strong className="mm-balance-sm">{to ? formatEUR(locationCents(snap, to)) : "—"}</strong>
              <em className={cents > 0 ? "is-pos" : ""}>{cents > 0 ? `+${amountText}` : "From outside your accounts"}</em>
            </div>
          </div>
        ) : (
          <>
            <div className="mm-panel mm-panel-from">
              <p className="mm-kicker">From</p>
              <LocationPicker
                snap={snap}
                label="Source"
                value={from}
                onChange={setFrom}
              />
              <div className="mm-panel-figure">
                <span>Current balance</span>
                <strong className="mm-balance-sm">{from ? formatEUR(locationCents(snap, from)) : "—"}</strong>
                <em className={cents > 0 ? "is-neg" : ""}>{cents > 0 ? `−${amountText}` : "−€0.00"}</em>
              </div>
            </div>
            <label className="mm-field">
              <span>To (optional)</span>
              <input
                className="mm-input"
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                placeholder="Person, shop or external account"
                maxLength={80}
              />
            </label>
            {recipients.length > 0 ? (
              <div className="mm-chips" aria-label="Frequent recipients">
                {recipients.map((name) => (
                  <button key={name} type="button" className={`mm-chip${recipient === name ? " is-active" : ""}`} onClick={() => setRecipient(name)}>
                    {name}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        )}

        <AmountPad value={amount} onChange={setAmount} />

        <button type="button" className="mm-details-toggle" onClick={() => setDetails((v) => !v)} aria-expanded={details}>
          {details ? "Hide details" : "Add date, note or label"}
        </button>
        {details ? (
          <div className="mm-details">
            <label className="mm-field">
              <span>Note</span>
              <input className="mm-input" value={note} onChange={(event) => setNote(event.target.value)} maxLength={120} placeholder="Optional" />
            </label>
            <label className="mm-field">
              <span>Date</span>
              <input className="mm-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            {mode !== "move" && categories.length > 0 ? (
              <label className="mm-field">
                <span>Label (optional)</span>
                <select className="mm-input" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                  <option value="">None</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ) : null}

        <ErrorLine message={error} />
        {mode === "move" && from ? (
          <p className="mm-caption">Moving between your own places never changes your total money.</p>
        ) : null}
      </div>
    </Sheet>
  );
}
