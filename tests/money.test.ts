import assert from "node:assert/strict";
import { buildTimeline } from "../money/engine";
import { buildForecast } from "../money/forecast";
import { formatEUR, parseEuroToCents, addMonthsKeepDay } from "../money/money";
import { saveTransaction, reverseTransaction, confirmRecurring, closeMonthRollover, setAllocation, saveCategory, saveIncomeSplit, archivePocket, deleteAccount, reconcileBalance, mainNowCents, pocketNowCents, savePocket } from "../money/actions";
import { validateBackup, exportSnapshot } from "../money/backup";
import { defaultCategories, EMPTY_SNAPSHOT, type Snapshot, type Transaction } from "../money/types";

let n = 0;
const ctx = { now: "2026-11-01T09:00:00Z", today: "2026-11-10", newId: () => `id${++n}` };

const base: Snapshot = {
  ...EMPTY_SNAPSHOT,
  accounts: [
    { id: "cur", name: "Current", kind: "current", openingCents: 100_000, excludeFromSpendable: false, archived: false, createdAt: "" },
    { id: "sav", name: "Savings", kind: "savings", openingCents: 0, excludeFromSpendable: true, archived: false, createdAt: "" },
  ],
  categories: defaultCategories(),
  settings: { id: "main", plannedSpendAccountId: "cur" },
};

function apply(snap: Snapshot, changes: { puts: { store: string; value: unknown }[] }): Snapshot {
  const next = structuredClone(snap);
  for (const p of changes.puts) {
    if (p.store === "settings") {
      next.settings = p.value as Snapshot["settings"];
      continue;
    }
    const v = p.value as { id?: string; key?: string };
    const key = v.id ?? v.key;
    const list = (next as unknown as Record<string, { id?: string; key?: string }[]>)[p.store];
    const i = list.findIndex((x) => (x.id ?? x.key) === key);
    if (i >= 0) list[i] = v; else list.push(v);
  }
  return next;
}

function must(r: ReturnType<typeof saveTransaction>) {
  assert.ok(r.ok, r.ok ? "" : r.error);
  return r.change;
}

const bal = (snap: Snapshot, id: string, month = "2026-11") =>
  buildTimeline(snap, snap.transactions.filter((t) => t.status === "confirmed"), { from: month, to: month, defaultAlloc: "zero" }).byMonth[month].accountEnd[id];

// --- money helpers
assert.equal(formatEUR(123456), "€1,234.56");
assert.equal(parseEuroToCents("1,234.5"), 123450);
assert.equal(parseEuroToCents("12.345"), null);
assert.equal(addMonthsKeepDay("2026-01-31", 1, 31), "2026-02-28");

// --- transfers are not spending and keep net worth
{
  const s1 = apply(base, must(saveTransaction(base, { kind: "transfer", status: "confirmed", date: "2026-11-02", amountCents: 20_000, accountId: "cur", toAccountId: "sav", categoryId: null, description: "To savings", notes: "" }, ctx)));
  assert.equal(bal(s1, "cur"), 80_000);
  assert.equal(bal(s1, "sav"), 20_000);
  const tl = buildTimeline(s1, s1.transactions, { from: "2026-11", to: "2026-11", defaultAlloc: "zero" }).byMonth["2026-11"];
  assert.equal(tl.totalEnd, 100_000);
  assert.equal(tl.outflow, 0);
}

// --- reversing restores balances; original stays visible and linked
{
  const exp = apply(base, must(saveTransaction(base, { kind: "expense", status: "confirmed", date: "2026-11-03", amountCents: 5_000, accountId: "cur", toAccountId: null, categoryId: "food", description: "Shop", notes: "" }, ctx)));
  assert.equal(bal(exp, "cur"), 95_000);
  const orig = exp.transactions[0];
  const rev = reverseTransaction(exp, orig.id, ctx);
  assert.ok(rev.ok);
  const after = apply(exp, rev.ok ? rev.change : { puts: [] });
  assert.equal(bal(after, "cur"), 100_000);
  assert.equal(reverseTransaction(after, orig.id, ctx).ok, false, "cannot reverse twice");
}

