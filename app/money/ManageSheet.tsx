"use client";

import { useEffect, useState } from "react";
import {
  saveAccount,
  savePocket,
  archivePocket,
  deletePocket,
  deleteAccount,
  setAccountArchived,
  pocketNowCents,
  saveTransaction,
  defaultCtx,
} from "@/money/actions";
import { currentPosition } from "@/money/engine";
import { formatEUR, parseEuroToCents, todayISO } from "@/money/money";
import { ACCOUNT_KINDS, type AccountKind, type Account } from "@/money/types";
import type { MoneyApi } from "./MoneyApp";
import { SheetPortal } from "./SheetPortal";

const POCKET_ICONS = ["🍎", "🚌", "💳", "🎬", "🛡️", "🚗", "🎁", "✈️", "🏋️", "💰"];
const POCKET_COLORS = ["#c9a84c", "#34d399", "#7cc7ff", "#f472b6", "#a78bfa", "#fb923c"];

type Editor =
  | { type: "account"; id?: string }
  | { type: "pocket"; id?: string; accountId: string }
  | { type: "move" }
  | null;

/** Accounts & pockets manager: add/edit/delete, plus a transfer between any two locations. */
export function ManageSheet({ api, onClose, notify }: { api: MoneyApi; onClose: () => void; notify: (m: string) => void }) {
  const { snap, commit } = api;
  const [editor, setEditor] = useState<Editor>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const accounts = snap.accounts.filter((a) => !a.archived);
  const deletedAccounts = snap.accounts.filter((a) => a.archived);
  const run = async (fn: () => ReturnType<typeof saveAccount>, ok: string) => {
    if (busy) return;
    setBusy(true);
    const err = await commit(fn());
    setBusy(false);
    if (err) return setError(err);
    setError(null);
    notify(ok);
    setEditor(null);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <SheetPortal>
      <div className="money-sheet-backdrop" role="presentation" onClick={onClose}>
        <div className="money-sheet" role="dialog" aria-modal="true" aria-label="Accounts and pockets" onClick={(e) => e.stopPropagation()}>
          <div className="money-sheet-grip" aria-hidden />
          <div className="money-sheet-head">
            <strong>Accounts & pockets</strong>
            <button type="button" className="money-link" onClick={onClose}>Done</button>
          </div>

          <div className="money-sheet-body">
            {editor === null && (
              <>
                {accounts.map((a) => (
                  <AccountBlock
                    key={a.id}
                    api={api}
                    account={a}
                    onEdit={() => setEditor({ type: "account", id: a.id })}
                    onAddPocket={() => setEditor({ type: "pocket", accountId: a.id })}
                    onEditPocket={(id) => setEditor({ type: "pocket", id, accountId: a.id })}
                    onError={setError}
                    notify={notify}
                  />
                ))}
                {accounts.length === 0 && <p className="money-muted">No accounts yet.</p>}
                <div className="money-row-actions">
                  <button type="button" className="money-btn-secondary" onClick={() => setEditor({ type: "move" })} disabled={accounts.length === 0}>
                    Move money
                  </button>
                  <button type="button" className="money-btn-primary" onClick={() => setEditor({ type: "account" })}>+ Account</button>
                </div>
                {deletedAccounts.length > 0 && (
                  <section className="money-manage-account">
                    <div className="money-manage-head">
                      <strong>Deleted</strong>
                    </div>
                    {deletedAccounts.map((a) => (
                      <div key={a.id} className="money-manage-pocket">
                        <span className="money-manage-name">{a.name}</span>
                        <button
                          type="button"
                          className="money-link"
                          onClick={async () => {
                            const err = await commit(setAccountArchived(snap, a.id, false));
                            if (err) return setError(err);
                            notify("Account restored");
                          }}
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </section>
                )}
                {error && <p className="money-error" role="alert">{error}</p>}
              </>
            )}

            {editor?.type === "account" && (
              <AccountForm
                existing={editor.id ? snap.accounts.find((a) => a.id === editor.id) : undefined}
                busy={busy}
                onCancel={() => setEditor(null)}
                onSave={(input) => run(() => saveAccount(snap, input, defaultCtx()), "Account saved")}
              />
            )}

            {editor?.type === "pocket" && (
              <PocketForm
                accountId={editor.accountId}
                existing={editor.id ? snap.pockets.find((p) => p.id === editor.id) : undefined}
                busy={busy}
                onCancel={() => setEditor(null)}
                onSave={(input) => run(() => savePocket(snap, input, defaultCtx()), "Pocket saved")}
              />
            )}

            {editor?.type === "move" && (
              <MoveForm
                api={api}
                busy={busy}
                onCancel={() => setEditor(null)}
                onSave={async (input) => {
                  setBusy(true);
                  const err = await commit(saveTransaction(snap, input, defaultCtx()));
                  setBusy(false);
                  if (err) return setError(err);
                  setError(null);
                  notify("Money moved");
                  setEditor(null);
                }}
                error={error}
              />
            )}
          </div>
        </div>
      </div>
    </SheetPortal>
  );
}

function AccountBlock({
  api,
  account,
  onEdit,
  onAddPocket,
  onEditPocket,
  onError,
  notify,
}: {
  api: MoneyApi;
  account: Account;
  onEdit: () => void;
  onAddPocket: () => void;
  onEditPocket: (id: string) => void;
  onError: (m: string | null) => void;
  notify: (m: string) => void;
}) {
  const { snap, commit } = api;
  const pockets = snap.pockets.filter((p) => p.accountId === account.id && !p.archived);
  const main = mainCents(api, account.id);
  const total = main + pockets.reduce((s, p) => s + pocketNowCents(snap, p.id), 0);

  const removeAccount = async () => {
    if (!window.confirm(`Delete ${account.name}?`)) return;
    onError(null);
    const err = await commit(deleteAccount(snap, account.id));
    if (err) return onError(err);
    notify("Account deleted");
  };
  const removePocket = async (id: string, name: string) => {
    if (!window.confirm(`Delete ${name}?`)) return;
    onError(null);
    const err = await commit(deletePocket(snap, id));
    if (err) return onError(err);
    notify("Pocket deleted");
  };
  const archive = async (id: string) => {
    const err = await commit(archivePocket(snap, id));
    if (err) return onError(err);
    notify("Pocket archived");
  };

  return (
    <section className="money-manage-account">
      <div className="money-manage-head">
        <div>
          <strong>{account.name}</strong>
          <div className="money-muted money-small">Total {formatEUR(total)} · Main {formatEUR(main)}</div>
        </div>
        <div className="money-row-actions">
          <button type="button" className="money-link" onClick={onEdit}>Edit</button>
          <button type="button" className="money-link is-danger" onClick={removeAccount}>Delete</button>
        </div>
      </div>
      {pockets.map((p) => (
        <div key={p.id} className="money-manage-pocket">
          <span aria-hidden>{p.icon}</span>
          <span className="money-manage-name">{p.name}</span>
          <strong>{formatEUR(pocketNowCents(snap, p.id))}</strong>
          <button type="button" className="money-link" onClick={() => onEditPocket(p.id)}>Edit</button>
          <button type="button" className="money-link" onClick={() => archive(p.id)}>Archive</button>
          <button type="button" className="money-link is-danger" onClick={() => removePocket(p.id, p.name)}>Delete</button>
        </div>
      ))}
      <button type="button" className="money-link" onClick={onAddPocket}>+ Add pocket</button>
    </section>
  );
}

/** Main balance of an account (its own money, excluding pockets) from the engine's current month. */
function mainCents(api: MoneyApi, accountId: string): number {
  const pos = currentPosition(api.snap, todayISO().slice(0, 7));
  return pos?.mainEnd[accountId] ?? 0;
}

function AccountForm({
  existing,
  busy,
  onCancel,
  onSave,
}: {
  existing: Account | undefined;
  busy: boolean;
  onCancel: () => void;
  onSave: (input: { id?: string; name: string; kind: AccountKind; openingCents: number; excludeFromSpendable: boolean }) => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [kind, setKind] = useState<AccountKind>(existing?.kind ?? "current");
  const [opening, setOpening] = useState(existing ? (existing.openingCents / 100).toFixed(2) : "");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const cents = opening.trim() === "" ? 0 : parseEuroToCents(opening);
    if (cents === null) return setError("Enter the balance like 500 or 12.50.");
    setError(null);
    onSave({ id: existing?.id, name, kind, openingCents: cents, excludeFromSpendable: ACCOUNT_KINDS[kind].excludeFromSpendable });
  };

  return (
    <div className="money-inline-panel">
      <label className="money-field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Revolut, AIB, Cash…" />
      </label>
      <div className="money-grid2">
        <label className="money-field">
          <span>Type</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as AccountKind)}>
            {(Object.keys(ACCOUNT_KINDS) as AccountKind[]).map((k) => (
              <option key={k} value={k}>{ACCOUNT_KINDS[k].label}</option>
            ))}
          </select>
        </label>
        <label className="money-field">
          <span>{existing ? "Opening balance €" : "Current balance €"}</span>
          <input inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="0.00" />
        </label>
      </div>
      {error && <p className="money-error" role="alert">{error}</p>}
      <div className="money-row-actions">
        <button type="button" className="money-btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="money-btn-primary" onClick={submit} disabled={busy || !name.trim()}>Save</button>
      </div>
    </div>
  );
}

function PocketForm({
  accountId,
  existing,
  busy,
  onCancel,
  onSave,
}: {
  accountId: string;
  existing: MoneyApi["snap"]["pockets"][number] | undefined;
  busy: boolean;
  onCancel: () => void;
  onSave: (input: { id?: string; accountId: string; name: string; icon: string; color: string; targetCents: number | null }) => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [icon, setIcon] = useState(existing?.icon ?? POCKET_ICONS[0]);
  const [color, setColor] = useState(existing?.color ?? POCKET_COLORS[0]);
  const [target, setTarget] = useState(existing?.targetCents != null ? (existing.targetCents / 100).toFixed(2) : "");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const targetCents = target.trim() === "" ? null : parseEuroToCents(target);
    if (target.trim() !== "" && (targetCents === null || targetCents < 0)) return setError("Enter a target like 300.");
    setError(null);
    onSave({ id: existing?.id, accountId, name, icon, color, targetCents });
  };

  return (
    <div className="money-inline-panel">
      <label className="money-field">
        <span>Pocket name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Food, Holiday, Car…" />
      </label>
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
      <label className="money-field">
        <span>Target € (optional)</span>
        <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="No target" />
      </label>
      {error && <p className="money-error" role="alert">{error}</p>}
      <div className="money-row-actions">
        <button type="button" className="money-btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="money-btn-primary" onClick={submit} disabled={busy || !name.trim()}>Save pocket</button>
      </div>
    </div>
  );
}

function MoveForm({
  api,
  busy,
  onCancel,
  onSave,
  error,
}: {
  api: MoneyApi;
  busy: boolean;
  onCancel: () => void;
  onSave: (input: Parameters<typeof saveTransaction>[1]) => void | Promise<void>;
  error: string | null;
}) {
  const { snap } = api;
  const accounts = snap.accounts.filter((a) => !a.archived);
  const pockets = snap.pockets.filter((p) => !p.archived);
  const options = accounts.flatMap((a) => [
    { value: `${a.id}|`, label: `${a.name} · Main` },
    ...pockets.filter((p) => p.accountId === a.id).map((p) => ({ value: `${a.id}|${p.id}`, label: `${a.name} · ${p.name}` })),
  ]);
  const [from, setFrom] = useState(options[0]?.value ?? "");
  const [to, setTo] = useState(options[1]?.value ?? "");
  const [amount, setAmount] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const split = (v: string) => {
    const [accountId, pocketId] = v.split("|");
    return { accountId, pocketId: pocketId || null };
  };

  const submit = () => {
    const cents = parseEuroToCents(amount);
    if (cents === null || cents <= 0) return setLocalError("Enter an amount like 100.");
    if (from === to) return setLocalError("Choose two different places.");
    const src = split(from);
    const dst = split(to);
    setLocalError(null);
    onSave({
      kind: "transfer",
      status: "confirmed",
      date: todayISO(),
      amountCents: cents,
      accountId: src.accountId,
      pocketId: src.pocketId,
      toAccountId: dst.accountId,
      toPocketId: dst.pocketId,
      categoryId: null,
      description: "Transfer",
      notes: "",
    });
  };

  return (
    <div className="money-inline-panel">
      <label className="money-field">
        <span>From</span>
        <select value={from} onChange={(e) => setFrom(e.target.value)}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <label className="money-field">
        <span>To</span>
        <select value={to} onChange={(e) => setTo(e.target.value)}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <label className="money-field">
        <span>Amount €</span>
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
      </label>
      {(localError || error) && <p className="money-error" role="alert">{localError ?? error}</p>}
      <div className="money-row-actions">
        <button type="button" className="money-btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="money-btn-primary" onClick={submit} disabled={busy || options.length < 2}>Confirm move</button>
      </div>
    </div>
  );
}
