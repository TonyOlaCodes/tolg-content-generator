import type { Allocation, Snapshot } from "./types";

export const BACKUP_FORMAT = "detailflows-money";
/** 3 adds IOUs (loans). Older backups are still accepted and upgraded on import. */
export const BACKUP_VERSION = 3;

export type Backup = { format: string; version: number; exportedAt: string; data: Snapshot };

export function exportSnapshot(snap: Snapshot, now: Date = new Date()): string {
  const backup: Backup = { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), data: snap };
  return JSON.stringify(backup, null, 2);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v);
const isStr = (v: unknown) => typeof v === "string";
const isISO = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isMonth = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}$/.test(v);


/** Validates the parsed file. Returns the snapshot only when every record and reference is valid. */
export function validateBackup(raw: unknown): { ok: true; data: Snapshot } | { ok: false; error: string } {
  if (!isObj(raw)) return { ok: false, error: "This file is not a Money Tracker backup." };
  if (raw.format !== BACKUP_FORMAT) return { ok: false, error: "This file is not a Money Tracker backup." };
  if (![1, 2, BACKUP_VERSION].includes(raw.version as number)) {
    return { ok: false, error: `Unsupported backup version: ${String(raw.version)}.` };
  }
  if (!isObj(raw.data)) return { ok: false, error: "The backup has no data." };
  // Version 1 has no pockets: upgrade it so every record reads as Main money.
  const d: Record<string, unknown> = { pockets: [], loans: [], ...raw.data };
  if (!Array.isArray(d.pockets)) return { ok: false, error: 'Backup is missing "pockets".' };
  if (!Array.isArray(d.loans)) d.loans = [];
  if (raw.version === 1 && Array.isArray(d.transactions)) {
    d.transactions = (d.transactions as Record<string, unknown>[]).map((t) => ({ pocketId: null, toPocketId: null, ...t }));
  }
  const lists = ["accounts", "categories", "transactions", "recurring", "allocations", "closures"] as const;
  for (const k of lists) if (!Array.isArray(d[k])) return { ok: false, error: `Backup is missing "${k}".` };

  const accounts = d.accounts as unknown[];
  const pockets = d.pockets as unknown[];
  const categories = d.categories as unknown[];
  const transactions = d.transactions as unknown[];
  const recurring = d.recurring as unknown[];
  const allocations = d.allocations as unknown[];
  const closures = d.closures as unknown[];
  const loans = d.loans as unknown[];

  const accountIds = new Set<string>();
  for (const a of accounts) {
    if (!isObj(a) || !isStr(a.id) || !isStr(a.name) || !isInt(a.openingCents) || typeof a.archived !== "boolean" || typeof a.excludeFromSpendable !== "boolean") {
      return { ok: false, error: "An account in the backup is malformed." };
    }
    if (accountIds.has(a.id)) return { ok: false, error: "The backup has duplicate account IDs." };
    accountIds.add(a.id);
  }

  const pocketIds = new Set<string>();
  for (const p of pockets) {
    if (!isObj(p) || !isStr(p.id) || !isStr(p.name) || !isStr(p.accountId) || !accountIds.has(p.accountId) || typeof p.archived !== "boolean") {
      return { ok: false, error: "A pocket in the backup is malformed." };
    }
    if (pocketIds.has(p.id)) return { ok: false, error: "The backup has duplicate pocket IDs." };
    pocketIds.add(p.id);
  }

  const loanIds = new Set<string>();
  for (const l of loans) {
    if (!isObj(l) || !isStr(l.id) || !isStr(l.person) || !isInt(l.principalCents) || !isISO(l.date)) {
      return { ok: false, error: "An IOU in the backup is malformed." };
    }
    if (l.direction !== "lent" && l.direction !== "borrowed") return { ok: false, error: "An IOU has an unknown direction." };
    if (loanIds.has(l.id)) return { ok: false, error: "The backup has duplicate IOU IDs." };
    loanIds.add(l.id);
  }

  const categoryIds = new Set<string>();
  for (const c of categories) {
    if (!isObj(c) || !isStr(c.id) || !isStr(c.name) || !isInt(c.targetCents) || (c.kind !== "spending" && c.kind !== "saving")) {
      return { ok: false, error: "A category in the backup is malformed." };
    }
    if (categoryIds.has(c.id)) return { ok: false, error: "The backup has duplicate category IDs." };
    categoryIds.add(c.id);
  }

  const txIds = new Set<string>();
  for (const t of transactions) {
    if (isObj(t) && isStr(t.id)) {
      if (txIds.has(t.id)) return { ok: false, error: "The backup has duplicate transaction IDs." };
      txIds.add(t.id);
    }
  }
  for (const t of transactions) {
    if (!isObj(t) || !isStr(t.id) || !isISO(t.date) || !isInt(t.amountCents)) {
      return { ok: false, error: "A transaction in the backup is malformed." };
    }
    if (!["expense", "income", "transfer", "refund", "adjustment", "lend", "borrow", "loan_repayment", "debt_repayment"].includes(String(t.kind))) {
      return { ok: false, error: "A transaction has an unknown type." };
    }
    if (t.status !== "planned" && t.status !== "confirmed") return { ok: false, error: "A transaction has an unknown status." };
    if (t.kind !== "adjustment" && (t.amountCents as number) <= 0) return { ok: false, error: "A transaction amount must be positive." };
    if (t.accountId !== null && !(isStr(t.accountId) && accountIds.has(t.accountId))) {
      return { ok: false, error: "A transaction refers to an account that is not in the backup." };
    }
    if (t.toAccountId !== null && !(isStr(t.toAccountId) && accountIds.has(t.toAccountId))) {
      return { ok: false, error: "A transfer refers to an account that is not in the backup." };
    }
    if (t.pocketId != null && !(isStr(t.pocketId) && pocketIds.has(t.pocketId))) {
      return { ok: false, error: "A transaction refers to a pocket that is not in the backup." };
    }
    if (t.toPocketId != null && !(isStr(t.toPocketId) && pocketIds.has(t.toPocketId))) {
      return { ok: false, error: "A transfer refers to a pocket that is not in the backup." };
    }
    if (t.categoryId !== null && !(isStr(t.categoryId) && categoryIds.has(t.categoryId))) {
      return { ok: false, error: "A transaction refers to a category that is not in the backup." };
    }
    if (t.refundOf != null && !(isStr(t.refundOf) && t.refundOf !== t.id && txIds.has(t.refundOf))) {
      return { ok: false, error: "A refund refers to a payment that is not in the backup." };
    }
    if (t.loanId != null && !(isStr(t.loanId) && loanIds.has(t.loanId))) {
      return { ok: false, error: "A transaction refers to an IOU that is not in the backup." };
    }
  }

  const recIds = new Set<string>();
  for (const r of recurring) {
    if (!isObj(r) || !isStr(r.id) || !isStr(r.name) || !isInt(r.amountCents) || !isISO(r.nextDue)) {
      return { ok: false, error: "A scheduled item in the backup is malformed." };
    }
    if (recIds.has(r.id)) return { ok: false, error: "The backup has duplicate scheduled item IDs." };
    recIds.add(r.id);
    if (r.accountId !== null && r.accountId !== undefined && !(isStr(r.accountId) && accountIds.has(r.accountId))) {
      return { ok: false, error: "A scheduled item refers to an account that is not in the backup." };
    }
  }

  for (const a of allocations as Allocation[]) {
    if (!isObj(a) || !isMonth(a.month) || !isStr(a.categoryId) || !isInt(a.cents) || a.cents < 0) {
      return { ok: false, error: "An allocation in the backup is malformed." };
    }
    if (!categoryIds.has(a.categoryId)) return { ok: false, error: "An allocation refers to a missing category." };
  }
  for (const c of closures) {
    if (!isObj(c) || !isMonth(c.month) || !isObj(c.choices)) return { ok: false, error: "A month closure in the backup is malformed." };
  }

  const settings = d.settings;
  if (settings !== null && settings !== undefined) {
    if (!isObj(settings) || (settings.plannedSpendAccountId !== null && !(isStr(settings.plannedSpendAccountId) && accountIds.has(settings.plannedSpendAccountId)))) {
      return { ok: false, error: "The settings in the backup are invalid." };
    }
    if (settings.splitTemplate != null) {
      if (!Array.isArray(settings.splitTemplate)) return { ok: false, error: "The saved split in the backup is invalid." };
      for (const line of settings.splitTemplate) {
        if (
          !isObj(line) ||
          !isStr(line.accountId) ||
          !accountIds.has(line.accountId) ||
          typeof line.cents !== "number" ||
          !Number.isSafeInteger(line.cents) ||
          line.cents <= 0 ||
          (line.pocketId !== null && !(isStr(line.pocketId) && pocketIds.has(line.pocketId)))
        ) {
          return { ok: false, error: "The saved split in the backup is invalid." };
        }
      }
    }
  }

  return { ok: true, data: d as unknown as Snapshot };
}
