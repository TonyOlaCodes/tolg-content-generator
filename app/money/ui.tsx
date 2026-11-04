"use client";

import { useState, type ReactNode } from "react";
import { formatDateIE, formatEUR } from "@/money/money";
import type { Snapshot, Transaction } from "@/money/types";
import { balances, type Location } from "@/money/banking";

export function Sheet({
  title,
  kicker,
  onClose,
  children,
  footer,
  tall,
}: {
  title: string;
  kicker?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  tall?: boolean;
}) {
  return (
    <div className="mm-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`mm-sheet${tall ? " is-tall" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mm-grip" aria-hidden />
        <header className="mm-sheet-head">
          <div>
            {kicker ? <p className="mm-kicker">{kicker}</p> : null}
            <h2>{title}</h2>
          </div>
          <button type="button" className="mm-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="mm-sheet-body">{children}</div>
        {footer ? <footer className="mm-sheet-foot">{footer}</footer> : null}
      </div>
    </div>
  );
}

export function useSaving() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => Promise<string | null>): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setError(null);
    const message = await fn();
    setBusy(false);
    if (message) {
      setError(message);
      return false;
    }
    return true;
  }
  return { busy, error, setError, run };
}

export function ErrorLine({ message }: { message: string | null }) {
  return message ? (
    <p className="mm-error" role="alert">
      {message}
    </p>
  ) : null;
}

const encode = (location: Location) => `${location.accountId}|${location.pocketId ?? ""}`;
export const decodeLocation = (value: string): Location => {
  const [accountId, pocketId] = value.split("|");
  return { accountId, pocketId: pocketId || null };
};

export function locationName(snap: Snapshot, location: Location | null): string {
  if (!location) return "Choose";
  const account = snap.accounts.find((a) => a.id === location.accountId);
  const pocket = location.pocketId ? snap.pockets.find((p) => p.id === location.pocketId) : null;
  return pocket ? `${account?.name ?? "Account"} · ${pocket.name}` : `${account?.name ?? "Account"} · Main`;
}

