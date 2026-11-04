"use client";

import { useState } from "react";
import { defaultCtx, saveAccount, savePocket } from "@/money/actions";
import { correctBalance, type Location } from "@/money/banking";
import { parseEuroToCents } from "@/money/money";
import { ACCOUNT_KINDS, type Account, type AccountKind, type Pocket } from "@/money/types";
import type { MoneyApi } from "./MoneyApp";
import { ErrorLine, locationName, Sheet, useSaving } from "./ui";

const ICONS = ["🍎", "🚌", "💳", "🎬", "🛡", "🚗", "🎁", "✈", "🏋", "💰", "🏠", "📱"];
const COLORS = ["#ffd166", "#4dd4ff", "#63e6be", "#ff8ad8", "#a78bfa", "#ff9f6e"];

export function AccountEditor({
  api,
  account,
  onClose,
  notify,
}: {
  api: MoneyApi;
  account?: Account;
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const [name, setName] = useState(account?.name ?? "");
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? "current");
  const [opening, setOpening] = useState(account ? "" : "");
  const { busy, error, run } = useSaving();

  const save = async () => {
    let openingCents = account?.openingCents ?? 0;
    if (!account && opening.trim()) {
      const parsed = parseEuroToCents(opening);
      if (parsed === null) return;
      openingCents = parsed;
    }
    const ok = await run(() =>
      api.commit(
        saveAccount(
          api.snap,
          {
            id: account?.id,
            name,
            kind,
            openingCents,
            excludeFromSpendable: account?.excludeFromSpendable ?? ACCOUNT_KINDS[kind].excludeFromSpendable,
          },
          defaultCtx(),
        ),
      ),
    );
    if (ok) {
      notify(account ? "Account updated" : "Account added");
      onClose();
    }
  };

  return (
    <Sheet
      title={account ? "Edit account" : "New account"}
      onClose={onClose}
      footer={
        <button type="button" className="mm-primary mm-wide" disabled={busy || !name.trim()} onClick={() => void save()}>
          {busy ? "Saving…" : account ? "Save changes" : "Add account"}
        </button>
      }
    >
      <div className="mm-form">
        <label className="mm-field">
          <span>Account name</span>
          <input className="mm-input" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} placeholder="Revolut, AIB, Cash…" autoFocus />
        </label>
        <label className="mm-field">
          <span>Type</span>
          <select className="mm-input" value={kind} onChange={(event) => setKind(event.target.value as AccountKind)}>
            {(Object.keys(ACCOUNT_KINDS) as AccountKind[]).map((key) => (
              <option key={key} value={key}>
                {ACCOUNT_KINDS[key].label}
              </option>
            ))}
          </select>
        </label>
        {!account ? (
          <label className="mm-field">
            <span>Current balance (optional)</span>
            <input className="mm-input" inputMode="decimal" value={opening} onChange={(event) => setOpening(event.target.value)} placeholder="0.00" />
          </label>
        ) : (
          <p className="mm-caption">To change the balance, use Edit balance inside the account. It is recorded as an auditable correction.</p>
        )}
        <ErrorLine message={error} />
      </div>
    </Sheet>
  );
}

export function PocketEditor({
  api,
  accountId,
  pocket,
  onClose,
  notify,
}: {
  api: MoneyApi;
  accountId: string;
  pocket?: Pocket;
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const [name, setName] = useState(pocket?.name ?? "");
  const [icon, setIcon] = useState(pocket?.icon ?? ICONS[0]);
  const [color, setColor] = useState(pocket?.color ?? COLORS[0]);
  const { busy, error, run } = useSaving();

  const save = async () => {
    const ok = await run(() =>
      api.commit(
        savePocket(
          api.snap,
          { id: pocket?.id, accountId, name, icon, color, targetCents: pocket?.targetCents ?? null },
          defaultCtx(),
        ),
      ),
    );
    if (ok) {
      notify(pocket ? "Pocket updated" : "Pocket added");
      onClose();
    }
  };

  return (
    <Sheet
      title={pocket ? "Edit pocket" : "New pocket"}
      onClose={onClose}
      footer={
        <button type="button" className="mm-primary mm-wide" disabled={busy || !name.trim()} onClick={() => void save()}>
          {busy ? "Saving…" : pocket ? "Save changes" : "Add pocket"}
        </button>
      }
    >
      <div className="mm-form">
        <label className="mm-field">
          <span>Pocket name</span>
          <input className="mm-input" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} placeholder="Emergency, Food, Subscriptions…" autoFocus />
        </label>
        <div className="mm-field">
          <span>Icon</span>
          <div className="mm-swatches" role="radiogroup" aria-label="Pocket icon">
            {ICONS.map((item) => (
              <button
                key={item}
                type="button"
                role="radio"
                aria-checked={icon === item}
                className={`mm-swatch-btn${icon === item ? " is-active" : ""}`}
                onClick={() => setIcon(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="mm-field">
          <span>Colour</span>
          <div className="mm-swatches" role="radiogroup" aria-label="Pocket colour">
            {COLORS.map((item) => (
              <button
                key={item}
                type="button"
                role="radio"
                aria-checked={color === item}
                aria-label={item}
                className={`mm-color${color === item ? " is-active" : ""}`}
                style={{ background: item }}
                onClick={() => setColor(item)}
              />
            ))}
          </div>
        </div>
        <ErrorLine message={error} />
      </div>
    </Sheet>
  );
}

export function BalanceEditor({
  api,
  location,
  currentCents,
  onClose,
  notify,
}: {
  api: MoneyApi;
  location: Location;
  currentCents: number;
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const [value, setValue] = useState((currentCents / 100).toFixed(2));
  const { busy, error, run } = useSaving();
  const current = locationName(api.snap, location);

  const save = async () => {
    const cents = parseEuroToCents(value);
    if (cents === null) return;
    const ok = await run(() => api.commit(correctBalance(api.snap, location, cents, defaultCtx())));
    if (ok) {
      notify("Balance corrected");
      onClose();
    }
  };

  return (
    <Sheet
      title="Edit balance"
      kicker={current}
      onClose={onClose}
      footer={
        <button type="button" className="mm-primary mm-wide" disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save correction"}
        </button>
      }
    >
      <div className="mm-form">
        <p className="mm-caption">This creates a visible balance correction in the history. It is never counted as income or spending.</p>
        <label className="mm-field">
          <span>New balance</span>
          <input className="mm-input mm-input-lg" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} autoFocus />
        </label>
        <ErrorLine message={error} />
      </div>
    </Sheet>
  );
}
