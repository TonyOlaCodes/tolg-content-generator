/* Notes tests: folders, sections, password lock, backups and migration. Run with: npx tsx tests/notes.test.ts */
import assert from "node:assert/strict";
import { decryptText, encryptText } from "../notes/crypto";
import {
  blocksToText,
  createBlock,
  createFolder,
  createNote,
  folderPath,
  loadNotes,
  parseLockedBlocks,
  saveNotes,
  sortFolders,
  sortNotes,
  type Block,
  type Folder,
  type Note,
} from "../notes/store";
import { exportNotes, validateBackup } from "../notes/backup";

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  clear(): void {
    this.data.clear();
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
  get length(): number {
    return this.data.size;
  }
}

(globalThis as unknown as { localStorage: Storage }).localStorage = new MemoryStorage() as unknown as Storage;

const ISO = "2026-03-01T10:00:00.000Z";

function note(id: string, overrides: Partial<Note> = {}): Note {
  return {
    id,
    title: id,
    folderId: null,
    color: "slate",
    blocks: [],
    locked: false,
    cipher: null,
    createdAt: ISO,
    updatedAt: ISO,
    ...overrides,
  };
}

function folder(id: string, name: string, parentId: string | null = null, color: Folder["color"] = "sage"): Folder {
  return { id, name, parentId, color };
}

const table: Block = { id: "table", kind: "table", rows: [["Item", "Qty"], ["Milk", "2"]] };
const checklist: Block = {
  id: "check",
  kind: "checklist",
  items: [
    { id: "c1", text: "Bins", done: false },
    { id: "c2", text: "Bills", done: true },
  ],
};
const bullets: Block = { id: "bul", kind: "bullets", items: ["One", "Two"] };

