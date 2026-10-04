import type { AIProvider, AnalyzeFreestyleInput, CoachInput, GenerateExerciseInput, SectionImproveInput } from "@/lib/ai/types";
import type { AIAnalysis, AssociationNode, PracticeModeId, SkillKey } from "@/lib/types";
import { REFERENCES } from "@/lib/data/references";
import { WORDS, RANDOM_WORDS } from "@/lib/data/words";
import { SKILL_KEYS } from "@/lib/data/skills";
import { uid } from "@/lib/utils";

const FILLERS = ["uh", "um", "you know", "like", "basically", "i mean", "yeah yeah"];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function countWords(words: string[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const w of words) m[w] = (m[w] ?? 0) + 1;
  return m;
}

function detectReferences(text: string): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const ref of REFERENCES) {
    const names = [ref.name, ...ref.aliases, ...ref.associatedWords.slice(0, 4)];
    if (names.some((n) => n && lower.includes(n.toLowerCase()))) hits.push(ref.name);
  }
  // number / nickname cues
  if (/\b23\b/.test(lower) && !hits.includes("Michael Jordan")) hits.push("Michael Jordan (via 23)");
  if (/\bair jordan\b|\bjumpman\b/.test(lower)) hits.push("Air Jordan");
  return [...new Set(hits)];
}

function detectDoubleMeanings(text: string): AIAnalysis["doubleMeanings"] {
  const lower = text.toLowerCase();
  const out: AIAnalysis["doubleMeanings"] = [];
  for (const w of WORDS) {
    if (!lower.includes(w.word)) continue;
    const meanings = [...w.definitions, ...w.alternateMeanings].slice(0, 3);
    // Only claim multi-meaning if surrounding context hints at >1 sense — else uncertain
    const contextHints = meanings.filter((m) => {
      const key = m.toLowerCase().split(/\s+/).slice(0, 2).join(" ");
      return key.length > 3 && lower.includes(key.split(" ")[0]!);
    });
    out.push({
      phrase: w.word,
      meanings,
      confidence: contextHints.length >= 2 ? "medium" : "uncertain",
    });
  }
  return out.slice(0, 5);
}

function rhymeScore(words: string[]): { score: number; chains: string[][] } {
  const endings = words.map((w) => w.slice(-3));
  const groups: Record<string, string[]> = {};
  endings.forEach((e, i) => {
    if (e.length < 2) return;
    groups[e] = groups[e] ?? [];
    if (!groups[e]!.includes(words[i]!)) groups[e]!.push(words[i]!);
  });
  const chains = Object.values(groups).filter((g) => g.length >= 2).slice(0, 6);
  const score = Math.min(95, 45 + chains.length * 8 + Math.min(20, words.length / 5));
  return { score: Math.round(score), chains };
}

function skillBundle(
  base: number,
  words: string[],
  refs: string[],
  fillers: number,
  durationSec: number,
  prompts: string[],
): Record<SkillKey | "promptUsage", number> {
  const unique = new Set(words).size;
  const promptHits = prompts.filter((p) => words.join(" ").includes(p.toLowerCase())).length;
  const promptUsage = prompts.length
    ? Math.round((promptHits / prompts.length) * 100)
    : 70;
  const rhyming = rhymeScore(words).score;
  return {
    rhyming,
    flow: Math.round(clamp(base + (durationSec > 45 ? 8 : 0) - fillers * 3, 25, 96)),
    wordplay: Math.round(clamp(base + detectDoubleMeanings(words.join(" ")).length * 6, 30, 95)),
    references: Math.round(clamp(40 + refs.length * 12, 25, 98)),
    creativity: Math.round(clamp(base + unique / 8, 30, 95)),
    vocabulary: Math.round(clamp(35 + unique / 3, 25, 96)),
    continuity: Math.round(clamp(base + 5 - fillers * 4, 25, 94)),
    punchlines: Math.round(clamp(base + refs.length * 4, 28, 92)),
    recovery: Math.round(clamp(base + (fillers ? 5 : 12), 30, 95)),
    endurance: Math.round(clamp(30 + durationSec / 2, 20, 98)),
    promptUsage,
  };
}

function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}

function missedFromRefs(refs: string[]): AIAnalysis["missedOpportunities"] {
  const out: AIAnalysis["missedOpportunities"] = [];
  for (const name of refs.slice(0, 2)) {
    const ref = REFERENCES.find((r) => name.includes(r.name) || r.aliases.some((a) => name.includes(a)));
    if (!ref) continue;
    const route = ref.associationTree[0]?.children?.slice(0, 4).map((c) => c.label) ?? ref.associatedWords.slice(0, 4);
    out.push({
      from: ref.name,
      route: [ref.name, ...route],
      idea: `You touched ${ref.name} but could have branched into: ${route.join(" → ")}.`,
    });
  }
  if (!out.length) {
    out.push({
      from: "Michael Jordan",
      route: ["Jordan", "Chicago", "Bulls", "bull market", "stocks", "money"],
      idea: "Classic unused bridge from basketball identity into finance imagery.",
    });
  }
  return out;
}

