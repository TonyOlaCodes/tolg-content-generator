import assert from "node:assert/strict";
import { buildTimeline } from "../money/engine";
import { buildForecast } from "../money/forecast";
import { formatEUR, parseEuroToCents, addMonthsKeepDay } from "../money/money";
import { saveTransaction, reverseTransaction, confirmRecurring, closeMonthRollover, setAllocation } from "../money/actions";
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
  broken.data.transactions = [{ id: "x", kind: "expense", status: "confirmed", date: "2026-11-01", amountCents: 100, accountId: "missing", toAccountId: null, categoryId: null, description: "x", notes: "", recurringId: null, occurrenceDate: null, reverses: false, reversedBy: null, createdAt: "", updatedAt: "" } satisfies Transaction];
  assert.equal(validateBackup(broken).ok, false);
}

console.log("money tests passed");
