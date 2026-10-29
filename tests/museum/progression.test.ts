/**
 * Museum progression, seeds, endings (no DOM / WebGL).
 * Run: npx tsx tests/museum/progression.test.ts
 */

import assert from "node:assert/strict";
import { EXHIBITS } from "../../lib/museum/exhibits";
import { ARTIFACTS } from "../../lib/museum/artifacts";
import { endingFor, LIBRARY_BOOKS } from "../../lib/museum/narrative";
import { createRng, hashSeed } from "../../lib/museum/seeds";
import { defaultSave } from "../../lib/museum/persistence";
import type { ArtifactId, ExhibitId } from "../../lib/museum/types";

function run(): void {
  console.log("Museum unit tests\n");

  {
    assert.equal(EXHIBITS.length, 12);
    assert.equal(ARTIFACTS.length, 12);
    assert.ok(EXHIBITS.every((e) => ARTIFACTS.some((a) => a.id === e.artifactId)));
    console.log("  ✓ twelve exhibits mapped to artifacts");
  }

  {
    const a = createRng("museum-demo");
    const b = createRng("museum-demo");
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    assert.deepEqual(seqA, seqB);
    assert.notEqual(hashSeed("a"), hashSeed("b"));
    console.log("  ✓ seeded RNG is deterministic");
  }

  {
    const origins = LIBRARY_BOOKS.filter((b) => b.originClue);
    assert.equal(origins.length, 3);
    console.log("  ✓ three origin library clues");
  }

  {
    const base = {
      artifacts: [] as ArtifactId[],
      clues: [] as string[],
      visited: [] as ExhibitId[],
    };
    assert.equal(endingFor(base), "observer");
    assert.equal(
      endingFor({
        ...base,
        artifacts: Array(8).fill("ember_core") as ArtifactId[],
        choices: { mercy: true },
      }),
      "escape",
    );
    assert.equal(
      endingFor({
        ...base,
        artifacts: Array(11).fill("ember_core") as ArtifactId[],
        clues: ["origin:a", "origin:b", "origin:c"],
        choices: { stay: true },
      }),
      "collaborator",
    );
    console.log("  ✓ ending variations");
  }

  {
    const save = defaultSave("testseed");
    assert.equal(save.version, 1);
    assert.equal(save.seed, "testseed");
    assert.equal(save.artifacts.length, 0);
    console.log("  ✓ default save shape");
  }

  {
    const forbidden = EXHIBITS.find((e) => e.id === "forbidden");
    assert.equal(forbidden?.locked, true);
    console.log("  ✓ forbidden room marked locked in registry");
  }

  console.log("\nAll museum tests passed.");
}

run();
