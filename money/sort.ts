import type { Account, Pocket, Snapshot } from "./types";
import { accountNowCents, mainNowCents, pocketNowCents } from "./actions";

/** Accounts highest total → lowest; stable by name then id. */
export function sortAccountsByBalance(snap: Snapshot, accounts: Account[]): Account[] {
  return accounts
    .map((a) => ({ a, bal: accountNowCents(snap, a.id) }))
    .sort((x, y) => y.bal - x.bal || x.a.name.localeCompare(y.a.name) || x.a.id.localeCompare(y.a.id))
    .map((x) => x.a);
}

export type PocketRow = { kind: "main"; balanceCents: number } | { kind: "pocket"; pocket: Pocket; balanceCents: number };

/** Main first, then pockets highest → lowest; stable by name/id. */
export function sortedPocketRows(snap: Snapshot, accountId: string): PocketRow[] {
  const main: PocketRow = { kind: "main", balanceCents: mainNowCents(snap, accountId) };
  const pockets = snap.pockets
    .filter((p) => p.accountId === accountId && !p.archived)
    .map((pocket) => ({ kind: "pocket" as const, pocket, balanceCents: pocketNowCents(snap, pocket.id) }))
    .sort(
      (x, y) =>
        y.balanceCents - x.balanceCents ||
        x.pocket.name.localeCompare(y.pocket.name) ||
        x.pocket.id.localeCompare(y.pocket.id),
    );
  return [main, ...pockets];
}

/** Location pickers: accounts by total, Main first within each, then pockets by balance. */
export function sortLocationValues(
  snap: Snapshot,
  values: { accountId: string; pocketId: string | null; balanceCents: number; label: string; value: string; group: string }[],
) {
  const accountOrder = new Map(
    sortAccountsByBalance(
      snap,
      snap.accounts.filter((a) => !a.archived),
    ).map((a, i) => [a.id, i]),
  );
  return values.slice().sort((a, b) => {
    const ao = (accountOrder.get(a.accountId) ?? 999) - (accountOrder.get(b.accountId) ?? 999);
    if (ao !== 0) return ao;
    const aMain = a.pocketId ? 1 : 0;
    const bMain = b.pocketId ? 1 : 0;
    if (aMain !== bMain) return aMain - bMain;
    return b.balanceCents - a.balanceCents || a.label.localeCompare(b.label);
  });
}
