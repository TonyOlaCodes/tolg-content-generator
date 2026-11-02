"use client";

import { useEffect, useState } from "react";
import {
  saveAccount,
  savePocket,
  deleteAccount,
  deletePocket,
  archivePocket,
  setAccountArchived,
  reconcileBalance,
  mainNowCents,
  pocketNowCents,
  defaultCtx,
} from "@/money/actions";
import { formatEUR, parseEuroToCents } from "@/money/money";
import { ACCOUNT_KINDS, type Account, type AccountKind, type Pocket } from "@/money/types";
import type { MoneyApi } from "../MoneyApp";
import type { FlowMode } from "../MoneyFlowSheet";
import { accountTotalCents, locationLabel } from "../locations";

export default function AccountsPage({
  api,
  notify,
  onFlow,
  focusAccountId,
}: {
  api: MoneyApi;
  notify: (m: string) => void;
  onFlow: (mode: FlowMode, preset?: { from?: string; to?: string }) => void;
  focusAccountId?: string | null;
}) {
  const { snap, commit } = api;
  const accounts = snap.accounts.filter((a) => !a.archived);
  const deleted = snap.accounts.filter((a) => a.archived);
  const [selectedId, setSelectedId] = useState<string | null>(focusAccountId ?? null);
  const [adding, setAdding] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [addingPocketFor, setAddingPocketFor] = useState<string | null>(null);
  const [editingPocket, setEditingPocket] = useState<Pocket | null>(null);
  const [balanceEdit, setBalanceEdit] = useState<{ accountId: string; pocketId: string | null; label: string; current: number } | null>(null);

  useEffect(() => {
    if (focusAccountId) setSelectedId(focusAccountId);
  }, [focusAccountId]);

  const selected = accounts.find((a) => a.id === selectedId) ?? null;

  if (balanceEdit) {
    return (
      <BalanceEditor
        label={balanceEdit.label}
        current={balanceEdit.current}
        onCancel={() => setBalanceEdit(null)}
        onSave={async (cents) => {
          const err = await commit(
            reconcileBalance(snap, balanceEdit.accountId, balanceEdit.pocketId, cents, defaultCtx(), balanceEdit.pocketId ? "pocket" : "main"),
          );
          if (err) return notify(err);
          notify("Balance updated");
          setBalanceEdit(null);
        }}
      />
    );
  }

  if (adding || editingAccount) {
    return (
      <AccountEditor
        existing={editingAccount ?? undefined}
        onCancel={() => { setAdding(false); setEditingAccount(null); }}
        onSave={async (input) => {
          const err = await commit(saveAccount(snap, input, defaultCtx()));
          if (err) return notify(err);
          notify(editingAccount ? "Account updated" : "Account added");
          setAdding(false);
          setEditingAccount(null);
        }}
      />
    );
  }

  if (addingPocketFor || editingPocket) {
    const accountId = editingPocket?.accountId ?? addingPocketFor!;
    return (
      <PocketEditor
        accountId={accountId}
        existing={editingPocket ?? undefined}
        onCancel={() => { setAddingPocketFor(null); setEditingPocket(null); }}
        onSave={async (input) => {
          const err = await commit(savePocket(snap, input, defaultCtx()));
          if (err) return notify(err);
          notify(editingPocket ? "Pocket updated" : "Pocket added");
          setAddingPocketFor(null);
          setEditingPocket(null);
        }}
      />
    );
  }

  if (selected) {
    const pockets = snap.pockets.filter((p) => p.accountId === selected.id && !p.archived);
    const main = mainNowCents(snap, selected.id);
    const total = accountTotalCents(snap, selected.id);
    const txs = snap.transactions
      .filter((t) => t.status === "confirmed" && !t.reverses && (t.accountId === selected.id || t.toAccountId === selected.id))
      .sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1))
      .slice(0, 12);

    return (
      <div className="money-page">
        <button type="button" className="money-link" onClick={() => setSelectedId(null)}>← Accounts</button>
        <section className="money-hero money-hero-left">
          <p className="money-kicker">{ACCOUNT_KINDS[selected.kind].label}</p>
          <p className="money-big">{selected.name}</p>
          <p className="money-balance">{formatEUR(total)}</p>
        </section>

        <div className="money-row-actions">
          <button type="button" className="money-btn-secondary" onClick={() => setEditingAccount(selected)}>Edit</button>
          <button type="button" className="money-btn-secondary" onClick={() => onFlow("add", { to: `${selected.id}|` })}>+ Add</button>
          <button type="button" className="money-btn-secondary" onClick={() => onFlow("send", { from: `${selected.id}|` })}>Send</button>
          <button
            type="button"
            className="money-link is-danger"
            onClick={async () => {
              if (!window.confirm(`Delete ${selected.name}?`)) return;
              const err = await commit(deleteAccount(snap, selected.id));
              if (err) return notify(err);
              notify("Account deleted");
              setSelectedId(null);
            }}
          >
            Delete
          </button>
        </div>

        <section className="money-block">
          <h2 className="money-h2">Balances</h2>
          <ul className="money-balance-list">
            <li>
              <button
                type="button"
                className="money-balance-row"
                onClick={() => setBalanceEdit({ accountId: selected.id, pocketId: null, label: "Main", current: main })}
              >
                <span>Main</span>
                <strong>{formatEUR(main)}</strong>
              </button>
            </li>
            {pockets.map((p) => {
              const bal = pocketNowCents(snap, p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className="money-balance-row"
                    onClick={() => setBalanceEdit({ accountId: selected.id, pocketId: p.id, label: p.name, current: bal })}
                  >
                    <span><span aria-hidden>{p.icon} </span>{p.name}</span>
                    <strong>{formatEUR(bal)}</strong>
                  </button>
                  <div className="money-sub-actions">
                    <button type="button" className="money-link" onClick={() => onFlow("add", { to: `${selected.id}|${p.id}` })}>Add</button>
                    <button type="button" className="money-link" onClick={() => onFlow("send", { from: `${selected.id}|${p.id}` })}>Send</button>
                    <button type="button" className="money-link" onClick={() => onFlow("transfer", { from: `${selected.id}|${p.id}` })}>Transfer</button>
                    <button type="button" className="money-link" onClick={() => setEditingPocket(p)}>Edit</button>
                    <button
                      type="button"
                      className="money-link is-danger"
                      onClick={async () => {
                        if (!window.confirm(`Delete ${p.name}?`)) return;
                        const hard = deletePocket(snap, p.id);
                        if (hard.ok) {
                          const err = await commit(hard);
                          if (err) return notify(err);
                          notify("Pocket deleted");
                          return;
                        }
                        const err = await commit(archivePocket(snap, p.id));
                        if (err) return notify(err);
                        notify("Pocket archived");
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <button type="button" className="money-link" onClick={() => setAddingPocketFor(selected.id)}>+ Add pocket</button>
        </section>

        <section className="money-block">
          <h2 className="money-h2">History</h2>
          {txs.length === 0 ? (
            <p className="money-muted">No movements in this account yet.</p>
          ) : (
            <ul className="money-tx-list">
              {txs.map((t) => (
                <li key={t.id} className="money-tx-row">
                  <span>
                    <strong>{t.description}</strong>
                    <span className="money-muted money-small">
                      {locationLabel(snap, t.accountId, t.pocketId ?? null)}
                      {t.kind === "transfer" ? ` → ${locationLabel(snap, t.toAccountId, t.toPocketId ?? null)}` : ""}
                    </span>
                  </span>
                  <strong className={`money-tx-amt${t.kind === "expense" ? " is-neg" : t.kind === "income" || t.kind === "refund" ? " is-pos" : ""}`}>
                    {formatEUR(t.amountCents)}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="money-page">
      <section className="money-block">
        <div className="money-block-head">
          <h2 className="money-h2">Accounts</h2>
          <button type="button" className="money-btn-primary money-btn-inline" onClick={() => setAdding(true)}>+ Account</button>
        </div>
        {accounts.length === 0 && <p className="money-muted">Add Revolut, AIB, cash, or any account you use.</p>}
        <ul className="money-account-list">
          {accounts.map((a) => {
            const pockets = snap.pockets.filter((p) => p.accountId === a.id && !p.archived);
            const total = accountTotalCents(snap, a.id);
            return (
              <li key={a.id}>
                <button type="button" className="money-account-card" onClick={() => setSelectedId(a.id)}>
                  <span>
                    <strong>{a.name}</strong>
                    <span className="money-muted money-small">
                      {ACCOUNT_KINDS[a.kind].label}
                      {pockets.length > 0 ? ` · ${pockets.length} pocket${pockets.length === 1 ? "" : "s"}` : ""}
                    </span>
                  </span>
                  <strong>{formatEUR(total)}</strong>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {deleted.length > 0 && (
        <section className="money-block">
          <h2 className="money-h2">Deleted</h2>
          {deleted.map((a) => (
            <div key={a.id} className="money-manage-pocket">
              <span>{a.name}</span>
              <button
                type="button"
                className="money-link"
                onClick={async () => {
                  const err = await commit(setAccountArchived(snap, a.id, false));
                  if (err) return notify(err);
                  notify("Account restored");
                }}
              >
                Restore
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function BalanceEditor({
  label,
  current,
  onCancel,
  onSave,
}: {
  label: string;
  current: number;
  onCancel: () => void;
  onSave: (cents: number) => Promise<void>;
}) {
  const [value, setValue] = useState((current / 100).toFixed(2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="money-page">
      <button type="button" className="money-link" onClick={onCancel}>← Back</button>
      <section className="money-block">
        <h2 className="money-h2">Set {label} balance</h2>
        <p className="money-muted money-small">Creates a balance correction in history.</p>
        <label className="money-amount-field">
          <span className="money-sr">New balance</span>
          <span className="money-amount-prefix">€</span>
          <input inputMode="decimal" autoFocus value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        {error && <p className="money-error">{error}</p>}
        <button
          type="button"
          className="money-btn-primary"
          disabled={busy}
          onClick={async () => {
            const cents = parseEuroToCents(value);
            if (cents === null) return setError("Enter a valid amount.");
            setBusy(true);
            await onSave(cents);
            setBusy(false);
          }}
        >
          Save balance
        </button>
      </section>
    </div>
  );
}

function AccountEditor({
  existing,
  onCancel,
  onSave,
}: {
  existing?: Account;
  onCancel: () => void;
  onSave: (input: { id?: string; name: string; kind: AccountKind; openingCents: number; excludeFromSpendable: boolean }) => Promise<void>;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [kind, setKind] = useState<AccountKind>(existing?.kind ?? "digital");
  const [opening, setOpening] = useState(existing ? (existing.openingCents / 100).toFixed(2) : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="money-page">
      <button type="button" className="money-link" onClick={onCancel}>← Back</button>
      <div className="money-form">
        <h2 className="money-h2">{existing ? "Edit account" : "New account"}</h2>
        <label className="money-field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Revolut, AIB, Cash…" /></label>
        <label className="money-field"><span>Type</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as AccountKind)}>
            {(Object.keys(ACCOUNT_KINDS) as AccountKind[]).map((k) => (
              <option key={k} value={k}>{ACCOUNT_KINDS[k].label}</option>
            ))}
          </select>
        </label>
        {!existing && (
          <label className="money-field"><span>Current balance €</span>
            <input inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="0.00" />
          </label>
        )}
        {error && <p className="money-error">{error}</p>}
        <button
          type="button"
          className="money-btn-primary"
          disabled={busy || !name.trim()}
          onClick={async () => {
            const cents = existing ? existing.openingCents : opening.trim() === "" ? 0 : parseEuroToCents(opening);
            if (cents === null) return setError("Enter a valid balance.");
            setBusy(true);
            await onSave({
              id: existing?.id,
              name,
              kind,
              openingCents: cents,
              excludeFromSpendable: ACCOUNT_KINDS[kind].excludeFromSpendable,
            });
            setBusy(false);
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

const POCKET_ICONS = ["🍎", "🚌", "💳", "🎬", "🛡️", "🚗", "🎁", "✈️", "🏋️", "💰"];
const POCKET_COLORS = ["#c9a84c", "#34d399", "#7cc7ff", "#f472b6", "#a78bfa", "#fb923c"];

function PocketEditor({
  accountId,
  existing,
  onCancel,
  onSave,
}: {
  accountId: string;
  existing?: Pocket;
  onCancel: () => void;
  onSave: (input: { id?: string; accountId: string; name: string; icon: string; color: string; targetCents: number | null }) => Promise<void>;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [icon, setIcon] = useState(existing?.icon ?? POCKET_ICONS[0]);
  const [color, setColor] = useState(existing?.color ?? POCKET_COLORS[0]);
  const [target, setTarget] = useState(existing?.targetCents != null ? (existing.targetCents / 100).toFixed(2) : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="money-page">
      <button type="button" className="money-link" onClick={onCancel}>← Back</button>
      <div className="money-form">
        <h2 className="money-h2">{existing ? "Edit pocket" : "New pocket"}</h2>
        <label className="money-field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Food, Transport…" /></label>
        <div className="money-chips" role="radiogroup" aria-label="Icon">
          {POCKET_ICONS.map((i) => (
            <button key={i} type="button" role="radio" aria-checked={icon === i} className={`money-chip${icon === i ? " is-active" : ""}`} onClick={() => setIcon(i)}>
              <span aria-hidden>{i}</span>
            </button>
          ))}
        </div>
        <div className="money-chips" role="radiogroup" aria-label="Colour">
          {POCKET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-label={c}
              aria-checked={color === c}
              className="money-swatch"
              style={{ background: c, outline: color === c ? `2px solid ${c}` : "none" }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <label className="money-field"><span>Target € (optional)</span>
          <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="No target" />
        </label>
        {error && <p className="money-error">{error}</p>}
        <button
          type="button"
          className="money-btn-primary"
          disabled={busy || !name.trim()}
          onClick={async () => {
            const targetCents = target.trim() === "" ? null : parseEuroToCents(target);
            if (target.trim() !== "" && (targetCents === null || targetCents < 0)) return setError("Enter a valid target.");
            setBusy(true);
            await onSave({ id: existing?.id, accountId, name, icon, color, targetCents });
            setBusy(false);
          }}
        >
          Save pocket
        </button>
      </div>
    </div>
  );
}
