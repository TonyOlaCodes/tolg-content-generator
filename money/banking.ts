import { saveTransaction, type Ctx, type Result, type TxInput } from "./actions";
import { buildTimeline } from "./engine";
import { currentMonth, nextOccurrence, parseISO, todayISO, type IntervalSpec } from "./money";
import type { Loan, Recurring, Snapshot, Transaction } from "./types";

/**
 * Banking-style operations built on the existing ledger. Every operation writes ordinary
 * transactions, so balances, history, backups and reversals keep working unchanged.
 */

export type Location = { accountId: string; pocketId: string | null };

export function balances(snap: Snapshot) {
  const confirmed = snap.transactions.filter((t) => t.status === "confirmed");
  const month = currentMonth();
  const row = buildTimeline(snap, confirmed, { from: month, to: month, defaultAlloc: "zero" }).byMonth[month];
  return {
    main: row?.mainEnd ?? {},
    pocket: row?.pocketEnd ?? {},
    account: row?.accountEnd ?? {},
    total: row?.totalEnd ?? 0,
  };
}

export function locationCents(snap: Snapshot, location: Location): number {
  const b = balances(snap);
  return location.pocketId ? (b.pocket[location.pocketId] ?? 0) : (b.main[location.accountId] ?? 0);
}

export function accountTotalCents(snap: Snapshot, accountId: string): number {
  return balances(snap).account[accountId] ?? 0;
}

export function sortAccounts<T extends { id: string }>(snap: Snapshot, accounts: T[]): T[] {
  const b = balances(snap);
  return accounts.slice().sort((a, b1) => (b.account[b1.id] ?? 0) - (b.account[a.id] ?? 0));
}

/** Main first, then active pockets by balance. Negative balances naturally fall to the bottom. */
export function sortPockets(snap: Snapshot, accountId: string) {
  const b = balances(snap);
  return snap.pockets
    .filter((p) => p.accountId === accountId && !p.archived)
    .sort((a, c) => (b.pocket[c.id] ?? 0) - (b.pocket[a.id] ?? 0));
}

export function isActiveLocation(snap: Snapshot, location: Location): boolean {
  if (!snap.accounts.some((a) => a.id === location.accountId && !a.archived)) return false;
  if (!location.pocketId) return true;
  return snap.pockets.some((p) => p.id === location.pocketId && p.accountId === location.accountId && !p.archived);
}

export function locationLabel(snap: Snapshot, location: Location): string {
  const account = snap.accounts.find((a) => a.id === location.accountId);
  const pocket = location.pocketId ? snap.pockets.find((p) => p.id === location.pocketId) : null;
  return `${account?.name ?? "Account"} · ${pocket?.name ?? "Main"}`;
}

const specOf = (r: Recurring): IntervalSpec => ({ interval: r.interval, customDays: r.customDays, dayOfMonth: r.dayOfMonth });

/* ----------------------------------------------------------------- bills */

/** Net amount already paid for the bill's current occurrence. Reversals reduce it. */
export function billPaidCents(snap: Snapshot, rec: Recurring, occurrence = rec.nextDue): number {
  return snap.transactions
    .filter((t) => t.status === "confirmed" && t.recurringId === rec.id && t.occurrenceDate === occurrence && t.kind === "expense")
    .reduce((sum, t) => sum + (t.reverses ? -t.amountCents : t.amountCents), 0);
}

export function billRemainingCents(snap: Snapshot, rec: Recurring): number {
  return Math.max(0, rec.amountCents - billPaidCents(snap, rec));
}

export type BillPaymentInput = {
  billId: string;
  amountCents: number;
  date: string;
  accountId: string;
  pocketId?: string | null;
  note?: string;
};

/**
 * Pays any amount towards the current bill occurrence. Early, late, partial and final payments
 * all use the same linked transaction. Only a payment that clears the balance advances the bill.
 */