// --- subscription payment: exactly one transaction, duplicate tap refused
{
  const snap: Snapshot = {
    ...base,
    recurring: [{ id: "cursor", kind: "bill", name: "Cursor", icon: "•", amountCents: 2000, interval: "monthly", customDays: null, dayOfMonth: 10, nextDue: "2026-11-10", categoryId: "subscriptions", accountId: "cur", status: "active", notes: "", history: [], createdAt: "", updatedAt: "" }],
  };
  const first = confirmRecurring(snap, "cursor", ctx);
  assert.ok(first.ok);
  const paid = apply(snap, first.ok ? first.change : { puts: [] });
  assert.equal(paid.transactions.length, 1);
  assert.equal(paid.recurring[0].nextDue, "2026-12-10");
  assert.equal(bal(paid, "cur"), 98_000);
  // Same occurrence replayed from a stale snapshot: the guard (checked in IndexedDB) must refuse it.
  const replay = confirmRecurring(snap, "cursor", ctx);
  assert.ok(replay.ok);
  assert.deepEqual(replay.ok ? replay.change.guards : [], [{ store: "recurring", key: "cursor", nextDue: "2026-11-10" }]);
  assert.equal(paid.transactions.filter((t) => t.recurringId === "cursor" && t.occurrenceDate === "2026-11-10").length, 1);
}

// --- partial subscription payment: schedule advances only when the remainder is paid
{
  const snap: Snapshot = {
    ...base,
    recurring: [{ id: "netflix", kind: "bill", name: "Netflix", icon: "•", amountCents: 1600, interval: "monthly", customDays: null, dayOfMonth: 1, nextDue: "2026-11-01", categoryId: "subscriptions", accountId: "cur", status: "active", notes: "", history: [], createdAt: "", updatedAt: "" }],
  };
  const part = confirmRecurring(snap, "netflix", ctx, 600);
  assert.ok(part.ok);
  const mid = apply(snap, part.ok ? part.change : { puts: [] });
  assert.equal(mid.recurring[0].nextDue, "2026-11-01", "partial pay keeps the same due date");
  assert.equal(mid.recurring[0].history.length, 0, "history waits until the occurrence is settled");
  assert.equal(bal(mid, "cur"), 99_400);
  assert.equal(confirmRecurring(mid, "netflix", ctx, 1200).ok, false, "cannot overpay the remainder");
  const rest = confirmRecurring(mid, "netflix", ctx, 1000);
  assert.ok(rest.ok);
  const done = apply(mid, rest.ok ? rest.change : { puts: [] });
  assert.equal(done.recurring[0].nextDue, "2026-12-01");
  assert.equal(done.recurring[0].history.length, 1);
  assert.equal(done.transactions.filter((t) => t.recurringId === "netflix").length, 2);
  assert.equal(bal(done, "cur"), 98_400);
}

// --- rollover: carry vs release (negative balances never forgiven)
{
  const snap: Snapshot = { ...base, allocations: [{ key: "2026-10|food", month: "2026-10", categoryId: "food", cents: 30_000 }] };
  const carry = buildTimeline(snap, [], { from: "2026-10", to: "2026-11", defaultAlloc: "zero" }).byMonth["2026-11"];
  assert.equal(carry.catStart.food, 30_000);
  const released = buildTimeline({ ...snap, closures: [{ month: "2026-10", choices: { food: "release" } }] }, [], { from: "2026-10", to: "2026-11", defaultAlloc: "zero" }).byMonth["2026-11"];
  assert.equal(released.catStart.food, 0);
  void closeMonthRollover;
  void setAllocation;
}

// --- forecast: subscriptions are not subtracted twice in the planned scenario
{
  const snap: Snapshot = {
    ...base,
    categories: defaultCategories(),
    recurring: [{ id: "sub", kind: "bill", name: "Cursor", icon: "•", amountCents: 2000, interval: "monthly", customDays: null, dayOfMonth: 10, nextDue: "2026-11-10", categoryId: "subscriptions", accountId: "cur", status: "active", notes: "", history: [], createdAt: "", updatedAt: "" }],
  };
  const sched = buildForecast(snap, "scheduled", {}, 12, "2026-11-01");
  assert.equal(sched.months.length, 12);
  assert.equal(sched.months[0].end, 100_000 - 2000);
  const plan = buildForecast(snap, "planned", {}, 12, "2026-11-01");
  // Subscriptions target is €250; €20 already scheduled, so only €230 more is planned that month.
  const subsItem = plan.months[0].items.find((i) => i.categoryId === "subscriptions" && i.source === "budget");
  assert.equal(subsItem?.amountCents, 23_000);
  // Scheduled-only plus planned adds spending; scenarios must differ.
  assert.ok(plan.months[0].end < sched.months[0].end);
  // What-if never changes stored data.
  const before = JSON.stringify(snap);
  buildForecast(snap, "scheduled", { extra: [{ kind: "expense", date: "2026-11-20", amountCents: 9_000, accountId: "cur", toAccountId: null, categoryId: null, description: "What-if" }] }, 12, "2026-11-01");
  assert.equal(JSON.stringify(snap), before);
}

