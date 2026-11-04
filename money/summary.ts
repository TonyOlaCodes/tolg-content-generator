import type { Account, Snapshot } from "./types";
import { sortedPocketRows } from "./sort";

export type WealthBucket = "spendable" | "savings" | "investments" | "other";

export type WealthAccountLine = {
  account: Account;
  bucket: WealthBucket;
  totalCents: number;
  mainCents: number;
  pockets: { id: string; name: string; icon: string; balanceCents: number }[];
};

export type WealthSummary = {
  /** Active (non-archived) money only — matches the Home total. */
  totalCents: number;
  spendableCents: number;
  savingsCents: number;
  investmentCents: number;
  otherCents: number;
  archivedCents: number;
  accounts: WealthAccountLine[];
};

/** Mutually exclusive bucket for an active account. */
export function accountBucket(a: Account): WealthBucket {
  if (a.kind === "investment") return "investments";
  if (a.kind === "savings") return "savings";
  if (a.kind === "custom" && a.excludeFromSpendable) return "other";
  if (a.excludeFromSpendable) return "savings";
  if (a.kind === "current" || a.kind === "digital" || a.kind === "cash" || a.kind === "custom") {
    return "spendable";
  }
  return "other";
}

/**
 * Home wealth figures. Every active euro lands in exactly one of
 * spendable / savings / investments / other. Archived money is tracked separately
 * and is NOT included in totalCents (that was the Total vs summary gap).
 */
export function computeWealthSummary(
  snap: Snapshot,
  accountEnd: Record<string, number>,
  mainEnd: Record<string, number>,
): WealthSummary {
  const accounts: WealthAccountLine[] = [];
  let spendableCents = 0;
  let savingsCents = 0;
  let investmentCents = 0;
  let otherCents = 0;
  let archivedCents = 0;

  for (const a of snap.accounts) {
    const totalCents = accountEnd[a.id] ?? 0;
    if (a.archived) {
      archivedCents += totalCents;
      continue;
    }
    const bucket = accountBucket(a);
    const rows = sortedPocketRows(snap, a.id);
    const mainCents = rows[0]?.kind === "main" ? rows[0].balanceCents : (mainEnd[a.id] ?? 0);
    const pockets = rows
      .filter((r): r is Extract<typeof r, { kind: "pocket" }> => r.kind === "pocket")
      .map((r) => ({
        id: r.pocket.id,
        name: r.pocket.name,
        icon: r.pocket.icon,
        balanceCents: r.balanceCents,
      }));
    accounts.push({ account: a, bucket, totalCents, mainCents, pockets });
    if (bucket === "spendable") spendableCents += totalCents;
    else if (bucket === "savings") savingsCents += totalCents;
    else if (bucket === "investments") investmentCents += totalCents;
    else otherCents += totalCents;
  }

  accounts.sort((x, y) => y.totalCents - x.totalCents || x.account.name.localeCompare(y.account.name));

  return {
    totalCents: spendableCents + savingsCents + investmentCents + otherCents,
    spendableCents,
    savingsCents,
    investmentCents,
    otherCents,
    archivedCents,
    accounts,
  };
}
