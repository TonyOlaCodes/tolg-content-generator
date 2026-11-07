// Notes live in localStorage: no account, no network. A locked note keeps only its ciphertext.
import type { Cipher } from "./crypto";

export type Note = {
  id: string;
  title: string;
  /** Plain text only while the note is unlocked. Locked notes keep an empty body and a cipher. */
  body: string;
  locked: boolean;
  cipher: Cipher | null;
  createdAt: string;
  updatedAt: string;
};

const KEY = "detailflows-notes-v1";

export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
}

function isNote(value: unknown): value is Note {
  if (typeof value !== "object" || value === null) return false;
  const note = value as Partial<Note>;
  return (
    typeof note.id === "string" &&
    typeof note.title === "string" &&
    typeof note.body === "string" &&
    typeof note.locked === "boolean" &&
    (note.cipher === null || typeof note.cipher === "object") &&
    typeof note.createdAt === "string" &&
    typeof note.updatedAt === "string"
  );
}

export function loadNotes(): Note[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isNote) : [];
  } catch {
    return [];
  }
}

export function saveNotes(notes: Note[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(notes));
}