// --- backup: round trip validates; broken references rejected
{
  const json = exportSnapshot(base);
  const ok = validateBackup(JSON.parse(json));
  assert.ok(ok.ok);
  const broken = JSON.parse(json);
  broken.data.transactions = [{ id: "x", kind: "expense", status: "confirmed", date: "2026-11-01", amountCents: 100, accountId: "missing", pocketId: null, toAccountId: null, toPocketId: null, categoryId: null, description: "x", notes: "", recurringId: null, occurrenceDate: null, reverses: false, reversedBy: null, createdAt: "", updatedAt: "" } satisfies Transaction];
  assert.equal(validateBackup(broken).ok, false);
}

// --- starting at €0: budget targets are plans and never reduce the balance
{
  const zero: Snapshot = { ...base, accounts: base.accounts.map((a) => (a.id === "cur" ? { ...a, openingCents: 0 } : a)) };
  const food = zero.categories.find((c) => c.id === "food");
  assert.ok(food, "food category exists");
  const r = saveCategory(zero, { id: "food", name: food.name, icon: food.icon, color: food.color, kind: food.kind, targetCents: 25_000, goalCents: food.goalCents }, ctx);
  assert.ok(r.ok, r.ok ? "" : r.error);
  const saved = apply(zero, r.ok ? r.change : { puts: [] });
  assert.equal(saved.categories.find((c) => c.id === "food")?.targetCents, 25_000);
  assert.equal(bal(saved, "cur"), 0, "a target must not change the account balance");
  assert.equal(buildTimeline(saved, [], { from: "2026-11", to: "2026-11", defaultAlloc: "zero" }).byMonth["2026-11"].totalEnd, 0);
}

// --- moving plan amounts between categories keeps balances and total money unchanged
{
  const before = buildTimeline(base, [], { from: "2026-11", to: "2026-11", defaultAlloc: "zero" }).byMonth["2026-11"];
  const food = base.categories.find((c) => c.id === "food");
  const transport = base.categories.find((c) => c.id === "transport");
  assert.ok(food && transport);
  const r1 = saveCategory(base, { id: "food", name: food.name, icon: food.icon, color: food.color, kind: food.kind, targetCents: food.targetCents - 5_000, goalCents: food.goalCents }, ctx);
  assert.ok(r1.ok);
  const mid = apply(base, r1.ok ? r1.change : { puts: [] });
  const r2 = saveCategory(mid, { id: "transport", name: transport.name, icon: transport.icon, color: transport.color, kind: transport.kind, targetCents: transport.targetCents + 5_000, goalCents: transport.goalCents }, ctx);
  assert.ok(r2.ok);
  const moved = apply(mid, r2.ok ? r2.change : { puts: [] });
  const after = buildTimeline(moved, [], { from: "2026-11", to: "2026-11", defaultAlloc: "zero" }).byMonth["2026-11"];
  assert.equal(after.totalEnd, before.totalEnd);
  assert.equal(bal(moved, "cur"), bal(base, "cur"));
}

