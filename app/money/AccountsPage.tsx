"use client";

import { useState } from "react";
import { archivePocket, deleteAccount, deletePocket, restorePocket, setAccountArchived } from "@/money/actions";
import { balances, sortAccounts, sortPockets, type Location } from "@/money/banking";
import { formatEUR } from "@/money/money";
import type { Account, Pocket, Snapshot, Transaction } from "@/money/types";
import type { MoneyApi } from "./MoneyApp";
import { TransactionRow } from "./ui";

export type HistoryFilter = { accountId?: string; pocketId?: string; title: string } | null;

function accountTransactions(snap: Snapshot, accountId: string): Transaction[] {
  return snap.transactions
    .filter((t) => !t.reverses && !t.reversedBy)
    .filter((t) => t.accountId === accountId || t.toAccountId === accountId)
    .sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1));
}

function pocketTransactions(snap: Snapshot, pocketId: string): Transaction[] {
  return snap.transactions
    .filter((t) => !t.reverses && !t.reversedBy)
    .filter((t) => t.pocketId === pocketId || t.toPocketId === pocketId)
    .sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1));
}

export default function AccountsPage({
  api,
  onOpenAccount,
  onAddAccount,
}: {
  api: MoneyApi;
  onOpenAccount: (id: string) => void;
  onAddAccount: () => void;
}) {
  const { snap } = api;
  const accounts = sortAccounts(snap, snap.accounts.filter((a) => !a.archived));
  const archived = sortAccounts(snap, snap.accounts.filter((a) => a.archived));
  const b = balances(snap);

  return (
    <div className="mm-page">
      <header className="mm-page-head">
        <div>
          <p className="mm-kicker">All your money</p>
          <h1>Accounts</h1>
        </div>
        <button type="button" className="mm-ghost-btn" onClick={onAddAccount}>
          + Account
        </button>
      </header>

      {accounts.length === 0 ? (
        <EmptyState title="No accounts yet" body="Add Revolut, your bank, cash or savings to start tracking where your money is." action="Add your first account" onAction={onAddAccount} />
      ) : (
        <ul className="mm-accounts">
          {accounts.map((account) => {
            const pockets = sortPockets(snap, account.id);
            return (
              <li key={account.id}>
                <button type="button" className="mm-account-row" onClick={() => onOpenAccount(account.id)}>
                  <span className="mm-account-mark" aria-hidden>
                    {account.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="mm-account-main">
                    <strong>{account.name}</strong>
                    <em>
                      Main {formatEUR(b.main[account.id] ?? 0)}
                      {pockets.length > 0 ? ` · ${pockets.length} ${pockets.length === 1 ? "pocket" : "pockets"}` : ""}
                    </em>
                  </span>
                  <span className="mm-account-total">{formatEUR(b.account[account.id] ?? 0)}</span>
                  <span className="mm-chevron" aria-hidden>
                    ›
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {archived.length > 0 ? (
        <section className="mm-section">
          <div className="mm-section-head">
            <h2>Archived</h2>
          </div>
          <ul className="mm-accounts">
            {archived.map((account) => (
              <li key={account.id}>
                <button type="button" className="mm-account-row" onClick={() => onOpenAccount(account.id)}>
                  <span className="mm-account-mark" aria-hidden>
                    {account.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="mm-account-main">
                    <strong>{account.name}</strong>
                    <em>Archived · history kept</em>
                  </span>
                  <span className="mm-account-total">{formatEUR(b.account[account.id] ?? 0)}</span>
                  <span className="mm-chevron" aria-hidden>
                    ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function AccountDetail({
  api,
  accountId,
  onBack,
  onOpenPocket,
  onAddPocket,
  onEditAccount,
  onEditBalance,
  onAdd,
  onSend,
  onMove,
  onOpenTransaction,
  onHistory,
  notify,
}: {
  api: MoneyApi;
  accountId: string;
  onBack: () => void;
  onOpenPocket: (accountId: string, pocketId: string) => void;
  onAddPocket: (accountId: string) => void;
  onEditAccount: (account: Account) => void;
  onEditBalance: (location: Location, cents: number) => void;
  onAdd: (destination: Location) => void;
  onSend: (source: Location) => void;
  onMove: (source: Location) => void;
  onOpenTransaction: (id: string) => void;
  onHistory: (filter: HistoryFilter) => void;
  notify: (message: string) => void;
}) {
  const { snap, commit } = api;
  const account = snap.accounts.find((a) => a.id === accountId);
  const [error, setError] = useState<string | null>(null);
  if (!account) return <p className="mm-muted">That account no longer exists.</p>;

  const main: Location = { accountId, pocketId: null };
  const pockets = sortPockets(snap, accountId);
  const archivedPockets = snap.pockets.filter((p) => p.accountId === accountId && p.archived);
  const b = balances(snap);
  const total = b.account[accountId] ?? 0;
  const mainCents = b.main[accountId] ?? 0;
  const recent = accountTransactions(snap, accountId).slice(0, 8);

  async function archive() {
    if (!window.confirm(`Archive ${account!.name}? It must have a zero balance.`)) return;
    const err = await commit(setAccountArchived(snap, accountId, true));
    if (err) return setError(err);
    notify("Account archived");
    onBack();
  }

  async function restore() {
    const err = await commit(setAccountArchived(snap, accountId, false));
    if (err) return setError(err);
    notify("Account restored");
    onBack();
  }

  async function restorePocketRow(id: string) {
    const err = await commit(restorePocket(snap, id));
    if (err) return setError(err);
    notify("Pocket restored");
  }

  async function remove() {
    const records = snap.transactions.filter((t) => t.accountId === accountId || t.toAccountId === accountId).length;
    const pocketCount = snap.pockets.filter((p) => p.accountId === accountId).length;
    const parts = [
      records > 0 ? `${records} ${records === 1 ? "record" : "records"}` : "",
      pocketCount > 0 ? `${pocketCount} ${pocketCount === 1 ? "pocket" : "pockets"}` : "",
    ].filter(Boolean);
    const money = (b.account[accountId] ?? 0) !== 0 ? " Its balance leaves your totals." : "";
    const message = `Delete ${account!.name}${parts.length > 0 ? ` and its ${parts.join(" and ")}` : ""}?${money} This cannot be undone.`;
    if (!window.confirm(message)) return;
    const err = await commit(deleteAccount(snap, accountId));
    if (err) return setError(err);
    notify("Account deleted");
    onBack();
  }

  return (
    <div className="mm-page mm-detail">
      <header className="mm-detail-head">
        <button type="button" className="mm-back-btn" onClick={onBack} aria-label="Back to accounts">
          ‹
        </button>
        <div className="mm-detail-title">
          <p className="mm-kicker">{account.archived ? "Archived account" : "Account"}</p>
          <h1>{account.name}</h1>
        </div>
        <details className="mm-menu">
          <summary aria-label="Account options">⋯</summary>
          <div className="mm-menu-pop">
            <button type="button" onClick={() => onEditAccount(account)}>
              Edit name and type
            </button>
            {account.archived ? null : (
              <button type="button" onClick={() => onAddPocket(account.id)}>
                Add pocket
              </button>
            )}
            {account.archived ? null : (
              <button type="button" onClick={() => onEditBalance(main, mainCents)}>
                Edit Main balance
              </button>
            )}
            {account.archived ? (
              <button type="button" onClick={() => void restore()}>
                Restore account
              </button>
            ) : (
              <button type="button" onClick={() => void archive()}>
                Archive account
              </button>
            )}
            <button type="button" className="is-danger" onClick={() => void remove()}>
              Delete account
            </button>
          </div>
        </details>
      </header>

      <section className="mm-account-hero">
        <p className="mm-balance">{formatEUR(total)}</p>
        <p className="mm-caption">Main plus every pocket</p>
      </section>

      {account.archived ? (
        <p className="mm-caption">This account is archived. Restore it from the menu to move money again.</p>
      ) : (
        <div className="mm-actions">
          <button type="button" className="mm-action" onClick={() => onAdd(main)}>
            <span aria-hidden>＋</span>Add
          </button>
          <button type="button" className="mm-action" onClick={() => onSend(main)}>
            <span aria-hidden>↗</span>Send
          </button>
          <button type="button" className="mm-action" onClick={() => onMove(main)}>
            <span aria-hidden>⇄</span>Move
          </button>
        </div>
      )}

      <section className="mm-section">
        <div className="mm-section-head">
          <h2>Balances</h2>
          {account.archived ? null : (
            <button type="button" className="mm-link" onClick={() => onAddPocket(account.id)}>
              + Pocket
            </button>
          )}
        </div>
        <ul className="mm-balance-list">
          <li>
            <button type="button" className="mm-balance-row" onClick={() => onEditBalance(main, mainCents)}>
              <span className="mm-pocket-icon" aria-hidden>
                ▣
              </span>
              <span className="mm-pocket-name">
                <strong>Main</strong>
                <em>Available in this account</em>
              </span>
              <span className="mm-pocket-amount">{formatEUR(mainCents)}</span>
            </button>
          </li>
          {pockets.map((pocket) => (
            <li key={pocket.id}>
              <button type="button" className="mm-balance-row" onClick={() => onOpenPocket(account.id, pocket.id)}>
                <span className="mm-pocket-icon" style={{ color: pocket.color }} aria-hidden>
                  {pocket.icon}
                </span>
                <span className="mm-pocket-name">
                  <strong>{pocket.name}</strong>
                  <em>Pocket</em>
                </span>
                <span className="mm-pocket-amount">{formatEUR(b.pocket[pocket.id] ?? 0)}</span>
                <span className="mm-chevron" aria-hidden>
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
        {pockets.length === 0 ? <p className="mm-caption">Pockets are optional. Add one to separate money for bills, food or savings.</p> : null}
        {archivedPockets.length > 0 ? (
          <div className="mm-paused">
            <p className="mm-kicker">Archived pockets</p>
            {archivedPockets.map((pocket) => (
              <div key={pocket.id} className="mm-mini-row">
                <span className="mm-mini-main">
                  <strong>
                    {pocket.icon} {pocket.name}
                  </strong>
                  <em>{formatEUR(b.pocket[pocket.id] ?? 0)} · history kept</em>
                </span>
                <button type="button" className="mm-link" onClick={() => void restorePocketRow(pocket.id)}>
                  Restore
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {error ? <p className="mm-error">{error}</p> : null}
      </section>

      <section className="mm-section">
        <div className="mm-section-head">
          <h2>Recent</h2>
          <button type="button" className="mm-link" onClick={() => onHistory({ accountId, title: account.name })}>
            See all
          </button>
        </div>
        {recent.length === 0 ? (
          <p className="mm-caption">No movements here yet. Use Add, Send or Move.</p>
        ) : (
          <ul className="mm-tx-list">
            {recent.map((tx) => (
              <li key={tx.id}>
                <TransactionRow snap={snap} tx={tx} showDate onClick={() => onOpenTransaction(tx.id)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function PocketDetail({
  api,
  accountId,
  pocketId,
  onBack,
  onEditPocket,
  onEditBalance,
  onAdd,
  onSend,
  onMove,
  onOpenTransaction,
  onHistory,
  notify,
}: {
  api: MoneyApi;
  accountId: string;
  pocketId: string;
  onBack: () => void;
  onEditPocket: (accountId: string, pocket: Pocket) => void;
  onEditBalance: (location: Location, cents: number) => void;
  onAdd: (destination: Location) => void;
  onSend: (source: Location) => void;
  onMove: (source: Location) => void;
  onOpenTransaction: (id: string) => void;
  onHistory: (filter: HistoryFilter) => void;
  notify: (message: string) => void;
}) {
  const { snap, commit } = api;
  const account = snap.accounts.find((a) => a.id === accountId);
  const pocket = snap.pockets.find((p) => p.id === pocketId);
  const [error, setError] = useState<string | null>(null);
  if (!account || !pocket) return <p className="mm-muted">That pocket no longer exists.</p>;

  const location: Location = { accountId, pocketId };
  const cents = balances(snap).pocket[pocketId] ?? 0;
  const recent = pocketTransactions(snap, pocketId).slice(0, 12);

  async function archive() {
    if (!window.confirm(`Archive ${pocket!.name}? It must have a zero balance.`)) return;
    const err = await commit(archivePocket(snap, pocketId));
    if (err) return setError(err);
    notify("Pocket archived");
    onBack();
  }

  async function remove() {
    if (!window.confirm(`Delete ${pocket!.name}? Only a pocket with no records and a zero balance can be deleted.`)) return;
    const err = await commit(deletePocket(snap, pocketId));
    if (err) return setError(err);
    notify("Pocket deleted");
    onBack();
  }

  return (
    <div className="mm-page mm-detail">
      <header className="mm-detail-head">
        <button type="button" className="mm-back-btn" onClick={onBack} aria-label={`Back to ${account.name}`}>
          ‹
        </button>
        <div className="mm-detail-title">
          <p className="mm-kicker">
            {account.name} · Pocket
          </p>
          <h1>
            <span aria-hidden style={{ color: pocket.color }}>
              {pocket.icon}
            </span>{" "}
            {pocket.name}
          </h1>
        </div>
        <details className="mm-menu">
          <summary aria-label="Pocket options">⋯</summary>
          <div className="mm-menu-pop">
            <button type="button" onClick={() => onEditPocket(accountId, pocket)}>
              Rename or change icon
            </button>
            <button type="button" onClick={() => onEditBalance(location, cents)}>
              Edit balance
            </button>
            <button type="button" onClick={() => onMove(location)}>
              Move money
            </button>
            <button type="button" onClick={() => void archive()}>
              Archive pocket
            </button>
            <button type="button" className="is-danger" onClick={() => void remove()}>
              Delete pocket
            </button>
          </div>
        </details>
      </header>

      <section className="mm-account-hero">
        <p className="mm-balance">{formatEUR(cents)}</p>
        <p className="mm-caption">
          Part of {account.name}, not extra money
        </p>
      </section>

      <div className="mm-actions">
        <button type="button" className="mm-action" onClick={() => onAdd(location)}>
          <span aria-hidden>＋</span>Add
        </button>
        <button type="button" className="mm-action" onClick={() => onSend(location)}>
          <span aria-hidden>↗</span>Send
        </button>
        <button type="button" className="mm-action" onClick={() => onMove(location)}>
          <span aria-hidden>⇄</span>Move
        </button>
      </div>

      <section className="mm-section">
        <div className="mm-section-head">
          <h2>History</h2>
          <button type="button" className="mm-link" onClick={() => onHistory({ accountId, pocketId, title: pocket.name })}>
            See all
          </button>
        </div>
        {recent.length === 0 ? (
          <p className="mm-caption">No movements in this pocket yet.</p>
        ) : (
          <ul className="mm-tx-list">
            {recent.map((tx) => (
              <li key={tx.id}>
                <TransactionRow snap={snap} tx={tx} showDate onClick={() => onOpenTransaction(tx.id)} />
              </li>
            ))}
          </ul>
        )}
        {error ? <p className="mm-error">{error}</p> : null}
      </section>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <section className="mm-empty">
      <span className="mm-empty-mark" aria-hidden>
        €
      </span>
      <h2>{title}</h2>
      <p>{body}</p>
      {action && onAction ? (
        <button type="button" className="mm-primary" onClick={onAction}>
          {action}
        </button>
      ) : null}
    </section>
  );
}
