import { buildTimeline } from "./engine";
import { isoDate, nextOccurrence, parseISO, todayISO, type IntervalSpec } from "./money";
import type { Account, AccountKind, Category, Pocket, Recurring, Rollover, Snapshot, Transaction, TxKind } from "./types";

export type StoreName = "accounts" | "pockets" | "categories" | "transactions" | "recurring" | "allocations" | "closures" | "settings";
export type Change = {
  puts: { store: StoreName; value: unknown }[];
  deletes: { store: StoreName; key: string }[];
  /** Checked inside the write transaction: the stored record must still have this nextDue, otherwise nothing is written. */
  guards?: { store: "recurring"; key: string; nextDue: string }[];
};
export type Result = { ok: true; change: Change } | { ok: false; error: string };

export type Ctx = { now: string; today: string; newId: () => string };

export const defaultCtx = (): Ctx => ({
  now: new Date().toISOString(),
  today: todayISO(),
  newId: () => crypto.randomUUID(),
});

const ok = (puts: Change["puts"] = [], deletes: Change["deletes"] = []): Result => ({ ok: true, change: { puts, deletes } });
const fail = (error: string): Result => ({ ok: false, error });
const isValidISO = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseISO(s).getTime()) && isoDate(parseISO(s)) === s;

// ---------- Transactions ----------

export type TxInput = {
  id?: string;
  kind: TxKind;
  status: "planned" | "confirmed";
  date: string;
  amountCents: number;
  accountId: string | null;
  pocketId?: string | null;
  toAccountId: string | null;
  toPocketId?: string | null;
  categoryId: string | null;
  description: string;
  notes: string;
};

export function saveTransaction(snap: Snapshot, input: TxInput, ctx: Ctx): Result {
  const description = input.description.trim();
  if (!description) return fail("Add a short description.");
  if (description.length > 120) return fail("Description is too long (120 characters max).");
  if (!isValidISO(input.date)) return fail("Choose a valid date.");
  if (!Number.isInteger(input.amountCents)) return fail("Amount must be whole cents.");
  if (input.kind === "adjustment") {
    if (input.amountCents === 0) return fail("An adjustment must change the balance.");
  } else if (input.amountCents <= 0) {
    return fail("Amount must be greater than zero.");
  }

  const activeAccount = (id: string | null) => snap.accounts.find((a) => a.id === id && !a.archived);
  const existing = input.id ? snap.transactions.find((t) => t.id === input.id) : undefined;
  if (input.id && !existing) return fail("That transaction no longer exists.");
  if (existing && (existing.reverses || existing.reversedBy)) {
    return fail("Reversed transactions cannot be edited. Reverse them or delete the reversal instead.");
  }

  // A pocket must belong to the account it is used with, and must be active.
  const activePocket = (accountId: string | null, pocketId: string | null | undefined) => {
    if (!pocketId) return true;
    return snap.pockets.some((p) => p.id === pocketId && p.accountId === accountId && !p.archived);
  };
  let toAccountId: string | null = null;
  let toPocketId: string | null = null;
  let categoryId: string | null = null;
  if (input.kind === "transfer") {
    if (!activeAccount(input.accountId) || !activeAccount(input.toAccountId)) return fail("Choose two active accounts.");
    if (!activePocket(input.accountId, input.pocketId) || !activePocket(input.toAccountId, input.toPocketId)) {
      return fail("Choose an active pocket in that account.");
    }
    if (input.accountId === input.toAccountId && (input.pocketId ?? null) === (input.toPocketId ?? null)) {
      return fail("A transfer needs two different places.");
    }
    toAccountId = input.toAccountId;
    toPocketId = input.toPocketId ?? null;
  } else {
    if (!activeAccount(input.accountId)) return fail("Choose an active account.");
    if (!activePocket(input.accountId, input.pocketId)) return fail("Choose an active pocket in that account.");
    if (input.kind === "expense" || input.kind === "refund") {
      if (input.categoryId) {
        const cat = snap.categories.find((c) => c.id === input.categoryId);
        if (!cat || cat.archived) return fail("Choose an active category.");
        categoryId = cat.id;
      }
    }
  }

  const tx: Transaction = {
    id: input.id ?? ctx.newId(),
    kind: input.kind,
    status: input.status,
    date: input.date,
    amountCents: input.amountCents,
    accountId: input.accountId,
    pocketId: input.pocketId ?? null,
    toAccountId,
    toPocketId,
    categoryId,
    description,
    notes: input.notes.trim().slice(0, 500),
    recurringId: existing?.recurringId ?? null,
    occurrenceDate: existing?.occurrenceDate ?? null,
    reverses: false,
    reversedBy: null,
    createdAt: existing?.createdAt ?? ctx.now,
    updatedAt: ctx.now,
  };
  return ok([{ store: "transactions", value: tx }]);
}

