"use client";

import { create } from "zustand";
import type {
  AIAnalysis,
  Beat,
  CoachMessage,
  DailyChallenge,
  FreestyleSessionConfig,
  ProgressPoint,
  RecordingMeta,
  UserProfile,
  UserVocabulary,
} from "@/lib/types";
import { BUILT_IN_BEATS } from "@/lib/data/beats";
import { ACHIEVEMENTS } from "@/lib/data/achievements";
import {
  defaultProfile,
  loadAnalyses,
  loadChallenge,
  loadCoach,
  loadCompletedLessons,
  loadProfile,
  loadProgress,
  loadVocab,
  markLessonDone,
  saveAnalysis,
  saveChallenge,
  saveCoach,
  saveProfile,
  saveProgress,
  saveVocab,
} from "@/lib/storage/local";
import { idbDeleteRecording, idbListRecordings, idbPutBlob, idbPutRecording } from "@/lib/storage/db";
import { awardXp, applySkillDeltas, touchStreak } from "@/lib/progression";
import { buildDailyChallenge, buildDailyPlan, skillInsights } from "@/lib/training/daily-plan";
import { SKILL_KEYS } from "@/lib/data/skills";
import type { SkillKey } from "@/lib/types";
import { uid } from "@/lib/utils";

interface AppState {
  hydrated: boolean;
  profile: UserProfile;
  progress: ProgressPoint[];
  vocab: UserVocabulary;
  recordings: RecordingMeta[];
  analyses: Record<string, AIAnalysis>;
  completedLessons: string[];
  challenge: DailyChallenge | null;
  coach: CoachMessage[];
  customBeats: Beat[];
  pendingSession: FreestyleSessionConfig | null;
  hydrate: () => Promise<void>;
  updateProfile: (patch: Partial<UserProfile>) => void;
  completeOnboarding: (data: {
    experience: UserProfile["experience"];
    struggles: string[];
    focusSkills: SkillKey[];
  }) => void;
  setPendingSession: (cfg: FreestyleSessionConfig | null) => void;
  completeLesson: (lessonId: string, xp: number, skills: SkillKey[]) => void;
  saveRecordingSession: (args: {
    meta: RecordingMeta;
    blob: Blob;
    analysis?: AIAnalysis;
    transcriptText?: string;
  }) => Promise<void>;
  deleteRecording: (id: string) => Promise<void>;
  completeChallenge: () => void;
  addCoachMessage: (role: "user" | "assistant", content: string) => void;
  addCustomBeat: (beat: Beat) => void;
  trackAssociations: (subject: string, concepts: string[]) => void;
  getDailyPlan: () => ReturnType<typeof buildDailyPlan>;
  getInsights: () => ReturnType<typeof skillInsights>;
}

function unlockAchievements(profile: UserProfile, recordings: RecordingMeta[]): string[] {
  const unlocked = new Set(profile.unlockedAchievements);
  if (profile.freestylesRecorded >= 1) unlocked.add("first_freestyle");
  if (profile.minutesFreestyled >= 10) unlocked.add("10_min");
  if (profile.minutesFreestyled >= 100) unlocked.add("100_min");
  if (profile.longestFreestyleSec >= 300) unlocked.add("5_min_run");
  if (profile.longestFreestyleSec >= 600) unlocked.add("10_min_run");
  if (profile.streak >= 7) unlocked.add("seven_day");
  void recordings;
  void ACHIEVEMENTS;
  return [...unlocked];
}

