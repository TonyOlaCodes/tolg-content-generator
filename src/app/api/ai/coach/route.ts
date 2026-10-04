import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerAI } from "@/lib/ai";
import { checkRateLimit } from "@/lib/ai/rate-limit";

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .optional(),
  profileSummary: z.string().optional(),
  recentContext: z.string().optional(),
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!checkRateLimit(`coach:${ip}`)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const ai = await getServerAI();
  const reply = await ai.coach(parsed.data);
  return NextResponse.json({ reply });
}
