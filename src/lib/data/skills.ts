import type { SkillKey } from "@/lib/types";

export const SKILL_LABELS: Record<SkillKey, string> = {
  rhyming: "Rhyming",
  flow: "Flow",
  wordplay: "Wordplay",
  references: "References",
  creativity: "Creativity",
  vocabulary: "Vocabulary",
  continuity: "Continuity",
  punchlines: "Punchlines",
  recovery: "Recovery",
  endurance: "Endurance",
};

export const SKILL_KEYS = Object.keys(SKILL_LABELS) as SkillKey[];

export function emptySkills(value = 40): Record<SkillKey, number> {
  return Object.fromEntries(SKILL_KEYS.map((k) => [k, value])) as Record<SkillKey, number>;
}

export function emptySkillXp(): Record<SkillKey, number> {
  return Object.fromEntries(SKILL_KEYS.map((k) => [k, 0])) as Record<SkillKey, number>;
}
