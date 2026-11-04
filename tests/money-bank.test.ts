import assert from "node:assert/strict";
import { defaultCtx, deleteTransaction, reverseTransaction, saveTransaction, saveIncomeSplit, saveSplitTemplate } from "../money/actions";
import {
  billRemainingCents,
  correctBalance,
  editTransaction,
  loanOutstandingCents,
  payBill,
  receiveScheduled,
  recordRefund,
  refundableCents,
  repayLoan,
  saveLoan,
  sortAccounts,
  sortPockets,
} from "../money/banking";
import { buildTimeline } from "../money/engine";
import { exportSnapshot, validateBackup } from "../money/backup";
import { EMPTY_SNAPSHOT, defaultCategories, type Snapshot, type Transaction } from "../money/types";

let n = 0;
const ctx = { now: "2026-11-01T09:00:00Z", today: "2026-11-10", newId: () => `b${++n}` };

const base: Snapshot = {
  ...EMPTY_SNAPSHOT,
  accounts: [
    { id: "rev", name: "Revolut", kind: "digital", openingCents: 100_000, excludeFromSpendable: false, archived: false, createdAt: "" },
    { id: "aib", name: "AIB", kind: "current", openingCents: 20_000, excludeFromSpendable: false, archived: false, createdAt: "" },
    { id: "sav", name: "Savings", kind: "savings", openingCents: 50_000, excludeFromSpendable: true, archived: false, createdAt: "" },
  ],
  pockets: [
    { id: "food", accountId: "rev", name: "Food", icon: "🍎", color: "#34d399", targetCents: null, archived: false, createdAt: "" },
    { id: "subs", accountId: "rev", name: "Subscriptions", icon: "🔁", color: "#a78bfa", targetCents: null, archived: false, createdAt: "" },
    { id: "emergency", accountId: "rev", name: "Emergency", icon: "🛡", color: "#ffd166", targetCents: null, archived: false, createdAt: "" },
  ],
  categories: defaultCategories(),
};

function apply(snap: Snapshot, change: { puts: { store: string; value: unknown }[]; deletes: { store: string; key: string }[] }): Snapshot {
  const next = structuredClone(snap);
  for (const p of change.puts) {
    const value = p.value as { id?: string; key?: string; month?: string };
    if (p.store === "settings") {
      next.settings = p.value as Snapshot["settings"];
      continue;
    }
    const key = value.id ?? value.key ?? value.month;
    const list = (next as unknown as Record<string, { id?: string; key?: string; month?: string }[]>)[p.store];
    const index = list.findIndex((item) => (item.id ?? item.key ?? item.month) === key);
    if (index >= 0) list[index] = value;
    else list.push(value);
  }
  for (const d of change.deletes) {
    const list = (next as unknown as Record<string, { id?: string; key?: string; month?: string }[]>)[d.store];
    const index = list.findIndex((item) => (item.id ?? item.key ?? item.month) === d.key);
    if (index >= 0) list.splice(index, 1);
  }
  return next;
}

function commit(snap: Snapshot, result: ReturnType<typeof saveTransaction>): Snapshot {
  assert.ok(result.ok, result.ok ? "" : result.error);
  return apply(snap, result.change);
}

const month = "2026-11";
const tl = (snap: Snapshot) => buildTimeline(snap, snap.transactions.filter((t) => t.status === "confirmed"), { from: month, to: month, defaultAlloc: "zero" }).byMonth[month];
const total = (snap: Snapshot) => tl(snap).totalEnd;
const acc = (snap: Snapshot, id: string) => tl(snap).accountEnd[id] ?? 0;
const pocket = (snap: Snapshot, id: string) => tl(snap).pocketEnd[id] ?? 0;

// --- add outside money: counted once, into the chosen pocket
{
  const added = commit(base, saveTransaction(base, { kind: "income", status: "confirmed", date: "2026-11-02", amountCents: 22_500, accountId: "rev", pocketId: "subs", toAccountId: null, categoryId: null, description: "Top up", notes: "" }, ctx));
  assert.equal(total(added), 170_000 + 22_500);
  assert.equal(pocket(added, "subs"), 22_500);
  assert.equal(acc(added, "rev"), 122_500, "pocket money is part of the account total");
}

