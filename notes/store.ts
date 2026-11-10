// Notes live in localStorage: no account, no network. A locked note keeps only its ciphertext.
import type { Cipher } from "./crypto";
import { isCurrency, parsePrice, roundMoney, formatAmount, formatMoney, type Currency } from "./calc";

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
export type HeadingBlock = { id: string; kind: "heading"; text: string };
export type ListBlock = { id: string; kind: "bullets" | "numbers"; items: string[] };
export type ChecklistItem = { id: string; text: string; done: boolean; price?: number | null };
export type ChecklistBlock = { id: string; kind: "checklist"; items: ChecklistItem[] };
/** The first row is the header row. */
export type TableBlock = { id: string; kind: "table"; rows: string[][] };
export type Block = ParagraphBlock | HeadingBlock | ListBlock | ChecklistBlock | TableBlock;
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
  /** Pinned notes stay at the top of every list. */
  pinned: boolean;
  /** Position used by the manual sort; lower comes first. */
  order: number;
  /** Defaults to euros so ordinary checklists never need a currency choice. */
  currency: Currency;
};

export type NotesState = { notes: Note[]; folders: Folder[] };
export type NoteSort = "edited" | "created" | "title" | "manual";

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

function isChecklistPrice(value: unknown): value is number | null | undefined {
  return value === undefined || value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

function isChecklistItem(value: unknown): value is ChecklistItem {
  return (
    isObj(value) &&
    isStr(value.id) &&
    isStr(value.text) &&
    typeof value.done === "boolean" &&
    isChecklistPrice(value.price)
  );
}

export function isBlock(value: unknown): value is Block {
  if (!isObj(value) || !isStr(value.id)) return false;
  switch (value.kind) {
    case "paragraph":
    case "heading":
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
    case "heading":
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
    pinned: false,
    order: now.getTime(),
    currency: "EUR",
  };
}

export function createFolder(name: string, parentId: string | null = null, color: NoteColor = "slate"): Folder {
  return { id: newId(), name: name.trim(), parentId, color };
}

function editedCompare(a: Note, b: Note): number {
  return a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0;
}

export function sortNotes(notes: Note[], mode: NoteSort = "edited"): Note[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    switch (mode) {
      case "manual":
        return a.order - b.order || editedCompare(a, b);
      case "created":
        return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
      case "title":
        return noteTitle(a).localeCompare(noteTitle(b), undefined, { sensitivity: "base" });
      default:
        return editedCompare(a, b);
    }
  });
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

/** The first non-empty line, used for untitled notes and previews. */
export function firstLineOf(blocks: Block[]): string {
  const line = (text: string): string | null => {
    const found = text.split("\n").map((part) => part.trim()).find(Boolean);
    return found ? found.slice(0, 80) : null;
  };
  for (const block of blocks) {
    switch (block.kind) {
      case "paragraph":
      case "heading": {
        const found = line(block.text);
        if (found) return found;
        break;
      }
      case "bullets":
      case "numbers": {
        const found = block.items.map((item) => item.trim()).find(Boolean);
        if (found) return found.slice(0, 80);
        break;
      }
      case "checklist": {
        const found = block.items.map((item) => item.text.trim()).find(Boolean);
        if (found) return found.slice(0, 80);
        break;
      }
      case "table": {
        const found = block.rows.flat().map((cell) => cell.trim()).find(Boolean);
        if (found) return found.slice(0, 80);
        break;
      }
    }
  }
  return "";
}

export function noteTitle(note: Note): string {
  return note.title.trim() || firstLineOf(note.blocks) || "Untitled note";
}

/** Text of every block, for previews and search. */
export function blocksToText(blocks: Block[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    switch (block.kind) {
      case "paragraph":
      case "heading":
        parts.push(block.text);
        break;
      case "bullets":
      case "numbers":
        parts.push(...block.items);
        break;
      case "checklist":
        parts.push(...block.items.map((item) => (item.price != null ? `${item.text} ${formatAmount(item.price)}` : item.text)));
        break;
      case "table":
        for (const row of block.rows) parts.push(...row);
        break;
    }
  }
  return parts.filter((part) => part.trim()).join(" ");
}

export type ChecklistSummary = {
  count: number;
  done: number;
  total: number;
  completed: number;
  remaining: number;
  hasPrices: boolean;
};

export function summarizeChecklist(items: ChecklistItem[]): ChecklistSummary {
  let total = 0;
  let completed = 0;
  let done = 0;
  let hasPrices = false;
  for (const item of items) {
    if (item.done) done += 1;
    if (typeof item.price === "number" && Number.isFinite(item.price)) {
      hasPrices = true;
      total += item.price;
      if (item.done) completed += item.price;
    }
  }
  const roundedTotal = roundMoney(total);
  const roundedCompleted = roundMoney(completed);
  return {
    count: items.length,
    done,
    total: roundedTotal,
    completed: roundedCompleted,
    remaining: roundMoney(roundedTotal - roundedCompleted),
    hasPrices,
  };
}

