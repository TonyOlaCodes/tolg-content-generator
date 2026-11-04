"use client";

import { useState } from "react";
import { currentPosition } from "@/money/engine";
import { computeWealthSummary, type WealthBucket } from "@/money/summary";
import { currentMonth, formatEUR } from "@/money/money";
import { ACCOUNT_KINDS } from "@/money/types";
import type { MoneyApi } from "../MoneyApp";

const BUCKET_LABEL: Record<WealthBucket, string> = {
  spendable: "Spendable",
  savings: "Savings",
  investments: "Investments",
  other: "Other",
};

export default function WealthPage({
  api,
  onBack,
  onOpenAccount,
}: {
  api: MoneyApi;
  onBack: () => void;
  onOpenAccount: (accountId: string) => void;
}) {
  const { snap } = api;
  const month = currentMonth();
  const row = currentPosition(snap, month);
  const summary = computeWealthSummary(snap, row?.accountEnd ?? {}, row?.mainEnd ?? {});
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const buckets = (
    [
      { id: "spendable" as const, cents: summary.spendableCents },
      { id: "savings" as const, cents: summary.savingsCents },
      { id: "investments" as const, cents: summary.investmentCents },
      { id: "other" as const, cents: summary.otherCents },
    ] satisfies { id: WealthBucket; cents: number }[]
  ).filter((b) => b.cents !== 0 || summary.accounts.some((a) => a.bucket === b.id));

  return (
    <div className="money-page">
      <button type="button" className="money-link" onClick={onBack}>← Home</button>
      <section className="money-hero money-hero-left">
        <p className="money-kicker">Total money</p>
        <p className="money-balance">{formatEUR(summary.totalCents)}</p>
        <p className="money-muted money-small">Active accounts only · categories sum to this total</p>
      </section>

      <section className="money-stat-grid">
        {buckets.map((b) => (
          <div key={b.id} className="money-stat-cell">
            <span className="money-muted money-small">{BUCKET_LABEL[b.id]}</span>
            <strong>{formatEUR(b.cents)}</strong>
          </div>
        ))}
      </section>

      {summary.archivedCents !== 0 && (
        <p className="money-muted money-small">
          Archived accounts hold {formatEUR(summary.archivedCents)} and are not included in Total Money.
        </p>
      )}

      <section className="money-block">
        <h2 className="money-h2">By account</h2>
        <ul className="money-wealth-list">
          {summary.accounts.map((line) => {
            const isOpen = !!open[line.account.id];
            return (
              <li key={line.account.id} className="money-wealth-card">
                <button
                  type="button"
                  className="money-wealth-head"
                  aria-expanded={isOpen}
                  onClick={() => setOpen((o) => ({ ...o, [line.account.id]: !isOpen }))}
                >
                  <span>
                    <strong>{line.account.name}</strong>
                    <span className="money-muted money-small">
                      {ACCOUNT_KINDS[line.account.kind].label} · {BUCKET_LABEL[line.bucket]}
                    </span>
                  </span>
                  <strong>{formatEUR(line.totalCents)}</strong>
                  <span aria-hidden>{isOpen ? "▴" : "▾"}</span>
                </button>
                {isOpen && (
                  <ul className="money-wealth-pockets">
                    <li>
                      <button type="button" className="money-link" onClick={() => onOpenAccount(line.account.id)}>
                        Main · {formatEUR(line.mainCents)}
                      </button>
                    </li>
                    {line.pockets.map((p) => (
                      <li key={p.id}>
                        <button type="button" className="money-link" onClick={() => onOpenAccount(line.account.id)}>
                          {p.icon} {p.name} · {formatEUR(p.balanceCents)}
                        </button>
                      </li>
                    ))}
                    <li>
                      <button type="button" className="money-btn-secondary" onClick={() => onOpenAccount(line.account.id)}>
                        Open account
                      </button>
                    </li>
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
