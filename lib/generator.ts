export type PlatformId = "instagram" | "linkedin" | "x" | "email" | "blog";

export type ToneId = "professional" | "friendly" | "bold" | "playful";

export interface Platform {
  id: PlatformId;
  label: string;
  /** Hard character limit, or null when the platform has none worth enforcing. */
  limit: number | null;
  note: string;
}

export interface Tone {
  id: ToneId;
  label: string;
  blurb: string;
}

export interface Brief {
  topic: string;
  audience: string;
  keyPoints: string;
  cta: string;
  platform: PlatformId;
  tone: ToneId;
  /** Changing the seed reshuffles which hooks and lines are used. */
  seed: number;
}

export interface Draft {
  id: string;
  label: string;
  angle: string;
  text: string;
  hashtags: string[];
  characters: number;
  limit: number | null;
  trimmed: boolean;
}

export const PLATFORMS: readonly Platform[] = [
  {
    id: "instagram",
    label: "Instagram caption",
    limit: 2200,
    note: "Hook on the first line, hashtags at the end.",
  },
  {
    id: "linkedin",
    label: "LinkedIn post",
    limit: 3000,
    note: "One idea, short paragraphs.",
  },
  {
    id: "x",
    label: "X / Twitter post",
    limit: 280,
    note: "Hard 280-character ceiling.",
  },
  {
    id: "email",
    label: "Email newsletter",
    limit: null,
    note: "Subject line plus body copy.",
  },
  {
    id: "blog",
    label: "Blog intro",
    limit: null,
    note: "Working title and an opening section.",
  },
];

export const TONES: readonly Tone[] = [
  { id: "professional", label: "Professional", blurb: "Clear, credible, no fluff." },
  { id: "friendly", label: "Friendly", blurb: "Warm and conversational." },
  { id: "bold", label: "Bold", blurb: "Direct and opinionated." },
  { id: "playful", label: "Playful", blurb: "Light, with a bit of fun." },
];

const ANGLES: readonly string[] = ["Hook-first", "Story angle", "Value-first"];

const HOOKS: Record<ToneId, readonly string[]> = {
  professional: [
    "{Topic} deserves a plan, not guesswork.",
    "A practical note on {topic}.",
    "What we keep seeing with {topic}.",
    "Three things that make {topic} work for {audience}.",
  ],
  friendly: [
    "Let's talk about {topic} — it is simpler than it looks.",
    "A quick one on {topic}, since a few of you asked.",
    "Here is the friendly version of {topic}.",
    "{Topic} does not have to be a whole project.",
  ],
  bold: [
    "Most {topic} advice is filler. Here is what actually moves the needle.",
    "Stop overthinking {topic}.",
    "{Topic}: the version nobody sends you.",
    "If {topic} is not working, it is almost never the tools.",
  ],
  playful: [
    "{Topic}, but actually enjoyable.",
    "Plot twist: {topic} does not have to be painful.",
    "{Topic} on easy mode.",
    "Your {audience} can tell when {topic} is a copy-paste job.",
  ],
};

const BRIDGES: Record<ToneId, readonly string[]> = {
  professional: [
    "The pattern is consistent across the accounts we look at.",
    "The short version, before the detail.",
  ],
  friendly: [
    "Here is how it usually goes.",
    "Short version first, detail after.",
  ],
  bold: [
    "Here is the part that gets skipped.",
    "Say it plainly, then prove it.",
  ],
  playful: [
    "Stay with me, this part is fun.",
    "No jargon, promise.",
  ],
};

const LINES: Record<ToneId, readonly string[]> = {
  professional: [
    "For {audience}, the win comes from tightening the basics before adding anything new.",
    "{Point} is the step most teams skip, and the step that compounds.",
    "The goal is not more output, it is output {audience} can act on today.",
    "One clear message, repeated until it sounds obvious, beats five clever ones.",
    "Measurement matters more than polish: pick the number you want to move first.",
  ],
  friendly: [
    "If you are talking to {audience}, lead with the problem they already recognise.",
    "{Point} sounds small. In practice it is the bit that changes the result.",
    "You do not need a bigger team for this, just fewer moving parts.",
    "Write it the way you would explain it to one person over coffee.",
    "Start where you are, with what you already have to hand.",
  ],
  bold: [
    "Nobody remembers the second-best version of {topic}.",
    "{Point} is the reason most attempts stall in week two.",
    "Cut the paragraph that exists only to sound impressive.",
    "Clarity beats cleverness, every single time.",
    "Ship something specific this week instead of something perfect next quarter.",
  ],
  playful: [
    "Think of {point} as the cheat code nobody reads the manual for.",
    "Your {audience} scroll past beige. Be a little bit specific instead.",
    "Two quick wins and one honest mistake, the usual recipe.",
    "It is allowed to be enjoyable, that is rather the point.",
    "Small, weird and memorable beats big, smooth and forgettable.",
  ],
};

const CTAS: Record<ToneId, readonly string[]> = {
  professional: [
    "Want the short checklist? Reply and I will send it over.",
    "Book fifteen minutes and we will map this for your {audience}.",
  ],
  friendly: [
    "Curious how this looks for you? Give me a shout, I am happy to talk it through.",
    "Reply with your biggest sticking point and I will answer it directly.",
  ],
  bold: [
    "Try one of these this week. Then tell me it did not work.",
    "Pick one, do it properly, and stop debating the rest.",
  ],
  playful: [
    "Give it a go and report back, I want details.",
    "Steal this, make it yours, tell me how it lands.",
  ],
};

