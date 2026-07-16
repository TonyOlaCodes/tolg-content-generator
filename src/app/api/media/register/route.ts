import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { mediaTypeSchema } from "@/lib/validations/media";
import { registerUploadedMedia } from "@/server/services/media/upload";

export const runtime = "nodejs";
export const maxDuration = 60;

const registerSchema = z.object({
  type: mediaTypeSchema,
  blobUrl: z.string().url(),
  pathname: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().positive(),
  contentHash: z.string().min(16),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  thumbnailUrl: z.string().url().nullable().optional(),
  durationMs: z.number().int().nonnegative().nullable().optional(),
  year: z.number().int().min(1950).max(2100).nullable().optional(),
  title: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  tagIds: z.array(z.string()).optional().default([]),
  customTags: z.array(z.string()).optional().default([]),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const parsed = registerSchema.parse(json);

    const asset = await registerUploadedMedia({
      userId,
      ...parsed,
    });

    return NextResponse.json({
      ok: true,
      id: asset.id,
      fileName: asset.fileName,
      type: asset.type,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save upload";
    console.error("[register]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
