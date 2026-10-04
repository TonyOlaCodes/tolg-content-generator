import type { Difficulty, PracticeModeId, Prompt } from "@/lib/types";
import { OBJECTS, RANDOM_WORDS, RHYME_FAMILIES, STORY_SEEDS, WORDS } from "@/lib/data/words";
import { REFERENCES } from "@/lib/data/references";
import { uid } from "@/lib/utils";

const HARD_WORDS = [
  "quorum", "isthmus", "chiaroscuro", "fiduciary", "nebula", "algorithm",
  "cathedral", "parallax", "habeas", "zinc", "onyx", "labyrinth",
];

const IMAGES = [
  { id: "img1", label: "Neon crosswalk", url: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80" },
  { id: "img2", label: "Basketball court", url: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80" },
  { id: "img3", label: "Vinyl and turntable", url: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&q=80" },
  { id: "img4", label: "City rain reflection", url: "https://images.unsplash.com/photo-1519501025268-f59f5b94a81d?w=800&q=80" },
  { id: "img5", label: "Boxing ring lights", url: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=800&q=80" },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function nextPrompt(mode: PracticeModeId, difficulty: Difficulty): Prompt {
  const hard = difficulty === "elite" || difficulty === "advanced" || difficulty === "endless";
  switch (mode) {
    case "object":
    case "surroundings":
      return { id: uid("p"), type: "object", value: pick(OBJECTS) };
    case "person":
    case "reference_lab": {
      const ref = pick(REFERENCES);
      return {
        id: uid("p"),
        type: "person",
        value: ref.name,
        meta: { referenceId: ref.id, aliases: ref.aliases },
      };
    }
    case "image": {
      const img = pick(IMAGES);
      return { id: uid("p"), type: "image", value: img.label, meta: { url: img.url } };
    }
    case "rhyme_chain":
    case "multisyllabic": {
      const fam = pick(RHYME_FAMILIES);
      return { id: uid("p"), type: "rhyme", value: fam.seed, meta: { family: fam.family } };
    }
    case "double_meaning": {
      const w = pick(WORDS);
      return { id: uid("p"), type: "word", value: w.word, meta: { wordId: w.id } };
    }
    case "topic_switch":
    case "connection_game":
      return { id: uid("p"), type: "topic", value: pick([...RANDOM_WORDS, ...REFERENCES.map((r) => r.name)]) };
    case "story": {
      const s = pick(STORY_SEEDS);
      return {
        id: uid("p"),
        type: "story",
        value: `${s.character} in ${s.location}`,
        meta: { ...s },
      };
    }
    case "recovery":
      return { id: uid("p"), type: "word", value: pick(HARD_WORDS) };
    case "rapid_association":
    case "association_lab":
    case "reference_chain":
      return { id: uid("p"), type: "word", value: pick(hard ? [...HARD_WORDS, ...RANDOM_WORDS] : RANDOM_WORDS) };
    case "blind":
    case "free":
    case "endurance":
    case "survival_60":
    case "no_filler":
    default:
      return { id: uid("p"), type: "word", value: pick(hard ? HARD_WORDS : RANDOM_WORDS) };
  }
}

export function connectionPair(): { a: string; b: string } {
  const a = pick(REFERENCES).name;
  let b = pick(REFERENCES).name;
  while (b === a) b = pick(REFERENCES).name;
  return { a, b };
}
