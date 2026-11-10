// Notes live in localStorage: no account, no network. A locked note keeps only its ciphertext.
import type { Cipher } from "./crypto";

export const NOTE_COLORS = ["slate", "rose", "amber", "sage", "sky", "lilac"] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

export const COLOR_LABELS: Record<NoteColor, string> = {
  slate: "Slate",
  rose: "Rose",
  amber: "Amber",
  sage: "Sage",
  sky: "Sky",
  lilac: "Lilac",
};

export type ParagraphBlock = { id: string; kind: "paragraph"; text: string };
export type ListBlock = { id: string; kind: "bullets" | "numbers"; items: string[] };
export type ChecklistItem = { id: string; text: string; done: boolean };
export type ChecklistBlock = { id: string; kind: "checklist"; items: ChecklistItem[] };
/** The first row is the header row. */
export type TableBlock = { id: string; kind: "table"; rows: string[][] };
export type Block = ParagraphBlock | ListBlock | ChecklistBlock | TableBlock;
export type BlockKind = Block["kind"];

export type Folder = {
  id: string;
  name: string;
  /** Null for a main folder. Subfolders can only sit one level deep. */
  parentId: string | null;
  color: NoteColor;
};

export type Note = {
  id: string;
  title: string;
  folderId: string | null;
  color: NoteColor;
  /** Empty while the note is locked; the cipher holds the block JSON. */
  blocks: Block[];
  locked: boolean;
  cipher: Cipher | null;
  createdAt: string;
  updatedAt: string;
};

export type NotesState = { notes: Note[]; folders: Folder[] };

const KEY = "detailflows-notes-v2";
const LEGACY_KEY = "detailflows-notes-v1";

const isObj = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isStr = (value: unknown): value is string => typeof value === "string";

export function isNoteColor(value: unknown): value is NoteColor {
  return typeof value === "string" && (NOTE_COLORS as readonly string[]).includes(value);
}

export function isCipher(value: unknown): value is Cipher {
  return isObj(value) && value.v === 1 && isStr(value.salt) && isStr(value.iv) && isStr(value.data);
}

function isChecklistItem(value: unknown): value is ChecklistItem {
  return isObj(value) && isStr(value.id) && isStr(value.text) && typeof value.done === "boolean";
}

export function isBlock(value: unknown): value is Block {
  if (!isObj(value) || !isStr(value.id)) return false;
  switch (value.kind) {
    case "paragraph":
      return isStr(value.text);
    case "bullets":
    case "numbers":
      return Array.isArray(value.items) && value.items.every(isStr);
    case "checklist":
      return Array.isArray(value.items) && value.items.every(isChecklistItem);
    case "table": {
      if (!Array.isArray(value.rows) || value.rows.length === 0) return false;
      const width = Array.isArray(value.rows[0]) ? value.rows[0].length : 0;
      if (width === 0) return false;
      return value.rows.every((row) => Array.isArray(row) && row.length === width && row.every(isStr));
    }
    default:
      return false;
  }
}

export function newId(): string {
  return crypto.randomUUID();
}

export function createBlock(kind: BlockKind): Block {
  const id = newId();
  switch (kind) {
    case "paragraph":
      return { id, kind, text: "" };
    case "checklist":
      return { id, kind, items: [{ id: newId(), text: "", done: false }] };
    case "table":
      return { id, kind, rows: [["", ""], ["", ""]] };
    default:
      return { id, kind, items: [""] };
  }
}

export function createNote(folderId: string | null = null, now: Date = new Date()): Note {
  const iso = now.toISOString();
  return {
    id: newId(),
    title: "",
    folderId,
    color: "slate",
    blocks: [],
    locked: false,
    cipher: null,
    createdAt: iso,
    updatedAt: iso,
  };
}

export function createFolder(name: string, parentId: string | null = null, color: NoteColor = "slate"): Folder {
  return { id: newId(), name: name.trim(), parentId, color };
}

export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
}

