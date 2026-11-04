"use client";

import { useMemo, useState } from "react";
import { computeMonthSpending, adjacentMonth } from "@/money/spending";
import { formatEUR, formatMonthIE, formatDateIE, currentMonth } from "@/money/money";
import type { Transaction } from "@/money/types";
import type { MoneyApi } from "../MoneyApp";
import { Donut } from "../charts";
import { locationLabel } from "../locations";
import { TransactionDetail } from "./TransactionDetail";

type SortKey = "newest" | "oldest" | "high" | "low";

export default function SpendingPage({
  api,
  notify,
  onBack,
  initialMonth,
}: {
  api: MoneyApi;
  notify: (m: string) => void;
  onBack: () => void;
  initialMonth?: string;
}) {
  const { snap } = api;
  const [month, setMonth] = useState(initialMonth ?? currentMonth());
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [locationKey, setLocationKey] = useState("all");
  const [txId, setTxId] = useState<string | null>(null);

  const data = useMemo(() => computeMonthSpending(snap, month), [snap, month]);
  const canNext = month < currentMonth();

  const slices = data.byCategory.map((c) => ({ label: c.name, color: c.color, value: c.cents }));

  const filtered = useMemo(() => {
    let list = data.expenses.slice();
    if (selectedCat) {
      const cat = data.byCategory.find((c) => c.name === selectedCat);
      list = list.filter((t) => {
        if (!cat) return true;
        if (cat.categoryId === null) return !t.categoryId;
        return t.categoryId === cat.categoryId;
      });
    }
    if (locationKey !== "all") {
      list = list.filter((t) => `${t.accountId}|${t.pocketId ?? ""}` === locationKey);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => {
        const cat = snap.categories.find((c) => c.id === t.categoryId)?.name ?? "";
        return t.description.toLowerCase().includes(q) || cat.toLowerCase().includes(q);
      });
    }
    list.sort((a, b) => {
      if (sort === "newest") return a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1;
      if (sort === "oldest") return a.date === b.date ? (a.createdAt > b.createdAt ? 1 : -1) : a.date > b.date ? 1 : -1;
      if (sort === "high") return b.amountCents - a.amountCents;
      return a.amountCents - b.amountCents;
    });
    return list;
  }, [data, selectedCat, locationKey, query, sort, snap.categories]);

  if (txId) {
    const tx = snap.transactions.find((t) => t.id === txId);
    if (tx) {
      return <TransactionDetail api={api} tx={tx} notify={notify} onBack={() => setTxId(null)} />;
    }
  }

  return (
    <div className="money-page">
      <button type="button" className="money-link" onClick={onBack}>← Home</button>
      <section className="money-hero money-hero-left">
        <div className="money-month-nav">
          <button type="button" className="money-icon-btn" aria-label="Previous month" onClick={() => setMonth(adjacentMonth(month, -1))}>‹</button>
          <div>
            <p className="money-kicker">{formatMonthIE(month)} spending</p>
            <p className="money-balance">{formatEUR(data.netCents)}</p>
          </div>
          <button type="button" className="money-icon-btn" aria-label="Next month" disabled={!canNext} onClick={() => canNext && setMonth(adjacentMonth(month, 1))}>›</button>
        </div>
      </section>

      <section className="money-stat-grid">
        <div className="money-stat-cell"><span className="money-muted money-small">Gross spending</span><strong>{formatEUR(data.grossExpenseCents)}</strong></div>
        <div className="money-stat-cell"><span className="money-muted money-small">Refunds</span><strong>{formatEUR(data.refundCents)}</strong></div>
        <div className="money-stat-cell"><span className="money-muted money-small">Net spending</span><strong>{formatEUR(data.netCents)}</strong></div>
        <div className="money-stat-cell"><span className="money-muted money-small">Expenses</span><strong>{data.expenseCount}</strong></div>
      </section>

      <section className="money-block">
        <h2 className="money-h2">By category</h2>
        <Donut
          slices={slices}
          emptyLabel="No spending this month."
          selectedLabel={selectedCat}
          onSelect={(label) => setSelectedCat((c) => (c === label ? null : label))}
        />
      </section>

      {data.byLocation.length > 0 && (
        <section className="money-block">
          <h2 className="money-h2">By account / pocket</h2>
          <ul className="money-breakdown-list">
            {data.byLocation.map((l) => (
              <li key={l.key}>
                <button type="button" className="money-link" onClick={() => setLocationKey((k) => (k === l.key ? "all" : l.key))}>
                  {l.label}{locationKey === l.key ? " · filtered" : ""}
                </button>
                <strong>{formatEUR(l.cents)}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="money-block">
        <div className="money-block-head">
          <h2 className="money-h2">{selectedCat ? selectedCat : "Transactions"}</h2>
          {selectedCat && <button type="button" className="money-link" onClick={() => setSelectedCat(null)}>Clear</button>}
        </div>
        <div className="money-search">
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search merchant or category" aria-label="Search spending" />
        </div>
        <div className="money-chips" role="radiogroup" aria-label="Sort">
          {([
            { id: "newest", label: "Newest" },
            { id: "oldest", label: "Oldest" },
            { id: "high", label: "Highest" },
            { id: "low", label: "Lowest" },
          ] as const).map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={sort === s.id} className={`money-chip${sort === s.id ? " is-active" : ""}`} onClick={() => setSort(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <p className="money-muted">No expenses match.</p>
        ) : (
          <ul className="money-tx-list">
            {filtered.map((t) => (
              <ExpenseRow key={t.id} tx={t} api={api} onOpen={() => setTxId(t.id)} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ExpenseRow({ tx, api, onOpen }: { tx: Transaction; api: MoneyApi; onOpen: () => void }) {
  const cat = api.snap.categories.find((c) => c.id === tx.categoryId)?.name ?? "Uncategorised";
  return (
    <li>
      <button type="button" className="money-tx-row" onClick={onOpen}>
        <span>
          <strong>{tx.description}</strong>
          <span className="money-muted money-small">
            {formatDateIE(tx.date)} · {cat} · {locationLabel(api.snap, tx.accountId, tx.pocketId ?? null)}
          </span>
        </span>
        <strong className="money-tx-amt is-neg">−{formatEUR(tx.amountCents)}</strong>
      </button>
    </li>
  );
}
