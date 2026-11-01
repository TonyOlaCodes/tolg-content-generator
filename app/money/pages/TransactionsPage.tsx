"use client";

import { useMemo, useState } from "react";
import { deleteTransaction, reverseTransaction, defaultCtx } from "@/money/actions";
import { formatEUR, formatDateIE } from "@/money/money";
import type { Transaction } from "@/money/types";
import type { MoneyApi } from "../MoneyApp";

const KIND_LABEL: Record<Transaction["kind"], string> = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
  refund: "Refund",
  adjustment: "Adjustment",
};

/** Signed effect on total money (transfers and reversed rows still show their own amount). */
function signed(t: Transaction): number {
  if (t.kind === "income" || t.kind === "refund") return t.amountCents;
  if (t.kind === "adjustment") return t.amountCents;
  if (t.kind === "transfer") return 0;
  return -t.amountCents;
}

export default function TransactionsPage({ api, notify }: { api: MoneyApi; notify: (m: string) => void }) {
  const { snap, commit } = api;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "planned" | Transaction["kind"]>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const accountName = (id: string | null) => snap.accounts.find((a) => a.id === id)?.name ?? "—";
  const categoryName = (id: string | null) => snap.categories.find((c) => c.id === id)?.name ?? "";

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const catName = (id: string | null) => snap.categories.find((c) => c.id === id)?.name ?? "";
    const list = snap.transactions
      .filter((t) => (filter === "all" ? true : filter === "planned" ? t.status === "planned" : t.kind === filter))
      .filter((t) => !q || t.description.toLowerCase().includes(q) || catName(t.categoryId).toLowerCase().includes(q))
      .sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1));
    const map = new Map<string, Transaction[]>();
    for (const t of list) {
      const arr = map.get(t.date);
      if (arr) arr.push(t);
      else map.set(t.date, [t]);
    }
    return Array.from(map.entries());
  }, [snap, query, filter]);

  const run = async (id: string, build: () => ReturnType<typeof deleteTransaction>, okMsg: string) => {
    if (busyId) return;
    setBusyId(id);
    const err = await commit(build());
    setBusyId(null);
    if (err) notify(err);
    else notify(okMsg);
  };

  const remove = (t: Transaction) => {
    if (!window.confirm(`Delete "${t.description}"? Its balance effect will be removed.`)) return;
    void run(t.id, () => deleteTransaction(snap, t.id, defaultCtx()), "Deleted");
  };

  const reverse = (t: Transaction) => {
    if (!window.confirm(`Reverse "${t.description}"? A linked reversal will be recorded and the original kept.`)) return;
    void run(t.id, () => reverseTransaction(snap, t.id, defaultCtx()), "Reversed");
  };

  return (
    <div className="money-page">
      <div className="money-search">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search description or category" aria-label="Search transactions" />
      </div>
      <div className="money-chips" role="radiogroup" aria-label="Filter">
        {(["all", "planned", "expense", "income", "transfer", "refund", "adjustment"] as const).map((f) => (
          <button key={f} type="button" role="radio" aria-checked={filter === f} className={`money-chip${filter === f ? " is-active" : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f === "planned" ? "Planned" : KIND_LABEL[f]}
          </button>
        ))}
      </div>

      {groups.length === 0 && <p className="money-muted">No transactions match. Use + to add one.</p>}

      {groups.map(([date, items]) => (
        <section key={date} className="money-day">
          <h2 className="money-day-head">{formatDateIE(date)}</h2>
          <ul className="money-list">
            {items.map((t) => {
              const eff = signed(t);
              const inactive = t.reverses || !!t.reversedBy;
              return (
                <li key={t.id} className={`money-tx${inactive ? " is-muted" : ""}${t.status === "planned" ? " is-planned" : ""}`}>
                  <div className="money-tx-main">
                    <span className="money-tx-title">
                      {t.description}
                      {t.status === "planned" && <span className="money-badge">Planned</span>}
                      {t.reverses && <span className="money-badge">Reversal</span>}
                      {t.reversedBy && <span className="money-badge">Reversed</span>}
                    </span>
                    <span className="money-muted">
                      {KIND_LABEL[t.kind]} · {accountName(t.accountId)}
                      {t.kind === "transfer" ? ` → ${accountName(t.toAccountId)}` : ""}
                      {categoryName(t.categoryId) ? ` · ${categoryName(t.categoryId)}` : ""}
                    </span>
                  </div>
                  <strong className={`money-tx-amt${eff < 0 ? " is-neg" : eff > 0 ? " is-pos" : ""}`}>
                    {t.kind === "transfer" ? formatEUR(t.amountCents) : `${eff < 0 ? "−" : eff > 0 ? "+" : ""}${formatEUR(Math.abs(eff) || t.amountCents)}`}
                  </strong>
                  {t.status === "confirmed" && !inactive && (
                    <div className="money-tx-actions">
                      <button type="button" className="money-link" disabled={busyId === t.id} onClick={() => reverse(t)}>Reverse</button>
                      <button type="button" className="money-link is-danger" disabled={busyId === t.id} onClick={() => remove(t)}>Delete</button>
                    </div>
                  )}
                  {t.status === "planned" && (
                    <div className="money-tx-actions">
                      <button type="button" className="money-link is-danger" disabled={busyId === t.id} onClick={() => remove(t)}>Delete</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
