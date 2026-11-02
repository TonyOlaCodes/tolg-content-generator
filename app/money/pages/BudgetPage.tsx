"use client";

import { useState } from "react";
import { currentPosition } from "@/money/engine";
import { saveCategory, defaultCtx } from "@/money/actions";
import { currentMonth, formatEUR, formatMonthIE, parseEuroToCents } from "@/money/money";
import type { Category } from "@/money/types";
import type { MoneyApi } from "../MoneyApp";

/**
 * Monthly spending plan. Each category's target is a plan, not money set aside:
 * changing targets never changes account balances.
 */
export default function BudgetPage({ api, notify }: { api: MoneyApi; notify: (m: string) => void }) {
  const { snap, commit } = api;
  const month = currentMonth();
  const row = currentPosition(snap, month);
  const cats = snap.categories
    .filter((c) => !c.archived && c.kind === "spending")
    .sort((a, b) => a.order - b.order);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [moveTo, setMoveTo] = useState("");
  const [moveAmt, setMoveAmt] = useState("");

  const planTotal = cats.reduce((s, c) => s + c.targetCents, 0);
  const spentTotal = cats.reduce((s, c) => s + (row?.catSpent[c.id] ?? 0), 0);

  const saveTarget = async (c: Category, raw: string) => {
    const cents = raw.trim() === "" ? 0 : parseEuroToCents(raw);
    if (cents === null || cents < 0) return notify("Enter an amount of zero or more.");
    if (cents === c.targetCents) return;
    setBusy(true);
    const err = await commit(
      saveCategory(snap, { id: c.id, name: c.name, icon: c.icon, color: c.color, kind: c.kind, targetCents: cents, goalCents: c.goalCents }, defaultCtx()),
    );
    setBusy(false);
    notify(err ?? `${c.name} target saved`);
  };

  // Linking a category to a pocket only changes where its expenses come from. The target stays a plan.
  const savePocketLink = async (c: Category, pocketId: string) => {
    setBusy(true);
    const err = await commit(
      saveCategory(snap, { id: c.id, name: c.name, icon: c.icon, color: c.color, kind: c.kind, targetCents: c.targetCents, goalCents: c.goalCents, defaultPocketId: pocketId || null }, defaultCtx()),
    );
    setBusy(false);
    notify(err ?? `${c.name} pocket saved`);
  };

  const pocketChoices = snap.pockets.filter((p) => !p.archived);
  const accountName = (id: string) => snap.accounts.find((a) => a.id === id)?.name ?? "";

  const moveBudget = async (from: Category) => {
    const cents = parseEuroToCents(moveAmt);
    const to = cats.find((c) => c.id === moveTo);
    if (!to || cents === null || cents <= 0) return notify("Choose a category and an amount above zero.");
    if (cents > from.targetCents) return notify(`${from.name} only has ${formatEUR(from.targetCents)} planned.`);
    const ctx = defaultCtx();
    const a = saveCategory(snap, { id: from.id, name: from.name, icon: from.icon, color: from.color, kind: from.kind, targetCents: from.targetCents - cents, goalCents: from.goalCents }, ctx);
    const b = saveCategory(snap, { id: to.id, name: to.name, icon: to.icon, color: to.color, kind: to.kind, targetCents: to.targetCents + cents, goalCents: to.goalCents }, ctx);
    if (!a.ok) return notify(a.error);
    if (!b.ok) return notify(b.error);
    // Both plan changes are applied together so the move never half-happens.
    setBusy(true);
    const err = await commit({ ok: true, change: { puts: [...a.change.puts, ...b.change.puts], deletes: [] } });
    setBusy(false);
    if (err) return notify(err);
    setMoveAmt("");
    notify(`Moved ${formatEUR(cents)} to ${to.name}`);
  };

  return (
    <div className="money-page">
      <section className="money-block">
        <p className="money-kicker">Spending plan · {formatMonthIE(month)}</p>
        <p className="money-big">{formatEUR(spentTotal)} <span className="money-muted">of {formatEUR(planTotal)}</span></p>
        <p className="money-muted money-small">
          {planTotal === 0 ? "Set a monthly target for each category below." : `${formatEUR(Math.max(planTotal - spentTotal, 0))} left in your plan. Targets never reduce your balance.`}
        </p>
      </section>

      <ul className="money-cats">
        {cats.map((c) => {
          const spent = row?.catSpent[c.id] ?? 0;
          const left = c.targetCents - spent;
          const pct = c.targetCents > 0 ? Math.min(100, Math.round((spent / c.targetCents) * 100)) : 0;
          const open = openId === c.id;
          return (
            <li key={c.id} className={`money-cat${open ? " is-open" : ""}`}>
              <button
                type="button"
                className="money-cat-head"
                aria-expanded={open}
                onClick={() => {
                  setOpenId(open ? null : c.id);
                  setDraft((c.targetCents / 100).toFixed(2));
                  setMoveTo("");
                  setMoveAmt("");
                }}
              >
                <span className="money-cat-name"><span aria-hidden>{c.icon}</span> {c.name}</span>
                <span className="money-cat-figs">
                  <span className="money-small money-muted">
                    {formatEUR(spent)} of {formatEUR(c.targetCents)}
                  </span>
                  <span className={`money-small ${left < 0 ? "is-neg" : "money-muted"}`}>
                    {left < 0 ? `${formatEUR(-left)} over` : `${formatEUR(left)} left`}
                  </span>
                </span>
              </button>
              <div className="money-bar" aria-hidden>
                <span style={{ width: `${pct}%`, background: c.color }} />
              </div>

              {open && (
                <div className="money-cat-editor">
                  <label className="money-field">
                    <span>Monthly target (€)</span>
                    <input
                      inputMode="decimal"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => saveTarget(c, draft)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                      disabled={busy}
                    />
                  </label>

                  {pocketChoices.length > 0 && (
                    <label className="money-field">
                      <span>Spend from pocket</span>
                      <select value={c.defaultPocketId ?? ""} onChange={(e) => savePocketLink(c, e.target.value)} disabled={busy}>
                        <option value="">None (use the chosen account)</option>
                        {pocketChoices.map((p) => (
                          <option key={p.id} value={p.id}>{accountName(p.accountId)} · {p.name}</option>
                        ))}
                      </select>
                    </label>
                  )}

                  {cats.length > 1 && (
                    <div className="money-move">
                      <p className="money-small money-muted">Move part of this plan to another category</p>
                      <div className="money-move-row">
                        <select aria-label="Move to" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                          <option value="">Choose</option>
                          {cats.filter((x) => x.id !== c.id).map((x) => (
                            <option key={x.id} value={x.id}>{x.name}</option>
                          ))}
                        </select>
                        <input
                          inputMode="decimal"
                          aria-label="Amount to move"
                          placeholder="€0.00"
                          value={moveAmt}
                          onChange={(e) => setMoveAmt(e.target.value)}
                        />
                        <button type="button" className="money-btn-small" disabled={busy} onClick={() => moveBudget(c)}>Move</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {cats.length === 0 && <p className="money-muted">No categories yet.</p>}
    </div>
  );
}
