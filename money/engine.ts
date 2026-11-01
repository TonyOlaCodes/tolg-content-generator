import { addMonths, monthOf } from "./money";
import type { Allocation, Closure, Snapshot, Transaction } from "./types";

/**
 * Money effects of one transaction on accounts. Reversed records negate their effects.
 * Transfers move money between accounts (no net change); adjustments change money only via their signed amount.
 */
export function accountEffects(tx: Transaction): { accountId: string; cents: number }[] {
  const s = tx.reverses ? -1 : 1;
  const a = tx.amountCents * s;
  switch (tx.kind) {
    case "expense":
      return tx.accountId ? [{ accountId: tx.accountId, cents: -a }] : [];
    case "income":
    case "refund":
      return tx.accountId ? [{ accountId: tx.accountId, cents: a }] : [];
    case "adjustment":
      return tx.accountId ? [{ accountId: tx.accountId, cents: a }] : [];
    case "transfer": {
      if (!tx.accountId || !tx.toAccountId) return [];
      return [
        { accountId: tx.accountId, cents: -a },
        { accountId: tx.toAccountId, cents: a },
      ];
    }
  }
}

/** Amount spent from a category envelope by this transaction (refunds are negative spend). */
export function envelopeSpend(tx: Transaction): number {
  if (!tx.categoryId) return 0;
  const a = tx.amountCents * (tx.reverses ? -1 : 1);
  if (tx.kind === "expense") return a;
  if (tx.kind === "refund") return -a;
  return 0;
}

export type MonthRow = {
  month: string;
  accountEnd: Record<string, number>;
  /** Sum of every account, archived included, so money is never silently dropped. */
  totalEnd: number;
  spendableEnd: number;
  catStart: Record<string, number>;
  catAlloc: Record<string, number>;
  catSpent: Record<string, number>;
  catEnd: Record<string, number>;
  allocatedEnd: number;
  unallocatedEnd: number;
  income: number;
  outflow: number;
  transfers: number;
};

export type Timeline = { rows: MonthRow[]; byMonth: Record<string, MonthRow> };

export type TimelineOptions = {
  /** Months from which rows are needed; the engine always replays from the earliest recorded month. */
  from: string;
  to: string;
  /** Actual view: unset allocations are 0. Forecast view: unset future allocations follow the category target. */
  defaultAlloc: "zero" | "target";
  /** Optional per-category target overrides (what-if). */
  targets?: Record<string, number>;
};

function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m);
  return out;
}

/**
 * Replays transactions month by month.
 * - Account balances start from opening balances and include only the transactions provided.
 * - Envelopes: start + allocation - spend. Month-end rollover (from closures) decides the next start:
 *   "carry" keeps the balance; "release"/"reset" keep only a deficit (negative balances are never forgiven).
 * - Unallocated = total money - sum of envelopes. Allocations never change total money.
 */
