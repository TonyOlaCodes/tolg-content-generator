import type { Difficulty, SkillKey, UserProfile } from "@/lib/types";
import { SKILL_KEYS } from "@/lib/data/skills";
import { todayKey } from "@/lib/utils";

export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.35));
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xp >= xpForLevel(level + 1) && level < 99) level++;
  return level;
}

export function xpProgress(xp: number): { level: number; into: number; need: number; ratio: number } {
  const level = levelFromXp(xp);
  const floor = xpForLevel(level);
  const need = xpForLevel(level + 1) - floor;
  const into = Math.max(0, xp - floor);
  return { level, into, need, ratio: need ? into / need : 1 };
}

export function awardXp(
  profile: UserProfile,
  amount: number,
  skills: SkillKey[] = [],
): UserProfile {
  const skillXp = { ...profile.skillXp };
  const skillShare = skills.length ? Math.floor(amount / skills.length) : 0;
  for (const s of skills) skillXp[s] = (skillXp[s] ?? 0) + skillShare;
  const xp = profile.xp + amount;
  return {
    ...profile,
    xp,
    level: levelFromXp(xp),
    skillXp,
  };
}

export function touchStreak(profile: UserProfile, date = todayKey()): UserProfile {
  if (profile.lastPracticeDate === date) return profile;
  const yesterday = new Date(`${date}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  const yKey = yesterday.toISOString().slice(0, 10);
  const streak = profile.lastPracticeDate === yKey ? profile.streak + 1 : 1;
  return { ...profile, streak, lastPracticeDate: date };
}

export function applySkillDeltas(
  profile: UserProfile,
  deltas: Partial<Record<SkillKey, number>>,
): UserProfile {
  const skills = { ...profile.skills };
  for (const key of SKILL_KEYS) {
    if (deltas[key] != null) {
      skills[key] = Math.round(
        Math.min(100, Math.max(0, skills[key] * 0.85 + (deltas[key] as number) * 0.15)),
      );
    }
  }
  const overall = Math.round(
    SKILL_KEYS.reduce((a, k) => a + skills[k], 0) / SKILL_KEYS.length,
  );
  return { ...profile, skills, overallRating: overall };
}

export function difficultyLabel(d: Difficulty): string {
  return d.charAt(0).toUpperCase() + d.slice(1);
}

export function promptIntervalForDifficulty(d: Difficulty, base: number): number {
  switch (d) {
    case "beginner":
      return Math.max(base, 15);
    case "intermediate":
      return base;
    case "advanced":
      return Math.max(5, Math.floor(base * 0.7));
    case "elite":
      return Math.max(3, Math.floor(base * 0.5));
    case "endless":
      return Math.max(3, Math.floor(base * 0.4));
  }
}
