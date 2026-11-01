"use client";

import { useMemo } from "react";
import type { GroceriesApi } from "../GroceriesApp";
import { formatEUR } from "@/money/money";
import { listEstimate, shiftDate } from "@/groceries/logic";
import { todayLocal } from "@/groceries/actions";
import type { Purchase, Log } from "@/groceries/model";

export default function AnalyticsPage({ api }: { api: GroceriesApi }) {
  const { snap } = api;
  const today = todayLocal();
  const weekStart = shiftDate(today, -6);
  const monthStart = `${today.slice(0, 7)}-01`;

  const sumSince = (from: string) =>
    snap.purchases.filter((p) => p.date >= from && p.date <= today).reduce((s, p) => s + p.costCents, 0);
  const weekCents = sumSince(weekStart);
  const monthCents = sumSince(monthStart);
  const hasPurchases = snap.purchases.length > 0;

  const topBought = useMemo(() => rank(snap.purchases.map((p) => ({ key: p.name, qty: p.packs }))), [snap.purchases]);
  const topEaten = useMemo(() => rank(snap.logs.filter((l) => l.kind === "eat").flatMap(eatenLines)), [snap.logs]);
  const history = useMemo(() => [...snap.purchases].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 12), [snap.purchases]);
  const future = listEstimate(snap.items.filter((i) => !i.purchased));

  return (
    <div className="gr-stack">
      <section className="gr-card">
        <p className="gr-kicker">Actual spending</p>
        <div className="gr-grid2">
          <Metric label="This week" value={weekCents} />
          <Metric label="This month" value={monthCents} />
        </div>
        {!hasPurchases && (
          <p className="gr-muted">No spending yet. Tick items as bought in Shopping and their cost is recorded here.</p>
        )}
      </section>

      <section className="gr-card">
        <p className="gr-kicker">Estimated future shopping (not spent)</p>
        <p className="gr-total-value is-muted">{formatEUR(future.cents)}</p>
        <p className="gr-muted gr-small">
          Based on the active list at saved prices.{future.missing ? ` ${future.missing} item(s) have no saved price.` : ""}
        </p>
      </section>

      <Ranking title="Most bought" rows={topBought} empty="Bought items appear here after you tick them off in Shopping." />
      <Ranking title="Most eaten" rows={topEaten} empty="Eaten foods appear here after you log a meal." />

      <section className="gr-card">
        <p className="gr-kicker">Shopping history</p>
        {history.length === 0 ? (
          <p className="gr-muted">No purchases recorded yet.</p>
        ) : (
          <ul className="gr-list">
            {history.map((p) => <HistoryRow key={p.id} p={p} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="gr-metric">
      <span className="gr-muted gr-small">{label}</span>
      <span className="gr-metric-value">{formatEUR(value)}</span>
    </div>
  );
}

function HistoryRow({ p }: { p: Purchase }) {
  return (
    <li className="gr-row">
      <div className="gr-row-main">
        <span className="gr-name">{p.name} × {p.packs}</span>
        <span className="gr-muted">{p.date}{p.costIsEstimate ? " · estimated cost" : ""}</span>
      </div>
      <span>{formatEUR(p.costCents)}</span>
    </li>
  );
}

function Ranking({ title, rows, empty }: { title: string; rows: { key: string; qty: number }[]; empty: string }) {
  return (
    <section className="gr-card">
      <p className="gr-kicker">{title}</p>
      {rows.length === 0 ? (
        <p className="gr-muted">{empty}</p>
      ) : (
        <ol className="gr-rank">
          {rows.slice(0, 8).map((r) => (
            <li key={r.key}><span>{r.key}</span><span className="gr-muted">{r.qty}</span></li>
          ))}
        </ol>
      )}
    </section>
  );
}

function rank(items: { key: string; qty: number }[]): { key: string; qty: number }[] {
  const totals = new Map<string, number>();
  for (const it of items) totals.set(it.key, (totals.get(it.key) ?? 0) + it.qty);
  return [...totals.entries()].map(([key, qty]) => ({ key, qty })).sort((a, b) => b.qty - a.qty);
}

function eatenLines(l: Log): { key: string; qty: number }[] {
  // Count how many times a food was eaten, so units never mix across foods.
  return l.lines.map((x) => ({ key: x.name ?? x.foodId, qty: 1 }));
}