async function main() {
  const secret = JSON.stringify([table]);
  const cipher = await encryptText("correct horse", secret);
  assert.notEqual(cipher.data, secret, "locked text is not stored in plain view");
  assert.equal(await decryptText("correct horse", cipher), secret);
  await assert.rejects(() => decryptText("wrong password", cipher), "a wrong password must not decrypt");

  const sorted = sortNotes([
    note("old", { updatedAt: "2026-01-01T10:00:00.000Z" }),
    note("new", { updatedAt: "2026-02-01T10:00:00.000Z" }),
  ]);
  assert.deepEqual(sorted.map((item) => item.id), ["new", "old"], "newest note first");
  assert.deepEqual(
    sortFolders([folder("b", "Beta"), folder("a", "Alpha")]).map((item) => item.name),
    ["Alpha", "Beta"],
    "folders sort by name",
  );

  const created = createNote("f1", new Date("2026-01-01T00:00:00.000Z"));
  assert.equal(created.folderId, "f1");
  assert.equal(created.color, "slate");
  assert.deepEqual(created.blocks, []);
  assert.equal(createFolder("  Trips  ", null, "sky").name, "Trips");

  const createdTable = createBlock("table");
  assert.equal(createdTable.kind, "table");
  assert.equal(createdTable.kind === "table" ? createdTable.rows.length : 0, 2, "tables start with a header and a row");
  assert.equal(createBlock("checklist").kind, "checklist");
  assert.equal(createBlock("numbers").kind, "numbers");

  assert.equal(
    blocksToText([{ id: "p", kind: "paragraph", text: "Hello" }, bullets, checklist, table]),
    "Hello One Two Bins Bills Item Qty Milk 2",
    "previews and search read every section",
  );

  const folders = [folder("f1", "Travel"), folder("f2", "Spain", "f1", "rose")];
  assert.equal(folderPath(folders, "f2"), "Travel / Spain");

  const rich = note("rich", { title: "Packing", folderId: "f2", color: "amber", blocks: [table, checklist, bullets] });
  const exported = exportNotes({ notes: [rich], folders }, new Date("2026-05-01T00:00:00.000Z"));
  const parsed = validateBackup(exported);
  if (!parsed.ok) throw new Error(`valid backup was rejected: ${parsed.error}`);
  assert.deepEqual(parsed.folders, folders, "folders and subfolders survive a backup");
  assert.deepEqual(parsed.notes[0].blocks, [table, checklist, bullets], "every section survives a backup");
  assert.equal(parsed.notes[0].color, "amber");
  assert.equal(parsed.notes[0].folderId, "f2");

  const locked = note("locked", { title: "Private", locked: true, blocks: [], cipher, folderId: "f1", color: "lilac" });
  const parsedLocked = validateBackup(exportNotes({ notes: [locked], folders }));
  if (!parsedLocked.ok) throw new Error(`valid locked backup was rejected: ${parsedLocked.error}`);
  const restoredLocked = parsedLocked.notes[0];
  assert.equal(restoredLocked.locked, true);
  assert.equal(restoredLocked.blocks.length, 0, "locked notes never carry readable sections");
  assert.deepEqual(JSON.parse(await decryptText("correct horse", restoredLocked.cipher!)), [table], "the cipher still opens");

  assert.equal(validateBackup("not json").ok, false, "garbage is rejected");
  assert.equal(validateBackup(JSON.stringify({ format: "other", version: 2, data: { notes: [], folders: [] } })).ok, false, "another app's backup is rejected");
  assert.equal(validateBackup(JSON.stringify({ format: "detailflows-notes", version: 3, data: { notes: [], folders: [] } })).ok, false, "unknown versions are rejected");
  assert.equal(
    validateBackup(JSON.stringify({ format: "detailflows-notes", version: 2, data: { notes: [], folders: [folder("a", "A"), folder("a", "A")] } })).ok,
    false,
    "duplicate folder IDs are rejected",
  );
  assert.equal(
    validateBackup(JSON.stringify({ format: "detailflows-notes", version: 2, data: { notes: [], folders: [folder("a", "A"), folder("b", "B", "a"), folder("c", "C", "b")] } })).ok,
    false,
    "folders can only be one level deep",
  );
  assert.equal(
    validateBackup(JSON.stringify({ format: "detailflows-notes", version: 2, data: { notes: [note("n", { folderId: "missing" })], folders: [] } })).ok,
    false,
    "notes must point at a real folder",
  );
  assert.equal(
    validateBackup(JSON.stringify({ format: "detailflows-notes", version: 2, data: { notes: [note("n", { blocks: [{ id: "r", kind: "table", rows: [["a", "b"], ["c"]] }] })], folders: [] } })).ok,
    false,
    "ragged tables are rejected",
  );
  assert.equal(
    validateBackup(JSON.stringify({ format: "detailflows-notes", version: 2, data: { notes: [note("n", { locked: true, cipher: null })], folders: [] } })).ok,
    false,
    "a locked note needs its cipher",
  );
  assert.equal(
    validateBackup(JSON.stringify({ format: "detailflows-notes", version: 2, data: { notes: [note("n", { locked: true, blocks: [bullets], cipher })], folders: [] } })).ok,
    false,
    "a locked note cannot carry readable sections",
  );
  assert.equal(
    validateBackup(JSON.stringify({ format: "detailflows-notes", version: 2, data: { notes: [note("n", { cipher })], folders: [] } })).ok,
    false,
    "an unlocked note cannot carry a cipher",
  );
  assert.equal(
    validateBackup(JSON.stringify({ format: "detailflows-notes", version: 2, data: { notes: [note("same"), note("same")], folders: [] } })).ok,
    false,
    "duplicate note IDs are rejected",
  );

  // Backups made before folders and sections become plain-text notes.
  const legacyFile = JSON.stringify({
    format: "detailflows-notes",
    version: 1,
    exportedAt: ISO,
    data: [{ id: "old", title: "Old", body: "Line one", locked: false, cipher: null, createdAt: ISO, updatedAt: ISO }],
  });
  const migrated = validateBackup(legacyFile);
  if (!migrated.ok) throw new Error(`legacy backup was rejected: ${migrated.error}`);
  assert.equal(migrated.folders.length, 0);
  const migratedBlock = migrated.notes[0].blocks[0];
  assert.equal(migratedBlock?.kind === "paragraph" ? migratedBlock.text : "", "Line one");

  const oldCipher = await encryptText("pw", "plain body");
  const migratedLocked = validateBackup(
    JSON.stringify({
      format: "detailflows-notes",
      version: 1,
      data: [{ id: "l", title: "L", body: "", locked: true, cipher: oldCipher, createdAt: ISO, updatedAt: ISO }],
    }),
  );
  if (!migratedLocked.ok) throw new Error(`legacy locked backup was rejected: ${migratedLocked.error}`);
  const unlockedLegacy = parseLockedBlocks(await decryptText("pw", migratedLocked.notes[0].cipher!));
  assert.equal(unlockedLegacy[0]?.kind === "paragraph" ? unlockedLegacy[0].text : "", "plain body");

  const legacyText = parseLockedBlocks("Just text")[0];
  assert.equal(legacyText?.kind === "paragraph" ? legacyText.text : "", "Just text");
  assert.deepEqual(parseLockedBlocks(JSON.stringify([bullets])), [bullets]);

  // The store migrates v1 notes and round-trips the new shape.
  localStorage.clear();
  localStorage.setItem(
    "detailflows-notes-v1",
    JSON.stringify([{ id: "legacy-note", title: "Legacy", body: "First line", locked: false, cipher: null, createdAt: ISO, updatedAt: ISO }]),
  );
  const loaded = loadNotes();
  assert.equal(loaded.folders.length, 0);
  assert.equal(loaded.notes.length, 1);
  assert.equal(loaded.notes[0].folderId, null);
  const loadedBlock = loaded.notes[0].blocks[0];
  assert.equal(loadedBlock?.kind === "paragraph" ? loadedBlock.text : "", "First line");

  saveNotes({ notes: [rich], folders });
  const reloaded = loadNotes();
  assert.deepEqual(reloaded.notes, [rich]);
  assert.deepEqual(reloaded.folders, folders);

  console.log("notes tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
