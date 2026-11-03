import { monthlyEquivalentCents, currentMonth, daysInMonth } from "./money";
import { remainingRecurringCents } from "./actions";
import type { BillPurpose, Recurring, Snapshot } from "./types";

export type { BillPurpose };

/** Existing bills without purpose count as expenses. */
export function billPurpose(r: Recurring): BillPurpose {
  return r.purpose ?? "expense";
}

export type BillContribution = {
  id: string;
  name: string;
  amountCents: number;
  monthlyEquivalentCents: number;
  interval: Recurring["interval"];
  purpose: BillPurpose;
  status: Recurring["status"];
  nextDue: string;
  remainingCents: number;
  countsInAverage: boolean;
  dueThisMonth: boolean;
  overdue: boolean;
};

export type BillTotals = {
  /** Monthly equivalent of active recurring expenses (excludes paused/cancelled and transfer/savings). */
  averageMonthlyExpenseCents: number;
  /** Full occurrence amounts whose next due falls in this calendar month. */
  dueThisMonthCents: number;
  /** Still unpaid of this month’s dues plus any overdue leftovers. */
  remainingThisMonthCents: number;
  /** averageMonthlyExpenseCents × 12 */
  annualExpenseCents: number;
  contributions: BillContribution[];
};

function monthEnd(month: string): string {
  return `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
}

/**
 * Transparent bill totals from live records.
 * Expense average uses monthly-equivalent conversion (weekly/yearly/custom).
 * Transfer and savings classifications are listed but excluded from expense averages.
 */
export function computeBillTotals(snap: Snapshot, month: string = currentMonth()): BillTotals {
  const end = monthEnd(month);
  const start = `${month}-01`;
  const bills = snap.recurring.filter((r) => r.kind === "bill");
  const contributions: BillContribution[] = [];

  let averageMonthlyExpenseCents = 0;
  let dueThisMonthCents = 0;
  let remainingThisMonthCents = 0;

  for (const r of bills) {
    const purpose = billPurpose(r);
    const remaining = r.status === "active" ? remainingRecurringCents(snap, r) : 0;
    const monthlyEq = monthlyEquivalentCents(r.amountCents, r);
    const inMonth = r.nextDue >= start && r.nextDue <= end;
    const overdue = r.status === "active" && r.nextDue < start && remaining > 0;
    const countsInAverage = r.status === "active" && (purpose === "expense" || purpose === "other");

    contributions.push({
      id: r.id,
      name: r.name,
      amountCents: r.amountCents,
      monthlyEquivalentCents: monthlyEq,
      interval: r.interval,
      purpose,
      status: r.status,
      nextDue: r.nextDue,
      remainingCents: remaining,
      countsInAverage,
      dueThisMonth: r.status === "active" && inMonth,
      overdue,
    });

    if (countsInAverage) averageMonthlyExpenseCents += monthlyEq;

    if (r.status === "active" && inMonth) {
      dueThisMonthCents += r.amountCents;
      remainingThisMonthCents += remaining;
    } else if (overdue) {
      remainingThisMonthCents += remaining;
    }
  }

  return {
    averageMonthlyExpenseCents,
    dueThisMonthCents,
    remainingThisMonthCents,
    annualExpenseCents: averageMonthlyExpenseCents * 12,
    contributions,
  };
}
