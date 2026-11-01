"use client";

import { currentPosition, balancePoints } from "@/money/engine";
import { currentMonth, formatEUR, formatMonthIE, dueLabel, monthlyEquivalentCents } from "@/money/money";
import type { MoneyApi, PageId } from "../MoneyApp";
import { Donut, LineChart } from "../charts";

export default function OverviewPage({ api, onNavigate }: { api: MoneyApi; onNavigate: (p: PageId) => void }) {
  const { snap } = api;
  const month = currentMonth();
  const row = currentPosition(snap, month);
  const accounts = snap.accounts.filter((a) => !a.archived);
  const spendableIds = new Set(accounts.filter((a) => !a.excludeFromSpendable).map((a) => a.id));

  const upcoming = snap.recurring
    .filter((r) => r.status === "active" && r.kind === "bill")
    .sort((a, b) => (a.nextDue < b.nextDue ? -1 : 1))
    .slice(0, 4);

  const spendableCents = row
    ? Object.entries(row.accountEnd)
        .filter(([id]) => spendableIds.has(id))
        .reduce((s, [, v]) => s + v, 0)
    : 0;

  const points = balancePoints(snap);
  const allocation = snap.categories
    .filter((c) => !c.archived && (row?.catEnd[c.id] ?? 0) > 0)
    .map((c) => ({ label: c.name, color: c.color, value: row?.catEnd[c.id] ?? 0 }));

  const savingsCats = snap.categories.filter((c) => c.kind === "saving" && !c.archived);
  const savingsCents = savingsCats.reduce((s, c) => s + (row?.catEnd[c.id] ?? 0), 0);
  const savingsGoal = savingsCats.reduce((s, c) => s + (c.goalCents ?? 0), 0);

  const monthlyBills = snap.recurring
    .filter((r) => r.status === "active" && r.kind === "bill")
    .reduce((s, r) => s + monthlyEquivalentCents(r.amountCents, r), 0);

  return (
    <div className="money-page">
      <section className="money-hero">
        <p className="money-kicker">{formatMonthIE(month)}</p>
        <p className="money-total">{formatEUR(row?.totalEnd ?? 0)}</p>
        <p className="money-muted">Total across all accounts</p>
      </section>

      {accounts.length === 0 ? (
        <section className="money-panel">
          <p>No accounts yet. Add your real balances in Settings to start.</p>
          <button type="button" className="money-btn-primary" onClick={() => onNavigate("settings")}>Set up accounts</button>
        </section>
      ) : (
        <>
          <section className="money-grid2">
            <Stat label="Spendable cash" value={formatEUR(spendableCents)} />
            <Stat label="Allocated" value={formatEUR(row?.allocatedEnd ?? 0)} />
            <Stat label="Unallocated" value={formatEUR(row?.unallocatedEnd ?? 0)} warn={(row?.unallocatedEnd ?? 0) < 0} />
            <Stat label="Remaining budget" value={formatEUR((row?.allocatedEnd ?? 0) - (row?.outflow ?? 0))} />
            <Stat label="Income this month" value={formatEUR(row?.income ?? 0)} />
            <Stat label="Expenses this month" value={formatEUR(row?.outflow ?? 0)} />
          </section>

          <section className="money-panel">
            <h2 className="money-h2">Accounts</h2>
            <ul className="money-list">
              {accounts.map((a) => (
                <li key={a.id} className="money-row">
                  <span>{a.name}</span>
                  <strong className={(row?.accountEnd[a.id] ?? 0) < 0 ? "is-neg" : ""}>{formatEUR(row?.accountEnd[a.id] ?? 0)}</strong>
                </li>
              ))}
            </ul>
          </section>

          <section className="money-panel">
            <h2 className="money-h2">Allocation</h2>
            <p className="money-muted">Envelopes this month. Account balances are a separate view and are not added here.</p>
            <Donut slices={allocation} emptyLabel="Allocate money to categories in Budget to see it here." />
          </section>

          <section className="money-panel">
            <h2 className="money-h2">Balance history</h2>
            <LineChart points={points} />
          </section>

          <section className="money-panel">
            <h2 className="money-h2">Upcoming payments</h2>
            {upcoming.length === 0 ? (
              <p className="money-muted">No active bills.</p>
            ) : (
              <ul className="money-list">
                {upcoming.map((r) => {
                  const due = dueLabel(r.nextDue);
                  return (
                    <li key={r.id} className="money-row">
                      <span>{r.name} · {formatEUR(r.amountCents)} · <span className={due.overdue ? "is-neg" : ""}>{due.text}</span></span>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="money-muted">Scheduled bills cost roughly {formatEUR(monthlyBills)} a month.</p>
          </section>

          {savingsCats.length > 0 && (
            <section className="money-panel">
              <h2 className="money-h2">Savings</h2>
              <p className="money-total-sm">{formatEUR(savingsCents)}{savingsGoal > 0 ? ` of ${formatEUR(savingsGoal)}` : ""}</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="money-stat">
      <span className="money-muted">{label}</span>
      <strong className={warn ? "is-neg" : ""}>{value}</strong>
    </div>
  );
}