// --- spending from a pocket reduces cash once, and negative balances are allowed
{
  const spent = commit(base, saveTransaction(base, { kind: "expense", status: "confirmed", date: "2026-11-03", amountCents: 25_000, accountId: "rev", pocketId: "food", toAccountId: null, categoryId: null, description: "Lidl", notes: "" }, ctx));
  assert.equal(pocket(spent, "food"), -25_000);
  assert.equal(acc(spent, "rev"), 75_000);
  assert.equal(total(spent), 145_000);
}

// --- moving money between accounts is not income or spending and preserves the total
{
  const before = total(base);
  const moved = commit(base, saveTransaction(base, { kind: "transfer", status: "confirmed", date: "2026-11-04", amountCents: 15_000, accountId: "rev", pocketId: null, toAccountId: "aib", toPocketId: null, categoryId: null, description: "Move", notes: "" }, ctx));
  assert.equal(acc(moved, "rev"), 85_000);
  assert.equal(acc(moved, "aib"), 35_000);
  assert.equal(total(moved), before);
  // Swapping direction is the same operation with source and destination exchanged.
  const swapped = commit(base, saveTransaction(base, { kind: "transfer", status: "confirmed", date: "2026-11-04", amountCents: 15_000, accountId: "aib", pocketId: null, toAccountId: "rev", toPocketId: null, categoryId: null, description: "Move", notes: "" }, ctx));
  assert.equal(acc(swapped, "rev"), 115_000);
  assert.equal(acc(swapped, "aib"), 5_000);
  assert.equal(total(swapped), before);
  const same = saveTransaction(base, { kind: "transfer", status: "confirmed", date: "2026-11-04", amountCents: 100, accountId: "rev", pocketId: "food", toAccountId: "rev", toPocketId: "food", categoryId: null, description: "x", notes: "" }, ctx);
  assert.equal(same.ok, false, "the same pocket cannot transfer to itself");
}

// --- editing a balance writes an auditable correction, never income
{
  const corrected = commit(base, correctBalance(base, { accountId: "rev", pocketId: null }, 90_000, ctx));
  assert.equal(acc(corrected, "rev"), 90_000);
  assert.equal(total(corrected), 160_000);
  const correction = corrected.transactions.find((tx) => tx.kind === "adjustment");
  assert.ok(correction);
  assert.equal(correction?.description, "Balance correction");
  assert.equal(tl(corrected).income, 0, "a correction is not income");
  assert.equal(correctBalance(base, { accountId: "rev", pocketId: null }, 100_000, ctx).ok, false, "no-op corrections are refused");
}

