import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerAI } from "@/lib/ai";
import { checkRateLimit } from "@/lib/ai/rate-limit";

const bodySchema = z.object({
  transcript: z.string(),
  recordingId: z.string(),
  segments: z
    .array(
      z.object({
        id: z.string(),
        startMs: z.number(),
        endMs: z.number(),
        text: z.string(),
        confidence: z.number().optional(),
      }),
    )
    .optional(),
  session: z
    .object({
      mode: z.string().optional(),
      difficulty: z.string().optional(),
      prompts: z.array(z.string()).optional(),
      durationSec: z.number().optional(),
    })
    .passthrough(),
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const ai = await getServerAI();
  const analysis = await ai.analyzeFreestyle({
    transcript: parsed.data.transcript,
    segments: parsed.data.segments,
    recordingId: parsed.data.recordingId,
    session: {
      prompts: parsed.data.session.prompts,
      durationSec: parsed.data.session.durationSec,
    },
  });

  return NextResponse.json(analysis);
}
