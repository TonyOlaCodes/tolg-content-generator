// JSON backup export and validated import for Notes. Locked notes keep only their ciphertext.
import type { Cipher } from "./crypto";
import type { Note } from "./store";

export const BACKUP_FORMAT = "detailflows-notes";
export const BACKUP_VERSION = 1;

type BackupFile = { format: string; version: number; exportedAt: string; data: Note[] };

export function exportNotes(notes: Note[], now: Date = new Date()): string {
  const file: BackupFile = { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), data: notes };
  return JSON.stringify(file, null, 2);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isCipher = (v: unknown): v is Cipher =>
  isObj(v) && v.v === 1 && isStr(v.salt) && isStr(v.iv) && isStr(v.data);

/**
 * Parses and checks a backup file. Locked notes must carry a complete cipher and
 * unlocked notes must not, so a restore can never leave a note half-locked.
 */
export function validateBackup(text: string): { ok: true; notes: Note[] } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file is not valid JSON." };
  }
  if (!isObj(raw) || raw.format !== BACKUP_FORMAT) return { ok: false, error: "This is not a Notes backup." };
  if (raw.version !== BACKUP_VERSION) return { ok: false, error: "This backup was made by a different app version." };
  if (!Array.isArray(raw.data)) return { ok: false, error: "The backup has no notes section." };

  const notes: Note[] = [];
  const ids = new Set<string>();
  for (const item of raw.data) {
    if (
      !isObj(item) ||
      !isStr(item.id) ||
      !isStr(item.title) ||
      !isStr(item.body) ||
      typeof item.locked !== "boolean" ||
      !isStr(item.createdAt) ||
      !isStr(item.updatedAt)
    ) {
      return { ok: false, error: "A note in the backup is malformed." };
    }
    if (ids.has(item.id)) return { ok: false, error: "The backup has duplicate note IDs." };
    ids.add(item.id);

    if (item.locked) {
      if (!isCipher(item.cipher)) return { ok: false, error: "A locked note in the backup has no usable encrypted text." };
      notes.push({
        id: item.id,
        title: item.title,
        body: "",
        locked: true,
        cipher: item.cipher,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
    } else {
      if (item.cipher !== null && item.cipher !== undefined) {
        return { ok: false, error: "An unlocked note in the backup carries encrypted text." };
      }
      notes.push({
        id: item.id,
        title: item.title,
        body: item.body,
        locked: false,
        cipher: null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
    }
  }
  return { ok: true, notes };
}
