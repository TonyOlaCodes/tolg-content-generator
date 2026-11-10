/* Notes tests: folders, sections, prices, calculations, locks, backups and migration. Run with: npx tsx tests/notes.test.ts */
import assert from "node:assert/strict";
import { decryptText, encryptText } from "../notes/crypto";
import { completeCalculation, evaluateExpression, formatMoney, parsePrice } from "../notes/calc";
import {
  blocksToText,
  createBlock,
  createFolder,
  createNote,
  duplicateNote,
  folderPath,
  loadNotes,
  notePlainText,
  parseLockedBlocks,
  saveNotes,
  sortFolders,
  sortNotes,
  summarizeBlocks,
  summarizeChecklist,
  tableColumnSums,
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
    pinned: false,
    order: 0,
    currency: "EUR",
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
const pricedChecklist: Block = {
  id: "priced",
  kind: "checklist",
  items: [
    { id: "p1", text: "Battery", done: false, price: 83.05 },
    { id: "p2", text: "NCT", done: false, price: 60 },
    { id: "p3", text: "Seatbelt repair", done: false, price: 50 },
    { id: "p4", text: "Cleaning supplies", done: false, price: 20 },
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
    sortNotes(
      [
        note("pin", { pinned: true, updatedAt: "2026-01-01T10:00:00.000Z" }),
        note("plain", { updatedAt: "2026-02-01T10:00:00.000Z" }),
      ],
      "edited",
    ).map((item) => item.id),
    ["pin", "plain"],
    "pinned notes stay on top",
  );
  assert.deepEqual(
    sortNotes([note("b", { title: "Beta" }), note("a", { title: "Alpha" })], "title").map((item) => item.id),
    ["a", "b"],
    "alphabetical sorting",
  );
  assert.deepEqual(
    sortNotes([note("m1", { order: 2 }), note("m2", { order: 1 })]).map((item) => item.id),
    ["m1", "m2"],
    "edited sorting ignores manual order",
  );
  assert.deepEqual(
    sortNotes([note("m1", { order: 2 }), note("m2", { order: 1 })], "manual").map((item) => item.id),
    ["m2", "m1"],
    "manual order is respected",
  );
  assert.deepEqual(
    sortFolders([folder("b", "Beta"), folder("a", "Alpha")]).map((item) => item.name),
    ["Alpha", "Beta"],
    "folders sort by name",
  );

  const created = createNote("f1", new Date("2026-01-01T00:00:00.000Z"));
  assert.equal(created.folderId, "f1");
  assert.equal(created.color, "slate");
  assert.equal(created.currency, "EUR");
  assert.equal(created.pinned, false);
  assert.deepEqual(created.blocks, []);
  assert.equal(createFolder("  Trips  ", null, "sky").name, "Trips");

  const createdTable = createBlock("table");
  assert.equal(createdTable.kind, "table");
  assert.equal(createdTable.kind === "table" ? createdTable.rows.length : 0, 2, "tables start with a header and a row");
  assert.equal(createBlock("checklist").kind, "checklist");
  assert.equal(createBlock("numbers").kind, "numbers");
  assert.equal(createBlock("heading").kind, "heading");

  assert.equal(
    blocksToText([{ id: "p", kind: "paragraph", text: "Hello" }, bullets, checklist, table]),
    "Hello One Two Bins Bills Item Qty Milk 2",
    "previews and search read every section",
  );
  assert.match(blocksToText([pricedChecklist]), /Battery 83\.05/, "prices are searchable too");

  // Money: euros by default, optional prices and a live summary.
  assert.equal(parsePrice("€83.05"), 83.05);
  assert.equal(parsePrice("83,05"), 83.05);
  assert.equal(parsePrice("1.234,56"), 1234.56);
  assert.equal(parsePrice("1,250.50"), 1250.5);
  assert.equal(parsePrice(""), null);
  assert.equal(parsePrice("not a price"), null);
  assert.equal(formatMoney(83.05), "€83.05");
  assert.equal(formatMoney(130, "GBP"), "£130");
  assert.equal(formatMoney(0), "€0");
  assert.equal(parsePrice("83."), 83);

  const empty = summarizeChecklist([
    { id: "a", text: "Bins", done: true },
    { id: "b", text: "Bills", done: false },
  ]);
  assert.equal(empty.hasPrices, false, "ordinary checklists stay plain");
  assert.equal(empty.done, 1);
  assert.equal(empty.count, 2);

  const summary = summarizeChecklist([
    { id: "p1", text: "Battery", done: false, price: 83.05 },
    { id: "p2", text: "NCT", done: false, price: 60 },
    { id: "p3", text: "Seatbelt repair", done: false, price: 50 },
    { id: "p4", text: "Cleaning supplies", done: false, price: 20 },
  ]);
  assert.equal(summary.hasPrices, true);
  assert.equal(summary.total, 213.05);
  assert.equal(summary.remaining, 213.05);
  assert.equal(summary.completed, 0);

  const partDone = summarizeChecklist([
    { id: "p1", text: "Battery", done: true, price: 83.05 },
    { id: "p2", text: "NCT", done: false, price: 60 },
    { id: "p3", text: "Seatbelt repair", done: false, price: 50 },
    { id: "p4", text: "Cleaning supplies", done: false, price: 20 },
  ]);
  assert.equal(partDone.completed, 83.05);
  assert.equal(partDone.remaining, 130);
  assert.equal(formatMoney(partDone.remaining), "€130");
  assert.equal(summarizeBlocks([pricedChecklist, bullets]).total, 213.05);

  // Inline arithmetic: typing "=" finishes the sum.
  assert.equal(evaluateExpression("250 + 350")?.formatted, "600");
  assert.equal(evaluateExpression("€83.05 + €60 + €50")?.formatted, "€193.05");
  assert.equal(evaluateExpression("4000 - 2750")?.formatted, "1250");
  assert.equal(evaluateExpression("not math"), null);
  const completedSum = completeCalculation("250 + 350 =", "250 + 350 =".length);
  assert.equal(completedSum?.text, "250 + 350 = 600");
  assert.equal(completeCalculation("Total =", "Total =".length), null);

  // Table sums only read data rows and skip text columns.
  assert.deepEqual(
    tableColumnSums([["Item", "Cost"], ["Battery", "83.05"], ["NCT", "60"]]),
    [null, 143.05],
  );
  assert.deepEqual(tableColumnSums([["Only header"]]), [null]);

  assert.deepEqual(
    sortNotes([note("p", { title: "Packing", blocks: [pricedChecklist] })])[0].blocks,
    [pricedChecklist],
  );

  const duplicated = duplicateNote(note("dup", { title: "List", blocks: [pricedChecklist] }));
  assert.notEqual(duplicated.id, "dup");
  assert.equal(duplicated.title, "List copy");
  assert.notEqual(duplicated.blocks[0].id, pricedChecklist.id, "duplicated blocks get fresh IDs");
  const duplicatedItems = duplicated.blocks[0].kind === "checklist" ? duplicated.blocks[0].items : [];
  assert.ok(duplicatedItems.every((item) => item.id !== "p1"), "duplicated checklist items get fresh IDs");

  assert.match(notePlainText(note("plain", { blocks: [pricedChecklist] })), /- \[ \] Battery — €83\.05/);

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

  const tuned = note("tuned", { title: "Tuned", pinned: true, order: 9, currency: "GBP", blocks: [pricedChecklist] });
  const tunedParsed = validateBackup(exportNotes({ notes: [tuned], folders: [] }));
  if (!tunedParsed.ok) throw new Error(`new note fields were rejected: ${tunedParsed.error}`);
  assert.equal(tunedParsed.notes[0].pinned, true);
  assert.equal(tunedParsed.notes[0].order, 9);
  assert.equal(tunedParsed.notes[0].currency, "GBP");
  assert.deepEqual(tunedParsed.notes[0].blocks, [pricedChecklist], "prices survive a backup");

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
    validateBackup(JSON.stringify({ format: "detailflows-notes", version: 2, data: { notes: [{ ...tuned, currency: "XYZ" }], folders: [] } })).ok,
    false,
    "unknown currencies are rejected",
  );
  assert.equal(
    validateBackup(
      JSON.stringify({
        format: "detailflows-notes",
        version: 2,
        data: {
          notes: [note("bad", { blocks: [{ ...pricedChecklist, items: [{ id: "x", text: "Bad", done: false, price: -1 }] } as Block] })],
          folders: [],
        },
      }),
    ).ok,
    false,
    "negative prices are rejected",
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
  assert.equal(migrated.notes[0].currency, "EUR");
  assert.equal(migrated.notes[0].pinned, false);

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
  assert.equal(loaded.notes[0].currency, "EUR");
  const loadedBlock = loaded.notes[0].blocks[0];
  assert.equal(loadedBlock?.kind === "paragraph" ? loadedBlock.text : "", "First line");

  saveNotes({ notes: [rich, tuned], folders });
  const reloaded = loadNotes();
  assert.deepEqual(reloaded.notes.find((item) => item.id === rich.id), rich);
  assert.deepEqual(reloaded.notes.find((item) => item.id === tuned.id), tuned);
  assert.deepEqual(reloaded.folders, folders);

  console.log("notes tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