// --- bills: early, partial, multiple instalments, different sources, one deduction each
{
  const billSnap: Snapshot = {
    ...base,
    recurring: [
      { id: "light", kind: "bill", name: "Light bill", icon: "↻", amountCents: 12_000, interval: "monthly", customDays: null, dayOfMonth: 20, nextDue: "2026-11-20", categoryId: null, accountId: "rev", pocketId: "subs", status: "active", notes: "", history: [], createdAt: "", updatedAt: "" },
    ],
  };
  // €60 early, from the default pocket.
  const first = payBill(billSnap, { billId: "light", amountCents: 6_000, date: "2026-11-05", accountId: "rev", pocketId: "subs" }, ctx);
  assert.ok(first.ok);
  let snap = apply(billSnap, first.change);
  assert.equal(billRemainingCents(snap, snap.recurring[0]), 6_000);
  assert.equal(snap.recurring[0].nextDue, "2026-11-20", "partial payment does not advance the bill");
  assert.equal(pocket(snap, "subs"), -6_000);
  assert.equal(acc(snap, "rev"), 94_000);

  // €20 from another account, on time.
  const second = payBill(snap, { billId: "light", amountCents: 2_000, date: "2026-11-20", accountId: "aib", pocketId: null }, ctx);
  assert.ok(second.ok);
  snap = apply(snap, second.change);
  assert.equal(billRemainingCents(snap, snap.recurring[0]), 4_000);
  assert.equal(acc(snap, "aib"), 18_000);

  // Overpaying is refused.
  assert.equal(payBill(snap, { billId: "light", amountCents: 4_001, date: "2026-11-21", accountId: "rev", pocketId: null }, ctx).ok, false);

  // €40 final, late, from Main. The bill advances once and cannot be paid twice.
  const last = payBill(snap, { billId: "light", amountCents: 4_000, date: "2026-11-25", accountId: "rev", pocketId: null }, ctx);
  assert.ok(last.ok);
  snap = apply(snap, last.change);
  assert.equal(snap.recurring[0].nextDue, "2026-12-20");
  assert.equal(billRemainingCents(snap, snap.recurring[0]), 12_000, "the next occurrence is a fresh, unpaid bill");
  assert.equal(snap.transactions.filter((tx) => tx.recurringId === "light").length, 3);
  assert.equal(total(snap), 170_000 - 12_000, "three instalments deduct exactly the bill amount once");
  assert.equal(payBill(snap, { billId: "light", amountCents: 100, date: "2026-11-26", accountId: "rev", pocketId: null }, ctx).ok, true, "next occurrence can still be paid early");
}

// --- reversing a bill payment reopens the bill and the replacement payment is not double-counted
{
  const billSnap: Snapshot = {
    ...base,
    recurring: [
      { id: "phone", kind: "bill", name: "Phone", icon: "↻", amountCents: 4_000, interval: "monthly", customDays: null, dayOfMonth: 10, nextDue: "2026-11-10", categoryId: null, accountId: "rev", pocketId: null, status: "active", notes: "", history: [], createdAt: "", updatedAt: "" },
    ],
  };
  const first = payBill(billSnap, { billId: "phone", amountCents: 4_000, date: "2026-11-10", accountId: "rev", pocketId: null }, ctx);
  assert.ok(first.ok);
  const paid = apply(billSnap, first.change);
  assert.equal(paid.recurring[0].nextDue, "2026-12-10");
  const paidTx = paid.transactions[0];
  const reversed = reverseTransaction(paid, paidTx.id, ctx);
  assert.ok(reversed.ok);
  const reopened = apply(paid, reversed.change);
  assert.equal(reopened.recurring[0].nextDue, "2026-11-10", "the bill is due again");
  assert.equal(billRemainingCents(reopened, reopened.recurring[0]), 4_000);
  assert.equal(acc(reopened, "rev"), 100_000, "the reversal restores the cash");
  const second = payBill(reopened, { billId: "phone", amountCents: 4_000, date: "2026-11-11", accountId: "rev", pocketId: null }, ctx);
  assert.ok(second.ok);
  const repaid = apply(reopened, second.change);
  assert.equal(acc(repaid, "rev"), 96_000, "only the replacement payment reduces cash");
  assert.equal(repaid.recurring[0].nextDue, "2026-12-10");
}

// --- a one-time bill is removed from the schedule after it is paid
{
  const once: Snapshot = {
    ...base,
    recurring: [
      { id: "deposit", kind: "bill", name: "Deposit", icon: "↻", amountCents: 5_000, interval: "once", customDays: null, dayOfMonth: 5, nextDue: "2026-11-05", categoryId: null, accountId: "rev", pocketId: null, status: "active", notes: "", history: [], createdAt: "", updatedAt: "" },
    ],
  };
  const paid = payBill(once, { billId: "deposit", amountCents: 5_000, date: "2026-11-05", accountId: "rev", pocketId: null }, ctx);
  assert.ok(paid.ok);
  const snap = apply(once, paid.change);
  assert.equal(snap.recurring[0].status, "cancelled", "a one-time bill does not repeat");
  assert.equal(acc(snap, "rev"), 95_000);
  assert.equal(snap.transactions.length, 1);
}