export function payBill(snap: Snapshot, input: BillPaymentInput, ctx: Ctx): Result {
  const rec = snap.recurring.find((r) => r.id === input.billId);
  if (!rec) return { ok: false, error: "That bill no longer exists." };
  if (rec.kind !== "bill") return { ok: false, error: "That is not a bill." };
  if (rec.status !== "active") return { ok: false, error: "Resume this bill before paying it." };
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { ok: false, error: "Enter an amount above zero." };
  const remaining = billRemainingCents(snap, rec);
  if (remaining <= 0) return { ok: false, error: "This bill is already fully paid." };
  if (input.amountCents > remaining) return { ok: false, error: `Only ${(remaining / 100).toFixed(2)} remains on this bill.` };
  const occurrence = rec.nextDue;
  const txResult = saveTransaction(
    snap,
    {
      kind: "expense",
      status: "confirmed",
      date: input.date,
      amountCents: input.amountCents,
      accountId: input.accountId,
      pocketId: input.pocketId ?? null,
      toAccountId: null,
      categoryId: null,
      description: input.note?.trim() || rec.name,
      notes: `Bill payment for ${occurrence}`,
      recurringId: rec.id,
      occurrenceDate: occurrence,
    },
    ctx,
  );
  if (!txResult.ok) return txResult;
  const tx = txResult.change.puts[0].value as Transaction;
  const cleared = input.amountCents === remaining;
  const next: Recurring = cleared
    ? {
        ...rec,
        status: rec.interval === "once" ? "cancelled" : rec.status,
        nextDue: nextOccurrence(specOf(rec), occurrence),
        history: [...rec.history, { date: occurrence, outcome: "paid", txId: tx.id }],
        updatedAt: ctx.now,
      }
    : { ...rec, updatedAt: ctx.now };
  return {
    ok: true,
    change: {
      puts: [...txResult.change.puts, { store: "recurring", value: next }],
      deletes: [],
      guards: [{ store: "recurring", key: rec.id, nextDue: occurrence }],
    },
  };
}

/** Default source for a bill: its linked account/pocket, or the first active location. */
export function billSource(snap: Snapshot, rec: Recurring): Location | null {
  if (rec.accountId && isActiveLocation(snap, { accountId: rec.accountId, pocketId: rec.pocketId ?? null })) {
    return { accountId: rec.accountId, pocketId: rec.pocketId ?? null };
  }
  const account = snap.accounts.find((a) => !a.archived);
  return account ? { accountId: account.id, pocketId: null } : null;
}

/* ------------------------------------------------------- scheduled income */

export type IncomingLine = Location & { cents: number };

/**
 * Marks one scheduled incoming payment as received into one or more places. The income is counted
 * once; moving parts to other locations uses ordinary transfers.
 */
