"use client";

import { useState } from "react";
import type { GroceriesApi } from "../GroceriesApp";
import { lineCents } from "@/groceries/logic";
import { formatEUR, parseEuroToCents } from "@/money/money";
import type { Snapshot } from "@/groceries/model";
import type { Op } from "@/groceries/store";

/** Review of bought lines with an editable actual cost, then the list is closed. */
export function FinishSheet({ api, listId, onClose }: { api: GroceriesApi; listId: string; onClose: () => void }) {
  const { snap, act, notify } = api;
  const bought = snap.items.filter((i) => i.listId === listId && i.purchased);
  const [costs, setCosts] = useState<Record<string, string>>(() =>
    Object.fromEntries(bought.map((i) => [i.id, ((i.actualCents ?? lineCents(i) ?? 0) / 100).toFixed(2)])),
  );
  const [error, setError] = useState<string | null>(null);
  const total = bought.reduce((sum, i) => sum + (parseEuroToCents(costs[i.id] ?? "") ?? 0), 0);

  const finish = async () => {
    setError(null);
    const parsed: Record<string, number> = {};
    for (const i of bought) {
      const cents = parseEuroToCents(costs[i.id] ?? "");
      if (cents === null || cents < 0) return setError(`Enter a valid amount for ${i.name}.`);
      parsed[i.id] = cents;
    }
    const err = await act((s: Snapshot) => {
      const list = s.lists.find((l) => l.id === listId);
      if (!list || list.finishedAt) return { error: "This list is already finished." };
      const ops: Op[] = [];
      for (const i of s.items.filter((x) => x.listId === listId && x.purchased)) {
        const cents = parsed[i.id];
        if (cents === undefined || cents === i.actualCents) continue;
        ops.push({ store: "items", put: { ...i, actualCents: cents, version: i.version + 1 } });
        if (i.purchaseId) {
          const p = s.purchases.find((x) => x.id === i.purchaseId);
          if (p) ops.push({ store: "purchases", put: { ...p, costCents: cents, costIsEstimate: false, version: p.version + 1 } });
        }
      }
      ops.push({ store: "lists", put: { ...list, finishedAt: new Date().toISOString(), version: list.version + 1 } });
      return { ops };
    });
    if (err) return setError(err);
    notify("Shopping finished. Actual costs saved.");
    onClose();
  };

  return (
    <div className="gr-sheet-wrap" role="dialog" aria-modal="true" aria-label="Finish shopping">
      <button className="gr-scrim" onClick={onClose} aria-label="Close" />
      <div className="gr-sheet">
        <div className="gr-sheet-head">
          <button className="gr-link" onClick={onClose}>Back</button>
          <h2 className="gr-h3">Finish shopping</h2>
          <span />
        </div>
        <div className="gr-form">
          {bought.map((i) => (
            <div key={i.id} className="gr-finish-row">
              <span className="gr-name">{i.name} × {i.packs}</span>
              <label className="gr-price">
                <span className="gr-muted">€</span>
                <input
                  className="gr-input is-compact"
                  inputMode="decimal"
                  value={costs[i.id] ?? ""}
                  onChange={(e) => setCosts((c) => ({ ...c, [i.id]: e.target.value }))}
                  aria-label={`Actual cost for ${i.name}`}
                />
              </label>
            </div>
          ))}
          <div className="gr-total">
            <span className="gr-kicker">Actual total</span>
            <span className="gr-total-value">{formatEUR(total)}</span>
          </div>
          {error && <p className="gr-error" role="alert">{error}</p>}
          <button className="gr-primary" onClick={finish}>Complete shopping</button>
        </div>
      </div>
    </div>
  );
}