// --- scheduled incoming money is not cash until received, then splits exactly once
{
  const incoming: Snapshot = {
    ...base,
    recurring: [
      { id: "salary", kind: "income", name: "Salary", icon: "↓", amountCents: 250_000, interval: "monthly", customDays: null, dayOfMonth: 25, nextDue: "2026-11-25", categoryId: null, accountId: "rev", pocketId: null, status: "active", notes: "", history: [], createdAt: "", updatedAt: "" },
    ],
  };
  assert.equal(total(incoming), 170_000, "expected money is not in the balance");
  const received = receiveScheduled(
    incoming,
    {
      recurringId: "salary",
      date: "2026-11-25",
      lines: [
        { accountId: "rev", pocketId: null, cents: 50_000 },
        { accountId: "rev", pocketId: "food", cents: 30_000 },
        { accountId: "aib", pocketId: null, cents: 170_000 },
      ],
    },
    ctx,
  );
  assert.ok(received.ok, received.ok ? "" : received.error);
  const snap = apply(incoming, received.change);
  assert.equal(total(snap), 420_000, "income counted exactly once");
  assert.equal(snap.transactions.filter((tx) => tx.kind === "income").length, 1);
  assert.equal(pocket(snap, "food"), 30_000);
  assert.equal(acc(snap, "aib"), 190_000);
  assert.equal(snap.recurring[0].nextDue, "2026-12-25");
  const bad = receiveScheduled(incoming, { recurringId: "salary", date: "2026-11-25", lines: [{ accountId: "rev", pocketId: null, cents: 100 }] }, ctx);
  assert.equal(bad.ok, false, "under-allocation is refused");
  assert.deepEqual(received.ok ? received.change.guards : [], [{ store: "recurring", key: "salary", nextDue: "2026-11-25" }]);
}

// --- salary split, arbitrary arrival: one income, internal transfers
{
  const result = saveIncomeSplit(
    base,
    {
      description: "Bonus",
      date: "2026-11-06",
      amountCents: 90_000,
      receiveAccountId: "rev",
      lines: [
        { accountId: "rev", pocketId: null, cents: 20_000 },
        { accountId: "rev", pocketId: "emergency", cents: 40_000 },
        { accountId: "sav", pocketId: null, cents: 30_000 },
      ],
    },
    ctx,
  );
  assert.ok(result.ok, result.ok ? "" : result.error);
  const snap = apply(base, result.change);
  assert.equal(total(snap), 260_000);
  assert.equal(pocket(snap, "emergency"), 40_000);
  assert.equal(acc(snap, "sav"), 80_000);
  assert.equal(snap.transactions.filter((tx) => tx.kind === "income").length, 1);
}

// --- refunds: full and partial, linked, capped, credited once
{
  const bought = commit(base, saveTransaction(base, { kind: "expense", status: "confirmed", date: "2026-11-02", amountCents: 5_000, accountId: "rev", pocketId: "food", toAccountId: null, categoryId: null, description: "Coat", notes: "" }, ctx));
  const original = bought.transactions.find((tx) => tx.description === "Coat")!;
  assert.equal(refundableCents(bought, original.id), 5_000);
  const refund = recordRefund(bought, { originalId: original.id, amountCents: 2_000, date: "2026-11-04", accountId: "aib", pocketId: null }, ctx);
  assert.ok(refund.ok);
  let snap = apply(bought, refund.change);
  assert.equal(total(snap), 170_000 - 5_000 + 2_000);
  assert.equal(acc(snap, "aib"), 22_000);
  assert.equal(refundableCents(snap, original.id), 3_000);
  assert.equal(recordRefund(snap, { originalId: original.id, amountCents: 3_001, date: "2026-11-05", accountId: "rev", pocketId: null }, ctx).ok, false);
  const full = recordRefund(snap, { originalId: original.id, amountCents: 3_000, date: "2026-11-05", accountId: "rev", pocketId: "food" }, ctx);
  assert.ok(full.ok);
  snap = apply(snap, full.change);
  assert.equal(total(snap), 170_000);
  assert.equal(refundableCents(snap, original.id), 0);
  assert.equal(recordRefund(snap, { originalId: original.id, amountCents: 1, date: "2026-11-05", accountId: "rev", pocketId: null }, ctx).ok, false, "no over-refund");
  assert.equal(snap.transactions.filter((tx) => tx.kind === "refund").length, 2);
}

