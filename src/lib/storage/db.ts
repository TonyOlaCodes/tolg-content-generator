import type { Beat } from "@/lib/types";

const DB_NAME = "freestyle-lab";
const DB_VERSION = 2;
const REC_STORE = "recordings";
const BLOB_STORE = "blobs";
const BEAT_META_STORE = "beat_meta";
const BEAT_BLOB_STORE = "beat_blobs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(REC_STORE)) {
        db.createObjectStore(REC_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(BEAT_META_STORE)) {
        db.createObjectStore(BEAT_META_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(BEAT_BLOB_STORE)) {
        db.createObjectStore(BEAT_BLOB_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function idbPutRecording<T extends { id: string }>(meta: T): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(REC_STORE, "readwrite");
  tx.objectStore(REC_STORE).put(meta);
  await txDone(tx);
  db.close();
}

export async function idbGetRecording<T>(id: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(REC_STORE, "readonly");
    const req = tx.objectStore(REC_STORE).get(id);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function idbListRecordings<T>(): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(REC_STORE, "readonly");
    const req = tx.objectStore(REC_STORE).getAll();
    req.onsuccess = () => resolve((req.result as T[]) ?? []);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function idbDeleteRecording(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([REC_STORE, BLOB_STORE], "readwrite");
  tx.objectStore(REC_STORE).delete(id);
  tx.objectStore(BLOB_STORE).delete(id);
  await txDone(tx);
  db.close();
}

export async function idbPutBlob(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(BLOB_STORE, "readwrite");
  tx.objectStore(BLOB_STORE).put({ id, blob });
  await txDone(tx);
  db.close();
}

export async function idbGetBlob(id: string): Promise<Blob | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, "readonly");
    const req = tx.objectStore(BLOB_STORE).get(id);
    req.onsuccess = () => resolve((req.result as { blob: Blob } | undefined)?.blob);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

type StoredBeatMeta = Omit<Beat, "src"> & { createdAt: string };

export async function idbPutBeat(beat: Beat, blob: Blob): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([BEAT_META_STORE, BEAT_BLOB_STORE], "readwrite");
  const { src: _src, ...meta } = beat;
  tx.objectStore(BEAT_META_STORE).put({ ...meta, createdAt: new Date().toISOString() } satisfies StoredBeatMeta);
  tx.objectStore(BEAT_BLOB_STORE).put({ id: beat.id, blob });
  await txDone(tx);
  db.close();
}

export async function idbListBeats(): Promise<Beat[]> {
  const db = await openDb();
  const metas = await new Promise<StoredBeatMeta[]>((resolve, reject) => {
    const tx = db.transaction([BEAT_META_STORE, BEAT_BLOB_STORE], "readonly");
    const req = tx.objectStore(BEAT_META_STORE).getAll();
    req.onsuccess = () => resolve((req.result as StoredBeatMeta[]) ?? []);
    req.onerror = () => reject(req.error);
  });

  const beats: Beat[] = [];
  for (const meta of metas.sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const blob = await new Promise<Blob | undefined>((resolve, reject) => {
      const tx = db.transaction(BEAT_BLOB_STORE, "readonly");
      const req = tx.objectStore(BEAT_BLOB_STORE).get(meta.id);
      req.onsuccess = () => resolve((req.result as { blob: Blob } | undefined)?.blob);
      req.onerror = () => reject(req.error);
    });
    if (!blob) continue;
    beats.push({
      id: meta.id,
      title: meta.title,
      category: meta.category,
      bpm: meta.bpm,
      key: meta.key,
      durationSec: meta.durationSec,
      style: meta.style,
      isCustom: true,
      src: URL.createObjectURL(blob),
    });
  }
  db.close();
  return beats;
}

export async function idbDeleteBeat(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([BEAT_META_STORE, BEAT_BLOB_STORE], "readwrite");
  tx.objectStore(BEAT_META_STORE).delete(id);
  tx.objectStore(BEAT_BLOB_STORE).delete(id);
  await txDone(tx);
  db.close();
}

export async function idbGetBeatBlob(id: string): Promise<Blob | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BEAT_BLOB_STORE, "readonly");
    const req = tx.objectStore(BEAT_BLOB_STORE).get(id);
    req.onsuccess = () => resolve((req.result as { blob: Blob } | undefined)?.blob);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}
