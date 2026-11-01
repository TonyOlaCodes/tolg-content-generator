import type { Allocation, Snapshot } from "./types";

export const BACKUP_FORMAT = "detailflows-money";
/** 2 adds pockets. Version 1 backups are still accepted and upgraded on import. */
export const BACKUP_VERSION = 2;

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
  if (raw.version !== 1 && raw.version !== BACKUP_VERSION) {
    return { ok: false, error: `Unsupported backup version: ${String(raw.version)}.` };
  }
  if (!isObj(raw.data)) return { ok: false, error: "The backup has no data." };
  // Version 1 has no pockets: upgrade it so every record reads as Main money.
  const d: Record<string, unknown> = { pockets: [], ...raw.data };
  if (!Array.isArray(d.pockets)) return { ok: false, error: 'Backup is missing "pockets".' };
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
    if (!isObj(t) || !isStr(t.id) || !isISO(t.date) || !isInt(t.amountCents)) {
      return { ok: false, error: "A transaction in the backup is malformed." };
    }
    if (!["expense", "income", "transfer", "refund", "adjustment"].includes(String(t.kind))) {
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
    if (txIds.has(t.id)) return { ok: false, error: "The backup has duplicate transaction IDs." };
    txIds.add(t.id);
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
  }

  return { ok: true, data: d as unknown as Snapshot };
}