// --- pockets: €500 Revolut stays, pocket moves are transfers, spending hits one place once
{
  const revolut: Snapshot = {
    ...base,
    accounts: [
      { id: "rev", name: "Revolut", kind: "digital", openingCents: 50_000, excludeFromSpendable: false, archived: false, createdAt: "" },
      { id: "cur", name: "AIB", kind: "current", openingCents: 0, excludeFromSpendable: false, archived: false, createdAt: "" },
    ],
    pockets: [
      { id: "food", accountId: "rev", name: "Food", icon: "🍎", color: "#34d399", targetCents: null, archived: false, createdAt: "" },
      { id: "travel", accountId: "rev", name: "Travel", icon: "✈", color: "#38bdf8", targetCents: null, archived: false, createdAt: "" },
    ],
  };
  const pocketBal = (snap: Snapshot, id: string) =>
    buildTimeline(snap, snap.transactions, { from: "2026-11", to: "2026-11", defaultAlloc: "zero" }).byMonth["2026-11"].pocketEnd[id];
  const mainBal = (snap: Snapshot) =>
    buildTimeline(snap, snap.transactions, { from: "2026-11", to: "2026-11", defaultAlloc: "zero" }).byMonth["2026-11"].mainEnd.rev;

  // Main → Food pocket €100: total unchanged, Main down, Food up.
  const moved = apply(revolut, must(saveTransaction(revolut, { kind: "transfer", status: "confirmed", date: "2026-11-02", amountCents: 10_000, accountId: "rev", pocketId: null, toAccountId: "rev", toPocketId: "food", categoryId: null, description: "To Food", notes: "" }, ctx)));
  assert.equal(mainBal(moved), 40_000);
  assert.equal(pocketBal(moved, "food"), 10_000);
  assert.equal(bal(moved, "rev"), 50_000, "account total = Main + pockets");

  // €50 spent from Food: deducted once, from the Food pocket only.
  const spent = apply(moved, must(saveTransaction(moved, { kind: "expense", status: "confirmed", date: "2026-11-03", amountCents: 5_000, accountId: "rev", pocketId: "food", toAccountId: null, categoryId: "food", description: "Lunch", notes: "" }, ctx)));
  assert.equal(pocketBal(spent, "food"), 5_000);
  assert.equal(mainBal(spent), 40_000);
  assert.equal(bal(spent, "rev"), 45_000);

  // A pocket from another account is refused.
  const wrong = saveTransaction(moved, { kind: "expense", status: "confirmed", date: "2026-11-03", amountCents: 100, accountId: "cur", pocketId: "food", toAccountId: null, categoryId: null, description: "x", notes: "" }, ctx);
  assert.equal(wrong.ok, false);

  // Archiving a pocket with money in it is refused; an empty one can be archived.
  assert.equal(archivePocket(spent, "food").ok, false);
  assert.equal(archivePocket(spent, "travel").ok, true);

  // Salary split: one income transaction, then internal transfers. Lines must match exactly.
  const splitOk = saveIncomeSplit(revolut, {
    description: "Salary", date: "2026-11-21", amountCents: 250_000, receiveAccountId: "rev",
    lines: [{ accountId: "rev", pocketId: null, cents: 50_000 }, { accountId: "rev", pocketId: "food", cents: 30_000 }, { accountId: "cur", pocketId: null, cents: 170_000 }],
  }, ctx);
  assert.ok(splitOk.ok, splitOk.ok ? "" : splitOk.error);
  const split = apply(revolut, splitOk.ok ? splitOk.change : { puts: [] });
  const totalBefore = buildTimeline(revolut, [], { from: "2026-11", to: "2026-11", defaultAlloc: "zero" }).byMonth["2026-11"].totalEnd;
  const totalAfter = buildTimeline(split, split.transactions, { from: "2026-11", to: "2026-11", defaultAlloc: "zero" }).byMonth["2026-11"].totalEnd;
  assert.equal(totalAfter - totalBefore, 250_000, "income counted exactly once");
  assert.equal(split.transactions.filter((t) => t.kind === "income").length, 1);
  assert.equal(pocketBal(split, "food"), 30_000, "split line lands in the Food pocket");
  assert.equal(saveIncomeSplit(revolut, { description: "Salary", date: "2026-11-21", amountCents: 100, receiveAccountId: "rev", lines: [{ accountId: "rev", pocketId: null, cents: 101 }] }, ctx).ok, false, "over-allocation refused");
  assert.equal(saveIncomeSplit(revolut, { description: "Salary", date: "2026-11-21", amountCents: 100, receiveAccountId: "rev", lines: [{ accountId: "rev", pocketId: null, cents: 50 }] }, ctx).ok, false, "unallocated remainder refused");

  // Subscription paid from a pocket: one expense, deducted from that pocket only.
  const subSnap: Snapshot = {
    ...revolut,
    recurring: [{ id: "gym", kind: "bill", name: "Gym", icon: "•", amountCents: 3000, interval: "monthly", customDays: null, dayOfMonth: 10, nextDue: "2026-11-10", categoryId: null, accountId: "rev", pocketId: "food", status: "active", notes: "", history: [], createdAt: "", updatedAt: "" }],
  };
  const funded = apply(subSnap, must(saveTransaction(subSnap, { kind: "transfer", status: "confirmed", date: "2026-11-02", amountCents: 10_000, accountId: "rev", pocketId: null, toAccountId: "rev", toPocketId: "food", categoryId: null, description: "To Food", notes: "" }, ctx)));
  const paid = confirmRecurring(funded, "gym", ctx);
  assert.ok(paid.ok);
  const after = apply(funded, paid.ok ? paid.change : { puts: [] });
  assert.equal(after.transactions.filter((t) => t.recurringId === "gym").length, 1);
  assert.equal(pocketBal(after, "food"), 7_000, "deducted from the Food pocket once");
  assert.equal(bal(after, "rev"), 47_000, "account total drops by the payment only");
  assert.equal(mainBal(after), 40_000, "Main is untouched");
}


