"use client";

import type { MoneyApi, PageId } from "../MoneyApp";

const LINKS: { id: PageId; title: string; blurb: string }[] = [
  { id: "activity", title: "All transactions", blurb: "Full history of money in, out, and transfers" },
  { id: "budget", title: "Budgets", blurb: "Optional spending limits by category" },
  { id: "future", title: "Future", blurb: "12-month projections from bills and income" },
  { id: "settings", title: "Settings & backup", blurb: "Export, restore, and app settings" },
];

export default function MorePage({ onNavigate }: { api: MoneyApi; onNavigate: (p: PageId) => void }) {
  return (
    <div className="money-page">
      <section className="money-block">
        <p className="money-kicker">More</p>
        <h2 className="money-h2">Everything else</h2>
        <ul className="money-more-list">
          {LINKS.map((l) => (
            <li key={l.id}>
              <button type="button" className="money-more-link" onClick={() => onNavigate(l.id)}>
                <span>
                  <strong>{l.title}</strong>
                  <span className="money-muted money-small">{l.blurb}</span>
                </span>
                <span aria-hidden>›</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
