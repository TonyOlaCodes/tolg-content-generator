export type ExhibitId =
  | "star_forge"
  | "garden"
  | "ocean"
  | "city"
  | "mirrors"
  | "clock"
  | "orchestra"
  | "pocket"
  | "weather"
  | "library"
  | "zerog"
  | "forbidden";

export type ArtifactId =
  | "ember_core"
  | "seed_of_never"
  | "tide_glass"
  | "century_key"
  | "false_reflection"
  | "stolen_hour"
  | "resonant_prism"
  | "pocket_seed"
  | "storm_needle"
  | "unwritten_folio"
  | "anchor_shard"
  | "curator_sigil";

export type EndingId = "observer" | "collaborator" | "escape";

export type GraphicsQuality = "auto" | "low" | "medium" | "high";

export type MuseumPhase = "arrival" | "atrium" | "exhibit" | "finale";

export type ExhibitDefinition = {
  id: ExhibitId;
  number: number;
  name: string;
  subtitle: string;
  blurb: string;
  accent: string;
  locked?: boolean;
  artifactId: ArtifactId;
};

export type ArtifactDefinition = {
  id: ArtifactId;
  name: string;
  description: string;
  hint: string;
  exhibitId: ExhibitId;
};

export type JournalEntry = {
  id: string;
  title: string;
  body: string;
  at: number;
};

export type AchievementId =
  | "first_door"
  | "six_artifacts"
  | "all_artifacts"
  | "forbidden_open"
  | "ending_observer"
  | "ending_collaborator"
  | "ending_escape"
  | "photo_taken"
  | "konami_void"
  | "mirror_whisper"
  | "library_triad"
  | "clock_solved"
  | "orchestra_chord"
  | "weather_eclipse"
  | "garden_bloom"
  | "star_collapse";

export type MuseumSaveV1 = {
  version: 1;
  seed: string;
  artifacts: ArtifactId[];
  visited: ExhibitId[];
  journal: JournalEntry[];
  achievements: AchievementId[];
  clues: string[];
  flags: Record<string, boolean | number | string>;
  ending: EndingId | null;
  muted: boolean;
  volume: number;
  quality: GraphicsQuality;
  updatedAt: number;
};

export type MuseumState = MuseumSaveV1 & {
  phase: MuseumPhase;
  currentExhibit: ExhibitId | null;
  curatorMessage: string | null;
  photoMode: boolean;
  directoryOpen: boolean;
  inventoryOpen: boolean;
  journalOpen: boolean;
  audioReady: boolean;
};
