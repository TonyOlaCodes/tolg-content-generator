"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import {
  bulkDeleteSchema,
  bulkTagSchema,
  mediaListQuerySchema,
  mediaTypeSchema,
  updateMediaTagsSchema,
} from "@/lib/validations/media";
import {
  bulkDeleteMedia,
  bulkUpdateTags,
  listMedia,
  updateMediaTags,
} from "@/server/services/media/library";
import { uploadMediaAsset } from "@/server/services/media/upload";

export async function uploadMediaAction(formData: FormData) {
  const user = await requireUser();
  const file = formData.get("file");
  const typeRaw = formData.get("type");
  if (!(file instanceof File)) {
    return { ok: false as const, error: "No file provided" };
  }

  const type = mediaTypeSchema.parse(typeRaw);
  const yearRaw = formData.get("year");
  const year =
    yearRaw && String(yearRaw).length
      ? Number(yearRaw)
      : null;
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
    return { ok: false as const, error: "Invalid tag payload" };
  }

  try {
    const asset = await uploadMediaAsset({
      userId: user.id!,
      file,
      type,
      year,
      title: typeof title === "string" ? title : undefined,
      description: typeof description === "string" ? description : undefined,
      tagIds,
      customTags,
    });
    revalidatePath("/media");
    revalidatePath("/dashboard");
    revalidatePath("/upload");
    return { ok: true as const, asset };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

export async function listMediaAction(input: unknown) {
  const user = await requireUser();
  const parsed = mediaListQuerySchema.parse(input);
  if (!parsed.type) {
    throw new Error("Media type is required");
  }
  return listMedia({
    ...parsed,
    type: parsed.type,
    userId: user.id!,
  });
}

export async function updateMediaTagsAction(input: unknown) {
  const user = await requireUser();
  const parsed = updateMediaTagsSchema.parse(input);
  const asset = await updateMediaTags(user.id!, parsed);
  revalidatePath("/media");
  return { ok: true as const, asset };
}

export async function bulkTagAction(input: unknown) {
  const user = await requireUser();
  const parsed = bulkTagSchema.parse(input);
  const result = await bulkUpdateTags(user.id!, parsed);
  revalidatePath("/media");
  return { ok: true as const, ...result };
}

export async function bulkDeleteAction(input: unknown) {
  const user = await requireUser();
  const parsed = bulkDeleteSchema.parse(input);
  const result = await bulkDeleteMedia(user.id!, parsed);
  revalidatePath("/media");
  revalidatePath("/dashboard");
  return { ok: true as const, ...result };
}