// --- lending and repayment: cash down, separate receivable, no income on repayment
{
  const lent = saveLoan(base, { direction: "lent", person: "Sam", amountCents: 10_000, date: "2026-11-02", accountId: "rev", pocketId: null }, ctx);
  assert.ok(lent.ok);
  let snap = apply(base, lent.change);
  const loan = snap.loans[0];
  assert.equal(acc(snap, "rev"), 90_000);
  assert.equal(loanOutstandingCents(snap, loan), 10_000);
  assert.equal(tl(snap).income, 0, "lending is not negative income");
  const repay = repayLoan(snap, { loanId: loan.id, amountCents: 4_000, date: "2026-11-08", accountId: "aib", pocketId: null }, ctx);
  assert.ok(repay.ok);
  snap = apply(snap, repay.change);
  assert.equal(acc(snap, "aib"), 24_000);
  assert.equal(loanOutstandingCents(snap, loan), 6_000);
  assert.equal(tl(snap).income, 0, "a loan repayment is not income");
  assert.equal(repayLoan(snap, { loanId: loan.id, amountCents: 6_001, date: "2026-11-09", accountId: "rev", pocketId: null }, ctx).ok, false);
}

// --- borrowing and repayment: cash up, separate debt, principal not spending
{
  const borrowed = saveLoan(base, { direction: "borrowed", person: "Alex", amountCents: 5_000, date: "2026-11-02", accountId: "rev", pocketId: null }, ctx);
  assert.ok(borrowed.ok);
  let snap = apply(base, borrowed.change);
  const loan = snap.loans[0];
  assert.equal(acc(snap, "rev"), 105_000);
  assert.equal(loanOutstandingCents(snap, loan), 5_000);
  assert.equal(tl(snap).outflow, 0, "borrowing is not income, and the debt is separate");
  const repay = repayLoan(snap, { loanId: loan.id, amountCents: 2_000, date: "2026-11-09", accountId: "rev", pocketId: "subs" }, ctx);
  assert.ok(repay.ok);
  snap = apply(snap, repay.change);
  assert.equal(pocket(snap, "subs"), -2_000);
  assert.equal(loanOutstandingCents(snap, loan), 3_000);
  assert.equal(tl(snap).outflow, 0, "debt principal repayment is not ordinary spending");
}

// --- editing and reversing transactions keeps balances exact
{
  const spent = commit(base, saveTransaction(base, { kind: "expense", status: "confirmed", date: "2026-11-03", amountCents: 5_000, accountId: "rev", pocketId: "food", toAccountId: null, categoryId: null, description: "Dinner", notes: "" }, ctx));
  const tx = spent.transactions[0];
  const edited = commit(spent, editTransaction(spent, tx.id, { amountCents: 3_000, description: "Dinner edited" }, ctx));
  assert.equal(acc(edited, "rev"), 97_000);
  const reversal = reverseTransaction(edited, tx.id, ctx);
  assert.ok(reversal.ok);
  const reversed = apply(edited, reversal.change);
  assert.equal(acc(reversed, "rev"), 100_000);
  assert.equal(reversed.transactions.length, 2, "original and reversal both stay visible");
  assert.equal(deleteTransaction(edited, tx.id, ctx).ok, true, "an un-reversed transaction can be deleted");
}