export function receiveScheduled(
  snap: Snapshot,
  input: { recurringId: string; date: string; lines: IncomingLine[]; amountCents?: number },
  ctx: Ctx,
): Result {
  const rec = snap.recurring.find((r) => r.id === input.recurringId);
  if (!rec) return { ok: false, error: "That scheduled payment no longer exists." };
  if (rec.kind !== "income") return { ok: false, error: "That is not incoming money." };
  if (rec.status !== "active") return { ok: false, error: "Resume this schedule before receiving it." };
  const occurrence = rec.nextDue;
  const already = snap.transactions.some(
    (t) =>
      t.status === "confirmed" &&
      t.recurringId === rec.id &&
      t.occurrenceDate === occurrence &&
      !t.reverses &&
      !t.reversedBy,
  );
  if (already) return { ok: false, error: "This payment has already been received." };
  const amount = input.amountCents ?? rec.amountCents;
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, error: "Enter an amount above zero." };
  if (input.lines.some((l) => !Number.isInteger(l.cents) || l.cents < 0)) return { ok: false, error: "Each split must be a whole, positive amount." };
  const total = input.lines.reduce((s, l) => s + l.cents, 0);
  if (total !== amount) return { ok: false, error: "The split must add up to the full amount." };
  if (!input.lines.some((l) => l.cents > 0)) return { ok: false, error: "Choose where the money arrived." };
  for (const line of input.lines) {
    if (!isActiveLocation(snap, line)) return { ok: false, error: "Choose an active account or pocket for each split." };
  }

  const first = input.lines.find((l) => l.cents > 0)!;
  const income = saveTransaction(
    snap,
    {
      kind: "income",
      status: "confirmed",
      date: input.date,
      amountCents: amount,
      accountId: first.accountId,
      pocketId: first.pocketId,
      toAccountId: null,
      categoryId: null,
      description: rec.name,
      notes: "Scheduled income received",
      recurringId: rec.id,
      occurrenceDate: occurrence,
    },
    ctx,
  );
  if (!income.ok) return income;
  const puts = [...income.change.puts];

  for (const line of input.lines) {
    if (line.cents <= 0) continue;
    if (line.accountId === first.accountId && (line.pocketId ?? null) === (first.pocketId ?? null)) continue;
    const move = saveTransaction(
      snap,
      {
        kind: "transfer",
        status: "confirmed",
        date: input.date,
        amountCents: line.cents,
        accountId: first.accountId,
        pocketId: first.pocketId,
        toAccountId: line.accountId,
        toPocketId: line.pocketId,
        categoryId: null,
        description: `${rec.name} → split`,
        notes: "Split of scheduled income",
      },
      ctx,
    );
    if (!move.ok) return move;
    puts.push(...move.change.puts);
  }

  const next: Recurring = {
    ...rec,
    status: rec.interval === "once" ? "cancelled" : rec.status,
    nextDue: nextOccurrence(specOf(rec), occurrence),
    history: [...rec.history, { date: occurrence, outcome: "paid", txId: (income.change.puts[0].value as Transaction).id }],
    updatedAt: ctx.now,
  };
  puts.push({ store: "recurring", value: next });
  return {
    ok: true,
    change: { puts, deletes: [], guards: [{ store: "recurring", key: rec.id, nextDue: occurrence }] },
  };
}

/* ------------------------------------------------------------- refunds */

/** How much of this expense can still be refunded. */
export function refundableCents(snap: Snapshot, originalId: string): number {
  const original = snap.transactions.find((t) => t.id === originalId);
  if (!original || original.kind !== "expense" || original.status !== "confirmed") return 0;
  if (original.reversedBy) return 0;
  const refunded = snap.transactions
    .filter(
      (t) =>
        t.status === "confirmed" &&
        t.kind === "refund" &&
        t.refundOf === originalId &&
        !t.reversedBy,
    )
    .reduce((sum, t) => sum + (t.reverses ? -t.amountCents : t.amountCents), 0);
  return Math.max(0, original.amountCents - refunded);
}

