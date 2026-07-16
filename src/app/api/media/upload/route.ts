import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { mediaTypeSchema } from "@/lib/validations/media";
import { uploadMediaAsset } from "@/server/services/media/upload";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const typeRaw = formData.get("type");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "No file provided" },
        { status: 400 },
      );
    }

    const type = mediaTypeSchema.parse(typeRaw);
    const yearRaw = formData.get("year");
    const yearParsed =
      yearRaw && String(yearRaw).trim().length
        ? Number(String(yearRaw).trim())
        : null;
    const year =
      yearParsed !== null && Number.isFinite(yearParsed) ? yearParsed : null;

    const title = formData.get("title");
    const description = formData.get("description");
    const tagIdsRaw = formData.get("tagIds");
    const customTagsRaw = formData.get("customTags");

    let tagIds: string[] = [];
    let customTags: string[] = [];
    try {
      if (typeof tagIdsRaw === "string" && tagIdsRaw) {
        tagIds = JSON.parse(tagIdsRaw) as string[];
      }
      if (typeof customTagsRaw === "string" && customTagsRaw) {
        customTags = JSON.parse(customTagsRaw) as string[];
      }
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid tag payload" },
        { status: 400 },
      );
    }

    const asset = await uploadMediaAsset({
      userId,
      file,
      type,
      year,
      title: typeof title === "string" ? title : undefined,
      description: typeof description === "string" ? description : undefined,
      tagIds,
      customTags,
    });

    return NextResponse.json({
      ok: true,
      id: asset.id,
      fileName: asset.fileName,
      type: asset.type,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upload failed";
    console.error("[upload]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