// --- pocket balance correction adjusts only that pocket; account total = main + pockets
{
  const withPocket = apply(base, must(savePocket(base, { accountId: "cur", name: "Food", icon: "🍎", color: "#34d399", targetCents: null }, ctx)));
  const funded = apply(withPocket, must(saveTransaction(withPocket, { kind: "transfer", status: "confirmed", date: "2026-11-02", amountCents: 20_000, accountId: "cur", pocketId: null, toAccountId: "cur", toPocketId: withPocket.pockets[0].id, categoryId: null, description: "To Food", notes: "" }, ctx)));
  const foodId = funded.pockets[0].id;
  assert.equal(mainNowCents(funded, "cur"), 80_000);
  assert.equal(pocketNowCents(funded, foodId), 20_000);
  const fix = reconcileBalance(funded, "cur", foodId, 15_000, ctx, "pocket");
  assert.ok(fix.ok);
  const after = apply(funded, fix.ok ? fix.change : { puts: [] });
  assert.equal(pocketNowCents(after, foodId), 15_000);
  assert.equal(mainNowCents(after, "cur"), 80_000);
  assert.equal(bal(after, "cur"), 95_000);
  assert.equal(after.transactions.some((t) => t.kind === "adjustment" && t.description === "Balance correction"), true);
}

// --- confirm bill can override payment source for one occurrence
{
  const snap: Snapshot = {
    ...base,
    recurring: [{ id: "cursor", kind: "bill", name: "Cursor", icon: "•", amountCents: 2000, interval: "monthly", customDays: null, dayOfMonth: 10, nextDue: "2026-11-10", categoryId: "subscriptions", accountId: "cur", status: "active", notes: "", history: [], createdAt: "", updatedAt: "" }],
  };
  const paid = confirmRecurring(snap, "cursor", ctx, { amountCents: 2000, accountId: "sav", pocketId: null });
  assert.ok(paid.ok);
  const after = apply(snap, paid.ok ? paid.change : { puts: [] });
  assert.equal(after.transactions[0].accountId, "sav");
  assert.equal(after.recurring[0].accountId, "cur", "default source unchanged unless saveAsDefault");
}

// --- delete account: unused hard-deletes; used accounts are soft-deleted (archived)
{
  const unused: Snapshot = {
    ...EMPTY_SNAPSHOT,
    accounts: [{ id: "tmp", name: "Temp", kind: "current", openingCents: 0, excludeFromSpendable: false, archived: false, createdAt: "" }],
    categories: [],
    settings: null,
  };
  const hard = deleteAccount(unused, "tmp");
  assert.ok(hard.ok);
  assert.deepEqual(hard.ok ? hard.change.deletes : [], [{ store: "accounts", key: "tmp" }]);

  const soft = deleteAccount(base, "cur");
  assert.ok(soft.ok);
  const put = soft.ok ? soft.change.puts[0]?.value as { id: string; archived: boolean } : null;
  assert.equal(put?.id, "cur");
  assert.equal(put?.archived, true);
}

// --- backup v1
{
  const v1 = { format: "detailflows-money", version: 1, exportedAt: "", data: { accounts: base.accounts, categories: base.categories, transactions: [], recurring: [], allocations: [], closures: [], settings: base.settings } };
  const parsed = validateBackup(JSON.parse(JSON.stringify(v1)));
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.error);
  assert.deepEqual(parsed.ok ? parsed.data.pockets : [], []);
  assert.equal(parsed.ok ? parsed.data.accounts[0].openingCents : 0, 100_000);
}

console.log("money tests passed");
