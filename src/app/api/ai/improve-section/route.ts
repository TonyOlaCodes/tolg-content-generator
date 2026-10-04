import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerAI } from "@/lib/ai";
import { checkRateLimit } from "@/lib/ai/rate-limit";

const bodySchema = z.object({
  section: z.string().min(1),
  surrounding: z.string().default(""),
  transcript: z.string().default(""),
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!checkRateLimit(`improve:${ip}`)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const ai = await getServerAI();
  const reply = await ai.improveSection(parsed.data);
  return NextResponse.json({ reply });
}
