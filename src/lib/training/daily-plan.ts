import type { DailyChallenge, DailySessionItem, SkillKey, TrainingSessionPlan, UserProfile } from "@/lib/types";
import { SKILL_KEYS, SKILL_LABELS } from "@/lib/data/skills";
import { todayKey, uid } from "@/lib/utils";

function weakestSkill(profile: UserProfile): SkillKey {
  return SKILL_KEYS.slice().sort((a, b) => profile.skills[a] - profile.skills[b])[0]!;
}

function strongestSkill(profile: UserProfile): SkillKey {
  return SKILL_KEYS.slice().sort((a, b) => profile.skills[b] - profile.skills[a])[0]!;
}

export function buildDailyPlan(profile: UserProfile): TrainingSessionPlan {
  const minutes = profile.settings.dailyTrainingMinutes;
  const weak = weakestSkill(profile);
  const items: DailySessionItem[] = [
    { mode: "rapid_association", title: "Association Speed", detail: "No rapping — pure connections", durationMin: 5 },
    { mode: "rhyme_chain", title: "Rhyme Chains", detail: "Ride one sound family", durationMin: 5 },
    { mode: "reference_lab", title: "Reference Drill", detail: "Usable routes under pressure", durationMin: 5 },
    { mode: "survival_60", title: "60 Second Freestyle", detail: "Continuous", durationMin: 3, rounds: 3 },
    { mode: "free", title: "Free Session", detail: "Open freestyle", durationMin: 5 },
  ];

  if (minutes === 15) {
    return {
      id: uid("plan"),
      title: "15 Minute Session",
      totalMin: 15,
      focusSkill: weak,
      items: items.slice(0, 3),
    };
  }
  if (minutes === 60) {
    return {
      id: uid("plan"),
      title: "60 Minute Session",
      totalMin: 60,
      focusSkill: weak,
      items: [
        ...items,
        { mode: "connection_game", title: "Connection Game", detail: "Bridge unrelated topics", durationMin: 5 },
        { mode: "multisyllabic", title: "Multisyllabic Rhymes", detail: "Stress-pattern matching", durationMin: 5 },
        { mode: "topic_switch", title: "Topic Switch", detail: "Smooth transitions", durationMin: 5 },
        { mode: "endurance", title: "Endurance", detail: "Long-form continuity", durationMin: 10 },
        { mode: "blind", title: "Blind Freestyle", detail: "No prompts", durationMin: 5 },
      ],
    };
  }
  return {
    id: uid("plan"),
    title: "Today's Session",
    totalMin: 30,
    focusSkill: weak,
    items: [
      { mode: "rapid_association", title: "Rapid Association", detail: "Speed connections", durationMin: 5 },
      { mode: "reference_lab", title: "Reference Lab", detail: "Expand knowledge routes", durationMin: 5 },
      { mode: "multisyllabic", title: "Multisyllabic Rhymes", detail: "Multi patterns", durationMin: 5 },
      { mode: "connection_game", title: "Connection Game", detail: "Topic bridges", durationMin: 5 },
      { mode: "random_word", title: "Prompt Freestyle", detail: "Live word prompts", durationMin: 5 },
      { mode: "free", title: "Free Freestyle", detail: "Open session", durationMin: 5 },
    ],
  };
}

export function buildDailyChallenge(profile: UserProfile): DailyChallenge {
  const weak = weakestSkill(profile);
  const map: Record<SkillKey, DailyChallenge["mode"]> = {
    rhyming: "rhyme_chain",
    flow: "blind",
    wordplay: "double_meaning",
    references: "reference_lab",
    creativity: "association_lab",
    vocabulary: "random_word",
    continuity: "topic_switch",
    punchlines: "punchline_builder",
    recovery: "recovery",
    endurance: "endurance",
  };
  return {
    id: `chal_${todayKey()}`,
    date: todayKey(),
    title: `Limiter: ${SKILL_LABELS[weak]}`,
    description: `Focused challenge on ${SKILL_LABELS[weak].toLowerCase()} — your current biggest limiter.`,
    mode: map[weak],
    targetSec: 180,
    xpReward: 80,
    completed: false,
  };
}

export function skillInsights(profile: UserProfile) {
  const weak = weakestSkill(profile);
  const strong = strongestSkill(profile);
  return {
    strongest: strong,
    weakest: weak,
    fastestImproving: profile.focusSkills[0] ?? strong,
    recommendations: [
      { mode: "connection_game" as const, title: "5 min Connection Game", reason: `Supports ${SKILL_LABELS[weak]}` },
      { mode: "association_lab" as const, title: "5 min Association Lab", reason: "Expand usable branches" },
      { mode: "topic_switch" as const, title: "3 × Topic Switch rounds", reason: "Smooth transitions under pressure" },
    ],
  };
}
