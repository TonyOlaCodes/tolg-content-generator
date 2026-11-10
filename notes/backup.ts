// JSON backup export and validated import for Notes. Locked notes keep only their ciphertext.
import {
  isBlock,
  isCipher,
  isNoteColor,
  newId,
  type Block,
  type Folder,
  type Note,
  type NotesState,
} from "./store";

export const BACKUP_FORMAT = "detailflows-notes";
export const BACKUP_VERSION = 2;

type BackupFile = { format: string; version: number; exportedAt: string; data: NotesState };

type Parsed = { ok: true; notes: Note[]; folders: Folder[] } | { ok: false; error: string };

const isObj = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isStr = (value: unknown): value is string => typeof value === "string";

export function exportNotes(state: NotesState, now: Date = new Date()): string {
  const file: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    data: state,
  };
  return JSON.stringify(file, null, 2);
}

function legacyBlocks(body: unknown): Block[] {
  return isStr(body) && body.trim() ? [{ id: newId(), kind: "paragraph", text: body }] : [];
}

function parseFolders(value: unknown): { ok: true; folders: Folder[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) return { ok: false, error: "The backup has no folders section." };

  const folders: Folder[] = [];
  const ids = new Set<string>();
  for (const item of value) {
    if (!isObj(item) || !isStr(item.id) || !isStr(item.name) || !item.name.trim()) {
      return { ok: false, error: "A folder in the backup is malformed." };
    }
    if (!isNoteColor(item.color)) return { ok: false, error: "A folder in the backup has an unknown colour." };
    if (item.parentId !== null && !isStr(item.parentId)) {
      return { ok: false, error: "A folder in the backup has an invalid parent." };
    }
    if (ids.has(item.id)) return { ok: false, error: "The backup has duplicate folder IDs." };
    ids.add(item.id);
    folders.push({ id: item.id, name: item.name.trim(), parentId: item.parentId, color: item.color });
  }

  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  for (const folder of folders) {
    if (!folder.parentId) continue;
    if (folder.id === folder.parentId) return { ok: false, error: "A folder in the backup contains itself." };
    const parent = byId.get(folder.parentId);
    if (!parent) return { ok: false, error: "A folder in the backup points to a missing folder." };
    if (parent.parentId !== null) return { ok: false, error: "Backup folders can only be one level deep." };
  }

  return { ok: true, folders };
}

function parseNotes(value: unknown, folders: Folder[]): { ok: true; notes: Note[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) return { ok: false, error: "The backup has no notes section." };

  const folderIds = new Set(folders.map((folder) => folder.id));
  const notes: Note[] = [];
  const ids = new Set<string>();
  for (const item of value) {
    if (
      !isObj(item) ||
      !isStr(item.id) ||
      !isStr(item.title) ||
      typeof item.locked !== "boolean" ||
      !isStr(item.createdAt) ||
      !isStr(item.updatedAt)
    ) {
      return { ok: false, error: "A note in the backup is malformed." };
    }
    if (ids.has(item.id)) return { ok: false, error: "The backup has duplicate note IDs." };
    ids.add(item.id);
    if (!isNoteColor(item.color)) return { ok: false, error: "A note in the backup has an unknown colour." };
    if (item.folderId !== null && !isStr(item.folderId)) {
      return { ok: false, error: "A note in the backup has an invalid folder." };
    }
    if (isStr(item.folderId) && !folderIds.has(item.folderId)) {
      return { ok: false, error: "A note in the backup points to a missing folder." };
    }
    if (!Array.isArray(item.blocks) || !item.blocks.every(isBlock)) {
      return { ok: false, error: "A note in the backup has a malformed section." };
    }

    if (item.locked) {
      if (!isCipher(item.cipher)) return { ok: false, error: "A locked note in the backup has no usable encrypted text." };
      if (item.blocks.length > 0) return { ok: false, error: "A locked note in the backup has readable text." };
      notes.push({
        id: item.id,
        title: item.title,
        folderId: item.folderId,
        color: item.color,
        blocks: [],
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
        folderId: item.folderId,
        color: item.color,
        blocks: item.blocks,
        locked: false,
        cipher: null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
    }
  }
  return { ok: true, notes };
}

/** Older backups held flat notes with a plain-text body and no folders. */
function parseLegacyNotes(data: unknown): Parsed {
  if (!Array.isArray(data)) return { ok: false, error: "The backup has no notes section." };

  const notes: Note[] = [];
  const ids = new Set<string>();
  for (const item of data) {
    if (
      !isObj(item) ||
      !isStr(item.id) ||
      !isStr(item.title) ||
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
        folderId: null,
        color: "slate",
        blocks: [],
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
        folderId: null,
        color: "slate",
        blocks: legacyBlocks(item.body),
        locked: false,
        cipher: null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
    }
  }
  return { ok: true, notes, folders: [] };
}

/**
 * Parses and checks a backup file. Folders must exist and be at most one level deep,
 * and locked notes must carry a complete cipher with no readable blocks, so a restore
 * can never leave a note half-locked or pointing at a missing folder.
 */
export function validateBackup(text: string): Parsed {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file is not valid JSON." };
  }
  if (!isObj(raw) || raw.format !== BACKUP_FORMAT) return { ok: false, error: "This is not a Notes backup." };
  if (raw.version === 1) return parseLegacyNotes(raw.data);
  if (raw.version !== BACKUP_VERSION) return { ok: false, error: "This backup was made by a different app version." };
  if (!isObj(raw.data)) return { ok: false, error: "The backup has no notes section." };

  const folders = parseFolders(raw.data.folders);
  if (!folders.ok) return folders;
  const notes = parseNotes(raw.data.notes, folders.folders);
  if (!notes.ok) return notes;

  return { ok: true, notes: notes.notes, folders: folders.folders };
}