// --- sorting: accounts by total, pockets by balance with Main separate and always first
{
  const withBalances = commit(
    commit(
      commit(base, saveTransaction(base, { kind: "transfer", status: "confirmed", date: "2026-11-02", amountCents: 40_000, accountId: "rev", pocketId: null, toAccountId: "aib", toPocketId: null, categoryId: null, description: "x", notes: "" }, ctx)),
      saveTransaction(base, { kind: "transfer", status: "confirmed", date: "2026-11-03", amountCents: 1_000, accountId: "rev", pocketId: null, toAccountId: "rev", toPocketId: "food", categoryId: null, description: "x", notes: "" }, ctx),
    ),
    saveTransaction(base, { kind: "transfer", status: "confirmed", date: "2026-11-03", amountCents: 9_000, accountId: "rev", pocketId: null, toAccountId: "rev", toPocketId: "emergency", categoryId: null, description: "x", notes: "" }, ctx),
  );
  // totals: AIB 60k, Savings 50k, Revolut 60k (tie stable); food 1k before emergency 9k by balance.
  assert.deepEqual(sortAccounts(withBalances, withBalances.accounts).map((a) => a.id), ["rev", "aib", "sav"]);
  assert.deepEqual(sortPockets(withBalances, "rev").map((p) => p.name), ["Emergency", "Food", "Subscriptions"]);
}

// --- every euro reconciles: total = active accounts, account = Main + pockets
{
  const split = saveIncomeSplit(base, { description: "Salary", date: "2026-11-05", amountCents: 100_000, receiveAccountId: "rev", lines: [{ accountId: "rev", pocketId: "food", cents: 30_000 }, { accountId: "aib", pocketId: null, cents: 70_000 }] }, ctx);
  assert.ok(split.ok);
  const snap = apply(base, split.change);
  const row = tl(snap);
  const active = snap.accounts.filter((a) => !a.archived).reduce((sum, a) => sum + (row.accountEnd[a.id] ?? 0), 0);
  assert.equal(row.totalEnd, active);
  for (const account of snap.accounts) {
    const main = row.mainEnd[account.id] ?? 0;
    const pockets = snap.pockets.filter((p) => p.accountId === account.id).reduce((sum, p) => sum + (row.pocketEnd[p.id] ?? 0), 0);
    assert.equal(row.accountEnd[account.id], main + pockets, `${account.name} reconciles`);
  }
}

// --- a saved salary split survives backup and validates its destinations
{
  const saved = saveSplitTemplate(base, [
    { accountId: "rev", pocketId: "food", cents: 30_000 },
    { accountId: "aib", pocketId: null, cents: 70_000 },
  ]);
  assert.ok(saved.ok, saved.ok ? "" : saved.error);
  const snap = apply(base, saved.change);
  assert.equal(snap.settings?.splitTemplate?.length, 2);
  const parsed = validateBackup(JSON.parse(exportSnapshot(snap)));
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.error);
  assert.equal(parsed.ok ? parsed.data.settings?.splitTemplate?.length : 0, 2);
  assert.equal(saveSplitTemplate(base, [{ accountId: "rev", pocketId: "emergency-bad", cents: 100 }]).ok, false);
}

// --- backup round trip keeps IOUs and linked movement, and old backups still load
{
  const lent = saveLoan(base, { direction: "lent", person: "Sam", amountCents: 10_000, date: "2026-11-02", accountId: "rev", pocketId: null }, ctx);
  assert.ok(lent.ok);
  const snap = apply(base, lent.change);
  const parsed = validateBackup(JSON.parse(exportSnapshot(snap)));
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.error);
  assert.equal(parsed.ok ? parsed.data.loans.length : 0, 1);
  assert.equal(parsed.ok ? parsed.data.transactions[0].loanId : null, snap.loans[0].id);
  const v2 = {
    format: "detailflows-money",
    version: 2,
    exportedAt: "",
    data: { accounts: base.accounts, pockets: base.pockets, categories: base.categories, transactions: [] as Transaction[], recurring: [], allocations: [], closures: [], settings: null },
  };
  const old = validateBackup(JSON.parse(JSON.stringify(v2)));
  assert.ok(old.ok, old.ok ? "" : old.error);
  assert.deepEqual(old.ok ? old.data.loans : [null], []);
}

// --- intended default context still produces local dates and ids
{
  const runtime = defaultCtx();
  assert.equal(runtime.today.length, 10);
  assert.ok(runtime.newId().length > 0);
}

console.log("money banking tests passed");