export type IncomeSplitLine = { accountId: string; pocketId: string | null; cents: number };

/**
 * Records income received into one account, then moves each allocated part to its pocket or account
 * with internal transfers. The lines must add up to the income exactly: nothing is counted twice and
 * nothing is left unassigned. The income transaction goes into `receiveAccountId` (Main by default).
 */
export function saveIncomeSplit(
  snap: Snapshot,
  input: { description: string; date: string; amountCents: number; receiveAccountId: string; lines: IncomeSplitLine[] },
  ctx: Ctx,
): Result {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return fail("Amount must be greater than zero.");
  const total = input.lines.reduce((s, l) => s + l.cents, 0);
  if (input.lines.some((l) => !Number.isInteger(l.cents) || l.cents < 0)) return fail("Each allocation must be a whole, positive amount.");
  if (total > input.amountCents) return fail("The allocations are more than the income. Reduce them.");
  if (total < input.amountCents) return fail("Allocate the whole amount, or choose where the remainder goes.");

  const income = saveTransaction(
    snap,
    {
      kind: "income",
      status: "confirmed",
      date: input.date,
      amountCents: input.amountCents,
      accountId: input.receiveAccountId,
      pocketId: null,
      toAccountId: null,
      categoryId: null,
      description: input.description,
      notes: "",
    },
    ctx,
  );
  if (!income.ok) return income;
  const puts = [...income.change.puts];
  const incomeId = (puts[0].value as Transaction).id;
  const from: { accountId: string; pocketId: string | null } = { accountId: input.receiveAccountId, pocketId: null };
  for (const line of input.lines) {
    if (line.cents === 0) continue;
    if (line.accountId === from.accountId && line.pocketId === from.pocketId) continue; // stays where it landed
    const t = saveTransaction(
      snap,
      {
        kind: "transfer",
        status: "confirmed",
        date: input.date,
        amountCents: line.cents,
        accountId: from.accountId,
        pocketId: from.pocketId,
        toAccountId: line.accountId,
        toPocketId: line.pocketId,
        categoryId: null,
        description: `${input.description} → split`,
        notes: `Split from income ${incomeId}`,
      },
      ctx,
    );
    if (!t.ok) return t;
    puts.push(...t.change.puts);
  }
  return ok(puts);
}

/** Confirms a planned transaction (it then counts in actual balances). */
export function confirmPlannedTransaction(snap: Snapshot, id: string, ctx: Ctx): Result {
  const tx = snap.transactions.find((t) => t.id === id);
  if (!tx) return fail("That transaction no longer exists.");
  if (tx.status === "confirmed") return fail("Already confirmed.");
  return ok([{ store: "transactions", value: { ...tx, status: "confirmed", updatedAt: ctx.now } }]);
}

export function deleteTransaction(snap: Snapshot, id: string, ctx: Ctx): Result {
  const tx = snap.transactions.find((t) => t.id === id);
  if (!tx) return fail("That transaction no longer exists.");
  if (tx.reversedBy) return fail("Delete its reversal first, then this transaction.");
  const puts: Change["puts"] = [];
  if (tx.reverses) {
    const original = snap.transactions.find((t) => t.reversedBy === id);
    if (original) puts.push({ store: "transactions", value: { ...original, reversedBy: null, updatedAt: ctx.now } });
  }
  // Undo a recurring payment so any unpaid remainder is due again.
  if (tx.recurringId && tx.occurrenceDate) {
    const rec = snap.recurring.find((r) => r.id === tx.recurringId);
    if (rec) {
      const history = rec.history.filter((h) => h.txId !== id);
      const othersPaid = snap.transactions
        .filter(
          (t) =>
            t.id !== id &&
            t.recurringId === tx.recurringId &&
            t.occurrenceDate === tx.occurrenceDate &&
            t.status === "confirmed" &&
            !t.reverses &&
            !t.reversedBy,
        )
        .reduce((s, t) => s + t.amountCents, 0);
      const nextDue =
        othersPaid < rec.amountCents && rec.nextDue > tx.occurrenceDate
          ? tx.occurrenceDate
          : rec.nextDue;
      puts.push({ store: "recurring", value: { ...rec, history, nextDue, updatedAt: ctx.now } });
    }
  }
  return ok(puts, [{ store: "transactions", key: id }]);
}

