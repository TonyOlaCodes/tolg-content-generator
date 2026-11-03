"use client";

import { currentPosition } from "@/money/engine";
import { remainingRecurringCents } from "@/money/actions";
import { computeBillTotals } from "@/money/bills";
import { currentMonth, dueLabel, formatEUR, formatDateIE, todayISO } from "@/money/money";
import { sortAccountsByBalance } from "@/money/sort";
import { ACCOUNT_KINDS } from "@/money/types";
import type { MoneyApi, PageId } from "../MoneyApp";
import type { FlowMode } from "../MoneyFlowSheet";
import { accountTotalCents, locationLabel } from "../locations";

export default function HomePage({
  api,
  onNavigate,
  onFlow,
  onIncome,
  onSetup,
  onConfirmBill,
}: {
  api: MoneyApi;
  onNavigate: (p: PageId, accountId?: string) => void;
  onFlow: (mode: FlowMode) => void;
  onIncome: () => void;
  onSetup: () => void;
  onConfirmBill: (id: string) => void;
}) {
  const { snap } = api;
  const month = currentMonth();
  const today = todayISO();
  const row = currentPosition(snap, month);
  const accounts = sortAccountsByBalance(snap, snap.accounts.filter((a) => !a.archived));
  const hasAccounts = accounts.length > 0;
  const billTotals = computeBillTotals(snap, month);

  const totalCents = row?.totalEnd ?? 0;
  const spendableCents = accounts
    .filter((a) => !a.excludeFromSpendable)
    .reduce((s, a) => s + (row?.accountEnd[a.id] ?? 0), 0);
  const savingsCents = accounts
    .filter((a) => a.kind === "savings" || (a.excludeFromSpendable && a.kind !== "investment"))
    .reduce((s, a) => s + (row?.accountEnd[a.id] ?? 0), 0);
  const investmentCents = accounts
    .filter((a) => a.kind === "investment")
    .reduce((s, a) => s + (row?.accountEnd[a.id] ?? 0), 0);
  const spentMonth = row?.outflow ?? 0;

  const bills = snap.recurring
    .filter((r) => r.status === "active" && r.kind === "bill" && remainingRecurringCents(snap, r) > 0)
    .sort((a, b) => (a.nextDue < b.nextDue ? -1 : 1))
    .slice(0, 4);

  const recent = snap.transactions
    .filter((t) => t.status === "confirmed" && !t.reverses)
    .slice()
    .sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1))
    .slice(0, 5);

  return (
    <div className="money-page money-home">
      <section className="money-hero">
        <p className="money-kicker">Total money</p>
        <p className="money-balance" aria-label={`Total money ${formatEUR(totalCents)}`}>
          {formatEUR(totalCents)}
        </p>
      </section>

      {!hasAccounts && (
        <button type="button" className="money-setup-card" onClick={onSetup}>
          <span><strong>Add your accounts</strong><br /><span className="money-muted money-small">Start with Revolut, AIB, cash…</span></span>
          <span aria-hidden>›</span>
        </button>
      )}

      {hasAccounts && (
        <>
          <section className="money-stat-grid" aria-label="Money summary">
            <Stat label="Spendable" value={formatEUR(spendableCents)} />
            <Stat label="Savings" value={formatEUR(savingsCents)} />
            <Stat label="Investments" value={formatEUR(investmentCents)} />
            <Stat label="Bills remaining" value={formatEUR(billTotals.remainingThisMonthCents)} />
            <Stat label="Spent this month" value={formatEUR(spentMonth)} wide />
          </section>

          <section className="money-quick-actions" aria-label="Quick actions">
            <button type="button" className="money-quick" onClick={() => onFlow("add")}>+ Add Money</button>
            <button type="button" className="money-quick" onClick={() => onFlow("send")}>Spend / Send</button>
            <button type="button" className="money-quick" onClick={() => onFlow("transfer")}>Transfer</button>
          </section>
          <button type="button" className="money-link money-income-link" onClick={onIncome}>Split income / salary</button>

          <section className="money-block">
            <div className="money-block-head">
              <h2 className="money-h2">Accounts</h2>
              <button type="button" className="money-link" onClick={() => onNavigate("accounts")}>See all</button>
            </div>
            <ul className="money-home-accounts">
              {accounts.slice(0, 6).map((a) => (
                <li key={a.id}>
                  <button type="button" className="money-home-account" onClick={() => onNavigate("accounts", a.id)}>
                    <span>
                      <strong>{a.name}</strong>
                      <span className="money-muted money-small">{ACCOUNT_KINDS[a.kind].label}</span>
                    </span>
                    <strong>{formatEUR(accountTotalCents(snap, a.id))}</strong>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="money-block">
            <div className="money-block-head">
              <h2 className="money-h2">Upcoming</h2>
              <button type="button" className="money-link" onClick={() => onNavigate("bills")}>See all</button>
            </div>
            {bills.length === 0 ? (
              <p className="money-muted">No bills due.</p>
            ) : (
              <ul className="money-upcoming">
                {bills.map((r) => {
                  const due = dueLabel(r.nextDue, today);
                  const left = remainingRecurringCents(snap, r);
                  return (
                    <li key={r.id} className="money-upcoming-item">
                      <span className="money-upcoming-text">
                        <span className="money-upcoming-name">{r.name}</span>
                        <span className={due.overdue ? "money-small is-neg" : "money-small money-muted"}>
                          {due.text} · {formatEUR(left)} · {locationLabel(snap, r.accountId, r.pocketId ?? null)}
                        </span>
                      </span>
                      <button type="button" className="money-btn-small" onClick={() => onConfirmBill(r.id)}>
                        Pay Now
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="money-block">
            <div className="money-block-head">
              <h2 className="money-h2">Recent</h2>
              <button type="button" className="money-link" onClick={() => onNavigate("activity")}>See all</button>
            </div>
            {recent.length === 0 ? (
              <p className="money-muted">No movements yet.</p>
            ) : (
              <ul className="money-tx-list">
                {recent.map((t) => {
                  const sign =
                    t.kind === "income" || t.kind === "refund" || (t.kind === "adjustment" && t.amountCents > 0)
                      ? "+"
                      : t.kind === "transfer"
                        ? "↔"
                        : "−";
                  const tone = t.kind === "transfer" ? "" : sign === "+" ? " is-pos" : " is-neg";
                  return (
                    <li key={t.id} className="money-tx-row">
                      <span>
                        <strong>{t.description}</strong>
                        <span className="money-muted money-small">
                          {formatDateIE(t.date)} · {locationLabel(snap, t.accountId, t.pocketId ?? null)}
                          {t.kind === "transfer" ? ` → ${locationLabel(snap, t.toAccountId, t.toPocketId ?? null)}` : ""}
                        </span>
                      </span>
                      <strong className={`money-tx-amt${tone}`}>
                        {sign === "↔" ? "↔ " : sign}
                        {formatEUR(Math.abs(t.amountCents))}
                      </strong>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`money-stat-cell${wide ? " is-wide" : ""}`}>
      <span className="money-muted money-small">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