/** Progress and money across every checklist in a note, for home-screen cards. */
export function summarizeBlocks(blocks: Block[]): ChecklistSummary {
  return summarizeChecklist(blocks.flatMap((block) => (block.kind === "checklist" ? block.items : [])));
}

/** Sums each table column's data rows (the first row is a header). */
export function tableColumnSums(rows: string[][]): (number | null)[] {
  const width = rows[0]?.length ?? 0;
  const sums: (number | null)[] = [];
  for (let column = 0; column < width; column += 1) {
    let sum = 0;
    let found = false;
    for (const row of rows.slice(1)) {
      const value = parsePrice(row[column] ?? "");
      if (value !== null) {
        sum += value;
        found = true;
      }
    }
    sums.push(found ? roundMoney(sum) : null);
  }
  return sums;
}

export function notePlainText(note: Note): string {
  const lines: string[] = [noteTitle(note), ""];
  for (const block of note.blocks) {
    switch (block.kind) {
      case "heading":
        lines.push(`# ${block.text}`, "");
        break;
      case "paragraph":
        lines.push(block.text, "");
        break;
      case "bullets":
        lines.push(...block.items.map((item) => `• ${item}`), "");
        break;
      case "numbers":
        lines.push(...block.items.map((item, index) => `${index + 1}. ${item}`), "");
        break;
      case "checklist":
        lines.push(
          ...block.items.map(
            (item) =>
              `- [${item.done ? "x" : " "}] ${item.text}${item.price != null ? ` — ${formatMoney(item.price, note.currency)}` : ""}`,
          ),
          "",
        );
        break;
      case "table":
        lines.push(...block.rows.map((row) => row.join(" | ")), "");
        break;
    }
  }
  return lines.join("\n").trim();
}

function cloneBlockList(blocks: Block[]): Block[] {
  return blocks.map((block) => {
    switch (block.kind) {
      case "paragraph":
      case "heading":
        return { ...block, id: newId() };
      case "bullets":
      case "numbers":
        return { ...block, id: newId(), items: [...block.items] };
      case "checklist":
        return { ...block, id: newId(), items: block.items.map((item) => ({ ...item, id: newId() })) };
      case "table":
        return { ...block, id: newId(), rows: block.rows.map((row) => [...row]) };
    }
  });
}

export function duplicateNote(note: Note, now: Date = new Date()): Note {
  return {
    ...note,
    id: newId(),
    title: `${noteTitle(note)} copy`,
    blocks: note.locked ? [] : cloneBlockList(note.blocks),
    pinned: false,
    order: now.getTime(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    cipher: note.cipher,
    locked: note.locked,
  };
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

function normalizeChecklistItem(value: unknown): ChecklistItem | null {
  if (!isChecklistItem(value)) return null;
  const item: ChecklistItem = { id: value.id, text: value.text, done: value.done };
  if (typeof value.price === "number") item.price = roundMoney(value.price);
  return item;
}

function normalizeBlock(value: unknown): Block | null {
  if (!isBlock(value)) return null;
  switch (value.kind) {
    case "paragraph":
    case "heading":
      return { id: value.id, kind: value.kind, text: value.text };
    case "bullets":
    case "numbers":
      return { id: value.id, kind: value.kind, items: [...value.items] };
    case "checklist":
      return {
        id: value.id,
        kind: "checklist",
        items: value.items.map(normalizeChecklistItem).filter((item): item is ChecklistItem => item !== null),
      };
    case "table":
      return { id: value.id, kind: "table", rows: value.rows.map((row) => [...row]) };
  }
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

  const rawBlocks = Array.isArray(value.blocks) ? value.blocks.map(normalizeBlock).filter((block): block is Block => block !== null) : blocksFromLegacyBody(value.body);
  const order =
    typeof value.order === "number" && Number.isFinite(value.order)
      ? value.order
      : Date.parse(value.updatedAt) || 0;

  return {
    id: value.id,
    title: value.title,
    folderId: isStr(value.folderId) && folderIds.has(value.folderId) ? value.folderId : null,
    color: isNoteColor(value.color) ? value.color : "slate",
    blocks: value.locked ? [] : rawBlocks,
    locked: value.locked,
    cipher: value.locked ? cipher : null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    pinned: typeof value.pinned === "boolean" ? value.pinned : false,
    order,
    currency: isCurrency(value.currency) ? value.currency : "EUR",
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
