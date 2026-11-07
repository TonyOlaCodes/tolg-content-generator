/* Notes tests: password lock round trip and ordering. Run with: npx tsx tests/notes.test.ts */
import assert from "node:assert/strict";
import { decryptText, encryptText } from "../notes/crypto";
import { sortNotes, type Note } from "../notes/store";

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

  console.log("notes tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
