import type {
  CoachMessage,
  DailyChallenge,
  ProgressPoint,
  UserProfile,
  UserVocabulary,
  AIAnalysis,
} from "@/lib/types";
import { emptySkillXp, emptySkills } from "@/lib/data/skills";
import { uid, todayKey } from "@/lib/utils";

const KEYS = {
  profile: "fl_profile",
  progress: "fl_progress",
  vocab: "fl_vocab",
  analyses: "fl_analyses",
  lessons: "fl_lessons_done",
  challenge: "fl_challenge",
  coach: "fl_coach",
  customBeats: "fl_custom_beats",
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function defaultProfile(): UserProfile {
  return {
    id: uid("user"),
    displayName: "Freestyler",
    experience: "beginner",
    struggles: [],
    focusSkills: ["references", "rhyming", "continuity"],
    onboarded: false,
    level: 1,
    xp: 0,
    streak: 0,
    lastPracticeDate: null,
    freestylesRecorded: 0,
    minutesFreestyled: 0,
    longestFreestyleSec: 0,
    overallRating: 40,
    skills: emptySkills(40),
    skillXp: emptySkillXp(),
    settings: {
      trainingGoal: "Become elite off-the-top",
      preferredGenres: ["boom_bap", "melodic", "trap"],
      preferredBpm: 92,
      promptFrequencySec: 10,
      difficulty: "beginner",
      explicitLanguage: false,
      dailyTrainingMinutes: 30,
      countdownSec: 3,
      aiFeedback: true,
      livePrompts: true,
      distractionFree: false,
    },
    unlockedAchievements: [],
    createdAt: new Date().toISOString(),
  };
}

export function loadProfile(): UserProfile {
  return read(KEYS.profile, defaultProfile());
}

export function saveProfile(profile: UserProfile): void {
  write(KEYS.profile, profile);
}

export function loadProgress(): ProgressPoint[] {
  return read(KEYS.progress, []);
}

export function saveProgress(points: ProgressPoint[]): void {
  write(KEYS.progress, points);
}

export function loadVocab(): UserVocabulary {
  return read(KEYS.vocab, { wordCounts: {}, referenceCounts: {}, associationEdges: [] });
}

export function saveVocab(v: UserVocabulary): void {
  write(KEYS.vocab, v);
}

export function loadAnalyses(): Record<string, AIAnalysis> {
  return read(KEYS.analyses, {});
}

export function saveAnalysis(a: AIAnalysis): void {
  const all = loadAnalyses();
  all[a.id] = a;
  write(KEYS.analyses, all);
}

export function loadCompletedLessons(): string[] {
  return read(KEYS.lessons, []);
}

export function markLessonDone(id: string): string[] {
  const done = new Set(loadCompletedLessons());
  done.add(id);
  const arr = [...done];
  write(KEYS.lessons, arr);
  return arr;
}

export function loadChallenge(): DailyChallenge | null {
  const c = read<DailyChallenge | null>(KEYS.challenge, null);
  if (!c || c.date !== todayKey()) return null;
  return c;
}

export function saveChallenge(c: DailyChallenge): void {
  write(KEYS.challenge, c);
}

export function loadCoach(): CoachMessage[] {
  return read(KEYS.coach, []);
}

export function saveCoach(messages: CoachMessage[]): void {
  write(KEYS.coach, messages);
}