export function refundsFor(snap: Snapshot, originalId: string): Transaction[] {
  return snap.transactions
    .filter((t) => t.kind === "refund" && t.refundOf === originalId && !t.reverses)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function recordRefund(
  snap: Snapshot,
  input: { originalId: string; amountCents: number; date: string; accountId: string; pocketId?: string | null; note?: string },
  ctx: Ctx,
): Result {
  const original = snap.transactions.find((t) => t.id === input.originalId);
  if (!original) return { ok: false, error: "The original payment no longer exists." };
  if (original.kind !== "expense" || original.status !== "confirmed" || original.reverses) {
    return { ok: false, error: "Only a confirmed payment can be refunded." };
  }
  const available = refundableCents(snap, original.id);
  if (available <= 0) return { ok: false, error: "This payment has already been fully refunded." };
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { ok: false, error: "Enter an amount above zero." };
  if (input.amountCents > available) return { ok: false, error: `Only ${(available / 100).toFixed(2)} can still be refunded.` };
  return saveTransaction(
    snap,
    {
      kind: "refund",
      status: "confirmed",
      date: input.date,
      amountCents: input.amountCents,
      accountId: input.accountId,
      pocketId: input.pocketId ?? null,
      toAccountId: null,
      categoryId: null,
      description: input.note?.trim() || `Refund · ${original.description}`,
      notes: `Refund of ${original.id}`,
      refundOf: original.id,
    },
    ctx,
  );
}

/* --------------------------------------------------------------- IOUs */

/** Outstanding receivable (lent) or debt (borrowed), net of repayments and reversals. */
export function loanOutstandingCents(snap: Snapshot, loan: Loan): number {
  let outstanding = 0;
  for (const tx of snap.transactions) {
    if (tx.loanId !== loan.id || tx.status !== "confirmed") continue;
    const sign = tx.reverses ? -1 : 1;
    if (loan.direction === "lent") {
      if (tx.kind === "lend") outstanding += tx.amountCents * sign;
      if (tx.kind === "loan_repayment") outstanding -= tx.amountCents * sign;
    } else {
      if (tx.kind === "borrow") outstanding += tx.amountCents * sign;
      if (tx.kind === "debt_repayment") outstanding -= tx.amountCents * sign;
    }
  }
  return Math.max(0, outstanding);
}

export type LoanInput = {
  direction: Loan["direction"];
  person: string;
  amountCents: number;
  date: string;
  accountId: string;
  pocketId?: string | null;
  dueDate?: string | null;
  notes?: string;
};

export function saveLoan(snap: Snapshot, input: LoanInput, ctx: Ctx): Result {
  const person = input.person.trim();
  if (!person) return { ok: false, error: "Add the person's name." };
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { ok: false, error: "Enter an amount above zero." };
  if (!isActiveLocation(snap, { accountId: input.accountId, pocketId: input.pocketId ?? null })) {
    return { ok: false, error: "Choose an active account or pocket." };
  }
  const loan: Loan = {
    id: ctx.newId(),
    direction: input.direction,
    person,
    principalCents: input.amountCents,
    date: input.date,
    dueDate: input.dueDate || null,
    notes: (input.notes ?? "").trim().slice(0, 500),
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  const borrowed = input.direction === "borrowed";
  const tx = saveTransaction(
    snap,
    {
      kind: borrowed ? "borrow" : "lend",
      status: "confirmed",
      date: input.date,
      amountCents: input.amountCents,
      accountId: input.accountId,
      pocketId: input.pocketId ?? null,
      toAccountId: null,
      categoryId: null,
      description: borrowed ? `Borrowed from ${person}` : `Lent to ${person}`,
      notes: loan.notes,
      loanId: loan.id,
    },
    ctx,
  );
  if (!tx.ok) return tx;
  return { ok: true, change: { puts: [{ store: "loans", value: loan }, ...tx.change.puts], deletes: [] } };
}

export function repayLoan(
  snap: Snapshot,
  input: { loanId: string; amountCents: number; date: string; accountId: string; pocketId?: string | null; note?: string },
  ctx: Ctx,
): Result {
  const loan = snap.loans.find((l) => l.id === input.loanId);
  if (!loan) return { ok: false, error: "That IOU no longer exists." };
  const outstanding = loanOutstandingCents(snap, loan);
  if (outstanding <= 0) return { ok: false, error: "This IOU is already settled." };
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { ok: false, error: "Enter an amount above zero." };
  if (input.amountCents > outstanding) return { ok: false, error: `Only ${(outstanding / 100).toFixed(2)} remains on this IOU.` };
  if (!isActiveLocation(snap, { accountId: input.accountId, pocketId: input.pocketId ?? null })) {
    return { ok: false, error: "Choose an active account or pocket." };
  }
  const lent = loan.direction === "lent";
  return saveTransaction(
    snap,
    {
      kind: lent ? "loan_repayment" : "debt_repayment",
      status: "confirmed",
      date: input.date,
      amountCents: input.amountCents,
      accountId: input.accountId,
      pocketId: input.pocketId ?? null,
      toAccountId: null,
      categoryId: null,
      description: input.note?.trim() || (lent ? `Repaid by ${loan.person}` : `Repaid ${loan.person}`),
      notes: lent ? `Repayment of money lent to ${loan.person}` : `Repayment of money borrowed from ${loan.person}`,
      loanId: loan.id,
    },
    ctx,
  );
}

/* ------------------------------------------------------ balance edits */

/** Reconciles one account's Main balance or one pocket with an auditable correction. */
export function correctBalance(
  snap: Snapshot,
  location: Location,
  targetCents: number,
  ctx: Ctx,
): Result {
  if (!isActiveLocation(snap, location)) return { ok: false, error: "Choose an active account or pocket." };
  if (!Number.isInteger(targetCents)) return { ok: false, error: "Enter a valid balance." };
  const current = locationCents(snap, location);
  const diff = targetCents - current;
  if (diff === 0) return { ok: false, error: "The balance already matches." };
  return saveTransaction(
    snap,
    {
      kind: "adjustment",
      status: "confirmed",
      date: ctx.today || todayISO(),
      amountCents: diff,
      accountId: location.accountId,
      pocketId: location.pocketId,
      toAccountId: null,
      categoryId: null,
      description: "Balance correction",
      notes: `Corrected from ${(current / 100).toFixed(2)} to ${(targetCents / 100).toFixed(2)}.`,
    },
    ctx,
  );
}

/* ----------------------------------------------------- transaction edit */

/**
 * Edits an ordinary transaction while keeping linked refunds and IOUs within their limits.
 * Reversed rows are intentionally immutable; reverse or delete the reversal instead.
 */
export function editTransaction(
  snap: Snapshot,
  id: string,
  patch: Partial<Pick<Transaction, "date" | "amountCents" | "description" | "accountId" | "pocketId" | "categoryId">> & { notes?: string },
  ctx: Ctx,
): Result {
  const tx = snap.transactions.find((t) => t.id === id);
  if (!tx) return { ok: false, error: "That transaction no longer exists." };
  if (tx.reverses || tx.reversedBy) return { ok: false, error: "Reversed transactions cannot be edited." };
  if (tx.status !== "confirmed") return { ok: false, error: "Confirm this item before editing it." };

  const amount = patch.amountCents ?? tx.amountCents;
  if (tx.kind !== "adjustment" && (!Number.isInteger(amount) || amount <= 0)) {
    return { ok: false, error: "Enter an amount above zero." };
  }

  if (tx.kind === "refund" && tx.refundOf) {
    const original = snap.transactions.find((t) => t.id === tx.refundOf);
    if (!original) return { ok: false, error: "The original payment is missing." };
    const others = refundableCents(snap, original.id) + tx.amountCents;
    if (amount > others) return { ok: false, error: `Only ${(others / 100).toFixed(2)} can be refunded in total.` };
  }

  if (tx.loanId) {
    const loan = snap.loans.find((l) => l.id === tx.loanId);
    if (loan) {
      const outstanding = loanOutstandingCents(snap, loan);
      if ((tx.kind === "loan_repayment" || tx.kind === "debt_repayment") && amount > outstanding + tx.amountCents) {
        return { ok: false, error: "The repayment cannot be larger than the IOU." };
      }
    }
  }

  const input: TxInput = {
    id: tx.id,
    kind: tx.kind,
    status: tx.status,
    date: patch.date ?? tx.date,
    amountCents: amount,
    accountId: patch.accountId ?? tx.accountId,
    pocketId: patch.pocketId !== undefined ? patch.pocketId : tx.pocketId,
    toAccountId: tx.toAccountId,
    toPocketId: tx.toPocketId,
    categoryId: patch.categoryId !== undefined ? patch.categoryId : tx.categoryId,
    description: patch.description ?? tx.description,
    notes: patch.notes !== undefined ? patch.notes : tx.notes,
    refundOf: tx.refundOf ?? null,
    loanId: tx.loanId ?? null,
  };
  if (input.kind === "adjustment") input.amountCents = amount;
  return saveTransaction(snap, input, ctx);
}

export function upcomingBills(snap: Snapshot): Recurring[] {
  return snap.recurring
    .filter((r) => r.kind === "bill" && r.status === "active")
    .sort((a, b) => (a.nextDue < b.nextDue ? -1 : a.nextDue > b.nextDue ? 1 : 0));
}

export function scheduledIncome(snap: Snapshot): Recurring[] {
  return snap.recurring
    .filter((r) => r.kind === "income" && r.status === "active")
    .sort((a, b) => (a.nextDue < b.nextDue ? -1 : a.nextDue > b.nextDue ? 1 : 0));
}

export function validISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseISO(value).getTime());
}
