/* Notes tests: password lock round trip and ordering. Run with: npx tsx tests/notes.test.ts */
import assert from "node:assert/strict";
import { decryptText, encryptText } from "../notes/crypto";
import { sortNotes, type Note } from "../notes/store";
import { exportNotes, validateBackup } from "../notes/backup";

function note(id: string, updatedAt: string): Note {
  return { id, title: id, body: "", locked: false, cipher: null, createdAt: updatedAt, updatedAt };
}

async function main() {
  const secret = "Milk, eggs and 2 kg of rice.";
  const cipher = await encryptText("correct horse", secret);
  assert.notEqual(cipher.data, secret, "locked text is not stored in plain view");
  assert.equal(await decryptText("correct horse", cipher), secret);
  await assert.rejects(() => decryptText("wrong password", cipher), "a wrong password must not decrypt");

  const sorted = sortNotes([note("old", "2026-01-01T10:00:00.000Z"), note("new", "2026-02-01T10:00:00.000Z")]);
  assert.deepEqual(sorted.map((n) => n.id), ["new", "old"], "newest note first");

  // Backup round trip keeps plain notes, and locked notes stay locked with their cipher intact.
  const plain: Note = { ...note("plain", "2026-03-01T10:00:00.000Z"), title: "Shopping", body: "Oat milk" };
  const locked: Note = {
    ...note("locked", "2026-03-02T10:00:00.000Z"),
    title: "Private",
    locked: true,
    cipher,
  };
  const parsed = validateBackup(exportNotes([plain, locked]));
  if (!parsed.ok) throw new Error(`valid backup was rejected: ${parsed.error}`);
  assert.equal(parsed.notes.length, 2);
  assert.equal(parsed.notes.find((n) => n.id === "plain")?.body, "Oat milk", "unlocked text survives a backup");
  const restoredLocked = parsed.notes.find((n) => n.id === "locked");
  assert.equal(restoredLocked?.locked, true);
  assert.equal(restoredLocked?.body, "", "locked notes never carry plain text in a backup");
  assert.equal(await decryptText("correct horse", restoredLocked!.cipher!), secret, "the cipher still opens with its password");

  assert.equal(validateBackup("not json").ok, false, "garbage is rejected");
  assert.equal(validateBackup(JSON.stringify({ format: "other", version: 1, data: [] })).ok, false, "another app's backup is rejected");
  const lockedWithoutCipher = { ...locked, cipher: null };
  assert.equal(validateBackup(exportNotes([lockedWithoutCipher])).ok, false, "a locked note needs its cipher");
  assert.equal(validateBackup(exportNotes([plain, plain])).ok, false, "duplicate note IDs are rejected");

  console.log("notes tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
