export type FallbackHookTemplate = {
  category: string;
  hookText: string;
  themeMoodTags: string[];
  requiredPhotoCount: number;
  photoRules: Array<{
    index: number;
    requiredTags: string[];
    preferredTags: string[];
    yearNear?: number;
    preferPoseMatch?: boolean;
  }>;
  photoOrder: string[];
  preferredMatching: {
    pose: boolean;
    angle: boolean;
    bodyPart: boolean;
    yearGap: boolean;
  };
  captionStyle: string;
};

export const FALLBACK_HOOK_TEMPLATES: FallbackHookTemplate[] = [
  {
    category: "progression",
    hookText: "When I thought my physique was good at 17",
    themeMoodTags: ["confused", "nostalgic"],
    requiredPhotoCount: 2,
    photoRules: [
      {
        index: 0,
        requiredTags: ["old"],
        preferredTags: ["average", "good"],
        yearNear: 17,
        preferPoseMatch: true,
      },
      {
        index: 1,
        requiredTags: ["recent", "good"],
        preferredTags: ["muscular"],
        preferPoseMatch: true,
      },
    ],
    photoOrder: ["old", "recent"],
    preferredMatching: {
      pose: true,
      angle: true,
      bodyPart: false,
      yearGap: true,
    },
    captionStyle: "reflective",
  },
  {
    category: "skinny to muscular",
    hookText:
      "When they call it genetics because they never saw the starting point",
    themeMoodTags: ["satirical", "cocky", "shocked"],
    requiredPhotoCount: 2,
    photoRules: [
      {
        index: 0,
        requiredTags: ["recent", "good", "muscular"],
        preferredTags: ["confident"],
        preferPoseMatch: true,
      },
      {
        index: 1,
        requiredTags: ["old"],
        preferredTags: ["skinny", "small"],
        preferPoseMatch: true,
      },
    ],
    photoOrder: ["recent", "old"],
    preferredMatching: {
      pose: true,
      angle: true,
      bodyPart: true,
      yearGap: true,
    },
    captionStyle: "defiant",
  },
  {
    category: "bulk",
    hookText: "Same weight. Different lifter.",
    themeMoodTags: ["motivational", "proud"],
    requiredPhotoCount: 2,
    photoRules: [
      {
        index: 0,
        requiredTags: ["old"],
        preferredTags: ["bulk", "higher-body-fat"],
      },
      {
        index: 1,
        requiredTags: ["recent"],
        preferredTags: ["muscular", "strong", "bulk"],
      },
    ],
    photoOrder: ["old", "recent"],
    preferredMatching: {
      pose: true,
      angle: false,
      bodyPart: true,
      yearGap: false,
    },
    captionStyle: "short-punchy",
  },
  {
    category: "cut",
    hookText: "How it feels when the progress finally becomes obvious",
    themeMoodTags: ["proud", "motivational", "impressed"],
    requiredPhotoCount: 2,
    photoRules: [
      {
        index: 0,
        requiredTags: ["old"],
        preferredTags: ["bulk", "higher-body-fat"],
      },
      {
        index: 1,
        requiredTags: ["recent", "cut"],
        preferredTags: ["lean", "good"],
      },
    ],
    photoOrder: ["old", "recent"],
    preferredMatching: {
      pose: true,
      angle: true,
      bodyPart: true,
      yearGap: false,
    },
    captionStyle: "process",
  },
  {
    category: "strength",
    hookText: "100kg used to humble me. Now it is cardio.",
    themeMoodTags: ["cocky", "funny", "motivational"],
    requiredPhotoCount: 2,
    photoRules: [
      {
        index: 0,
        requiredTags: ["old"],
        preferredTags: ["small", "skinny"],
      },
      {
        index: 1,
        requiredTags: ["recent"],
        preferredTags: ["strong", "muscular", "big"],
      },
    ],
    photoOrder: ["old", "recent"],
    preferredMatching: {
      pose: false,
      angle: false,
      bodyPart: true,
      yearGap: true,
    },
    captionStyle: "strength",
  },
  {
    category: "genetics",
    hookText: "My 2020 self would not believe this is the same person",
    themeMoodTags: ["nostalgic", "shocked", "proud"],
    requiredPhotoCount: 2,
    photoRules: [
      {
        index: 0,
        requiredTags: ["old"],
        preferredTags: ["skinny", "average"],
        preferPoseMatch: true,
      },
      {
        index: 1,
        requiredTags: ["recent"],
        preferredTags: ["muscular", "good"],
        preferPoseMatch: true,
      },
    ],
    photoOrder: ["old", "recent"],
    preferredMatching: {
      pose: true,
      angle: true,
      bodyPart: true,
      yearGap: true,
    },
    captionStyle: "nostalgic",
  },
  {
    category: "confidence",
    hookText: "When your old dream physique becomes your before picture",
    themeMoodTags: ["proud", "cocky", "motivational"],
    requiredPhotoCount: 2,
    photoRules: [
      {
        index: 0,
        requiredTags: ["old", "good"],
        preferredTags: ["lean"],
      },
      {
        index: 1,
        requiredTags: ["recent", "good"],
        preferredTags: ["muscular", "confident"],
      },
    ],
    photoOrder: ["old", "recent"],
    preferredMatching: {
      pose: true,
      angle: true,
      bodyPart: false,
      yearGap: false,
    },
    captionStyle: "confidence",
  },
  {
    category: "old physique",
    hookText: "Not even mad at the old version. Just grateful I kept going.",
    themeMoodTags: ["nostalgic", "calm", "relatable"],
    requiredPhotoCount: 2,
    photoRules: [
      {
        index: 0,
        requiredTags: ["old"],
        preferredTags: ["average"],
      },
      {
        index: 1,
        requiredTags: ["recent"],
        preferredTags: ["good"],
      },
    ],
    photoOrder: ["old", "recent"],
    preferredMatching: {
      pose: false,
      angle: false,
      bodyPart: false,
      yearGap: true,
    },
    captionStyle: "grateful",
  },
  {
    category: "same pose",
    hookText: "Same pose. Different chapter.",
    themeMoodTags: ["motivational", "proud", "relatable"],
    requiredPhotoCount: 2,
    photoRules: [
      {
        index: 0,
        requiredTags: ["old"],
        preferredTags: [],
        preferPoseMatch: true,
      },
      {
        index: 1,
        requiredTags: ["recent"],
        preferredTags: [],
        preferPoseMatch: true,
      },
    ],
    photoOrder: ["old", "recent"],
    preferredMatching: {
      pose: true,
      angle: true,
      bodyPart: true,
      yearGap: false,
    },
    captionStyle: "short-punchy",
  },
  {
    category: "setbacks",
    hookText: "The setback looked permanent. It was not.",
    themeMoodTags: ["sad", "disappointed", "dramatic"],
    requiredPhotoCount: 2,
    photoRules: [
      {
        index: 0,
        requiredTags: ["recent"],
        preferredTags: ["good", "muscular"],
      },
      {
        index: 1,
        requiredTags: ["old"],
        preferredTags: ["average", "bad"],
      },
    ],
    photoOrder: ["setback", "comeback"],
    preferredMatching: {
      pose: true,
      angle: false,
      bodyPart: false,
      yearGap: false,
    },
    captionStyle: "comeback",
  },
  {
    category: "comebacks",
    hookText: "Turns out I just needed time.",
    themeMoodTags: ["motivational", "calm", "proud"],
    requiredPhotoCount: 2,
    photoRules: [
      {
        index: 0,
        requiredTags: ["old"],
        preferredTags: ["skinny", "small"],
      },
      {
        index: 1,
        requiredTags: ["recent"],
        preferredTags: ["muscular", "good"],
      },
    ],
    photoOrder: ["old", "recent"],
    preferredMatching: {
      pose: false,
      angle: false,
      bodyPart: false,
      yearGap: true,
    },
    captionStyle: "process",
  },
  {
    category: "calm disrespect",
    hookText: "Still nowhere near finished.",
    themeMoodTags: ["calm", "cocky", "mysterious"],
    requiredPhotoCount: 2,
    photoRules: [
      {
        index: 0,
        requiredTags: ["old"],
        preferredTags: ["average"],
      },
      {
        index: 1,
        requiredTags: ["recent"],
        preferredTags: ["good", "lean"],
      },
    ],
    photoOrder: ["old", "recent"],
    preferredMatching: {
      pose: true,
      angle: true,
      bodyPart: false,
      yearGap: false,
    },
    captionStyle: "understated",
  },
  {
    category: "cocky",
    hookText: "Had to trust the process.",
    themeMoodTags: ["cocky", "proud", "funny"],
    requiredPhotoCount: 2,
    photoRules: [
      {
        index: 0,
        requiredTags: ["old"],
        preferredTags: ["skinny"],
      },
      {
        index: 1,
        requiredTags: ["recent", "good"],
        preferredTags: ["muscular", "confident"],
      },
    ],
    photoOrder: ["old", "recent"],
    preferredMatching: {
      pose: false,
      angle: false,
      bodyPart: false,
      yearGap: false,
    },
    captionStyle: "cocky",
  },
  {
    category: "satire",
    hookText: "The old goal became the starting point.",
    themeMoodTags: ["satirical", "funny", "relatable"],
    requiredPhotoCount: 2,
    photoRules: [
      {
        index: 0,
        requiredTags: ["old", "good"],
        preferredTags: ["lean"],
      },
      {
        index: 1,
        requiredTags: ["recent"],
        preferredTags: ["muscular", "big"],
      },
    ],
    photoOrder: ["old", "recent"],
    preferredMatching: {
      pose: true,
      angle: false,
      bodyPart: false,
      yearGap: true,
    },
    captionStyle: "reflective",
  },
  {
    category: "funny",
    hookText: "Nobody asked for the glow-up update. Here it is anyway.",
    themeMoodTags: ["funny", "relatable", "cocky"],
    requiredPhotoCount: 2,
    photoRules: [
      {
        index: 0,
        requiredTags: ["old"],
        preferredTags: ["skinny", "average"],
      },
      {
        index: 1,
        requiredTags: ["recent"],
        preferredTags: ["good"],
      },
    ],
    photoOrder: ["old", "recent"],
    preferredMatching: {
      pose: false,
      angle: false,
      bodyPart: false,
      yearGap: false,
    },
    captionStyle: "funny",
  },
  {
    category: "nostalgic",
    hookText: "Looking back hits different when the work shows.",
    themeMoodTags: ["nostalgic", "emotional", "calm"],
    requiredPhotoCount: 2,
    photoRules: [
      {
        index: 0,
        requiredTags: ["old"],
        preferredTags: [],
      },
      {
        index: 1,
        requiredTags: ["recent"],
        preferredTags: ["good"],
      },
    ],
    photoOrder: ["old", "recent"],
    preferredMatching: {
      pose: true,
      angle: false,
      bodyPart: false,
      yearGap: true,
    },
    captionStyle: "nostalgic",
  },
  {
    category: "relatable",
    hookText: "The mirror lied for years. The photos did not.",
    themeMoodTags: ["relatable", "confused", "funny"],
    requiredPhotoCount: 2,
    photoRules: [
      {
        index: 0,
        requiredTags: ["old"],
        preferredTags: ["average"],
      },
      {
        index: 1,
        requiredTags: ["recent"],
        preferredTags: ["good", "lean"],
      },
    ],
    photoOrder: ["old", "recent"],
    preferredMatching: {
      pose: true,
      angle: true,
      bodyPart: false,
      yearGap: false,
    },
    captionStyle: "relatable",
  },
];
