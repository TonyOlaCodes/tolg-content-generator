import { EMPTY_SNAPSHOT, defaultCategories, type Snapshot } from "./types";
import type { Change, StoreName } from "./actions";

/** Bump when the schema changes; add a migration step in `upgrade` for each bump. */
export const DB_VERSION = 2;
const DB_NAME = "detailflows-money";

export const STORES: StoreName[] = ["accounts", "pockets", "categories", "transactions", "recurring", "allocations", "closures", "settings"];

const KEY_PATH: Record<StoreName, string> = {
  accounts: "id",
  pockets: "id",
  categories: "id",
  transactions: "id",
  recurring: "id",
  allocations: "key",
  closures: "month",
  settings: "id",
};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Local storage is not available in this browser."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      const oldVersion = ev.oldVersion;
      // Migration 0 -> 1: create the base stores.
      if (oldVersion < 1) {
        for (const s of STORES) if (s !== "pockets") db.createObjectStore(s, { keyPath: KEY_PATH[s] });
      }
      // Migration 1 -> 2: add pockets. Existing accounts, transactions and balances are untouched:
      // every existing transaction has no pocket, so it still acts on the account's Main balance.
      if (oldVersion < 2) {
        db.createObjectStore("pockets", { keyPath: KEY_PATH.pockets });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open local storage."));
    req.onblocked = () => reject(new Error("Close other open copies of this app and reload."));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not save changes."));
    tx.onabort = () => reject(tx.error ?? new Error("Changes were cancelled and not saved."));
  });
}

/** Reads every store in one read transaction so the snapshot is consistent. */
export async function loadSnapshot(): Promise<Snapshot> {
  const db = await open();
  try {
    const tx = db.transaction(STORES, "readonly");
    const getAll = <T,>(name: StoreName) =>
      new Promise<T[]>((resolve, reject) => {
        const req = tx.objectStore(name).getAll();
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error);
      });
    const [accounts, pockets, categories, transactions, recurring, allocations, closures, settings] = await Promise.all([
      getAll<Snapshot["accounts"][number]>("accounts"),
      getAll<Snapshot["pockets"][number]>("pockets"),
      getAll<Snapshot["categories"][number]>("categories"),
      getAll<Snapshot["transactions"][number]>("transactions"),
      getAll<Snapshot["recurring"][number]>("recurring"),
      getAll<Snapshot["allocations"][number]>("allocations"),
      getAll<Snapshot["closures"][number]>("closures"),
      getAll<NonNullable<Snapshot["settings"]>>("settings"),
    ]);
    await txDone(tx);
    return {
      ...EMPTY_SNAPSHOT,
      accounts,
      pockets,
      categories,
      transactions,
      recurring,
      allocations,
      closures,
      settings: settings[0] ?? null,
    };
  } finally {
    db.close();
  }
}

/** Writes the default categories on first run only. Existing data is never overwritten. */
export async function ensureSeeded(): Promise<void> {
  const db = await open();
  try {
    const tx = db.transaction(["categories", "settings"], "readwrite");
    const cats = tx.objectStore("categories");
    const count = await new Promise<number>((resolve, reject) => {
      const req = cats.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (count === 0) {
      for (const c of defaultCategories()) cats.put(c);
    }
    await txDone(tx);
  } finally {
    db.close();
  }
}

/** Applies every change of one user action in a single transaction: all succeed or none do. */
export async function applyChange(change: Change): Promise<void> {
  const db = await open();
  try {
    const names = Array.from(new Set([...change.puts.map((p) => p.store), ...change.deletes.map((d) => d.store), ...(change.guards ?? []).map((g) => g.store)]));
    const tx = db.transaction(names, "readwrite");
    for (const g of change.guards ?? []) {
      const req = tx.objectStore(g.store).get(g.key);
      req.onsuccess = () => {
        const current = req.result as { nextDue?: string } | undefined;
        if (!current || current.nextDue !== g.nextDue) {
          tx.abort();
        }
      };
    }
    for (const p of change.puts) tx.objectStore(p.store).put(p.value);
    for (const d of change.deletes) tx.objectStore(d.store).delete(d.key);
    await txDone(tx).catch((e) => {
      if (change.guards?.length) throw new Error("This item was already updated. Nothing was recorded twice.");
      throw e;
    });
  } finally {
    db.close();
  }
}

/** Replaces all data atomically (used by import and reset). */
export async function replaceAll(snap: Snapshot): Promise<void> {
  const db = await open();
  try {
    const tx = db.transaction(STORES, "readwrite");
    for (const s of STORES) tx.objectStore(s).clear();
    for (const a of snap.accounts) tx.objectStore("accounts").put(a);
    for (const p of snap.pockets) tx.objectStore("pockets").put(p);
    for (const c of snap.categories) tx.objectStore("categories").put(c);
    for (const t of snap.transactions) tx.objectStore("transactions").put(t);
    for (const r of snap.recurring) tx.objectStore("recurring").put(r);
    for (const a of snap.allocations) tx.objectStore("allocations").put(a);
    for (const c of snap.closures) tx.objectStore("closures").put(c);
    if (snap.settings) tx.objectStore("settings").put(snap.settings);
    await txDone(tx);
  } finally {
    db.close();
  }
}
