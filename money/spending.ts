import { addMonths, monthOf } from "./money";
import type { Snapshot, Transaction } from "./types";

export type MonthSpending = {
  month: string;
  grossExpenseCents: number;
  refundCents: number;
  netCents: number;
  expenseCount: number;
  byCategory: { categoryId: string | null; name: string; color: string; cents: number }[];
  byLocation: { key: string; label: string; cents: number }[];
  expenses: Transaction[];
};

function activeExpense(t: Transaction): boolean {
  return t.kind === "expense" && t.status === "confirmed" && !t.reverses && !t.reversedBy;
}

function activeRefund(t: Transaction): boolean {
  return t.kind === "refund" && t.status === "confirmed" && !t.reverses && !t.reversedBy;
}

/** Confirmed expenses and refunds for one calendar month. */
export function computeMonthSpending(snap: Snapshot, month: string): MonthSpending {
  const expenses = snap.transactions
    .filter((t) => activeExpense(t) && monthOf(t.date) === month)
    .sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1));
  const refunds = snap.transactions.filter((t) => activeRefund(t) && monthOf(t.date) === month);

  const grossExpenseCents = expenses.reduce((s, t) => s + t.amountCents, 0);
  const refundCents = refunds.reduce((s, t) => s + t.amountCents, 0);

  const catMap = new Map<string | null, number>();
  for (const t of expenses) {
    catMap.set(t.categoryId, (catMap.get(t.categoryId) ?? 0) + t.amountCents);
  }
  // Net category: subtract refunds by category
  for (const t of refunds) {
    catMap.set(t.categoryId, (catMap.get(t.categoryId) ?? 0) - t.amountCents);
  }

  const byCategory = [...catMap.entries()]
    .map(([categoryId, cents]) => {
      const cat = categoryId ? snap.categories.find((c) => c.id === categoryId) : null;
      return {
        categoryId,
        name: cat?.name ?? "Uncategorised",
        color: cat?.color ?? "#a3a3a3",
        cents: Math.max(0, cents),
      };
    })
    .filter((c) => c.cents > 0)
    .sort((a, b) => b.cents - a.cents);

  const locMap = new Map<string, { label: string; cents: number }>();
  for (const t of expenses) {
    const acc = snap.accounts.find((a) => a.id === t.accountId)?.name ?? "Account";
    const pocket = t.pocketId ? snap.pockets.find((p) => p.id === t.pocketId)?.name ?? "Pocket" : "Main";
    const key = `${t.accountId}|${t.pocketId ?? ""}`;
    const prev = locMap.get(key);
    locMap.set(key, { label: `${acc} → ${pocket}`, cents: (prev?.cents ?? 0) + t.amountCents });
  }
  const byLocation = [...locMap.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.cents - a.cents);

  return {
    month,
    grossExpenseCents,
    refundCents,
    netCents: Math.max(0, grossExpenseCents - refundCents),
    expenseCount: expenses.length,
    byCategory,
    byLocation,
    expenses,
  };
}

export function adjacentMonth(month: string, delta: number): string {
  return addMonths(month, delta);
}
