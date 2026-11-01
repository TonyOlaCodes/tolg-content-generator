"use client";

import { currentPosition } from "@/money/engine";
import { confirmRecurring, defaultCtx } from "@/money/actions";
import { currentMonth, daysInMonth, dueLabel, formatEUR, formatMonthIE, todayISO } from "@/money/money";
import type { MoneyApi, PageId } from "../MoneyApp";
import { Donut, type Slice } from "../charts";

export default function OverviewPage({
  api,
  onNavigate,
  onSetup,
  notify,
}: {
  api: MoneyApi;
  onNavigate: (p: PageId) => void;
  onSetup: () => void;
  notify: (msg: string) => void;
}) {
  const { snap } = api;
  const month = currentMonth();
  const today = todayISO();
  const row = currentPosition(snap, month);
  const accounts = snap.accounts.filter((a) => !a.archived);
  const spendableIds = new Set(accounts.filter((a) => !a.excludeFromSpendable).map((a) => a.id));

  const totalCents = row?.totalEnd ?? 0;
  const spendableCents = row
    ? Object.entries(row.accountEnd)
        .filter(([id]) => spendableIds.has(id))
        .reduce((s, [, v]) => s + v, 0)
    : 0;

  // Active bills that are still unpaid and due by the end of this month (or already overdue).
  const monthEnd = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  const bills = snap.recurring
    .filter((r) => r.status === "active" && r.kind === "bill")
    .sort((a, b) => (a.nextDue < b.nextDue ? -1 : a.nextDue > b.nextDue ? 1 : 0));
  const dueThisMonth = bills.filter((r) => r.nextDue <= monthEnd);
  const billsDueCents = dueThisMonth.reduce((s, r) => s + r.amountCents, 0);
  const availableCents = spendableCents - billsDueCents;

  // Spending plan: monthly target per spending category. Targets are plans and never reduce the balance.
  const spendCats = snap.categories.filter((c) => !c.archived && c.kind === "spending");
  const planCents = spendCats.reduce((s, c) => s + c.targetCents, 0);
  const spentPlanCents = spendCats.reduce((s, c) => s + (row?.catSpent[c.id] ?? 0), 0);
  const plannedLeftCents = spendCats.reduce(
    (s, c) => s + Math.max(c.targetCents - (row?.catSpent[c.id] ?? 0), 0),
    0,
  );
  const slices: Slice[] = spendCats
    .filter((c) => c.targetCents > 0)
    .map((c) => ({ label: c.name, color: c.color, value: c.targetCents }));

  const savingsPlanCents = snap.categories
    .filter((c) => !c.archived && c.kind === "saving")
    .reduce((s, c) => s + c.targetCents, 0);
  const incomeCents = row?.income ?? 0;

  const dayOfMonth = Number(today.slice(8, 10));
  const elapsed = Math.min(dayOfMonth / daysInMonth(month), 1);
  const used = planCents > 0 ? Math.min(spentPlanCents / planCents, 1) : 0;

  const hasAccounts = accounts.length > 0;
  const setupNeeded = !hasAccounts || (incomeCents === 0 && planCents === 0);

  async function confirmPaid(id: string, name: string) {
    const err = await api.commit(confirmRecurring(api.snap, id, defaultCtx()));
    notify(err ?? `${name} marked as paid.`);
  }

  return (
    <div className="money-page money-home">
      <section className="money-hero">
        <p className="money-kicker">My Money · {formatMonthIE(month)}</p>
        <p className="money-balance" aria-label={`My money ${formatEUR(totalCents)}`}>
          {formatEUR(totalCents)}
        </p>
        <p className="money-muted">Across {accounts.length === 1 ? "your account" : `${accounts.length} accounts`}</p>
      </section>

      {setupNeeded && (
        <button type="button" className="money-setup-card" onClick={onSetup}>
          <span>
            <strong>{hasAccounts ? "Set up your monthly plan" : "Add your accounts"}</strong>
            <span className="money-muted">
              {hasAccounts ? "Add your salary and budget targets in a minute." : "Start with your balances. Takes a minute."}
            </span>
          </span>
          <span aria-hidden>›</span>
        </button>
      )}

      {hasAccounts && (
        <>
          <section className="money-stats">
            <Stat label="Available to spend" value={formatEUR(availableCents)} warn={availableCents < 0} hint={billsDueCents > 0 ? `After ${formatEUR(billsDueCents)} in bills due` : undefined} />
            <Stat label="Upcoming bills" value={formatEUR(billsDueCents)} hint={dueThisMonth.length ? `${dueThisMonth.length} due this month` : "Nothing due this month"} />
            <Stat label="Spent this month" value={formatEUR(row?.outflow ?? 0)} />
            <Stat label="Income this month" value={formatEUR(incomeCents)} />
            <Stat label="Planned savings" value={formatEUR(savingsPlanCents)} hint="Monthly plan" />
          </section>

          <section className="money-block">
            <div className="money-block-head">
              <h2 className="money-h2">Spending plan</h2>
              <button type="button" className="money-link" onClick={() => onNavigate("spending")}>Details</button>
            </div>
            <Donut slices={slices} emptyLabel="Set monthly targets to see your plan here." />
            <dl className="money-plan-split">
              <div>
                <dt><span className="money-dot is-spent" />Spent so far</dt>
                <dd>{formatEUR(spentPlanCents)}</dd>
              </div>
              <div>
                <dt><span className="money-dot is-planned" />Planned, not spent yet</dt>
                <dd>{formatEUR(plannedLeftCents)}</dd>
              </div>
              <div>
                <dt><span className="money-dot is-available" />Available to spend</dt>
                <dd>{formatEUR(availableCents)}</dd>
              </div>
            </dl>
          </section>

          <section className="money-block">
            <div className="money-progress-head">
              <span>Month progress</span>
              <span className="money-muted">
                {planCents > 0 ? `${formatEUR(spentPlanCents)} of ${formatEUR(planCents)} used` : "No budget set"}
              </span>
            </div>
            <div className="money-progress" role="img" aria-label={`${Math.round(elapsed * 100)}% of the month gone, ${Math.round(used * 100)}% of budget used`}>
              <span className="money-progress-time" style={{ width: `${elapsed * 100}%` }} />
              <span className="money-progress-used" style={{ width: `${used * 100}%` }} />
            </div>
            <p className="money-muted money-small">
              {Math.round(elapsed * 100)}% of the month gone · {Math.round(used * 100)}% of budget used
            </p>
          </section>

          <section className="money-block">
            <div className="money-block-head">
              <h2 className="money-h2">Upcoming</h2>
              <button type="button" className="money-link" onClick={() => onNavigate("upcoming")}>See all</button>
            </div>
            {bills.length === 0 ? (
              <p className="money-muted">No recurring bills. Add subscriptions or bills under Upcoming.</p>
            ) : (
              <ul className="money-upcoming">
                {bills.slice(0, 4).map((r) => {
                  const due = dueLabel(r.nextDue, today);
                  return (
                    <li key={r.id} className="money-upcoming-item">
                      <span className="money-upcoming-text">
                        <span className="money-upcoming-name">{r.icon ? `${r.icon} ` : ""}{r.name}</span>
                        <span className={due.overdue ? "money-small is-neg" : "money-small money-muted"}>
                          {due.text} · {formatEUR(r.amountCents)}
                        </span>
                      </span>
                      <button type="button" className="money-btn-small" onClick={() => confirmPaid(r.id, r.name)}>
                        Confirm Paid
                      </button>
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

function Stat({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div className="money-stat">
      <span className="money-muted">{label}</span>
      <strong className={warn ? "is-neg" : ""}>{value}</strong>
      {hint && <span className="money-small money-muted">{hint}</span>}
    </div>
  );
}