export function buildTimeline(
  snap: Pick<Snapshot, "accounts" | "categories" | "allocations" | "closures">,
  txs: Transaction[],
  opts: TimelineOptions,
): Timeline {
  const txByMonth = new Map<string, Transaction[]>();
  let earliest = opts.from;
  for (const tx of txs) {
    const m = monthOf(tx.date);
    if (m < earliest) earliest = m;
    const list = txByMonth.get(m);
    if (list) list.push(tx);
    else txByMonth.set(m, [tx]);
  }
  for (const a of snap.allocations) if (a.month < earliest) earliest = a.month;
  for (const c of snap.closures) if (c.month < earliest) earliest = c.month;

  const allocMap = new Map<string, Allocation>(snap.allocations.map((a) => [a.key, a]));
  const closureMap = new Map<string, Closure>(snap.closures.map((c) => [c.month, c]));
  const targetOf = (catId: string, fallback: number) => opts.targets?.[catId] ?? fallback;

  const rows: MonthRow[] = [];
  const byMonth: Record<string, MonthRow> = {};
  let prev: MonthRow | null = null;
  const accountBalance: Record<string, number> = Object.fromEntries(snap.accounts.map((a) => [a.id, a.openingCents]));

  for (const m of monthRange(earliest, opts.to)) {
    const monthTxs = txByMonth.get(m) ?? [];
    const prevChoices = prev ? closureMap.get(prev.month)?.choices ?? {} : {};

    // Accounts
    for (const tx of monthTxs) {
      for (const e of accountEffects(tx)) {
        accountBalance[e.accountId] = (accountBalance[e.accountId] ?? 0) + e.cents;
      }
    }
    const accountEnd: Record<string, number> = { ...accountBalance };
    const totalEnd = snap.accounts.reduce((s, a) => s + (accountEnd[a.id] ?? 0), 0);
    const spendableEnd = snap.accounts
      .filter((a) => !a.archived && !a.excludeFromSpendable)
      .reduce((s, a) => s + (accountEnd[a.id] ?? 0), 0);

    // Envelopes
    const catStart: Record<string, number> = {};
    const catAlloc: Record<string, number> = {};
    const catSpent: Record<string, number> = {};
    const catEnd: Record<string, number> = {};
    for (const c of snap.categories) {
      const carried = prev ? prev.catEnd[c.id] ?? 0 : 0;
      const choice = prevChoices[c.id] ?? "carry";
      const start = prev ? (choice === "carry" ? carried : Math.min(carried, 0)) : 0;
      catStart[c.id] = start;

      const explicit = allocMap.get(`${m}|${c.id}`);
      let alloc: number;
      if (explicit) alloc = explicit.cents;
      else if (prevChoices[c.id] === "reset") alloc = targetOf(c.id, c.targetCents);
      else alloc = opts.defaultAlloc === "target" ? targetOf(c.id, c.targetCents) : 0;
      catAlloc[c.id] = alloc;
      catSpent[c.id] = 0;
    }
    let income = 0;
    let outflow = 0;
    let transfers = 0;
    for (const tx of monthTxs) {
      const spend = envelopeSpend(tx);
      if (tx.categoryId && tx.categoryId in catSpent) catSpent[tx.categoryId] += spend;
      const a = tx.amountCents * (tx.reverses ? -1 : 1);
      if (tx.kind === "income") income += a;
      else if (tx.kind === "expense") outflow += a;
      else if (tx.kind === "refund") outflow -= a;
      else if (tx.kind === "transfer") transfers += a;
    }
    let allocatedEnd = 0;
    for (const c of snap.categories) {
      catEnd[c.id] = catStart[c.id] + catAlloc[c.id] - catSpent[c.id];
      allocatedEnd += catEnd[c.id];
    }

    const row: MonthRow = {
      month: m,
      accountEnd,
      totalEnd,
      spendableEnd,
      catStart,
      catAlloc,
      catSpent,
      catEnd,
      allocatedEnd,
      unallocatedEnd: totalEnd - allocatedEnd,
      income,
      outflow,
      transfers,
    };
    if (m >= opts.from) {
      rows.push(row);
      byMonth[m] = row;
    }
    prev = row;
  }
  return { rows, byMonth };
}

/** Actual-money-only view of today's position (confirmed transactions, current month). */
export function currentPosition(snap: Snapshot, month: string) {
  const confirmed = snap.transactions.filter((t) => t.status === "confirmed");
  const tl = buildTimeline(snap, confirmed, { from: month, to: month, defaultAlloc: "zero" });
  return tl.byMonth[month] ?? null;
}

/** Cumulative total money after each confirmed transaction date (for the balance-history line). */
export function balancePoints(
  snap: Pick<Snapshot, "accounts" | "transactions">,
  accountIds?: Set<string>,
): { date: string; cents: number }[] {
  const include = (id: string) => !accountIds || accountIds.has(id);
  const start = snap.accounts.filter((a) => include(a.id)).reduce((s, a) => s + a.openingCents, 0);
  const txs = snap.transactions
    .filter((t) => t.status === "confirmed")
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const points: { date: string; cents: number }[] = [];
  let running = start;
  const first = txs[0]?.date ?? new Date().toISOString().slice(0, 10);
  points.push({ date: first, cents: running });
  for (const tx of txs) {
    for (const e of accountEffects(tx)) {
      if (include(e.accountId)) running += e.cents;
    }
    const last = points[points.length - 1];
    if (last.date === tx.date) last.cents = running;
    else points.push({ date: tx.date, cents: running });
  }
  return points;
}
