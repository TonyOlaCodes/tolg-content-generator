import type { Lesson, LessonModule } from "@/lib/types";

export const MODULES: LessonModule[] = [
  {
    id: "m1",
    number: 1,
    title: "Freestyle Foundations",
    description: "Thinking ahead, not stopping, recovering, and simple rhyme families.",
    lessonIds: ["m1-thinking-ahead", "m1-filler", "m1-recover", "m1-rhyme-families"],
  },
  {
    id: "m2",
    number: 2,
    title: "Rhyme Chains",
    description: "End rhymes, internals, multis, slant rhymes, and switching families.",
    lessonIds: ["m2-sounds", "m2-internal", "m2-multis", "m2-switching"],
  },
  {
    id: "m3",
    number: 3,
    title: "Association",
    description: "Build mental association trees at freestyle speed.",
    lessonIds: ["m3-trees", "m3-directions", "m3-timed"],
  },
  {
    id: "m4",
    number: 4,
    title: "Name Drops & References",
    description: "Reference real people and culture without dumping bare names.",
    lessonIds: ["m4-why-refs", "m4-routes", "m4-categories"],
  },
  {
    id: "m5",
    number: 5,
    title: "Double Meanings",
    description: "Stack definitions inside a single bar.",
    lessonIds: ["m5-meanings", "m5-connect"],
  },
  {
    id: "m6",
    number: 6,
    title: "Punchlines",
    description: "Setup, expectation, punch — misdirection and callbacks.",
    lessonIds: ["m6-setup", "m6-builder"],
  },
  {
    id: "m7",
    number: 7,
    title: "Flow",
    description: "Pockets, density, pauses, double-time, melodic delivery.",
    lessonIds: ["m7-pockets", "m7-switching"],
  },
  {
    id: "m8",
    number: 8,
    title: "Storytelling",
    description: "Character, setting, problem, callback, ending.",
    lessonIds: ["m8-structure", "m8-scenario"],
  },
  {
    id: "m9",
    number: 9,
    title: "Topic Transitions",
    description: "Association bridges between unrelated subjects.",
    lessonIds: ["m9-bridging", "m9-exercise"],
  },
  {
    id: "m10",
    number: 10,
    title: "Advanced Freestyling",
    description: "Long-form coherence, layered refs, beat switching, surroundings.",
    lessonIds: ["m10-longform", "m10-mistakes"],
  },
];

