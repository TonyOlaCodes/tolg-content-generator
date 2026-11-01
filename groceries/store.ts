// Local-first storage for Groceries & Pantry. IndexedDB only; no account or network.
// Every change runs as one read-write transaction: the current data is read, a builder decides
// the writes from it, and everything is saved together or not at all. That stops double taps and
// double purchases, because the second attempt sees the first one already applied.
import { EMPTY_SNAPSHOT, type Snapshot } from "./model";

/** Bump when the schema changes, and add a migration step in `open` for each bump. */
export const DB_VERSION = 1;
const DB_NAME = "detailflows-groceries";
export const BACKUP_APP = "detailflows-groceries";

export const STORES = ["foods", "meals", "logs", "lists", "items", "shops", "prices", "purchases", "settings"] as const;
export type StoreName = (typeof STORES)[number];
const KEY: Record<StoreName, string> = {
  foods: "id",
  meals: "id",
  logs: "id",
  lists: "id",
  items: "id",
  shops: "id",
  prices: "id",
  purchases: "id",
  settings: "id",
};

export type Op = { store: StoreName; put?: unknown; del?: string };
/** Builder: receives the current data and returns writes, or an error message to stop the change. */
export type Builder = (snap: Snapshot) => { ops: Op[] } | { error: string };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Local storage is not available in this browser."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      // Migration 0 -> 1: create the base stores. Future versions add their own steps here.
      if (ev.oldVersion < 1) for (const s of STORES) db.createObjectStore(s, { keyPath: KEY[s] });
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

function getAllFrom(tx: IDBTransaction, name: StoreName): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const req = tx.objectStore(name).getAll();
    req.onsuccess = () => resolve(req.result as unknown[]);
    req.onerror = () => reject(req.error);
  });
}

function fromRows(rows: Record<StoreName, unknown[]>): Snapshot {
  return {
    ...EMPTY_SNAPSHOT,
    foods: rows.foods as Snapshot["foods"],
    meals: rows.meals as Snapshot["meals"],
    logs: rows.logs as Snapshot["logs"],
    lists: rows.lists as Snapshot["lists"],
    items: rows.items as Snapshot["items"],
    shops: rows.shops as Snapshot["shops"],
    prices: rows.prices as Snapshot["prices"],
    purchases: rows.purchases as Snapshot["purchases"],
    settings: (rows.settings[0] as Snapshot["settings"]) ?? null,
  };
}

/** Reads every store in one transaction so the snapshot is consistent. */
export async function loadSnapshot(): Promise<Snapshot> {
  const db = await open();
  try {
    const tx = db.transaction(STORES, "readonly");
    const rows = Object.fromEntries(
      await Promise.all(STORES.map(async (s) => [s, await getAllFrom(tx, s)])),
    ) as Record<StoreName, unknown[]>;
    await txDone(tx);
    return fromRows(rows);
  } finally {
    db.close();
  }
}

/** Runs a builder against fresh data and saves its writes atomically. Returns an error message or null. */
export async function commit(build: Builder): Promise<string | null> {
  const db = await open();
  try {
    const tx = db.transaction(STORES, "readwrite");
    let error: string | null = null;
    const done = txDone(tx);
    const pending = Promise.all(STORES.map((s) => new Promise<[StoreName, unknown[]]>((resolve, reject) => {
      const req = tx.objectStore(s).getAll();
      req.onsuccess = () => resolve([s, req.result as unknown[]]);
      req.onerror = () => reject(req.error);
    })));
    const rows = Object.fromEntries(await pending) as Record<StoreName, unknown[]>;
    const result = build(fromRows(rows));
    if ("error" in result) {
      error = result.error;
      tx.abort();
    } else {
      for (const op of result.ops) {
        const store = tx.objectStore(op.store);
        if (op.del !== undefined) store.delete(op.del);
        else store.put(op.put);
      }
    }
    try {
      await done;
    } catch (e) {
      if (error) return error;
      throw e;
    }
    return error;
  } finally {
    db.close();
  }
}

/** Replaces all stored data. Only called after the user confirms and the backup has been validated. */
export async function replaceAll(snap: Snapshot): Promise<void> {
  const db = await open();
  try {
    const tx = db.transaction(STORES, "readwrite");
    const data: Record<StoreName, unknown[]> = {
      foods: snap.foods,
      meals: snap.meals,
      logs: snap.logs,
      lists: snap.lists,
      items: snap.items,
      shops: snap.shops,
      prices: snap.prices,
      purchases: snap.purchases,
      settings: snap.settings ? [snap.settings] : [],
    };
    for (const s of STORES) {
      const store = tx.objectStore(s);
      store.clear();
      for (const row of data[s]) store.put(row);
    }
    await txDone(tx);
  } finally {
    db.close();
  }
}
