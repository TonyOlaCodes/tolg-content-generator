/**
 * Local-first storage for the Daily Tracker (IndexedDB).
 *
 * `DailyStore` is the seam for a future account-based sync: a cloud adapter can
 * implement the same three methods (load, apply, replaceAll) against the same
 * Snapshot shape without changing any UI or domain code. No sync is enabled
 * today, and nothing is ever sent to a server.
 *
 * Every user action is written as one transaction, so a save either fully
 * happens or leaves the previous records untouched.
 */

import { DEFAULT_SETTINGS, EMPTY_SNAPSHOT, STORE_KEY, STORE_NAMES, type Snapshot } from "./model";
import type { Change } from "./actions";

const DB_NAME = "detailflows-daily";
const DB_VERSION = 1;

export type DailyStore = {
  load(): Promise<Snapshot>;
  apply(change: Change): Promise<void>;
  replaceAll(snapshot: Snapshot): Promise<void>;
};

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
      reject(new Error("This browser does not allow local storage. Your entries cannot be saved."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORE_NAMES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: STORE_KEY[name] });
      }
      for (const name of ["weights", "water", "highlights"] as const) {
        const store = request.transaction?.objectStore(name);
        if (store && !store.indexNames.contains("by-date")) store.createIndex("by-date", "date");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local storage."));
    request.onblocked = () => reject(new Error("Close other open copies of Daily Tracker, then reload."));
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not save your entries."));
    tx.onabort = () => reject(tx.error ?? new Error("The save was cancelled. Nothing was changed."));
  });
}

function normalizeSettings(value: unknown): Snapshot["settings"] {
  if (!value || typeof value !== "object") return { ...DEFAULT_SETTINGS, metricOrder: [...DEFAULT_SETTINGS.metricOrder], hiddenMetrics: [] };
  const raw = value as Partial<Snapshot["settings"]>;
  const order = Array.isArray(raw.metricOrder)
    ? raw.metricOrder.filter((k): k is Snapshot["settings"]["metricOrder"][number] =>
        ["steps", "weight", "calories", "sleep", "water"].includes(String(k)),
      )
    : [];
  const hidden = Array.isArray(raw.hiddenMetrics)
    ? raw.hiddenMetrics.filter((k) => ["steps", "weight", "calories", "sleep", "water"].includes(String(k)))
    : [];
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    id: "main",
    metricOrder: order.length ? order : [...DEFAULT_SETTINGS.metricOrder],
    hiddenMetrics: hidden,
  };
}

export async function loadSnapshot(): Promise<Snapshot> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAMES, "readonly");
    const readAll = <T>(name: (typeof STORE_NAMES)[number]) =>
      new Promise<T[]>((resolve, reject) => {
        const request = tx.objectStore(name).getAll();
        request.onsuccess = () => resolve(request.result as T[]);
        request.onerror = () => reject(request.error);
      });
    const [days, weights, water, highlights, settings] = await Promise.all([
      readAll<Snapshot["days"][number]>("days"),
      readAll<Snapshot["weights"][number]>("weights"),
      readAll<Snapshot["water"][number]>("water"),
      readAll<Snapshot["highlights"][number]>("highlights"),
      readAll<Snapshot["settings"]>("settings"),
    ]);
    await done(tx);
    return {
      days,
      weights,
      water,
      highlights,
      settings: normalizeSettings(settings[0]),
    };
  } finally {
    db.close();
  }
}

export async function applyChange(change: Change): Promise<void> {
  if (!change.puts.length && !change.deletes.length) return;
  const db = await openDb();
  try {
    const stores = [...new Set([...change.puts.map((p) => p.store), ...change.deletes.map((d) => d.store)])];
    const tx = db.transaction(stores, "readwrite");
    for (const put of change.puts) tx.objectStore(put.store).put(put.value);
    for (const del of change.deletes) tx.objectStore(del.store).delete(del.key);
    await done(tx);
  } finally {
    db.close();
  }
}

export async function replaceAll(snapshot: Snapshot): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAMES, "readwrite");
    for (const name of STORE_NAMES) tx.objectStore(name).clear();
    for (const day of snapshot.days) tx.objectStore("days").put(day);
    for (const weight of snapshot.weights) tx.objectStore("weights").put(weight);
    for (const entry of snapshot.water) tx.objectStore("water").put(entry);
    for (const highlight of snapshot.highlights) tx.objectStore("highlights").put(highlight);
    tx.objectStore("settings").put(normalizeSettings(snapshot.settings));
    await done(tx);
  } finally {
    db.close();
  }
}

/** The browser store. Swap this for a cloud adapter later; the UI only uses this interface. */
export const localDailyStore: DailyStore = {
  load: loadSnapshot,
  apply: applyChange,
  replaceAll,
};

export function emptyLocalSnapshot(): Snapshot {
  return {
    ...EMPTY_SNAPSHOT,
    days: [],
    weights: [],
    water: [],
    highlights: [],
    settings: { ...DEFAULT_SETTINGS, metricOrder: [...DEFAULT_SETTINGS.metricOrder], hiddenMetrics: [] },
  };
}
