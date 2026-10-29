import type { MuseumSaveV1 } from "./types";
import { randomSeed } from "./seeds";

export const SAVE_KEY = "impossible-museum:v1";

export function defaultSave(seed?: string): MuseumSaveV1 {
  return {
    version: 1,
    seed: seed || randomSeed(),
    artifacts: [],
    visited: [],
    journal: [],
    achievements: [],
    clues: [],
    flags: {},
    ending: null,
    muted: false,
    volume: 0.55,
    quality: "auto",
    updatedAt: Date.now(),
  };
}

export function loadSave(): MuseumSaveV1 {
  if (typeof window === "undefined") return defaultSave();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<MuseumSaveV1>;
    if (parsed.version !== 1 || typeof parsed.seed !== "string") {
      return defaultSave();
    }
    return {
      ...defaultSave(parsed.seed),
      ...parsed,
      version: 1,
      artifacts: Array.isArray(parsed.artifacts) ? parsed.artifacts : [],
      visited: Array.isArray(parsed.visited) ? parsed.visited : [],
      journal: Array.isArray(parsed.journal) ? parsed.journal : [],
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
      clues: Array.isArray(parsed.clues) ? parsed.clues : [],
      flags: parsed.flags && typeof parsed.flags === "object" ? parsed.flags : {},
      ending: parsed.ending ?? null,
      muted: Boolean(parsed.muted),
      volume: typeof parsed.volume === "number" ? parsed.volume : 0.55,
      quality: parsed.quality ?? "auto",
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return defaultSave();
  }
}

export function persistSave(save: MuseumSaveV1): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...save, updatedAt: Date.now() }));
  } catch {
    /* quota / private mode */
  }
}

export function resetSave(keepAudio = true): MuseumSaveV1 {
  const prev = loadSave();
  const next = defaultSave(randomSeed());
  if (keepAudio) {
    next.muted = prev.muted;
    next.volume = prev.volume;
    next.quality = prev.quality;
  }
  persistSave(next);
  return next;
}