export class MockAIProvider implements AIProvider {
  async analyzeFreestyle(input: AnalyzeFreestyleInput): Promise<AIAnalysis> {
    const text = input.transcript?.trim() || "";
    const words = tokenize(text);
    const counts = countWords(words);
    const repeated = Object.entries(counts)
      .filter(
        ([word, c]) =>
          c >= 3 && !["the", "a", "i", "and", "to", "my", "in", "on", "of", "it", "you"].includes(word),
      )
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const fillerPhrases = FILLERS.map((phrase) => ({
      phrase,
      count: (text.toLowerCase().match(new RegExp(phrase.replace(/\s+/g, "\\s+"), "g")) || []).length,
    })).filter((f) => f.count > 0);

    const refs = detectReferences(text);
    const doubles = detectDoubleMeanings(text);
    const { chains } = rhymeScore(words);
    const durationSec = input.session.durationSec ?? 60;
    const prompts = input.session.prompts ?? [];
    const base = words.length < 8 ? 42 : 62;
    const skills = skillBundle(base, words, refs, fillerPhrases.reduce((a, f) => a + f.count, 0), durationSec, prompts);
    const overall = Math.round(
      (SKILL_KEYS.reduce((a, k) => a + skills[k], 0) / SKILL_KEYS.length) * 10,
    );

    const sentences = text.split(/[.!?\n]+/).map((s) => s.trim()).filter((s) => s.length > 12);
    const bestBar = sentences.sort((a, b) => b.length - a.length)[0] || (words.slice(0, 12).join(" ") || "—");

    const highlights: AIAnalysis["highlights"] = [];
    for (const ref of refs.slice(0, 4)) {
      const idx = text.toLowerCase().indexOf(ref.toLowerCase().split(" ")[0]!);
      if (idx >= 0) {
        highlights.push({
          start: idx,
          end: idx + ref.length,
          kind: "reference",
          label: ref,
          explanation: `Identified cultural/reference cue: ${ref}.`,
        });
      }
    }
    for (const f of fillerPhrases.slice(0, 3)) {
      const idx = text.toLowerCase().indexOf(f.phrase);
      if (idx >= 0) {
        highlights.push({
          start: idx,
          end: idx + f.phrase.length,
          kind: "filler",
          label: f.phrase,
          explanation: `Repeated filler pattern (“${f.phrase}”) — replace with a concrete image or rhyme target.`,
        });
      }
    }
    for (const p of prompts) {
      const idx = text.toLowerCase().indexOf(p.toLowerCase());
      if (idx >= 0) {
        highlights.push({
          start: idx,
          end: idx + p.length,
          kind: "prompt",
          label: p,
          explanation: `Prompt word incorporated: ${p}.`,
        });
      }
    }

    const bestRef = refs[0];
    let summary = "Mock analysis based on transcript patterns.";
    if (bestRef?.includes("Jordan") || bestRef?.includes("Air")) {
      summary =
        "You referenced Michael Jordan through identity cues and linked toward Air/flying imagery. That creates a useful semantic bridge from basketball to elevation — keep extending the branch instead of resetting.";
    } else if (refs.length) {
      summary = `Strongest reference moment: ${refs[0]}. Specific route-building beat vague name-drops — expand one branch for several bars.`;
    } else if (!text) {
      summary =
        "No transcript available (mock STT). Scores are baseline estimates from session length and prompts. Connect a transcription provider for line-level feedback.";
    } else {
      summary =
        "Solid continuity signals in the word stream. Next edge: plant a reference early and callback later, and hunt one deliberate double meaning.";
    }

    return {
      id: uid("analysis"),
      recordingId: input.recordingId,
      createdAt: new Date().toISOString(),
      overallScore: Math.min(1000, Math.max(200, overall)),
      maxScore: 1000,
      skills,
      bestMoments: [
        {
          text: bestBar,
          reason: refs[0]
            ? `Contains or sits near reference material (${refs[0]}).`
            : "Longest coherent phrase — candidate for polish into a punch.",
        },
      ],
      bestBar,
      bestReference: refs[0],
      bestRhymeChain: chains[0]?.join(" → "),
      bestTransition: refs.length >= 2 ? `${refs[0]} → ${refs[1]}` : undefined,
      cleverReferences: refs,
      doubleMeanings: doubles,
      rhymeChains: chains,
      repeatedWords: repeated,
      fillerPhrases,
      missedOpportunities: missedFromRefs(refs),
      suggestedAssociations: RANDOM_WORDS.slice(0, 8),
      recommendedDrills: [
        { mode: "association_lab", title: "Association Lab", reason: "Speed up branch generation under time pressure." },
        { mode: "topic_switch", title: "Topic Switch", reason: "Practice bridges when continuity dips." },
        { mode: "rhyme_chain", title: "Rhyme Chain", reason: "Extend sound families past the first three hits." },
      ],
      highlights,
      summary,
      uncertainNotes: doubles
        .filter((d) => d.confidence === "uncertain")
        .map((d) => `Uncertain whether “${d.phrase}” was used as a true double meaning.`),
    };
  }