export function sortFolders(folders: Folder[]): Folder[] {
  return [...folders].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export function childrenOf(folders: Folder[], parentId: string): Folder[] {
  return sortFolders(folders.filter((folder) => folder.parentId === parentId));
}

/** "Travel / Spain", or "" when the note sits at the top level. */
export function folderPath(folders: Folder[], id: string | null): string {
  if (!id) return "";
  const folder = folders.find((item) => item.id === id);
  if (!folder) return "";
  if (!folder.parentId) return folder.name;
  const parent = folders.find((item) => item.id === folder.parentId);
  return parent ? `${parent.name} / ${folder.name}` : folder.name;
}

/** Text of every block, for previews and search. */
export function blocksToText(blocks: Block[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.kind === "paragraph") parts.push(block.text);
    else if (block.kind === "bullets" || block.kind === "numbers") parts.push(...block.items);
    else if (block.kind === "checklist") parts.push(...block.items.map((item) => item.text));
    else for (const row of block.rows) parts.push(...row);
  }
  return parts.filter((part) => part.trim()).join(" ");
}

/** Reads blocks back out of a locked note; older locks held plain text. */
export function parseLockedBlocks(text: string): Block[] {
  try {
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.every(isBlock)) return parsed;
  } catch {
    // Older locks stored plain text, which becomes a single paragraph.
  }
  return text.trim() ? [{ id: newId(), kind: "paragraph", text }] : [];
}

function blocksFromLegacyBody(body: unknown): Block[] {
  if (!isStr(body) || !body.trim()) return [];
  return [{ id: newId(), kind: "paragraph", text: body }];
}

function normalizeFolder(value: unknown): Folder | null {
  if (!isObj(value) || !isStr(value.id) || !isStr(value.name) || !value.name.trim()) return null;
  return {
    id: value.id,
    name: value.name.trim().slice(0, 60),
    parentId: isStr(value.parentId) ? value.parentId : null,
    color: isNoteColor(value.color) ? value.color : "slate",
  };
}

function normalizeNote(value: unknown, folderIds: Set<string>): Note | null {
  if (!isObj(value)) return null;
  if (!isStr(value.id) || !isStr(value.title) || typeof value.locked !== "boolean") return null;
  if (!isStr(value.createdAt) || !isStr(value.updatedAt)) return null;

  const cipher = isCipher(value.cipher) ? value.cipher : null;
  if (value.locked && !cipher) return null;

  const blocks = Array.isArray(value.blocks) ? value.blocks.filter(isBlock) : blocksFromLegacyBody(value.body);
  return {
    id: value.id,
    title: value.title,
    folderId: isStr(value.folderId) && folderIds.has(value.folderId) ? value.folderId : null,
    color: isNoteColor(value.color) ? value.color : "slate",
    blocks: value.locked ? [] : blocks,
    locked: value.locked,
    cipher: value.locked ? cipher : null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function uniqueNotes(notes: Note[]): Note[] {
  const seen = new Set<string>();
  return notes.filter((note) => {
    if (seen.has(note.id)) return false;
    seen.add(note.id);
    return true;
  });
}

function normalizeState(value: unknown): NotesState {
  if (!isObj(value)) return { notes: [], folders: [] };

  const rawFolders = Array.isArray(value.folders)
    ? value.folders.map(normalizeFolder).filter((folder): folder is Folder => folder !== null)
    : [];
  const byId = new Map(rawFolders.map((folder) => [folder.id, folder]));
  const folders = rawFolders.map((folder) => {
    if (!folder.parentId) return folder;
    const parent = byId.get(folder.parentId);
    if (!parent || parent.id === folder.id || parent.parentId !== null) return { ...folder, parentId: null };
    return folder;
  });
  const folderIds = new Set(folders.map((folder) => folder.id));

  const notes = Array.isArray(value.notes)
    ? value.notes.map((note) => normalizeNote(note, folderIds)).filter((note): note is Note => note !== null)
    : [];

  return { notes: sortNotes(uniqueNotes(notes)), folders };
}

export function loadNotes(): NotesState {
  if (typeof localStorage === "undefined") return { notes: [], folders: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalizeState(JSON.parse(raw));

    // Notes written before folders and blocks existed are plain text notes.
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed: unknown = JSON.parse(legacy);
      if (Array.isArray(parsed)) {
        const notes = parsed
          .map((note) => normalizeNote(note, new Set<string>()))
          .filter((note): note is Note => note !== null);
        return { notes: sortNotes(uniqueNotes(notes)), folders: [] };
      }
    }
  } catch {
    // A corrupted store should not stop the app from opening.
  }
  return { notes: [], folders: [] };
}

export function saveNotes(state: NotesState): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(state));
}