export function LocationPicker({
  snap,
  label,
  value,
  onChange,
  exclude,
}: {
  snap: Snapshot;
  label: string;
  value: Location | null;
  onChange: (location: Location) => void;
  exclude?: (location: Location) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const b = balances(snap);
  const centsAt = (location: Location) =>
    location.pocketId ? (b.pocket[location.pocketId] ?? 0) : (b.main[location.accountId] ?? 0);
  const [query, setQuery] = useState("");
  const accounts = snap.accounts.filter((a) => !a.archived);
  const q = query.trim().toLowerCase();
  const matches = (name: string) => !q || name.toLowerCase().includes(q);
  const options = accounts
    .flatMap((account) => {
      const pockets = snap.pockets.filter((p) => p.accountId === account.id && !p.archived);
      const rows: { location: Location; name: string; sub: string; color: string }[] = [
        { location: { accountId: account.id, pocketId: null }, name: `${account.name} · Main`, sub: account.name, color: "#8b849e" },
        ...pockets.map((p) => ({
          location: { accountId: account.id, pocketId: p.id },
          name: `${account.name} · ${p.name}`,
          sub: p.name,
          color: p.color,
        })),
      ];
      return rows.filter((row) => matches(row.name) && !exclude?.(row.location));
    })
    .slice(0, 80);

  return (
    <div className="mm-location">
      <span className="mm-label">{label}</span>
      <button type="button" className="mm-location-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="mm-location-text">
          <strong>{value ? locationName(snap, value) : "Choose account or pocket"}</strong>
          {value ? <em>{formatEUR(centsAt(value))}</em> : null}
        </span>
        <span aria-hidden className="mm-chevron">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open ? (
        <div className="mm-picker">
          <input
            className="mm-input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search accounts and pockets"
            aria-label={`Search ${label.toLowerCase()}`}
            autoFocus
          />
          <div className="mm-picker-list">
            {options.length === 0 ? <p className="mm-muted">Nothing matches.</p> : null}
            {options.map((option) => {
              const active = value?.accountId === option.location.accountId && value?.pocketId === option.location.pocketId;
              return (
                <button
                  key={encode(option.location)}
                  type="button"
                  className={`mm-picker-row${active ? " is-active" : ""}`}
                  onClick={() => {
                    onChange(option.location);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <span className="mm-avatar" style={{ background: option.color }} aria-hidden />
                  <span className="mm-picker-name">
                    <strong>{option.name}</strong>
                    <em>{option.location.pocketId ? "Pocket" : "Main balance"}</em>
                  </span>
                  <span className="mm-picker-balance">{formatEUR(centsAt(option.location))}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AmountPad({
  value,
  onChange,
  max,
}: {
  value: string;
  onChange: (value: string) => void;
  max?: number;
}) {
  function type(key: string) {
    if (key === "back") {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === ".") {
      if (value.includes(".")) return;
      onChange(value === "" ? "0." : `${value}.`);
      return;
    }
    const [whole, decimals] = value.split(".");
    if (decimals !== undefined && decimals.length >= 2) return;
    if (whole.length >= 7 && decimals === undefined) return;
    const next = `${value}${key}`.replace(/^0+(?=\d)/, "");
    if (max !== undefined && Number(next) > max / 100) return;
    onChange(next);
  }

  return (
    <div className="mm-pad-wrap">
      <label className="mm-amount">
        <span aria-hidden>€</span>
        <input
          inputMode="decimal"
          value={value}
          onChange={(event) => {
            const raw = event.target.value.replace(/[^0-9.]/g, "");
            if (/^\d{0,7}(\.\d{0,2})?$/.test(raw)) onChange(raw);
          }}
          placeholder="0.00"
          aria-label="Amount in euros"
        />
      </label>
      <div className="mm-pad" role="group" aria-label="Number keypad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"].map((key) => (
          <button
            key={key}
            type="button"
            className="mm-pad-key"
            onClick={() => type(key)}
            aria-label={key === "back" ? "Backspace" : key}
          >
            {key === "back" ? "⌫" : key}
          </button>
        ))}
      </div>
    </div>
  );
}

export const KIND_LABEL: Record<Transaction["kind"], string> = {
  expense: "Sent",
  income: "Received",
  transfer: "Moved",
  refund: "Refunded",
  adjustment: "Correction",
  lend: "Lent",
  borrow: "Borrowed",
  loan_repayment: "Repayment in",
  debt_repayment: "Debt repayment",
};

const KIND_ICON: Record<Transaction["kind"], string> = {
  expense: "↗",
  income: "↙",
  transfer: "⇄",
  refund: "↩",
  adjustment: "±",
  lend: "→",
  borrow: "←",
  loan_repayment: "↙",
  debt_repayment: "↗",
};

/** Signed cash change, or null for internal transfers (money did not enter or leave). */
export function cashDelta(tx: Transaction): number | null {
  const sign = tx.reverses ? -1 : 1;
  switch (tx.kind) {
    case "transfer":
      return null;
    case "expense":
    case "lend":
    case "debt_repayment":
      return -tx.amountCents * sign;
    case "adjustment":
      return tx.amountCents * sign;
    default:
      return tx.amountCents * sign;
  }
}

export function transactionTitle(snap: Snapshot, tx: Transaction): string {
  return tx.description;
}

export function TransactionRow({
  snap,
  tx,
  onClick,
  showDate = false,
  sub,
}: {
  snap: Snapshot;
  tx: Transaction;
  onClick?: () => void;
  showDate?: boolean;
  sub?: string;
}) {
  const delta = cashDelta(tx);
  const negative = delta !== null && delta < 0;
  const positive = delta !== null && delta > 0;
  const account = snap.accounts.find((a) => a.id === tx.accountId);
  const pocket = tx.pocketId ? snap.pockets.find((p) => p.id === tx.pocketId) : null;
  const dest = tx.kind === "transfer" ? snap.accounts.find((a) => a.id === tx.toAccountId) : null;
  const destPocket = tx.toPocketId ? snap.pockets.find((p) => p.id === tx.toPocketId) : null;
  const where = pocket ? `${account?.name ?? ""} · ${pocket.name}` : `${account?.name ?? ""} · Main`;
  const meta = sub ?? (tx.kind === "transfer" ? `Moved · ${where} → ${destPocket?.name ?? `${dest?.name ?? ""} · Main`}` : `${KIND_LABEL[tx.kind]} · ${where}`);
  return (
    <button type="button" className="mm-tx" onClick={onClick} disabled={!onClick}>
      <span className={`mm-tx-icon is-${tx.kind}`} aria-hidden>
        {KIND_ICON[tx.kind]}
      </span>
      <span className="mm-tx-main">
        <strong>
          {transactionTitle(snap, tx)}
          {tx.status === "planned" ? <span className="mm-badge">Planned</span> : null}
          {tx.reverses ? <span className="mm-badge">Reversed</span> : null}
        </strong>
        <em>
          {showDate ? `${formatDateIE(tx.date)} · ` : ""}
          {meta}
        </em>
      </span>
      <span className={`mm-tx-amount${negative ? " is-neg" : positive ? " is-pos" : ""}`}>
        {delta === null ? formatEUR(tx.amountCents) : `${delta < 0 ? "−" : delta > 0 ? "+" : ""}${formatEUR(Math.abs(delta))}`}
      </span>
    </button>
  );
}
