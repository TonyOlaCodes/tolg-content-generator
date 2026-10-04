import { z } from "zod";
import type { AIProvider, AnalyzeFreestyleInput, CoachInput, GenerateExerciseInput, SectionImproveInput } from "@/lib/ai/types";
import type { AIAnalysis } from "@/lib/types";
import { MockAIProvider } from "@/lib/ai/mock-provider";

const analysisSchema = z.object({
  overallScore: z.number().min(0).max(1000),
  summary: z.string(),
  skills: z.record(z.string(), z.number()),
  bestBar: z.string().optional(),
  bestReference: z.string().optional(),
  bestRhymeChain: z.string().optional(),
  bestTransition: z.string().optional(),
  cleverReferences: z.array(z.string()).default([]),
  missedOpportunities: z
    .array(
      z.object({
        from: z.string(),
        route: z.array(z.string()),
        idea: z.string(),
      }),
    )
    .default([]),
  recommendedDrills: z
    .array(
      z.object({
        mode: z.string(),
        title: z.string(),
        reason: z.string(),
      }),
    )
    .default([]),
  uncertainNotes: z.array(z.string()).default([]),
});

/**
 * OpenAI-backed provider. Only instantiate server-side with process.env.OPENAI_API_KEY.
 * Falls back to mock analysis if the API call fails or JSON is invalid.
 */
export class OpenAIProvider implements AIProvider {
  private fallback = new MockAIProvider();
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "gpt-4o-mini") {
    this.apiKey = apiKey;
    this.model = model;
  }

  private async chat(system: string, user: string): Promise<string> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.4,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? "{}";
  }

  async analyzeFreestyle(input: AnalyzeFreestyleInput): Promise<AIAnalysis> {
    const mock = await this.fallback.analyzeFreestyle(input);
    try {
      const raw = await this.chat(
        "You are a precise freestyle rap coach. Return structured JSON only. Never invent clever double meanings when uncertain — label uncertain. Be specific.",
        JSON.stringify({
          transcript: input.transcript,
          prompts: input.session.prompts,
          durationSec: input.session.durationSec,
          schemaHint: Object.keys(analysisSchema.shape),
        }),
      );
      const parsed = analysisSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) return mock;
      return {
        ...mock,
        overallScore: parsed.data.overallScore,
        summary: parsed.data.summary,
        bestBar: parsed.data.bestBar ?? mock.bestBar,
        bestReference: parsed.data.bestReference ?? mock.bestReference,
        bestRhymeChain: parsed.data.bestRhymeChain ?? mock.bestRhymeChain,
        bestTransition: parsed.data.bestTransition ?? mock.bestTransition,
        cleverReferences: parsed.data.cleverReferences,
        missedOpportunities: parsed.data.missedOpportunities,
        recommendedDrills: parsed.data.recommendedDrills.map((d) => ({
          ...d,
          mode: d.mode as AIAnalysis["recommendedDrills"][number]["mode"],
        })),
        uncertainNotes: parsed.data.uncertainNotes,
      };
    } catch {
      return mock;
    }
  }

  async generateExercise(input: GenerateExerciseInput) {
    return this.fallback.generateExercise(input);
  }

  async generateAssociations(subject: string) {
    return this.fallback.generateAssociations(subject);
  }

  async evaluateWordplay(line: string, word?: string) {
    return this.fallback.evaluateWordplay(line, word);
  }

  async coach(input: CoachInput): Promise<string> {
    try {
      const raw = await this.chat(
        "You are Freestyle Lab coach. Help with associations, multis, references, drills. No copyrighted lyric imitation. Return JSON {\"reply\":\"...\"}.",
        JSON.stringify(input),
      );
      const data = JSON.parse(raw) as { reply?: string };
      return data.reply ?? (await this.fallback.coach(input));
    } catch {
      return this.fallback.coach(input);
    }
  }

  async improveSection(input: SectionImproveInput): Promise<string> {
    try {
      const raw = await this.chat(
        "Improve only the selected freestyle section. Specific, practical. JSON {\"reply\":\"...\"}.",
        JSON.stringify(input),
      );
      const data = JSON.parse(raw) as { reply?: string };
      return data.reply ?? (await this.fallback.improveSection(input));
    } catch {
      return this.fallback.improveSection(input);
    }
  }
}
