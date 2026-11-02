"use client";

import { useMemo, useState } from "react";
import { buildForecast, type Scenario } from "@/money/forecast";
import { formatEUR, formatMonthIE, parseEuroToCents, todayISO } from "@/money/money";
import { LineChart } from "../charts";
import type { MoneyApi } from "../MoneyApp";

const MILESTONES = [1, 3, 6, 12] as const;

export default function ForecastPage({ api, onSetup }: { api: MoneyApi; onSetup?: () => void }) {
  const { snap } = api;
  const [scenario, setScenario] = useState<Scenario>("scheduled");
  const [selected, setSelected] = useState<number>(0);
  const [whatIfAmt, setWhatIfAmt] = useState("");
  const today = todayISO();
  const hasAccount = snap.accounts.some((a) => !a.archived);
  const hasIncome = snap.recurring.some((r) => r.kind === "income" && r.status === "active");

  // The what-if is a preview only: it is passed to the forecast engine and never saved.
  const extra = useMemo(() => {
    const cents = parseEuroToCents(whatIfAmt);
    const account = snap.accounts.find((a) => !a.archived);
    if (!cents || cents <= 0 || !account) return [];
    return [
      {
        kind: "expense" as const,
        date: today,
        amountCents: cents,
        accountId: account.id,
        toAccountId: null,
        categoryId: null,
        description: "What-if expense",
      },
    ];
  }, [snap, whatIfAmt, today]);

  const forecast = useMemo(
    () => buildForecast(snap, scenario, { extra }, 12, today),
    [snap, scenario, extra, today],
  );

  const months = forecast.months;
  const current = months[selected] ?? months[0];
  const milestoneIdx = (n: number) => Math.min(n, months.length) - 1;
  const points = months.map((m) => ({ date: `${m.month}-01`, cents: m.end }));
  const needsSetup = !hasAccount || !hasIncome;

  return (
    <div className="money-page">
      <section className="money-block">
        <p className="money-kicker">My future</p>
        <div className="money-seg" role="radiogroup" aria-label="What to include">
          <button type="button" role="radio" aria-checked={scenario === "scheduled"} className={`money-seg-btn${scenario === "scheduled" ? " is-active" : ""}`} onClick={() => setScenario("scheduled")}>Bills & salary</button>
          <button type="button" role="radio" aria-checked={scenario === "planned"} className={`money-seg-btn${scenario === "planned" ? " is-active" : ""}`} onClick={() => setScenario("planned")}>+ Spending plan</button>
        </div>
        <p className="money-muted money-small">
          {scenario === "scheduled"
            ? "Your confirmed balance plus expected salary, bills and planned items."
            : "Also includes what is left in each category's monthly plan. Bills already in categories are not counted twice."}
        </p>
        {forecast.warning && <p className="money-error" role="status">{forecast.warning}</p>}
      </section>

      {needsSetup && (
        <section className="money-block money-setup-card">
          <p><strong>Forecasts need a little information.</strong></p>
          <p className="money-muted money-small">
            {!hasAccount ? "Add an account and its balance. " : ""}
            {!hasIncome ? "Add your salary and payday." : ""}
          </p>
          {onSetup && <button type="button" className="money-btn-small" onClick={onSetup}>Finish setup</button>}
        </section>
      )}

      <section className="money-stack">
        <div className="money-milestones" role="tablist" aria-label="Months ahead">
          {MILESTONES.map((n) => {
            const idx = milestoneIdx(n);
            const m = months[idx];
            if (!m) return null;
            return (
              <button
                key={n}
                type="button"
                role="tab"
                aria-selected={selected === idx}
                className={`money-milestone${selected === idx ? " is-active" : ""}`}
                onClick={() => setSelected(idx)}
              >
                <span className="money-small money-muted">{n === 1 ? "Next month" : `${n} months`}</span>
                <strong className={m.end < 0 ? "is-neg" : ""}>{formatEUR(m.end)}</strong>
              </button>
            );
          })}
        </div>

        <LineChart points={points} />
        <p className="money-muted money-small">
          History and projected months.
        </p>
      </section>

      {current && (
        <section className="money-block">
          <p className="money-kicker">{formatMonthIE(current.month)}</p>
          <div className="money-grid2">
            <div className="money-stat"><span className="money-muted money-small">Starts with</span><strong>{formatEUR(current.start)}</strong></div>
            <div className="money-stat"><span className="money-muted money-small">Ends with</span><strong className={current.end < 0 ? "is-neg" : ""}>{formatEUR(current.end)}</strong></div>
            <div className="money-stat"><span className="money-muted money-small">Income</span><strong>{formatEUR(current.income)}</strong></div>
            <div className="money-stat"><span className="money-muted money-small">Spending & bills</span><strong>{formatEUR(current.outflow)}</strong></div>
          </div>
          {current.items.length > 0 && (
            <details className="money-more">
              <summary className="money-link">What&apos;s included</summary>
              <ul className="money-list">
                {current.items.map((it, j) => (
                  <li key={j} className="money-row">
                    <span>{it.label}{it.projected ? " (projected)" : ""}</span>
                    <strong>{formatEUR(it.amountCents)}</strong>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      <section className="money-block">
        <p className="money-kicker">What if I spend or save?</p>
        <div className="money-inline">
          <input inputMode="decimal" aria-label="Hypothetical expense" value={whatIfAmt} placeholder="0.00" onChange={(e) => setWhatIfAmt(e.target.value)} />
          {whatIfAmt && <button type="button" className="money-link" onClick={() => setWhatIfAmt("")}>Clear</button>}
        </div>
        {extra.length > 0 && current && (
          <p className="money-small">
            Ends {formatMonthIE(current.month)} with <strong>{formatEUR(current.end)}</strong> including this preview.
          </p>
        )}
      </section>
    </div>
  );
}