export const useAppStore = create<AppState>((set, get) => ({
  hydrated: false,
  profile: defaultProfile(),
  progress: [],
  vocab: { wordCounts: {}, referenceCounts: {}, associationEdges: [] },
  recordings: [],
  analyses: {},
  completedLessons: [],
  challenge: null,
  coach: [],
  customBeats: [],
  pendingSession: null,

  hydrate: async () => {
    const profile = loadProfile();
    const progress = loadProgress();
    const vocab = loadVocab();
    const analyses = loadAnalyses();
    const completedLessons = loadCompletedLessons();
    let challenge = loadChallenge();
    if (!challenge) {
      challenge = buildDailyChallenge(profile);
      saveChallenge(challenge);
    }
    const coach = loadCoach();
    let recordings: RecordingMeta[] = [];
    try {
      recordings = await idbListRecordings<RecordingMeta>();
      recordings.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch {
      recordings = [];
    }
    const customBeats = BUILT_IN_BEATS.filter(() => false);
    set({
      hydrated: true,
      profile,
      progress,
      vocab,
      analyses,
      completedLessons,
      challenge,
      coach,
      recordings,
      customBeats,
    });
  },

  updateProfile: (patch) => {
    const profile = { ...get().profile, ...patch, settings: { ...get().profile.settings, ...patch.settings } };
    if (patch.settings) profile.settings = { ...get().profile.settings, ...patch.settings };
    saveProfile(profile);
    set({ profile });
  },

  completeOnboarding: ({ experience, struggles, focusSkills }) => {
    const difficulty =
      experience === "beginner" ? "beginner" : experience === "some" ? "intermediate" : experience === "good" ? "advanced" : "elite";
    const profile: UserProfile = {
      ...get().profile,
      experience,
      struggles,
      focusSkills,
      onboarded: true,
      settings: { ...get().profile.settings, difficulty },
      skills: Object.fromEntries(
        SKILL_KEYS.map((k) => [
          k,
          experience === "beginner" ? 35 : experience === "some" ? 48 : experience === "good" ? 62 : 74,
        ]),
      ) as UserProfile["skills"],
      overallRating: experience === "beginner" ? 35 : experience === "some" ? 48 : experience === "good" ? 62 : 74,
    };
    saveProfile(profile);
    const challenge = buildDailyChallenge(profile);
    saveChallenge(challenge);
    set({ profile, challenge });
  },

  setPendingSession: (cfg) => set({ pendingSession: cfg }),

  completeLesson: (lessonId, xp, skills) => {
    const completedLessons = markLessonDone(lessonId);
    let profile = touchStreak(get().profile);
    profile = awardXp(profile, xp, skills);
    saveProfile(profile);
    set({ profile, completedLessons });
  },

  saveRecordingSession: async ({ meta, blob, analysis, transcriptText }) => {
    await idbPutBlob(meta.id, blob);
    await idbPutRecording(meta);
    let profile = touchStreak(get().profile);
    profile = {
      ...profile,
      freestylesRecorded: profile.freestylesRecorded + 1,
      minutesFreestyled: profile.minutesFreestyled + meta.durationSec / 60,
      longestFreestyleSec: Math.max(profile.longestFreestyleSec, meta.durationSec),
    };
    profile = awardXp(profile, Math.round(20 + meta.durationSec / 3), ["endurance", "continuity"]);
    if (analysis) {
      saveAnalysis(analysis);
      const deltas = Object.fromEntries(
        SKILL_KEYS.map((k) => [k, analysis.skills[k]]),
      ) as Partial<Record<SkillKey, number>>;
      profile = applySkillDeltas(profile, deltas);
      profile = awardXp(profile, Math.round(analysis.overallScore / 20), SKILL_KEYS);
    }
    const recordings = [meta, ...get().recordings.filter((r) => r.id !== meta.id)];
    profile.unlockedAchievements = unlockAchievements(profile, recordings);

    const vocab = { ...get().vocab, wordCounts: { ...get().vocab.wordCounts } };
    if (transcriptText) {
      for (const w of transcriptText.toLowerCase().split(/\W+/).filter((x) => x.length > 3)) {
        vocab.wordCounts[w] = (vocab.wordCounts[w] ?? 0) + 1;
      }
    }
    for (const p of meta.prompts) {
      vocab.referenceCounts[p] = (vocab.referenceCounts[p] ?? 0) + 1;
    }
    saveVocab(vocab);

    const point: ProgressPoint = {
      date: meta.createdAt.slice(0, 10),
      overall: analysis?.overallScore ?? profile.overallRating * 10,
      skills: analysis
        ? Object.fromEntries(SKILL_KEYS.map((k) => [k, analysis.skills[k]]))
        : profile.skills,
      durationSec: meta.durationSec,
      fillerRate: analysis?.fillerPhrases.reduce((a, f) => a + f.count, 0) ?? 0,
      uniqueVocab: Object.keys(vocab.wordCounts).length,
      promptSuccess: analysis?.skills.promptUsage ?? 0,
    };
    const progress = [...get().progress.filter((p) => p.date !== point.date), point];
    saveProgress(progress);
    saveProfile(profile);

    set({
      profile,
      recordings,
      vocab,
      progress,
      analyses: analysis ? { ...get().analyses, [analysis.id]: analysis } : get().analyses,
    });
  },

  deleteRecording: async (id) => {
    await idbDeleteRecording(id);
    set({ recordings: get().recordings.filter((r) => r.id !== id) });
  },

  completeChallenge: () => {
    const challenge = get().challenge;
    if (!challenge || challenge.completed) return;
    const updated = { ...challenge, completed: true };
    saveChallenge(updated);
    let profile = awardXp(touchStreak(get().profile), challenge.xpReward, get().profile.focusSkills);
    saveProfile(profile);
    set({ challenge: updated, profile });
  },

  addCoachMessage: (role, content) => {
    const msg: CoachMessage = { id: uid("coach"), role, content, createdAt: new Date().toISOString() };
    const coach = [...get().coach, msg].slice(-40);
    saveCoach(coach);
    set({ coach });
  },

  addCustomBeat: (beat) => set({ customBeats: [...get().customBeats, beat] }),

  trackAssociations: (subject, concepts) => {
    const vocab = { ...get().vocab, associationEdges: [...get().vocab.associationEdges] };
    for (const c of concepts) {
      const existing = vocab.associationEdges.find((e) => e.from === subject && e.to === c);
      if (existing) existing.count += 1;
      else vocab.associationEdges.push({ from: subject, to: c, count: 1 });
      vocab.referenceCounts[c] = (vocab.referenceCounts[c] ?? 0) + 1;
    }
    if (concepts.length >= 12) {
      const profile = {
        ...get().profile,
        unlockedAchievements: [...new Set([...get().profile.unlockedAchievements, "association_machine"])],
      };
      saveProfile(profile);
      set({ profile });
    }
    saveVocab(vocab);
    set({ vocab });
  },

  getDailyPlan: () => buildDailyPlan(get().profile),
  getInsights: () => skillInsights(get().profile),
}));
