import type { ArtifactDefinition, ArtifactId } from "./types";

export const ARTIFACTS: ArtifactDefinition[] = [
  {
    id: "ember_core",
    name: "Ember Core",
    description: "A cooling fragment of a star that never quite finished dying.",
    hint: "Collapse a forged star past the point of recovery.",
    exhibitId: "star_forge",
  },
  {
    id: "seed_of_never",
    name: "Seed of Never",
    description: "A seed that germinates only when remembered twice.",
    hint: "Grow three alien species to full bloom.",
    exhibitId: "garden",
  },
  {
    id: "tide_glass",
    name: "Tide Glass",
    description: "Water that forgets which way is down.",
    hint: "Wake the luminous leviathan in the ocean above.",
    exhibitId: "ocean",
  },
  {
    id: "century_key",
    name: "Century Key",
    description: "A key whose teeth rearrange by decade.",
    hint: "Visit every century marker in the city’s timeline.",
    exhibitId: "city",
  },
  {
    id: "false_reflection",
    name: "False Reflection",
    description: "A shard that shows what is not there.",
    hint: "Find the mirror that blinks out of sequence.",
    exhibitId: "mirrors",
  },
  {
    id: "stolen_hour",
    name: "Stolen Hour",
    description: "Sixty minutes the clock refused to admit existed.",
    hint: "Restore the missing hour on the great clock.",
    exhibitId: "clock",
  },
  {
    id: "resonant_prism",
    name: "Resonant Prism",
    description: "Light that remembers a chord.",
    hint: "Play the Archivist’s triad on the Orchestra.",
    exhibitId: "orchestra",
  },
  {
    id: "pocket_seed",
    name: "Pocket Seed",
    description: "A universe compressed to a shareable number.",
    hint: "Visit three planets in a pocket cosmos.",
    exhibitId: "pocket",
  },
  {
    id: "storm_needle",
    name: "Storm Needle",
    description: "A compass that points only at weather that hasn’t happened.",
    hint: "Trigger an eclipse over the miniature landscape.",
    exhibitId: "weather",
  },
  {
    id: "unwritten_folio",
    name: "Unwritten Folio",
    description: "Pages about a museum that denies its own founding.",
    hint: "Open the three origin books in the Library.",
    exhibitId: "library",
  },
  {
    id: "anchor_shard",
    name: "Anchor Shard",
    description: "Gravity pretending to be solid.",
    hint: "Align the three floating anchors.",
    exhibitId: "zerog",
  },
  {
    id: "curator_sigil",
    name: "Curator’s Sigil",
    description: "Proof that the observer was always part of the exhibit.",
    hint: "Enter the Forbidden Room.",
    exhibitId: "forbidden",
  },
];

export function getArtifact(id: ArtifactId): ArtifactDefinition | undefined {
  return ARTIFACTS.find((a) => a.id === id);
}
