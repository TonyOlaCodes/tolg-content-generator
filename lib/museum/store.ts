"use client";

import { create } from "zustand";
import { ARTIFACTS } from "./artifacts";
import { museumAudio } from "./audio";
import { CURATOR_LINES } from "./narrative";
import { defaultSave, loadSave, persistSave, resetSave } from "./persistence";
import { parseSeedFromLocation, writeSeedToUrl } from "./seeds";
import type {
  AchievementId,
  ArtifactId,
  EndingId,
  ExhibitId,
  GraphicsQuality,
  JournalEntry,
  MuseumPhase,
  MuseumState,
} from "./types";

function hydrate(): MuseumState {
  const urlSeed = typeof window !== "undefined" ? parseSeedFromLocation() : null;
  const saved = loadSave();
  if (urlSeed && urlSeed !== saved.seed) {
    const merged = { ...saved, seed: urlSeed };
    persistSave(merged);
    return {
      ...merged,
      phase: "arrival",
      currentExhibit: null,
      curatorMessage: null,
      photoMode: false,
      directoryOpen: false,
      inventoryOpen: false,
      journalOpen: false,
      audioReady: false,
    };
  }
  return {
    ...saved,
    phase: "arrival",
    currentExhibit: null,
    curatorMessage: null,
    photoMode: false,
    directoryOpen: false,
    inventoryOpen: false,
    journalOpen: false,
    audioReady: false,
  };
}

type Actions = {
  init: () => void;
  setPhase: (p: MuseumPhase) => void;
  enterExhibit: (id: ExhibitId) => void;
  returnAtrium: () => void;
  collectArtifact: (id: ArtifactId, journal?: Omit<JournalEntry, "at">) => void;
  addClue: (clue: string, journal?: Omit<JournalEntry, "at">) => void;
  unlockAchievement: (id: AchievementId) => void;
  setFlag: (key: string, value: boolean | number | string) => void;
  setCuratorMessage: (msg: string | null) => void;
  setMuted: (m: boolean) => void;
  setVolume: (v: number) => void;
  setQuality: (q: GraphicsQuality) => void;
  togglePhotoMode: () => void;
  toggleDirectory: () => void;
  toggleInventory: () => void;
  toggleJournal: () => void;
  canEnterForbidden: () => boolean;
  completeEnding: (ending: EndingId) => void;
  softReset: () => void;
  ensureAudio: () => void;
};

function saveSlice(s: MuseumState) {
  persistSave({
    version: 1,
    seed: s.seed,
    artifacts: s.artifacts,
    visited: s.visited,
    journal: s.journal,
    achievements: s.achievements,
    clues: s.clues,
    flags: s.flags,
    ending: s.ending,
    muted: s.muted,
    volume: s.volume,
    quality: s.quality,
    updatedAt: Date.now(),
  });
  writeSeedToUrl(s.seed);
}