const TAG_POOL: readonly string[] = [
  "#content",
  "#marketing",
  "#growth",
  "#strategy",
  "#tips",
  "#smallbusiness",
];

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "you", "your", "our", "are",
  "was", "how", "what", "why", "when", "from", "into", "about", "they",
  "their", "them", "not", "but", "can", "will", "get", "got", "all", "any",
  "out", "who", "its",
]);

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function capitalise(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? vars[key] : match,
  );
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function getPlatform(id: PlatformId): Platform {
  return PLATFORMS.find((platform) => platform.id === id) ?? PLATFORMS[0];
}

export function getTone(id: ToneId): Tone {
  return TONES.find((tone) => tone.id === id) ?? TONES[0];
}

export function splitKeyPoints(raw: string): string[] {
  return raw
    .split(/[\n;•]|(?:,\s)/)
    .map((point) => collapseWhitespace(point.replace(/^[-*\s]+/, "")))
    .filter((point) => point.length > 2)
    .slice(0, 6);
}

export function buildHashtags(brief: Brief, max: number): string[] {
  const source = `${brief.topic} ${brief.audience} ${brief.keyPoints}`
    .toLowerCase()
    .split(/[^a-z0-9]+/);
  const tags: string[] = [];
  for (const word of source) {
    if (word.length < 4 || STOP_WORDS.has(word)) continue;
    const tag = `#${word}`;
    if (!tags.includes(tag)) tags.push(tag);
    if (tags.length === max) break;
  }
  for (const fallback of TAG_POOL) {
    if (tags.length >= Math.min(3, max)) break;
    if (!tags.includes(fallback)) tags.push(fallback);
  }
  return tags.slice(0, max);
}

export function validateBrief(brief: Brief): string | null {
  if (!collapseWhitespace(brief.topic)) {
    return "Add a topic so there is something to write about.";
  }
  return null;
}

function truncateAtWord(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const slice = text.slice(0, Math.max(limit - 1, 1));
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > limit * 0.5 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trimEnd()}…`;
}

interface ComposeInput {
  hook: string;
  bridge: string;
  lines: string[];
  cta: string;
  hashtags: string[];
  topic: string;
  audience: string;
}

function compose(
  platformId: PlatformId,
  input: ComposeInput,
): { text: string; hashtags: string[] } {
  const { hook, bridge, lines, cta, hashtags, topic, audience } = input;

  switch (platformId) {
    case "instagram": {
      const tagLine = hashtags.length ? `\n\n${hashtags.join(" ")}` : "";
      return {
        text: `${hook}\n\n${lines.join("\n")}\n\n${cta}${tagLine}`,
        hashtags,
      };
    }
    case "linkedin":
      return {
        text: `${hook}\n\n${bridge} ${lines[0]}\n\n${lines[1]}\n\n${cta}`,
        hashtags,
      };
    case "x":
      return {
        text: `${hook} ${lines[0]} ${cta}`,
        hashtags: [],
      };
    case "email":
      return {
        text: [
          `Subject: ${topic} — a simpler path for ${audience}`,
          "",
          `Hi ${audience},`,
          "",
          hook,
          "",
          `${bridge} ${lines[0]}`,
          "",
          lines[1],
          "",
          cta,
          "",
          "— The TOLG team",
        ].join("\n"),
        hashtags: [],
      };
    case "blog":
      return {
        text: [
          `# ${topic}: what actually works`,
          "",
          hook,
          "",
          `${bridge} ${lines[0]}`,
          "",
          lines[1],
          "",
          "## Where to start",
          "",
          cta,
        ].join("\n"),
        hashtags: [],
      };
  }
}

export function generateDrafts(brief: Brief): Draft[] {
  const topic = collapseWhitespace(brief.topic);
  if (!topic) return [];

  const platform = getPlatform(brief.platform);
  const tone = getTone(brief.tone);
  const audience = collapseWhitespace(brief.audience) || "your audience";
  const points = splitKeyPoints(brief.keyPoints);
  const hooks = HOOKS[tone.id];
  const bridges = BRIDGES[tone.id];
  const lines = LINES[tone.id];
  const custom = collapseWhitespace(brief.cta);
  const ctas = custom ? [custom] : CTAS[tone.id];
  const hashtags = buildHashtags(brief, platform.id === "instagram" ? 5 : 3);

  const random = mulberry32(brief.seed);
  const hookOffset = Math.floor(random() * hooks.length);
  const lineOffset = Math.floor(random() * lines.length);
  const ctaOffset = Math.floor(random() * ctas.length);

  return ANGLES.map((angle, index) => {
    const point = points.length
      ? points[index % points.length]
      : "the first idea on your list";

    const vars: Record<string, string> = {
      topic,
      Topic: capitalise(topic),
      audience,
      Audience: capitalise(audience),
      point: point.charAt(0).toLowerCase() + point.slice(1),
      Point: capitalise(point),
    };

    const hook = fill(hooks[(hookOffset + index) % hooks.length], vars);
    const bridge = fill(bridges[(ctaOffset + index) % bridges.length], vars);
    const draftLines = [
      fill(lines[(lineOffset + index) % lines.length], vars),
      fill(lines[(lineOffset + index + 2) % lines.length], vars),
    ];
    const cta = fill(ctas[(ctaOffset + index) % ctas.length], vars);

    const composed = compose(platform.id, {
      hook,
      bridge,
      lines: draftLines,
      cta,
      hashtags,
      topic,
      audience,
    });

    const limit = platform.limit;
    const oversized = limit !== null && composed.text.length > limit;
    const text = oversized && limit !== null
      ? truncateAtWord(composed.text, limit)
      : composed.text;

    return {
      id: `${platform.id}-${index}`,
      label: `${platform.label} · draft ${index + 1}`,
      angle,
      text,
      hashtags: composed.hashtags,
      characters: text.length,
      limit,
      trimmed: oversized,
    };
  });
}
