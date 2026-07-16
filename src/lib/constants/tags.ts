import type { TagCategory } from "@/generated/prisma/client";

export type SeedTag = {
  name: string;
  slug: string;
  category: TagCategory;
};

export const PHYSIQUE_TAG_GROUPS: Record<string, SeedTag[]> = {
  TIME: [
    { name: "old", slug: "old", category: "TIME" },
    { name: "recent", slug: "recent", category: "TIME" },
  ],
  PHASE: [
    { name: "bulk", slug: "bulk", category: "PHASE" },
    { name: "cut", slug: "cut", category: "PHASE" },
    { name: "maintenance", slug: "maintenance", category: "PHASE" },
  ],
  QUALITY: [
    { name: "good", slug: "good", category: "QUALITY" },
    { name: "average", slug: "average", category: "QUALITY" },
    { name: "bad", slug: "bad", category: "QUALITY" },
  ],
  PHYSIQUE: [
    { name: "skinny", slug: "skinny", category: "PHYSIQUE" },
    { name: "lean", slug: "lean", category: "PHYSIQUE" },
    { name: "muscular", slug: "muscular", category: "PHYSIQUE" },
    { name: "higher body fat", slug: "higher-body-fat", category: "PHYSIQUE" },
    { name: "strong", slug: "strong", category: "PHYSIQUE" },
    { name: "small", slug: "small", category: "PHYSIQUE" },
    { name: "big", slug: "big", category: "PHYSIQUE" },
  ],
  POSE: [
    { name: "front relaxed", slug: "front-relaxed", category: "POSE" },
    {
      name: "front double biceps",
      slug: "front-double-biceps",
      category: "POSE",
    },
    {
      name: "back double biceps",
      slug: "back-double-biceps",
      category: "POSE",
    },
    { name: "side chest", slug: "side-chest", category: "POSE" },
    { name: "side triceps", slug: "side-triceps", category: "POSE" },
    { name: "lat spread", slug: "lat-spread", category: "POSE" },
    { name: "mirror selfie", slug: "mirror-selfie", category: "POSE" },
    { name: "arms", slug: "arms", category: "POSE" },
    { name: "abs", slug: "abs", category: "POSE" },
    { name: "legs", slug: "legs", category: "POSE" },
    { name: "back", slug: "back", category: "POSE" },
    { name: "upper body", slug: "upper-body", category: "POSE" },
    { name: "full body", slug: "full-body", category: "POSE" },
    { name: "other", slug: "pose-other", category: "POSE" },
  ],
  ANGLE: [
    { name: "front", slug: "angle-front", category: "ANGLE" },
    { name: "back", slug: "angle-back", category: "ANGLE" },
    { name: "side", slug: "angle-side", category: "ANGLE" },
    { name: "three-quarter", slug: "three-quarter", category: "ANGLE" },
  ],
  LOCATION: [
    { name: "gym", slug: "gym", category: "LOCATION" },
    { name: "bedroom", slug: "bedroom", category: "LOCATION" },
    { name: "bathroom", slug: "bathroom", category: "LOCATION" },
    { name: "beach", slug: "beach", category: "LOCATION" },
    { name: "outdoor", slug: "outdoor", category: "LOCATION" },
    { name: "stage", slug: "stage", category: "LOCATION" },
    { name: "other", slug: "location-other", category: "LOCATION" },
  ],
  EXPRESSION: [
    { name: "confident", slug: "confident", category: "EXPRESSION" },
    { name: "neutral", slug: "neutral", category: "EXPRESSION" },
    { name: "smiling", slug: "smiling", category: "EXPRESSION" },
    { name: "serious", slug: "serious", category: "EXPRESSION" },
    { name: "confused", slug: "confused-expression", category: "EXPRESSION" },
    { name: "other", slug: "expression-other", category: "EXPRESSION" },
  ],
};

export const THEME_MOOD_TAGS: SeedTag[] = [
  "confused",
  "proud",
  "nostalgic",
  "sad",
  "shocked",
  "calm",
  "cocky",
  "funny",
  "dramatic",
  "relatable",
  "disappointed",
  "impressed",
  "angry",
  "satirical",
  "mysterious",
  "motivational",
].map((name) => ({
  name,
  slug: `theme-${name}`,
  category: "THEME_MOOD" as const,
}));

export const ALL_SYSTEM_TAGS: SeedTag[] = [
  ...Object.values(PHYSIQUE_TAG_GROUPS).flat(),
  ...THEME_MOOD_TAGS,
];