  async generateExercise(input: GenerateExerciseInput) {
    const mode = (input.mode ?? "rapid_association") as PracticeModeId;
    return {
      title: `Focus drill: ${input.skill ?? "creativity"}`,
      mode,
      steps: [
        "Warm up with 60 seconds of rapid associations (no rapping).",
        "Run the selected mode for 5 minutes at your current difficulty.",
        "Record a blind freestyle and compare reference density.",
      ],
    };
  }

  async generateAssociations(subject: string): Promise<AssociationNode[]> {
    const ref = REFERENCES.find(
      (r) =>
        r.name.toLowerCase().includes(subject.toLowerCase()) ||
        r.aliases.some((a) => a.toLowerCase().includes(subject.toLowerCase())),
    );
    if (ref) return ref.associationTree;
    const words = subject.split(/\s+/);
    return [
      {
        id: "root",
        label: subject,
        children: [
          ...words.map((w, i) => ({ id: `w${i}`, label: w, children: [{ id: `w${i}c`, label: `${w} imagery` }] })),
          { id: "sound", label: "sound-alikes", children: [{ id: "rhyme", label: "rhyme family" }] },
          { id: "cult", label: "culture links", children: [{ id: "pop", label: "pop culture" }] },
        ],
      },
    ];
  }

  async evaluateWordplay(line: string, word?: string) {
    const doubles = detectDoubleMeanings(line);
    const hit = word ? doubles.find((d) => d.phrase === word) : doubles[0];
    if (!hit) {
      return { score: 40, notes: ["No clear multi-meaning pivot detected."], uncertain: true };
    }
    return {
      score: hit.confidence === "medium" ? 78 : 55,
      notes: [`Possible meanings for “${hit.phrase}”: ${hit.meanings.join("; ")}`],
      uncertain: hit.confidence === "uncertain",
    };
  }

  async coach(input: CoachInput): Promise<string> {
    const msg = input.message.toLowerCase();
    if (msg.includes("lebron")) {
      return [
        "10 usable LeBron routes:",
        "1) King / crown / throne",
        "2) Court (basketball + legal)",
        "3) Akron / hometown loyalty",
        "4) Chase (legacy + bank)",
        "5) Decision / choice pressure",
        "6) Heat → temperature / pressure",
        "7) Lake / Lakers water imagery",
        "8) Longevity / mileage / odometer",
        "9) Fatherhood / Bronny bridge",
        "10) Jersey numbers 6 & 23 → identity shifts",
        "",
        "Pick one branch and ride it for 8 bars before hopping.",
      ].join("\n");
    }
    if (msg.includes("court")) {
      return [
        "Flip “court” by stacking meanings:",
        "• Basketball surface",
        "• Legal courtroom",
        "• Royal court",
        "• To court someone",
        "",
        "Example structure: set basketball imagery, pivot to judgment/verdict as the punch. Mark uncertain if the second meaning isn’t clear in performance.",
      ].join("\n");
    }
    if (msg.includes("multi")) {
      return "For multis, lock the stress pattern first. celebration → elevation / revelation / compensation. Rap the skeleton on nonsense syllables, then swap in meaning.";
    }
    if (msg.includes("drill") || msg.includes("10 minute")) {
      return [
        "10-minute drill:",
        "2m Rapid Association",
        "2m Reference Lab",
        "2m Rhyme Chain",
        "2m Topic Switch freestyle",
        "2m Blind freestyle",
      ].join("\n");
    }
    if (msg.includes("harder")) {
      return "Harder pack: quartz, parallax, habeas, nebula, fiduciary, chiaroscuro, isthmus, algorithm, cathedral, voltage. Incorporate one every 10 seconds.";
    }
    return [
      "Coach notes:",
      input.recentContext ? `Recent context considered: ${input.recentContext.slice(0, 160)}…` : "No recent session context attached.",
      "",
      "Try this: name a concrete object, attach a reference, then exit through a double meaning. If you want specifics, ask about a word, person, or paste a bar.",
    ].join("\n");
  }

  async improveSection(input: SectionImproveInput): Promise<string> {
    return [
      "Section feedback (mock):",
      "",
      `Selected: “${input.section.slice(0, 180)}”`,
      "",
      "• Keep the strongest concrete noun and rebuild the bar around it.",
      "• Add one reference branch or double meaning — not both if the pocket is crowded.",
      "• If this was a recovery moment, callback the odd word 2 bars later so it feels intentional.",
      "",
      input.surrounding ? `Context used: ${input.surrounding.slice(0, 120)}…` : "",
    ].join("\n");
  }
}

export const mockAI = new MockAIProvider();