/** Creates an equal, opposite record linked to the original. Balances stay correct and the history stays visible. */
export function reverseTransaction(snap: Snapshot, id: string, ctx: Ctx): Result {
  const tx = snap.transactions.find((t) => t.id === id);
  if (!tx) return fail("That transaction no longer exists.");
  if (tx.status !== "confirmed") return fail("Only confirmed transactions can be reversed.");
  if (tx.reverses || tx.reversedBy) return fail("This transaction is already reversed.");
  const reversal: Transaction = {
    ...tx,
    id: ctx.newId(),
    date: ctx.today,
    description: `Reversal: ${tx.description}`,
    recurringId: null,
    occurrenceDate: null,
    reverses: true,
    reversedBy: null,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  return ok([
    { store: "transactions", value: reversal },
    { store: "transactions", value: { ...tx, reversedBy: reversal.id, updatedAt: ctx.now } },
  ]);
}

/** Records a reconciliation: the difference between the bank's balance and the app's is posted as an adjustment. */
export function reconcileAccount(snap: Snapshot, accountId: string, actualCents: number, ctx: Ctx): Result {
  const acc = snap.accounts.find((a) => a.id === accountId);
  if (!acc) return fail("Choose an account.");
  if (!Number.isInteger(actualCents)) return fail("Enter a valid balance.");
  const recorded = accountNowCents(snap, accountId);
  const diff = actualCents - recorded;
  if (diff === 0) return fail("The balance already matches.");
  return saveTransaction(
    snap,
    {
      kind: "adjustment",
      status: "confirmed",
      date: ctx.today,
      amountCents: diff,
      accountId,
      toAccountId: null,
      categoryId: null,
      description: "Balance reconciliation",
      notes: `Recorded balance ${(recorded / 100).toFixed(2)}, statement ${(actualCents / 100).toFixed(2)}.`,
    },
    ctx,
  );
}

/** Confirmed balance of one account today (includes only confirmed transactions). */
export function accountNowCents(snap: Snapshot, accountId: string): number {
  const acc = snap.accounts.find((a) => a.id === accountId);
  if (!acc) return 0;
  const confirmed = snap.transactions.filter((t) => t.status === "confirmed");
  const month = todayISO().slice(0, 7);
  const tl = buildTimeline(snap, confirmed, { from: month, to: month, defaultAlloc: "zero" });
  return tl.byMonth[month]?.accountEnd[accountId] ?? acc.openingCents;
}

// ---------- Recurring bills and income ----------

export type RecurringInput = {
  id?: string;
  kind: "bill" | "income";
  name: string;
  icon: string;
  amountCents: number;
  interval: IntervalSpec["interval"];
  customDays: number | null;
  dayOfMonth: number;
  nextDue: string;
  categoryId: string | null;
  accountId: string | null;
  pocketId?: string | null;
  notes: string;
};

export function saveRecurring(snap: Snapshot, input: RecurringInput, ctx: Ctx): Result {
  const name = input.name.trim();
  if (!name) return fail("Add a name.");
  if (name.length > 60) return fail("Name is too long (60 characters max).");
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return fail("Amount must be greater than zero.");
  if (!isValidISO(input.nextDue)) return fail("Choose a valid next date.");
  if (input.interval === "custom" && !(Number.isInteger(input.customDays) && (input.customDays ?? 0) > 0)) {
    return fail("Custom interval needs a number of days.");
  }
  if (!Number.isInteger(input.dayOfMonth) || input.dayOfMonth < 1 || input.dayOfMonth > 31) {
    return fail("Day of month must be between 1 and 31.");
  }
  if (input.accountId && !snap.accounts.some((a) => a.id === input.accountId && !a.archived)) {
    return fail("Choose an active account.");
  }
  if (input.categoryId && !snap.categories.some((c) => c.id === input.categoryId && !c.archived)) {
    return fail("Choose an active category.");
  }
  const pocketId = input.pocketId ?? null;
  if (pocketId && !snap.pockets.some((p) => p.id === pocketId && p.accountId === input.accountId && !p.archived)) {
    return fail("Choose an active pocket in that account.");
  }
  const existing = input.id ? snap.recurring.find((r) => r.id === input.id) : undefined;
  if (input.id && !existing) return fail("That item no longer exists.");
  const rec: Recurring = {
    id: input.id ?? ctx.newId(),
    kind: input.kind,
    name,
    icon: input.icon || "•",
    amountCents: input.amountCents,
    interval: input.interval,
    customDays: input.interval === "custom" ? input.customDays : null,
    dayOfMonth: input.dayOfMonth,
    nextDue: input.nextDue,
    categoryId: input.kind === "bill" ? input.categoryId : null,
    accountId: input.accountId,
    pocketId,
    status: existing?.status ?? "active",
    notes: input.notes.trim().slice(0, 500),
    history: existing?.history ?? [],
    createdAt: existing?.createdAt ?? ctx.now,
    updatedAt: ctx.now,
  };
  return ok([{ store: "recurring", value: rec }]);
}

function specOf(r: Recurring): IntervalSpec {
  return { interval: r.interval, customDays: r.customDays, dayOfMonth: r.dayOfMonth };
}

/** Confirmed, non-reversed payments already posted against one occurrence. */
export function paidTowardOccurrence(snap: Snapshot, recurringId: string, occurrenceDate: string): number {
  return snap.transactions
    .filter(
      (t) =>
        t.recurringId === recurringId &&
        t.occurrenceDate === occurrenceDate &&
        t.status === "confirmed" &&
        !t.reverses &&
        !t.reversedBy,
    )
    .reduce((s, t) => s + t.amountCents, 0);
}

/** Amount still owed for the current due date (full price minus any partial payments). */
export function remainingRecurringCents(snap: Snapshot, rec: Recurring): number {
  return Math.max(0, rec.amountCents - paidTowardOccurrence(snap, rec.id, rec.nextDue));
}

/**
 * Confirms (part of) the current occurrence: posts a linked transaction.
 * Pass amountCents to pay a partial amount; omit it (or pass the remaining balance) to settle in full.
 * The schedule only advances once the occurrence is fully paid.
 * Protected against double taps via a nextDue guard once the occurrence completes.
 */
export function confirmRecurring(snap: Snapshot, id: string, ctx: Ctx, amountCents?: number): Result {
  const rec = snap.recurring.find((r) => r.id === id);
  if (!rec) return fail("That item no longer exists.");
  if (rec.status !== "active") return fail("Resume this item before confirming it.");
  const occurrence = rec.nextDue;
  const remaining = remainingRecurringCents(snap, rec);
  if (remaining <= 0) return fail("This payment is already recorded.");
  const pay = amountCents === undefined ? remaining : amountCents;
  if (!Number.isInteger(pay) || pay <= 0) return fail("Enter an amount above zero.");
  if (pay > remaining) return fail("That is more than what is left on this bill.");
  const accountId = rec.accountId ?? snap.settings?.plannedSpendAccountId ?? null;
  if (!accountId || !snap.accounts.some((a) => a.id === accountId && !a.archived)) {
    return fail("Choose a payment account for this item first.");
  }
  const txId = ctx.newId();
  const settled = pay === remaining;
  const tx: Transaction = {
    id: txId,
    kind: rec.kind === "bill" ? "expense" : "income",
    status: "confirmed",
    date: ctx.today,
    amountCents: pay,
    accountId,
    pocketId: rec.accountId ? (rec.pocketId ?? null) : null,
    toAccountId: null,
    toPocketId: null,
    categoryId: rec.kind === "bill" ? rec.categoryId : null,
    description: settled && pay === rec.amountCents ? rec.name : `${rec.name} (partial)`,
    notes: "",
    recurringId: id,
    occurrenceDate: occurrence,
    reverses: false,
    reversedBy: null,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  const next: Recurring = settled
    ? {
        ...rec,
        nextDue: nextOccurrence(specOf(rec), occurrence),
        history: [...rec.history, { date: occurrence, outcome: "paid", txId }],
        updatedAt: ctx.now,
      }
    : { ...rec, updatedAt: ctx.now };
  return {
    ok: true,
    change: {
      puts: [
        { store: "transactions", value: tx },
        { store: "recurring", value: next },
      ],
      deletes: [],
      guards: settled ? [{ store: "recurring", key: id, nextDue: occurrence }] : undefined,
    },
  };
}

/** Skips the current occurrence without any money moving. */
export function skipRecurring(snap: Snapshot, id: string, ctx: Ctx): Result {
  const rec = snap.recurring.find((r) => r.id === id);
  if (!rec) return fail("That item no longer exists.");
  const next: Recurring = {
    ...rec,
    nextDue: nextOccurrence(specOf(rec), rec.nextDue),
    history: [...rec.history, { date: rec.nextDue, outcome: "skipped", txId: null }],
    updatedAt: ctx.now,
  };
  return ok([{ store: "recurring", value: next }]);
}

/** Moves the current occurrence to another date; later occurrences follow the rule from there. */
export function rescheduleRecurring(snap: Snapshot, id: string, date: string, ctx: Ctx): Result {
  const rec = snap.recurring.find((r) => r.id === id);
  if (!rec) return fail("That item no longer exists.");
  if (!isValidISO(date)) return fail("Choose a valid date.");
  return ok([{ store: "recurring", value: { ...rec, nextDue: date, updatedAt: ctx.now } }]);
}

export function setRecurringStatus(snap: Snapshot, id: string, status: Recurring["status"], ctx: Ctx): Result {
  const rec = snap.recurring.find((r) => r.id === id);
  if (!rec) return fail("That item no longer exists.");
  return ok([{ store: "recurring", value: { ...rec, status, updatedAt: ctx.now } }]);
}

/**
 * Removes a bill/subscription. Unused items are hard-deleted; items with payment history
 * are marked cancelled so past transactions stay linked.
 */
export function deleteRecurring(snap: Snapshot, id: string, ctx?: Ctx): Result {
  const rec = snap.recurring.find((r) => r.id === id);
  if (!rec) return fail("That item no longer exists.");
  if (rec.history.length > 0 || snap.transactions.some((t) => t.recurringId === id)) {
    const now = ctx?.now ?? new Date().toISOString();
    return ok([{ store: "recurring", value: { ...rec, status: "cancelled", updatedAt: now } }]);
  }
  return ok([], [{ store: "recurring", key: id }]);
}

// ---------- Budget ----------

export function setAllocation(snap: Snapshot, month: string, categoryId: string, cents: number): Result {
  if (!snap.categories.some((c) => c.id === categoryId)) return fail("Choose a category.");
  if (!Number.isInteger(cents) || cents < 0) return fail("Allocation must be zero or more.");
  const key = `${month}|${categoryId}`;
  if (cents === 0) return ok([], [{ store: "allocations", key }]);
  return ok([{ store: "allocations", value: { key, month, categoryId, cents } }]);
}

/** Moves money between two envelopes for one month. Total money and unallocated money are unchanged. */
export function moveAllocation(
  snap: Snapshot,
  month: string,
  fromId: string,
  toId: string,
  cents: number,
): Result {
  if (fromId === toId) return fail("Choose two different categories.");
  if (!Number.isInteger(cents) || cents <= 0) return fail("Amount must be greater than zero.");
  const tl = buildTimeline(snap, snap.transactions.filter((t) => t.status === "confirmed"), {
    from: month,
    to: month,
    defaultAlloc: "zero",
  });
  const row = tl.byMonth[month];
  const fromAlloc = row?.catAlloc[fromId] ?? 0;
  const toAlloc = row?.catAlloc[toId] ?? 0;
  if (cents > fromAlloc) return fail("That is more than is allocated to the source category this month.");
  const a = setAllocation(snap, month, fromId, fromAlloc - cents);
  const b = setAllocation(snap, month, toId, toAlloc + cents);
  if (!a.ok) return a;
  if (!b.ok) return b;
  return ok([...a.change.puts, ...b.change.puts], [...a.change.deletes, ...b.change.deletes]);
}

export function closeMonthRollover(snap: Snapshot, month: string, choices: Record<string, Rollover>): Result {
  const cleaned: Record<string, Rollover> = {};
  for (const c of snap.categories) cleaned[c.id] = choices[c.id] ?? "carry";
  return ok([{ store: "closures", value: { month, choices: cleaned } }]);
}

// ---------- Accounts ----------

export type AccountInput = {
  id?: string;
  name: string;
  kind: AccountKind;
  openingCents: number;
  excludeFromSpendable: boolean;
};

export function saveAccount(snap: Snapshot, input: AccountInput, ctx: Ctx): Result {
  const name = input.name.trim();
  if (!name) return fail("Add a name.");
  if (name.length > 40) return fail("Name is too long (40 characters max).");
  if (snap.accounts.some((a) => a.id !== input.id && a.name.toLowerCase() === name.toLowerCase())) {
    return fail("An account with that name already exists.");
  }
  if (!Number.isInteger(input.openingCents)) return fail("Enter a valid opening balance.");
  const existing = input.id ? snap.accounts.find((a) => a.id === input.id) : undefined;
  if (input.id && !existing) return fail("That account no longer exists.");
  const acc: Account = {
    id: input.id ?? ctx.newId(),
    name,
    kind: input.kind,
    openingCents: input.openingCents,
    excludeFromSpendable: input.excludeFromSpendable,
    archived: existing?.archived ?? false,
    createdAt: existing?.createdAt ?? ctx.now,
  };
  return ok([{ store: "accounts", value: acc }]);
}

export function setAccountArchived(snap: Snapshot, id: string, archived: boolean): Result {
  const acc = snap.accounts.find((a) => a.id === id);
  if (!acc) return fail("That account no longer exists.");
  return ok([{ store: "accounts", value: { ...acc, archived } }]);
}

/** Deletes an account only when nothing refers to it. Otherwise archive it, so history and totals stay correct. */
export function deleteAccount(snap: Snapshot, id: string): Result {
  const used =
    snap.transactions.some((t) => t.accountId === id || t.toAccountId === id) ||
    snap.recurring.some((r) => r.accountId === id) ||
    snap.pockets.some((p) => p.accountId === id) ||
    snap.settings?.plannedSpendAccountId === id;
  if (used) return fail("This account has transactions or schedules. Archive it instead.");
  return ok([], [{ store: "accounts", key: id }]);
}

// ---------- Pockets ----------

export type PocketInput = {
  id?: string;
  accountId: string;
  name: string;
  icon: string;
  color: string;
  targetCents: number | null;
};

export function savePocket(snap: Snapshot, input: PocketInput, ctx: Ctx): Result {
  const name = input.name.trim();
  if (!name) return fail("Add a name.");
  if (name.length > 40) return fail("Name is too long (40 characters max).");
  if (!snap.accounts.some((a) => a.id === input.accountId && !a.archived)) return fail("Choose an active account.");
  if (snap.pockets.some((p) => p.id !== input.id && p.accountId === input.accountId && p.name.toLowerCase() === name.toLowerCase())) {
    return fail("This account already has a pocket with that name.");
  }
  if (input.targetCents !== null && (!Number.isInteger(input.targetCents) || input.targetCents < 0)) {
    return fail("Target must be zero or more.");
  }
  const existing = input.id ? snap.pockets.find((p) => p.id === input.id) : undefined;
  if (input.id && !existing) return fail("That pocket no longer exists.");
  if (existing && existing.accountId !== input.accountId) {
    return fail("A pocket cannot move to another account. Create a new pocket instead.");
  }
  const pocket: Pocket = {
    id: input.id ?? ctx.newId(),
    accountId: input.accountId,
    name,
    icon: input.icon || "•",
    color: input.color,
    targetCents: input.targetCents,
    archived: existing?.archived ?? false,
    createdAt: existing?.createdAt ?? ctx.now,
  };
  return ok([{ store: "pockets", value: pocket }]);
}

/** Pocket balance now (confirmed transactions only). */
export function pocketNowCents(snap: Snapshot, pocketId: string): number {
  const confirmed = snap.transactions.filter((t) => t.status === "confirmed");
  const month = todayISO().slice(0, 7);
  const tl = buildTimeline(snap, confirmed, { from: month, to: month, defaultAlloc: "zero" });
  return tl.byMonth[month]?.pocketEnd[pocketId] ?? 0;
}

/**
 * Archives a pocket. Its balance must be zero first, so no money is hidden or lost.
 * Archived pockets keep their history.
 */
export function archivePocket(snap: Snapshot, id: string): Result {
  const pocket = snap.pockets.find((p) => p.id === id);
  if (!pocket) return fail("That pocket no longer exists.");
  if (pocketNowCents(snap, id) !== 0) return fail("Move the money out of this pocket before archiving it.");
  return ok([{ store: "pockets", value: { ...pocket, archived: true } }]);
}

/** Deletes a pocket only when nothing references it and its balance is zero. */
export function deletePocket(snap: Snapshot, id: string): Result {
  const pocket = snap.pockets.find((p) => p.id === id);
  if (!pocket) return fail("That pocket no longer exists.");
  if (pocketNowCents(snap, id) !== 0) return fail("Move the money out of this pocket before deleting it.");
  const used =
    snap.transactions.some((t) => t.pocketId === id || t.toPocketId === id) ||
    snap.categories.some((c) => c.defaultPocketId === id);
  if (used) return fail("This pocket has transactions. Archive it instead.");
  return ok([], [{ store: "pockets", key: id }]);
}

// ---------- Categories ----------

export type CategoryInput = {
  id?: string;
  name: string;
  icon: string;
  color: string;
  kind: Category["kind"];
  targetCents: number;
  goalCents: number | null;
  /** Optional pocket that this category's expenses come from. Omit to keep the current link. */
  defaultPocketId?: string | null;
};

export function saveCategory(snap: Snapshot, input: CategoryInput, ctx: Ctx): Result {
  const name = input.name.trim();
  if (!name) return fail("Add a name.");
  if (name.length > 40) return fail("Name is too long (40 characters max).");
  if (snap.categories.some((c) => c.id !== input.id && c.name.toLowerCase() === name.toLowerCase())) {
    return fail("A category with that name already exists.");
  }
  if (!Number.isInteger(input.targetCents) || input.targetCents < 0) return fail("Target must be zero or more.");
  if (input.goalCents !== null && (!Number.isInteger(input.goalCents) || input.goalCents < 0)) {
    return fail("Goal must be zero or more.");
  }
  const existing = input.id ? snap.categories.find((c) => c.id === input.id) : undefined;
  if (input.id && !existing) return fail("That category no longer exists.");
  const defaultPocketId = input.defaultPocketId !== undefined ? input.defaultPocketId : (existing?.defaultPocketId ?? null);
  if (defaultPocketId && !snap.pockets.some((p) => p.id === defaultPocketId && !p.archived)) {
    return fail("Choose an active pocket for this category.");
  }
  const order = existing?.order ?? Math.max(-1, ...snap.categories.map((c) => c.order)) + 1;
  const cat: Category = {
    id: input.id ?? ctx.newId(),
    name,
    icon: input.icon || "•",
    color: input.color,
    kind: input.kind,
    targetCents: input.targetCents,
    goalCents: input.goalCents,
    defaultPocketId,
    archived: existing?.archived ?? false,
    order,
  };
  return ok([{ store: "categories", value: cat }]);
}

export function moveCategory(snap: Snapshot, id: string, dir: -1 | 1): Result {
  const sorted = snap.categories.slice().sort((a, b) => a.order - b.order);
  const i = sorted.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= sorted.length) return ok();
  const a = { ...sorted[i], order: sorted[j].order };
  const b = { ...sorted[j], order: sorted[i].order };
  return ok([
    { store: "categories", value: a },
    { store: "categories", value: b },
  ]);
}

export function setCategoryArchived(snap: Snapshot, id: string, archived: boolean): Result {
  const cat = snap.categories.find((c) => c.id === id);
  if (!cat) return fail("That category no longer exists.");
  return ok([{ store: "categories", value: { ...cat, archived } }]);
}

export function deleteCategory(snap: Snapshot, id: string): Result {
  const used =
    snap.transactions.some((t) => t.categoryId === id) ||
    snap.recurring.some((r) => r.categoryId === id) ||
    snap.allocations.some((a) => a.categoryId === id);
  if (used) return fail("This category is used. Archive it instead.");
  return ok([], [{ store: "categories", key: id }]);
}

export function setPlannedSpendAccount(snap: Snapshot, accountId: string | null): Result {
  return ok([{ store: "settings", value: { id: "main", plannedSpendAccountId: accountId } }]);
}