export const LESSONS: Lesson[] = [
  {
    id: "m1-thinking-ahead",
    moduleId: "m1",
    title: "Thinking Ahead",
    summary: "Build the next line before you finish the current one.",
    durationMin: 6,
    xpReward: 40,
    skills: ["continuity", "recovery"],
    steps: [
      {
        id: "s1",
        title: "The overlap principle",
        body: "Elite freestylers overlap thought and speech. While your mouth finishes line A, your mind should already be assembling line B — rhyme target, meaning, and exit route.",
      },
      {
        id: "s2",
        title: "Listen to your last line",
        body: "Your previous bar is free material. Echo a word, flip its meaning, or continue its image. Stopping often happens when you treat each line as isolated.",
      },
      {
        id: "s3",
        title: "Practice cue",
        body: "Rap for 30 seconds about a room you’re in. Every line must reuse one word from the line before it — not as filler, but as a bridge.",
      },
    ],
  },
  {
    id: "m1-filler",
    moduleId: "m1",
    title: "Using Filler Intelligently",
    summary: "Buy milliseconds without sounding empty.",
    durationMin: 5,
    xpReward: 35,
    skills: ["recovery", "flow"],
    steps: [
      {
        id: "s1",
        title: "Filler vs glue",
        body: "Empty filler (“uh”, “you know”, repeating the same flex) kills momentum. Useful glue is rhythmic: short connective phrases that keep pocket while you load the next idea.",
      },
      {
        id: "s2",
        title: "Better than silence panic",
        body: "If you’re stuck, describe something concrete in the room for one bar, then jump. Concrete observation beats abstract panic every time.",
      },
    ],
  },
  {
    id: "m1-recover",
    moduleId: "m1",
    title: "Recovering from Mistakes",
    summary: "Turn stumbles into intentional moves.",
    durationMin: 5,
    xpReward: 40,
    skills: ["recovery", "punchlines"],
    steps: [
      {
        id: "s1",
        title: "Never apologize mid-take",
        body: "Naming the mistake out loud (“wait, that was wrong”) breaks the spell. Instead, redefine it: pretend the odd word was a setup.",
      },
      {
        id: "s2",
        title: "Callback save",
        body: "If you say a weird word, come back to it two bars later as if it was planned. Listeners remember confidence more than perfection.",
      },
    ],
  },
  {
    id: "m1-rhyme-families",
    moduleId: "m1",
    title: "Simple Rhyme Families",
    summary: "Group words by sound, not spelling.",
    durationMin: 7,
    xpReward: 45,
    skills: ["rhyming", "vocabulary"],
    steps: [
      {
        id: "s1",
        title: "Sounds over spelling",
        body: "“Motion” pairs with ocean, potion, promotion — spelling differs, sound family matches. Train your ear, not your eyes.",
      },
      {
        id: "s2",
        title: "Interactive family",
        body: "Explore a rhyme family built from the seed word motion.",
        interactive: {
          type: "rhyme_family",
          payload: {
            seed: "motion",
            family: ["ocean", "potion", "commotion", "promotion", "slow motion", "locomotion", "devotion"],
          },
        },
      },
    ],
  },
  {
    id: "m2-sounds",
    moduleId: "m2",
    title: "End Rhymes & Families",
    summary: "Extend one sound as far as it can go.",
    durationMin: 6,
    xpReward: 45,
    skills: ["rhyming", "continuity"],
    steps: [
      {
        id: "s1",
        title: "Ride the family",
        body: "Stay in one rhyme family for 8–16 bars before switching. This builds the “can’t miss” feeling of long chains.",
      },
      {
        id: "s2",
        title: "Compound rhymes",
        body: "Stack small words: “slow motion” / “no potion” / “show devotion”. Compounds multiply options inside one family.",
      },
    ],
  },
  {
    id: "m2-internal",
    moduleId: "m2",
    title: "Internal Rhymes",
    summary: "Rhyme inside the bar, not only at the end.",
    durationMin: 5,
    xpReward: 40,
    skills: ["rhyming", "flow"],
    steps: [
      {
        id: "s1",
        title: "Pocket glue",
        body: "Internal rhymes tighten rhythm: “quick wit / thick script”. They also buy you time because the ear is satisfied before the line ends.",
      },
    ],
  },
  {
    id: "m2-multis",
    moduleId: "m2",
    title: "Multisyllabic Rhymes",
    summary: "Match stress patterns across multiple syllables.",
    durationMin: 7,
    xpReward: 50,
    skills: ["rhyming", "flow", "wordplay"],
    steps: [
      {
        id: "s1",
        title: "Pattern first",
        body: "For “celebration”, feel ce-le-BRA-tion. Candidates share stress shape: revelation, elevation, compensation.",
      },
      {
        id: "s2",
        title: "Try it",
        body: "Build multis around celebration.",
        interactive: {
          type: "rhyme_family",
          payload: {
            seed: "celebration",
            family: ["revelation", "elevation", "compensation", "concentration", "constellation", "conversation"],
          },
        },
      },
    ],
  },
  {
    id: "m2-switching",
    moduleId: "m2",
    title: "Switching Rhyme Families",
    summary: "Exit a chain without sounding broken.",
    durationMin: 5,
    xpReward: 40,
    skills: ["rhyming", "continuity"],
    steps: [
      {
        id: "s1",
        title: "Bridge word",
        body: "Use a slant or semantic bridge: leave -otion via “open ocean” into a new vowel family. Announce the turn with a slight cadence change.",
      },
    ],
  },
  {
    id: "m3-trees",
    moduleId: "m3",
    title: "Association Trees",
    summary: "One subject → many freestyle directions.",
    durationMin: 8,
    xpReward: 55,
    skills: ["references", "creativity", "vocabulary"],
    steps: [
      {
        id: "s1",
        title: "Why trees matter",
        body: "A single reference is not one bar — it’s a map. Metta World Peace alone opens basketball, name-change wordplay, peace/war contrast, and art/test splits.",
      },
      {
        id: "s2",
        title: "Explore a tree",
        body: "Tap branches to see how one name becomes many routes.",
        interactive: {
          type: "association_tree",
          payload: { referenceId: "metta-world-peace" },
        },
      },
    ],
  },
  {
    id: "m3-directions",
    moduleId: "m3",
    title: "Choosing a Direction",
    summary: "Commit to a branch, then ride it.",
    durationMin: 5,
    xpReward: 40,
    skills: ["continuity", "references"],
    steps: [
      {
        id: "s1",
        title: "Commit",
        body: "Beginners list associations out loud and stall. Pros pick one branch (e.g. Air Jordan → flying) and develop it for several bars before hopping.",
      },
    ],
  },
  {
    id: "m3-timed",
    moduleId: "m3",
    title: "Timed Associations",
    summary: "Ten seconds. No overthinking.",
    durationMin: 6,
    xpReward: 50,
    skills: ["references", "creativity"],
    steps: [
      {
        id: "s1",
        title: "Pressure training",
        body: "Eventually you get only the subject. Ten seconds to generate routes. This is the mental gym for off-the-top speed.",
      },
      {
        id: "s2",
        title: "Drill",
        body: "Open Practice → Association Lab after this lesson and run three rounds.",
      },
    ],
  },
  {
    id: "m4-why-refs",
    moduleId: "m4",
    title: "Why References Are Useful",
    summary: "A name is a toolbox, not a flex by itself.",
    durationMin: 6,
    xpReward: 45,
    skills: ["references", "wordplay"],
    steps: [
      {
        id: "s1",
        title: "Useful knowledge",
        body: "Saying “Metta World Peace” alone is thin. Knowing Lakers, defense, 2010, Artest→art test gives you punchlines and bridges.",
      },
    ],
  },
  {
    id: "m4-routes",
    moduleId: "m4",
    title: "Wordplay Routes",
    summary: "Derive paths from facts.",
    durationMin: 7,
    xpReward: 50,
    skills: ["references", "wordplay", "punchlines"],
    steps: [
      {
        id: "s1",
        title: "Route cards",
        body: "For each reference, store: aliases, numbers, people, places, literal meanings, homophones. Tap any connection to expand further in the Reference Library.",
      },
    ],
  },
  {
    id: "m4-categories",
    moduleId: "m4",
    title: "Reference Categories",
    summary: "Athletes, anime, science, brands — breadth beats repetition.",
    durationMin: 5,
    xpReward: 40,
    skills: ["references", "vocabulary"],
    steps: [
      {
        id: "s1",
        title: "Avoid the same five topics",
        body: "If your map is only money/cars/gym, your freestyles loop. Deliberately learn one new category per week.",
      },
    ],
  },
  {
    id: "m5-meanings",
    moduleId: "m5",
    title: "Words With Multiple Meanings",
    summary: "Court, charge, bank, current, bars…",
    durationMin: 6,
    xpReward: 45,
    skills: ["wordplay", "vocabulary"],
    steps: [
      {
        id: "s1",
        title: "Split the meanings",
        body: "See each meaning separately before you try to combine them. Clarity first, clever second.",
        interactive: {
          type: "double_meaning",
          payload: { wordId: "court" },
        },
      },
    ],
  },
  {
    id: "m5-connect",
    moduleId: "m5",
    title: "Connect Two Meanings",
    summary: "One bar, two definitions.",
    durationMin: 6,
    xpReward: 50,
    skills: ["wordplay", "punchlines"],
    steps: [
      {
        id: "s1",
        title: "Challenge",
        body: "Write or freestyle one line that uses “bank” as money and as a river edge — or “current” as time and electricity.",
      },
    ],
  },
  {
    id: "m6-setup",
    moduleId: "m6",
    title: "Setup → Expectation → Punch",
    summary: "Punchlines are engineered surprises.",
    durationMin: 6,
    xpReward: 45,
    skills: ["punchlines", "wordplay"],
    steps: [
      {
        id: "s1",
        title: "Structure",
        body: "Setup points the listener one way. Expectation forms. Punch lands elsewhere — via reference, double meaning, exaggeration, or callback.",
      },
    ],
  },
  {
    id: "m6-builder",
    moduleId: "m6",
    title: "Punchline Builder",
    summary: "Interactive setups and punches.",
    durationMin: 7,
    xpReward: 55,
    skills: ["punchlines", "creativity"],
    steps: [
      {
        id: "s1",
        title: "Practice modes",
        body: "Either receive a setup and supply the punch, or receive a punch and reverse-engineer a setup. Use Practice → Punchline Builder.",
      },
    ],
  },
  {
    id: "m7-pockets",
    moduleId: "m7",
    title: "Rhythmic Pockets",
    summary: "Density, pauses, syncopation.",
    durationMin: 6,
    xpReward: 45,
    skills: ["flow", "endurance"],
    steps: [
      {
        id: "s1",
        title: "Visual grid",
        body: "Imagine 16 slots in a bar. Place syllables early (push), late (drag), or leave rests. Silence is part of flow.",
        interactive: {
          type: "quiz",
          payload: {
            question: "Which change often creates melodic freestyle space?",
            options: ["Filling every sixteenth", "Longer vowels + selective pauses", "Only end rhymes", "Faster filler words"],
            answer: 1,
          },
        },
      },
    ],
  },
  {
    id: "m7-switching",
    moduleId: "m7",
    title: "Switching Cadence",
    summary: "Double-time, half-time, melodic flips.",
    durationMin: 6,
    xpReward: 50,
    skills: ["flow", "creativity"],
    steps: [
      {
        id: "s1",
        title: "Announce with energy",
        body: "Cadence switches feel intentional when you change breath and vowel length at the turn — not only syllable count.",
      },
    ],
  },
  {
    id: "m8-structure",
    moduleId: "m8",
    title: "Story Beats",
    summary: "Beginning, character, setting, problem, development, callback, ending.",
    durationMin: 6,
    xpReward: 45,
    skills: ["continuity", "creativity"],
    steps: [
      {
        id: "s1",
        title: "Keep a spine",
        body: "Even chaotic freestyles benefit from a spine: who, where, what goes wrong, what returns at the end.",
      },
    ],
  },
  {
    id: "m8-scenario",
    moduleId: "m8",
    title: "Scenario Freestyle",
    summary: "Random story seeds on the clock.",
    durationMin: 5,
    xpReward: 40,
    skills: ["continuity", "creativity"],
    steps: [
      {
        id: "s1",
        title: "Next step",
        body: "Use Practice → Story Mode. Hit beginning → problem → callback → ending in under three minutes.",
      },
    ],
  },
  {
    id: "m9-bridging",
    moduleId: "m9",
    title: "Association Bridging",
    summary: "car → engine → power → electricity → lightning → Thor → Marvel",
    durationMin: 6,
    xpReward: 50,
    skills: ["continuity", "references", "creativity"],
    steps: [
      {
        id: "s1",
        title: "Short jumps",
        body: "The best transitions use short logical jumps. Fewer hops usually sounds cleaner — but creative long chains can become the bar.",
        interactive: {
          type: "bridge",
          payload: {
            from: "car",
            to: "Thor",
            example: ["car", "engine", "power", "electricity", "lightning", "Thor"],
          },
        },
      },
    ],
  },
  {
    id: "m9-exercise",
    moduleId: "m9",
    title: "Connect A to B",
    summary: "Score yourself on jump count and smoothness.",
    durationMin: 5,
    xpReward: 45,
    skills: ["continuity", "creativity"],
    steps: [
      {
        id: "s1",
        title: "Drill",
        body: "Open Connection Game. Try Titanic → PlayStation in under six hops, then freestyle the chain.",
      },
    ],
  },
  {
    id: "m10-longform",
    moduleId: "m10",
    title: "Long-Form Freestyle",
    summary: "Coherence across minutes, not just bars.",
    durationMin: 7,
    xpReward: 60,
    skills: ["endurance", "continuity", "creativity"],
    steps: [
      {
        id: "s1",
        title: "Themes + callbacks",
        body: "Plant images early and harvest them later. Change rhyme schemes on purpose. Layer references. Keep a thematic through-line even while topics evolve.",
      },
    ],
  },
  {
    id: "m10-mistakes",
    moduleId: "m10",
    title: "Surroundings & Intentional Mistakes",
    summary: "Use the room. Weaponize errors.",
    durationMin: 6,
    xpReward: 55,
    skills: ["recovery", "creativity", "references"],
    steps: [
      {
        id: "s1",
        title: "Live inventory",
        body: "When ideas thin out, scan: colors, logos, weather, body position, sounds. Ordinary objects become elite fuel when associated quickly.",
      },
    ],
  },
];

export function getLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}

export function getModule(id: string): LessonModule | undefined {
  return MODULES.find((m) => m.id === id);
}
