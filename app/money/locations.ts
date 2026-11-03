import { formatEUR } from "@/money/money";
import { accountNowCents, mainNowCents, pocketNowCents } from "@/money/actions";
import { sortAccountsByBalance, sortLocationValues } from "@/money/sort";
import type { Snapshot } from "@/money/types";

export type LocationValue = `${string}|${string}`;

export type LocationOption = {
  value: LocationValue;
  accountId: string;
  pocketId: string | null;
  label: string;
  balanceCents: number;
  group: string;
};

/** Account Main + pocket destinations with live balances, sorted like Accounts. */
export function locationOptions(snap: Snapshot, preferAccountId?: string | null): LocationOption[] {
  const accounts = sortAccountsByBalance(
    snap,
    snap.accounts.filter((a) => !a.archived),
  );
  const out: LocationOption[] = [];
  for (const a of accounts) {
    out.push({
      value: `${a.id}|`,
      accountId: a.id,
      pocketId: null,
      label: `${a.name} · Main`,
      balanceCents: mainNowCents(snap, a.id),
      group: a.name,
    });
    for (const p of snap.pockets
      .filter((p) => p.accountId === a.id && !p.archived)
      .slice()
      .sort(
        (x, y) =>
          pocketNowCents(snap, y.id) - pocketNowCents(snap, x.id) ||
          x.name.localeCompare(y.name) ||
          x.id.localeCompare(y.id),
      )) {
      out.push({
        value: `${a.id}|${p.id}`,
        accountId: a.id,
        pocketId: p.id,
        label: `${a.name} · ${p.name}`,
        balanceCents: pocketNowCents(snap, p.id),
        group: a.name,
      });
    }
  }
  const sorted = sortLocationValues(snap, out) as LocationOption[];
  if (!preferAccountId) return sorted;
  const preferred = sorted.filter((o) => o.accountId === preferAccountId);
  const rest = sorted.filter((o) => o.accountId !== preferAccountId);
  return [...preferred, ...rest];
}

export function parseLocation(value: string): { accountId: string; pocketId: string | null } {
  const [accountId, pocketId] = value.split("|");
  return { accountId, pocketId: pocketId || null };
}

export function locationLabel(snap: Snapshot, accountId: string | null, pocketId: string | null): string {
  if (!accountId) return "—";
  const acc = snap.accounts.find((a) => a.id === accountId)?.name ?? "Account";
  if (!pocketId) return `${acc} · Main`;
  const pocket = snap.pockets.find((p) => p.id === pocketId)?.name ?? "Pocket";
  return `${acc} · ${pocket}`;
}

export function locationBalanceLabel(opt: LocationOption): string {
  return `${opt.label} · ${formatEUR(opt.balanceCents)}`;
}

export function accountTotalCents(snap: Snapshot, accountId: string): number {
  return accountNowCents(snap, accountId);
}
