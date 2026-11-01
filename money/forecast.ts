import { buildTimeline, type MonthRow } from "./engine";
import { addMonths, nextOccurrence, todayISO, type IntervalSpec } from "./money";
import type { Recurring, Snapshot, Transaction } from "./types";

export type Scenario = "scheduled" | "planned";

export type Overrides = {
  /** Hypothetical extra items. Never saved; shown only in the forecast. */
  extra?: Pick<Transaction, "kind" | "date" | "amountCents" | "accountId" | "toAccountId" | "categoryId" | "description">[];
  /** Hypothetical monthly targets per category (used by the "planned" scenario). */
  targets?: Record<string, number>;
};

export type ForecastItem = {
  id: string;
  label: string;
  kind: Transaction["kind"];
  date: string;
  amountCents: number;
  /** true when it is only projected (scheduled or planned), false when already confirmed. */
  projected: boolean;
  source: "confirmed" | "planned" | "scheduled" | "budget" | "what-if";
  categoryId: string | null;
};

export type ForecastMonth = {
  month: string;
  start: number;
  income: number;
  outflow: number;
  end: number;
  row: MonthRow;
  items: ForecastItem[];
  /** Amount of this month's income/outflow that is not yet confirmed. */
  projectedIncome: number;
  projectedOutflow: number;
};

export type Forecast = {
  scenario: Scenario;
  months: ForecastMonth[];
  /** Set when a planned-spend scenario could not be attributed to an account. */
  warning: string | null;
};

const MAX_OCCURRENCES = 400;

/** Where a forecast transaction comes from. Only confirmed records are actual money. */
function sourceOf(t: Transaction): ForecastItem["source"] {
  if (t.id.startsWith("budget-")) return "budget";
  if (t.id.startsWith("whatif-")) return "what-if";
  if (t.status === "confirmed") return "confirmed";
  if (t.id.includes(":")) return "scheduled";
  return "planned";
}

function specOf(r: Recurring): IntervalSpec {
  return { interval: r.interval, customDays: r.customDays, dayOfMonth: r.dayOfMonth };
}

/** Scheduled bills and income not yet confirmed, within [today, horizonEnd]. Overdue items are placed today. */
export function scheduledItems(snap: Snapshot, today: string, horizonEnd: string): Transaction[] {
  const out: Transaction[] = [];
  const fallbackAccount = snap.settings?.plannedSpendAccountId ?? null;
  for (const r of snap.recurring) {
    if (r.status !== "active") continue;
    const accountId = r.accountId ?? fallbackAccount;
    if (!accountId || !snap.accounts.some((a) => a.id === accountId && !a.archived)) continue;
    let occ = r.nextDue;
    for (let i = 0; i < MAX_OCCURRENCES && occ <= horizonEnd; i++) {
      const posted = snap.transactions.some((t) => t.recurringId === r.id && t.occurrenceDate === occ);
      if (!posted) {
        out.push({
          id: `${r.id}:${occ}`,
          kind: r.kind === "bill" ? "expense" : "income",
          status: "planned",
          date: occ < today ? today : occ,
          amountCents: r.amountCents,
          accountId,
          toAccountId: null,
          categoryId: r.kind === "bill" ? r.categoryId : null,
          description: r.name,
          notes: "",
          recurringId: null,
          occurrenceDate: null,
          reverses: false,
          reversedBy: null,
          createdAt: "",
          updatedAt: "",
        });
      }
      occ = nextOccurrence(specOf(r), occ);
    }
  }
  return out;
}

/**
 * Builds a 12-month forecast starting from the current confirmed balances.
 * - "scheduled": confirmed + planned transactions + scheduled bills/income.
 * - "planned": also adds, per spending category, the monthly target minus what is already scheduled in
 *   that category (so subscriptions counted in Subscriptions are never subtracted twice).
 * Stored data is never modified.
 */
