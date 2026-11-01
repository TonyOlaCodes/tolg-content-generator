"use client";

import { useState } from "react";
import { currentPosition } from "@/money/engine";
import { setAllocation, moveAllocation } from "@/money/actions";
import { currentMonth, formatEUR, formatMonthIE, parseEuroToCents } from "@/money/money";
import type { MoneyApi } from "../MoneyApp";

export default function BudgetPage({ api, notify }: { api: MoneyApi; notify: (m: string) => void }) {
  const { snap, commit } = api;
  const month = currentMonth();
  const row = currentPosition(snap, month);
  const cats = snap.categories.filter((c) => !c.archived).sort((a, b) => a.order - b.order);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [moveFrom, setMoveFrom] = useState("");
  const [moveTo, setMoveTo] = useState("");
  const [moveAmt, setMoveAmt] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (categoryId: string) => {
    const raw = edit[categoryId];
    if (raw === undefined || busy) return;
    const cents = raw.trim() === "" ? 0 : parseEuroToCents(raw);
    if (cents === null || cents < 0) return notify("Enter an amount of zero or more");
    setBusy(true);
    const err = await commit(setAllocation(snap, month, categoryId, cents));
    setBusy(false);
    if (err) return notify(err);
    setEdit((e) => {
      const next = { ...e };
      delete next[categoryId];
      return next;
    });
    notify("Allocation saved");
  };

  const move = async () => {
    const cents = parseEuroToCents(moveAmt);
    if (!moveFrom || !moveTo || cents === null) return notify("Choose two categories and an amount");
    setBusy(true);
    const err = await commit(moveAllocation(snap, month, moveFrom, moveTo, cents));
    setBusy(false);
    if (err) return notify(err);
    setMoveAmt("");
    notify("Moved between categories");
  };

  const allocatedTotal = row?.allocatedEnd ?? 0;
  const totalMoney = row?.totalEnd ?? 0;
  const over = allocatedTotal > totalMoney;

  return (
    <div className="money-page">
      <section className="money-panel">
        <p className="money-kicker">{formatMonthIE(month)}</p>
        <div className="money-grid2">
          <div className="money-stat"><span className="money-muted">Total money</span><strong>{formatEUR(totalMoney)}</strong></div>
          <div className="money-stat"><span className="money-muted">Unallocated</span><strong className={(row?.unallocatedEnd ?? 0) < 0 ? "is-neg" : ""}>{formatEUR(row?.unallocatedEnd ?? 0)}</strong></div>
        </div>
        {over && <p className="money-error" role="alert">Allocations exceed your total money by {formatEUR(allocatedTotal - totalMoney)}. Reduce an envelope before spending more.</p>}
      </section>

      <section className="money-panel">
        <h2 className="money-h2">Envelopes</h2>
        <ul className="money-list">
          {cats.map((c) => {
            const alloc = row?.catAlloc[c.id] ?? 0;
            const spent = row?.catSpent[c.id] ?? 0;
            const left = row?.catEnd[c.id] ?? 0;
            const pct = alloc > 0 ? Math.min(100, Math.round((spent / alloc) * 100)) : 0;
            const value = edit[c.id] ?? (alloc ? (alloc / 100).toFixed(2) : "");
            return (
              <li key={c.id} className="money-env">
                <div className="money-env-head">
                  <span><span aria-hidden>{c.icon}</span> {c.name}</span>
                  <strong className={left < 0 ? "is-neg" : ""}>{formatEUR(left)} left</strong>
                </div>
                <div className="money-bar" aria-hidden><span style={{ width: `${pct}%`, background: c.color }} /></div>
                <div className="money-env-foot">
                  <span className="money-muted">Spent {formatEUR(spent)} of {formatEUR(alloc)}</span>
                  <span className="money-inline">
                    <label className="sr-only" htmlFor={`alloc-${c.id}`}>Allocation for {c.name}</label>
                    <input id={`alloc-${c.id}`} inputMode="decimal" className="money-input-sm" value={value} placeholder="0.00" onChange={(e) => setEdit((s) => ({ ...s, [c.id]: e.target.value }))} />
                    <button type="button" className="money-link" disabled={busy || edit[c.id] === undefined} onClick={() => save(c.id)}>Save</button>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="money-panel">
        <h2 className="money-h2">Move allocation</h2>
        <p className="money-muted">Moves money between envelopes. It is not income or spending.</p>
        <div className="money-grid2">
          <label className="money-field"><span>From</span>
            <select value={moveFrom} onChange={(e) => setMoveFrom(e.target.value)}>
              <option value="">Choose</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="money-field"><span>To</span>
            <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              <option value="">Choose</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        <label className="money-field"><span>Amount (€)</span>
          <input inputMode="decimal" value={moveAmt} onChange={(e) => setMoveAmt(e.target.value)} placeholder="0.00" />
        </label>
        <button type="button" className="money-btn-primary" disabled={busy} onClick={move}>Move</button>
      </section>
    </div>
  );
}
