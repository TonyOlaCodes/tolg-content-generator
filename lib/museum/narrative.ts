import type { ArtifactId, EndingId, ExhibitId } from "./types";

export const ARRIVAL_LINES = [
  "This place was not built for you.",
  "Yet the doors open anyway.",
  "The exhibits remember every visitor who pretends not to notice them.",
];

export const CURATOR_LINES: Record<string, string> = {
  welcome: "I am the Archivist. I curate what cannot exist — and what insists on existing anyway.",
  first_door: "Curiosity is a solvent. Do not spill it carelessly.",
  six_artifacts: "Six truths. The sculpture is listening harder now.",
  library_triad: "Three unwritten books agree on one inconvenient fact: you were expected.",
  clock_solved: "Time is not missing. It was relocated — into you.",
  forbidden_near: "The twelfth door no longer pretends to be locked.",
  mirror_whisper: "Some reflections refuse the courtesy of accuracy.",
  finale_prep: "Enter when ready. The museum has already decided what you are.",
};

export function endingFor(flags: {
  artifacts: ArtifactId[];
  clues: string[];
  visited: ExhibitId[];
  choices?: { mercy?: boolean; stay?: boolean };
}): EndingId {
  const art = flags.artifacts.length;
  const clueCount = flags.clues.filter((c) => c.startsWith("origin:")).length;
  if (flags.choices?.stay || (art >= 11 && clueCount >= 3)) return "collaborator";
  if (flags.choices?.mercy || art >= 8) return "escape";
  return "observer";
}

export const ENDING_COPY: Record<
  EndingId,
  { title: string; body: string; epilogue: string }
> = {
  observer: {
    title: "ENDING · THE OBSERVER",
    body: "You leave with evidence and no allegiance. The museum catalogues your refusal as Exhibit Zero: a visitor who looked without becoming.",
    epilogue: "Outside, the void is quieter. Or you are.",
  },
  collaborator: {
    title: "ENDING · THE COLLABORATOR",
    body: "You remain. The Archivist sets a chair that wasn’t there a moment ago. Together you curate phenomena that have not happened yet.",
    epilogue: "The sculpture blooms your silhouette into its geometry.",
  },
  escape: {
    title: "ENDING · THE ESCAPE",
    body: "You pry the Forbidden Room open from the inside and drag a seam of reality with you. The museum shrinks to a postcard of light — still watching.",
    epilogue: "Somewhere, a door remembers your name as a frequency.",
  },
};

export const LIBRARY_BOOKS: Array<{
  id: string;
  title: string;
  fragment: string;
  originClue?: string;
}> = [
  {
    id: "b1",
    title: "The Year the Moon Forgot Its Face",
    fragment: "Tides argued for weeks. Sailors painted new charts of absence.",
  },
  {
    id: "b2",
    title: "Treatise on Soft Architecture",
    fragment: "Buildings inhaled at dusk. Windows blinked like tired animals.",
  },
  {
    id: "b3",
    title: "Catalogue of Unopened Doors",
    fragment: "Door #12 is not a door. It is a question wearing hinges.",
    originClue: "origin:door",
  },
  {
    id: "b4",
    title: "The Quiet War of Colours",
    fragment: "Blue surrendered first. Amber held the ridge until morning never came.",
  },
  {
    id: "b5",
    title: "Minutes Stolen from Clocks",
    fragment: "An hour went missing from every city at once. Nobody was late. Everyone was.",
  },
  {
    id: "b6",
    title: "On Visitors Who Were Always Exhibits",
    fragment: "The museum did not open to the public. The public opened around the museum.",
    originClue: "origin:visitor",
  },
  {
    id: "b7",
    title: "Gardens That Grow Backward",
    fragment: "Seeds remember futures. Roots invent pasts to justify them.",
  },
  {
    id: "b8",
    title: "A Lexicon of Impossible Weather",
    fragment: "Eclipse rain falls upward. Thunder apologises in Morse.",
  },
  {
    id: "b9",
    title: "Correspondence of the Archivist",
    fragment: "‘If you are reading this, the collection has already begun collecting you.’",
    originClue: "origin:archivist",
  },
  {
    id: "b10",
    title: "Pocket Universes for Domestic Use",
    fragment: "Keep your cosmos away from pets. They invent religions.",
  },
  {
    id: "b11",
    title: "Reflections That Arrive Early",
    fragment: "A mirror showed Tuesday on Monday. The face inside waved goodbye first.",
  },
  {
    id: "b12",
    title: "How to Leave a Place That Is Also Leaving You",
    fragment: "Walk toward the sculpture when it looks most like a question mark.",
  },
];

export const EASTER_EGGS = [
  "konami_void",
  "triple_click_sculpture",
  "type_void",
  "hold_mute_5s",
  "visit_all_before_artifact",
  "orchestra_silence",
  "city_year_zero",
  "garden_night",
  "ocean_still",
  "photo_forbidden_threshold",
] as const;