export function buildForecast(
  snap: Snapshot,
  scenario: Scenario,
  overrides: Overrides = {},
  months = 12,
  today: string = todayISO(),
): Forecast {
  const thisMonth = today.slice(0, 7);
  const lastMonth = addMonths(thisMonth, months - 1);
  const horizonEnd = `${lastMonth}-31`;
  const planned = snap.transactions.filter((t) => t.status === "planned" || t.status === "confirmed");

  const scheduledWithAccounts = scheduledItems(snap, today, horizonEnd);
  let forecastWarning: string | null = null;
  const whatIf: Transaction[] = (overrides.extra ?? []).map((e, i) => ({
    id: `whatif-${i}`,
    kind: e.kind,
    status: "planned",
    date: e.date,
    amountCents: e.amountCents,
    accountId: e.accountId,
    toAccountId: e.toAccountId,
    categoryId: e.categoryId,
    description: e.description,
    notes: "",
    recurringId: null,
    occurrenceDate: null,
    reverses: false,
    reversedBy: null,
    createdAt: "",
    updatedAt: "",
  }));

  const base = [...planned, ...scheduledWithAccounts, ...whatIf];
  const extraItems: Transaction[] = [];

  if (scenario === "planned") {
    const spendingCats = snap.categories.filter((c) => !c.archived && c.kind === "spending");
    const accountForPlan =
      snap.settings?.plannedSpendAccountId && snap.accounts.some((a) => a.id === snap.settings?.plannedSpendAccountId && !a.archived)
        ? snap.settings.plannedSpendAccountId
        : snap.accounts.find((a) => !a.archived && !a.excludeFromSpendable)?.id ?? null;
    if (!accountForPlan) {
      forecastWarning = "Add an account to include planned category spending.";
    } else {
      for (let i = 0; i < months; i++) {
        const m = addMonths(thisMonth, i);
        const date = `${m}-28`;
        for (const c of spendingCats) {
          const target = overrides.targets?.[c.id] ?? c.targetCents;
          if (target <= 0) continue;
          const scheduledSpend = base
            .filter((t) => t.categoryId === c.id && t.kind === "expense" && t.date.slice(0, 7) === m)
            .reduce((s, t) => s + t.amountCents, 0);
          const remaining = target - scheduledSpend;
          if (remaining > 0) {
            extraItems.push({
              id: `budget-${m}-${c.id}`,
              kind: "expense",
              status: "planned",
              date: m === thisMonth && date < today ? today : date,
              amountCents: remaining,
              accountId: accountForPlan,
              toAccountId: null,
              categoryId: c.id,
              description: `${c.name} (planned budget)`,
              notes: "",
              recurringId: null,
              occurrenceDate: null,
              reverses: false,
              reversedBy: null,
              createdAt: "",
              updatedAt: "",
            });
          }
        }
      }
    }
  }

  const all = [...base, ...extraItems];
  const categories = snap.categories;
  const tl = buildTimeline(
    { accounts: snap.accounts, categories, allocations: snap.allocations, closures: snap.closures },
    all,
    { from: addMonths(thisMonth, -1), to: lastMonth, defaultAlloc: "target", targets: overrides.targets },
  );

  const result: ForecastMonth[] = [];
  for (let i = 0; i < months; i++) {
    const m = addMonths(thisMonth, i);
    const row = tl.byMonth[m];
    const prev = tl.byMonth[addMonths(m, -1)];
    const start = prev ? prev.totalEnd : tl.rows[0]?.totalEnd ?? 0;
    const items: ForecastItem[] = [];
    let projectedIncome = 0;
    let projectedOutflow = 0;
    for (const t of all) {
      if (t.date.slice(0, 7) !== m) continue;
      const source = sourceOf(t);
      const projected = source !== "confirmed";
      if (projected) {
        if (t.kind === "income") projectedIncome += t.amountCents;
        else if (t.kind === "expense") projectedOutflow += t.amountCents;
      }
      items.push({
        id: t.id,
        label: t.description,
        kind: t.kind,
        date: t.date,
        amountCents: t.amountCents,
        projected,
        source,
        categoryId: t.categoryId,
      });
    }
    result.push({
      month: m,
      start,
      income: row?.income ?? 0,
      outflow: row?.outflow ?? 0,
      end: row?.totalEnd ?? start,
      row: row!,
      items: items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
      projectedIncome,
      projectedOutflow,
    });
  }
  return { scenario, months: result, warning: forecastWarning };
}