export const useMuseum = create<MuseumState & Actions>((set, get) => ({
  ...defaultSave(),
  phase: "arrival",
  currentExhibit: null,
  curatorMessage: null,
  photoMode: false,
  directoryOpen: false,
  inventoryOpen: false,
  journalOpen: false,
  audioReady: false,

  init: () => {
    const h = hydrate();
    set(h);
    museumAudio.setMuted(h.muted);
    museumAudio.setVolume(h.volume);
    writeSeedToUrl(h.seed);
  },

  setPhase: (phase) => set({ phase }),

  enterExhibit: (id) => {
    const s = get();
    if (id === "forbidden" && !get().canEnterForbidden()) {
      set({ curatorMessage: "The twelfth door tastes unfinished truths and refuses." });
      return;
    }
    const visited = s.visited.includes(id) ? s.visited : [...s.visited, id];
    const achievements = s.achievements.includes("first_door")
      ? s.achievements
      : ([...s.achievements, "first_door"] as AchievementId[]);
    const next = {
      ...s,
      phase: "exhibit" as const,
      currentExhibit: id,
      visited,
      achievements,
      directoryOpen: false,
      curatorMessage:
        achievements.includes("first_door") && !s.achievements.includes("first_door")
          ? CURATOR_LINES.first_door
          : s.curatorMessage,
    };
    set(next);
    saveSlice(next);
    museumAudio.whoosh();
  },

  returnAtrium: () => {
    set({ phase: "atrium", currentExhibit: null, photoMode: false });
    museumAudio.startAmbient("void");
  },

  collectArtifact: (id, journal) => {
    const s = get();
    if (s.artifacts.includes(id)) return;
    const artifacts = [...s.artifacts, id];
    const entries = journal
      ? [...s.journal, { ...journal, at: Date.now() }]
      : [
          ...s.journal,
          {
            id: `art-${id}`,
            title: ARTIFACTS.find((a) => a.id === id)?.name ?? id,
            body: ARTIFACTS.find((a) => a.id === id)?.description ?? "A new artifact.",
            at: Date.now(),
          },
        ];
    const achievements = [...s.achievements];
    if (artifacts.length >= 6 && !achievements.includes("six_artifacts")) {
      achievements.push("six_artifacts");
    }
    if (artifacts.length >= 12 && !achievements.includes("all_artifacts")) {
      achievements.push("all_artifacts");
    }
    let curatorMessage = s.curatorMessage;
    if (artifacts.length === 6) curatorMessage = CURATOR_LINES.six_artifacts;
    if (get().canEnterForbidden() || (artifacts.length >= 8 && s.clues.filter((c) => c.startsWith("origin:")).length >= 2)) {
      curatorMessage = CURATOR_LINES.forbidden_near;
    }
    const next = { ...s, artifacts, journal: entries, achievements, curatorMessage };
    set(next);
    saveSlice(next);
    museumAudio.chime();
  },

  addClue: (clue, journal) => {
    const s = get();
    if (s.clues.includes(clue)) return;
    const clues = [...s.clues, clue];
    const journalEntries = journal
      ? [...s.journal, { ...journal, at: Date.now() }]
      : s.journal;
    const achievements = [...s.achievements];
    const originCount = clues.filter((c) => c.startsWith("origin:")).length;
    if (originCount >= 3 && !achievements.includes("library_triad")) {
      achievements.push("library_triad");
    }
    const next = {
      ...s,
      clues,
      journal: journalEntries,
      achievements,
      curatorMessage: originCount >= 3 ? CURATOR_LINES.library_triad : s.curatorMessage,
    };
    set(next);
    saveSlice(next);
  },

  unlockAchievement: (id) => {
    const s = get();
    if (s.achievements.includes(id)) return;
    const next = { ...s, achievements: [...s.achievements, id] };
    set(next);
    saveSlice(next);
  },

  setFlag: (key, value) => {
    const s = get();
    const next = { ...s, flags: { ...s.flags, [key]: value } };
    set(next);
    saveSlice(next);
  },

  setCuratorMessage: (curatorMessage) => set({ curatorMessage }),

  setMuted: (muted) => {
    museumAudio.setMuted(muted);
    const next = { ...get(), muted };
    set(next);
    saveSlice(next);
  },

  setVolume: (volume) => {
    museumAudio.setVolume(volume);
    const next = { ...get(), volume };
    set(next);
    saveSlice(next);
  },

  setQuality: (quality) => {
    const next = { ...get(), quality };
    set(next);
    saveSlice(next);
  },

  togglePhotoMode: () => {
    const photoMode = !get().photoMode;
    set({ photoMode, directoryOpen: false, inventoryOpen: false, journalOpen: false });
    if (photoMode) get().unlockAchievement("photo_taken");
  },

  toggleDirectory: () => set({ directoryOpen: !get().directoryOpen, inventoryOpen: false, journalOpen: false }),
  toggleInventory: () => set({ inventoryOpen: !get().inventoryOpen, directoryOpen: false, journalOpen: false }),
  toggleJournal: () => set({ journalOpen: !get().journalOpen, directoryOpen: false, inventoryOpen: false }),

  canEnterForbidden: () => {
    const s = get();
    const origins = s.clues.filter((c) => c.startsWith("origin:")).length;
    const need = [
      "ember_core",
      "stolen_hour",
      "false_reflection",
      "unwritten_folio",
      "resonant_prism",
    ] as ArtifactId[];
    const hasKeys = need.filter((a) => s.artifacts.includes(a)).length >= 4;
    return s.artifacts.length >= 8 && origins >= 2 && hasKeys;
  },

  completeEnding: (ending) => {
    const s = get();
    const ach: AchievementId =
      ending === "observer"
        ? "ending_observer"
        : ending === "collaborator"
          ? "ending_collaborator"
          : "ending_escape";
    const achievements = s.achievements.includes(ach)
      ? s.achievements
      : [...s.achievements, ach, "forbidden_open" as AchievementId];
    const arts = s.artifacts.includes("curator_sigil")
      ? s.artifacts
      : ([...s.artifacts, "curator_sigil"] as ArtifactId[]);
    const next = {
      ...s,
      ending,
      phase: "finale" as const,
      achievements,
      artifacts: arts,
      curatorMessage: CURATOR_LINES.finale_prep,
    };
    set(next);
    saveSlice(next);
    museumAudio.startAmbient("finale");
    museumAudio.chime();
  },

  softReset: () => {
    const fresh = resetSave(true);
    set({
      ...fresh,
      phase: "arrival",
      currentExhibit: null,
      curatorMessage: CURATOR_LINES.welcome,
      photoMode: false,
      directoryOpen: false,
      inventoryOpen: false,
      journalOpen: false,
      audioReady: get().audioReady,
    });
    writeSeedToUrl(fresh.seed);
  },

  ensureAudio: () => {
    museumAudio.ensure();
    museumAudio.setMuted(get().muted);
    museumAudio.setVolume(get().volume);
    museumAudio.startAmbient("void");
    set({ audioReady: true });
  },
}));
