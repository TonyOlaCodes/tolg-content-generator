"use client";

import { useMemo, useState } from "react";
import { buildForecast, type Scenario } from "@/money/forecast";
import { formatEUR, formatMonthIE, parseEuroToCents, todayISO } from "@/money/money";
import { LineChart } from "../charts";
import type { MoneyApi } from "../MoneyApp";

export default function ForecastPage({ api }: { api: MoneyApi }) {
  const { snap } = api;
  const [scenario, setScenario] = useState<Scenario>("scheduled");
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [whatIfAmt, setWhatIfAmt] = useState("");
  const [whatIfOn, setWhatIfOn] = useState(false);
  const today = todayISO();

  const extra = useMemo(() => {
    const cents = parseEuroToCents(whatIfAmt);
    const account = snap.accounts.find((a) => !a.archived);
    if (!whatIfOn || !cents || cents <= 0 || !account) return [];
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
  }, [snap, whatIfAmt, whatIfOn, today]);

  const forecast = useMemo(
    () => buildForecast(snap, scenario, { extra }, 12, today),
    [snap, scenario, extra, today],
  );

  const points = forecast.months.map((m) => ({ date: `${m.month}-01`, cents: m.end }));
  const detail = openIdx !== null ? forecast.months[openIdx] : null;

  return (
    <div className="money-page">
      <section className="money-panel">
        <div className="money-seg" role="radiogroup" aria-label="Scenario">
          <button type="button" role="radio" aria-checked={scenario === "scheduled"} className={`money-seg-btn${scenario === "scheduled" ? " is-active" : ""}`} onClick={() => setScenario("scheduled")}>Scheduled only</button>
          <button type="button" role="radio" aria-checked={scenario === "planned"} className={`money-seg-btn${scenario === "planned" ? " is-active" : ""}`} onClick={() => setScenario("planned")}>+ Planned spend</button>
        </div>
        <p className="money-muted">{scenario === "scheduled" ? "Only scheduled bills, salary and planned items." : "Adds each category's remaining plan, without repeating bills already scheduled."} An estimate, not a guarantee.</p>
        {forecast.warning && <p className="money-error" role="status">{forecast.warning}</p>}
      </section>

      <section className="money-panel">
        <h2 className="money-h2">Balance over 12 months</h2>
        <LineChart points={points} />
        <p className="money-muted">Solid figures come from your confirmed transactions. Later months are projections.</p>
      </section>

      <section className="money-panel">
        <h2 className="money-h2">What if</h2>
        <p className="money-muted">Preview an extra expense today. It is not saved and does not change your actual finances.</p>
        <div className="money-inline">
          <input inputMode="decimal" aria-label="Hypothetical expense" value={whatIfAmt} placeholder="0.00" onChange={(e) => setWhatIfAmt(e.target.value)} />
          <button type="button" className="money-btn-small" onClick={() => setWhatIfOn((v) => !v)} disabled={!parseEuroToCents(whatIfAmt)}>
            {whatIfOn ? "Remove" : "Preview"}
          </button>
        </div>
      </section>

      <section className="money-panel">
        <h2 className="money-h2">Month by month</h2>
        <ul className="money-list">
          {forecast.months.map((m, i) => (
            <li key={m.month}>
              <button type="button" className="money-month" onClick={() => setOpenIdx(i)}>
                <span>{formatMonthIE(m.month)}</span>
                <span className="money-muted">{formatEUR(m.start)} → {formatEUR(m.end)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {detail && (
        <div className="money-sheet-backdrop" role="presentation" onClick={() => setOpenIdx(null)}>
          <div className="money-sheet" role="dialog" aria-modal="true" aria-label={`Forecast for ${formatMonthIE(detail.month)}`} onClick={(e) => e.stopPropagation()}>
            <div className="money-sheet-head">
              <strong>{formatMonthIE(detail.month)}</strong>
              <button type="button" className="money-link" onClick={() => setOpenIdx(null)}>Close</button>
            </div>
            <div className="money-grid2">
              <div className="money-stat"><span className="money-muted">Start</span><strong>{formatEUR(detail.start)}</strong></div>
              <div className="money-stat"><span className="money-muted">End</span><strong className={detail.end < 0 ? "is-neg" : ""}>{formatEUR(detail.end)}</strong></div>
              <div className="money-stat"><span className="money-muted">Income</span><strong>{formatEUR(detail.income)}</strong></div>
              <div className="money-stat"><span className="money-muted">Outflow</span><strong>{formatEUR(detail.outflow)}</strong></div>
            </div>
            <p className="money-muted">Projected income {formatEUR(detail.projectedIncome)} · projected outflow {formatEUR(detail.projectedOutflow)}</p>
            <ul className="money-list">
              {detail.items.map((it, j) => (
                <li key={j} className="money-row">
                  <span>{it.label}{it.projected ? " (projected)" : ""}</span>
                  <strong>{formatEUR(it.amountCents)}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
