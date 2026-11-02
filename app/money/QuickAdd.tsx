"use client";

import { useEffect, useState } from "react";
import { saveTransaction, saveAccount, saveCategory, defaultCtx, type TxInput } from "@/money/actions";
import { parseEuroToCents, todayISO } from "@/money/money";
import { ACCOUNT_KINDS, type AccountKind, type TxKind } from "@/money/types";
import type { MoneyApi } from "./MoneyApp";
import { SheetPortal } from "./SheetPortal";

const KINDS: { id: TxKind | "planned"; label: string }[] = [
  { id: "expense", label: "Spent" },
  { id: "income", label: "Money in" },
  { id: "transfer", label: "Transfer" },
  { id: "refund", label: "Refund" },
  { id: "planned", label: "Planned" },
  { id: "adjustment", label: "Adjust balance" },
];

/** A money location: an account's Main balance (pocketId "") or one of its pockets. */
const encode = (accountId: string, pocketId: string | null) => `${accountId}|${pocketId ?? ""}`;
const decode = (value: string): { accountId: string; pocketId: string | null } => {
  const [accountId, pocketId] = value.split("|");
  return { accountId, pocketId: pocketId ? pocketId : null };
};

/** Fast entry sheet: amount, then category, then source, then confirm. Everything else sits under "More". */
export function QuickAdd({ api, onClose, notify }: { api: MoneyApi; onClose: () => void; notify: (m: string) => void }) {
  const { snap, commit } = api;
  const accounts = snap.accounts.filter((a) => !a.archived);
  const pockets = snap.pockets.filter((p) => !p.archived);
  const categories = snap.categories.filter((c) => !c.archived && c.kind === "spending");
  const firstSource = accounts[0] ? encode(accounts[0].id, null) : "";
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayISO());
  const [source, setSource] = useState(firstSource);
  const [destination, setDestination] = useState("");
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [addingAccount, setAddingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountKind, setNewAccountKind] = useState<AccountKind>("current");
  const [newAccountOpening, setNewAccountOpening] = useState("");
  const [pendingSourceName, setPendingSourceName] = useState<string | null>(null);

  const [addingCategory, setAddingCategory] = useState(categories.length === 0);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [pendingCategoryName, setPendingCategoryName] = useState<string | null>(null);

  const isTransfer = kind === "transfer";
  const isIncome = kind === "income";
  const usesCategory = !isTransfer && !isIncome && kind !== "adjustment";

  const label = (accountId: string, pocketId: string | null) => {
    const acc = accounts.find((a) => a.id === accountId);
    if (!pocketId) return `${acc?.name ?? "Account"} · Main`;
    const p = pockets.find((x) => x.id === pocketId);
    return `${acc?.name ?? "Account"} · ${p?.name ?? "Pocket"}`;
  };

  /** Options: every account's Main followed by its pockets. */
  const sourceOptions = accounts.flatMap((a) => [
    { value: encode(a.id, null), label: label(a.id, null) },
    ...pockets.filter((p) => p.accountId === a.id).map((p) => ({ value: encode(a.id, p.id), label: label(a.id, p.id) })),
  ]);

  // Prefer a different location than source for transfers (another account Main, or a pocket).
  useEffect(() => {
    if (destination) return;
    const fallback = sourceOptions.find((o) => o.value !== source)?.value ?? "";
    if (fallback) setDestination(fallback);
    // sourceOptions is rebuilt each render from accounts/pockets; length is enough to re-seed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, destination, accounts.length, pockets.length]);

  // After inline create, snap reloads — pick the new account/category by the name we just saved.
  useEffect(() => {
    if (!pendingSourceName) return;
    const acc = accounts.find((a) => a.name === pendingSourceName);
    if (!acc) return;
    setSource(encode(acc.id, null));
    setPendingSourceName(null);
  }, [accounts, pendingSourceName]);

  useEffect(() => {
    if (!pendingCategoryName) return;
    const cat = categories.find((c) => c.name === pendingCategoryName);
    if (!cat) return;
    setCategoryId(cat.id);
    setPendingCategoryName(null);
  }, [categories, pendingCategoryName]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const addAccount = async () => {
    const name = newAccountName.trim();
    const opening = newAccountOpening.trim() === "" ? 0 : parseEuroToCents(newAccountOpening);
    if (opening === null) return setError("Enter the current balance like 500 or 12.50.");
    const err = await commit(
      saveAccount(
        snap,
        { name, kind: newAccountKind, openingCents: opening, excludeFromSpendable: ACCOUNT_KINDS[newAccountKind].excludeFromSpendable },
        defaultCtx(),
      ),
    );
    if (err) return setError(err);
    setPendingSourceName(name);
    setAddingAccount(false);
    setError(null);
    setNewAccountName("");
    setNewAccountOpening("");
    notify("Account added");
  };

  const addCategory = async () => {
    const name = newCategoryName.trim();
    const err = await commit(
      saveCategory(
        snap,
        { name, icon: "🏷️", color: "#c9a84c", kind: "spending", targetCents: 0, goalCents: null },
        defaultCtx(),
      ),
    );
    if (err) return setError(err);
    setPendingCategoryName(name);
    setAddingCategory(false);
    setNewCategoryName("");
    setError(null);
  };

  const submit = async () => {
    if (busy) return;
    if (accounts.length === 0) return setError("Add an account first, so the balance can change.");
    const cents = parseEuroToCents(amount.trim());
    if (cents === null || cents === 0) return setError("Enter an amount like 12.50.");
    if (kind !== "adjustment" && cents < 0) return setError("Enter a positive amount.");
    if (usesCategory && !categoryId) return setError("Choose a category, or create one.");
    const category = categories.find((c) => c.id === categoryId);
    const fallback = isTransfer ? "Transfer" : isIncome ? "Money in" : category?.name ?? KINDS.find((k) => k.id === kind)?.label ?? "Spent";
    const src = decode(source);
    const dst = decode(destination);
    const input: TxInput = {
      kind: kind === "planned" ? "expense" : kind,
      status: kind === "planned" ? "planned" : "confirmed",
      date,
      // Adjustments keep their sign; every other kind is stored as a positive magnitude.
      amountCents: kind === "adjustment" ? cents : Math.abs(cents),
      accountId: src.accountId || null,
      pocketId: src.pocketId,
      toAccountId: isTransfer ? dst.accountId || null : null,
      toPocketId: isTransfer ? dst.pocketId : null,
      categoryId: usesCategory ? categoryId || null : null,
      description: description.trim() || fallback,
      notes: "",
    };
    setBusy(true);
    const err = await commit(saveTransaction(snap, input, defaultCtx()));
    setBusy(false);
    if (err) return setError(err);
    notify(kind === "planned" ? "Planned item saved" : "Saved");
    onClose();
  };

  const sourceSelect = (value: string, onChange: (v: string) => void, title: string) => (
    <label className="money-field">
      <span>{title}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {sourceOptions.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );

  return (
    <SheetPortal>
    <div className="money-sheet-backdrop" role="presentation" onClick={onClose}>
      <div className="money-sheet" role="dialog" aria-modal="true" aria-label="Add transaction" onClick={(e) => e.stopPropagation()}>
        <div className="money-sheet-grip" aria-hidden />
        <div className="money-sheet-head">
          <strong>Add</strong>
          <button type="button" className="money-link" onClick={onClose}>Cancel</button>
        </div>

        <div className="money-sheet-body">
          <label className="money-amount">
            <span className="sr-only">Amount in euros</span>
            <span className="money-amount-sign" aria-hidden>€</span>
            <input
              inputMode="decimal"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              aria-label="Amount in euros"
            />
          </label>

          {accounts.length === 0 && !addingAccount && (
            <div className="money-inline-panel">
              <p className="money-muted">No accounts yet.</p>
              <button type="button" className="money-btn-secondary" onClick={() => setAddingAccount(true)}>+ Add account</button>
            </div>
          )}

          {addingAccount && (
            <div className="money-inline-panel">
              <label className="money-field">
                <span>Account name</span>
                <input value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} maxLength={40} placeholder="Revolut, AIB, Cash…" />
              </label>
              <div className="money-grid2">
                <label className="money-field">
                  <span>Type</span>
                  <select value={newAccountKind} onChange={(e) => setNewAccountKind(e.target.value as AccountKind)}>
                    {(Object.keys(ACCOUNT_KINDS) as AccountKind[]).map((k) => (
                      <option key={k} value={k}>{ACCOUNT_KINDS[k].label}</option>
                    ))}
                  </select>
                </label>
                <label className="money-field">
                  <span>Current balance €</span>
                  <input inputMode="decimal" value={newAccountOpening} onChange={(e) => setNewAccountOpening(e.target.value)} placeholder="0.00" />
                </label>
              </div>
              <div className="money-row-actions">
                <button type="button" className="money-btn-secondary" onClick={() => setAddingAccount(false)}>Cancel</button>
                <button type="button" className="money-btn-primary" onClick={addAccount} disabled={!newAccountName.trim()}>Save account</button>
              </div>
            </div>
          )}

          {usesCategory && (
            <>
              {categories.length > 0 && (
                <div className="money-chips" role="radiogroup" aria-label="Category">
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={categoryId === c.id}
                      className={`money-chip${categoryId === c.id ? " is-active" : ""}`}
                      onClick={() => {
                        setCategoryId(c.id);
                        // A category linked to a pocket sets the source; the user can still change it.
                        if (c.defaultPocketId) {
                          const pocket = pockets.find((p) => p.id === c.defaultPocketId);
                          if (pocket) setSource(encode(pocket.accountId, pocket.id));
                        }
                      }}
                    >
                      <span aria-hidden>{c.icon}</span> {c.name}
                    </button>
                  ))}
                  <button type="button" className="money-chip" onClick={() => setAddingCategory((v) => !v)}>+ New</button>
                </div>
              )}
              {addingCategory && (
                <div className="money-inline-panel">
                  <label className="money-field">
                    <span>New category</span>
                    <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} maxLength={40} placeholder="Coffee, Pets…" />
                  </label>
                  <div className="money-row-actions">
                    <button type="button" className="money-btn-secondary" onClick={() => setAddingCategory(false)} disabled={categories.length === 0}>Cancel</button>
                    <button type="button" className="money-btn-primary" onClick={addCategory} disabled={!newCategoryName.trim()}>Save category</button>
                  </div>
                </div>
              )}
            </>
          )}

          {accounts.length > 0 && sourceSelect(source, setSource, isIncome ? "Receive into" : isTransfer ? "From" : "Paid from")}
          {isTransfer && accounts.length > 0 && sourceSelect(destination, setDestination, "To")}

          {more && (
            <div className="money-more">
              <div className="money-seg" role="radiogroup" aria-label="Type">
                {KINDS.map((k) => (
                  <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} className={`money-seg-btn${kind === k.id ? " is-active" : ""}`} onClick={() => setKind(k.id)}>
                    {k.label}
                  </button>
                ))}
              </div>
              <label className="money-field">
                <span>Note</span>
                <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} placeholder={isIncome ? "Salary, refund…" : "Lidl, bus ticket…"} />
              </label>
              <label className="money-field">
                <span>Date</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
            </div>
          )}

          <button type="button" className="money-link money-more-toggle" onClick={() => setMore((v) => !v)} aria-expanded={more}>
            {more ? "Less" : "More options"}
          </button>

          {error && <p className="money-error" role="alert">{error}</p>}
        </div>

        <div className="money-sheet-foot">
          <button type="button" className="money-btn-primary money-confirm" onClick={submit} disabled={busy || accounts.length === 0}>
            {busy ? "Saving…" : kind === "planned" ? "Save planned item" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
