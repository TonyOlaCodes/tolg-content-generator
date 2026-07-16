import "server-only";

import sharp from "sharp";
import { parseBuffer } from "music-metadata";

import {
  deleteFromBlob,
  getBlobConfigStatus,
  uploadImageThumbnailToBlob,
  uploadOriginalToBlob,
} from "@/lib/storage";
import { prisma } from "@/lib/db";
import { hashFileBuffer } from "@/lib/crypto";
import {
  computeAspectRatio,
  detectOrientation,
  slugify,
} from "@/lib/utils";
import {
  IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  MAX_MUSIC_BYTES,
  MUSIC_MIME_TYPES,
  mediaTypeSchema,
} from "@/lib/validations/media";
import type { MediaType, Orientation } from "@/generated/prisma/client";

export type UploadInput = {
  userId: string;
  file: File;
  type: MediaType;
  year?: number | null;
  title?: string;
  tagIds?: string[];
  customTags?: string[];
  description?: string;
};

function inferMimeType(file: File): string {
  if (file.type) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".heif")) return "image/heif";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  return "";
}

function assertFileAllowed(type: MediaType, mimeType: string, size: number) {
  if (type === "MUSIC") {
    const ok =
      MUSIC_MIME_TYPES.includes(mimeType as (typeof MUSIC_MIME_TYPES)[number]) ||
      mimeType.startsWith("audio/");
    if (!ok) {
      throw new Error(
        `Unsupported music type: ${mimeType || "unknown"}. Use MP3, WAV, or M4A.`,
      );
    }
    if (size > MAX_MUSIC_BYTES) {
      throw new Error("Music file exceeds 50 MB limit.");
    }
    return;
  }

  const normalized = mimeType === "image/jpg" ? "image/jpeg" : mimeType;
  const ok =
    IMAGE_MIME_TYPES.includes(
      normalized as (typeof IMAGE_MIME_TYPES)[number],
    ) || normalized.startsWith("image/");
  if (!ok) {
    throw new Error(`Unsupported image type: ${mimeType || "unknown"}`);
  }
  if (size > MAX_IMAGE_BYTES) {
    throw new Error("Image exceeds 25 MB limit.");
  }
}

async function resolveCustomTags(names: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const name of names) {
    const slug = slugify(name);
    if (!slug) continue;
    const tag = await prisma.tag.upsert({
      where: { slug_category: { slug, category: "CUSTOM" } },
      create: { name, slug, category: "CUSTOM", isSystem: false },
      update: {},
    });
    ids.push(tag.id);
  }
  return ids;
}

export async function uploadMediaAsset(input: UploadInput) {
  const type = mediaTypeSchema.parse(input.type);
  const blobStatus = getBlobConfigStatus();
  if (!blobStatus.configured) {
    throw new Error(
      `Vercel Blob configuration required. Missing: ${blobStatus.missing.join(", ")}`,
    );
  }

  const mimeType = inferMimeType(input.file);
  const buffer = Buffer.from(await input.file.arrayBuffer());
  assertFileAllowed(type, mimeType, buffer.byteLength);

  const contentHash = hashFileBuffer(buffer);
  const existing = await prisma.mediaAsset.findUnique({
    where: {
      userId_contentHash: { userId: input.userId, contentHash },
    },
  });
  if (existing && !existing.deletedAt) {
    throw new Error("Duplicate file already exists in your library.");
  }

  let width: number | undefined;
  let height: number | undefined;
  let aspectRatio: number | undefined;
  let orientation: Orientation | undefined;
  let durationMs = 0;

  if (type !== "MUSIC") {
    try {
      const meta = await sharp(buffer).rotate().metadata();
      width = meta.width;
      height = meta.height;
      if (width && height) {
        aspectRatio = computeAspectRatio(width, height);
        orientation = detectOrientation(width, height);
      }
    } catch {
      throw new Error(
        "Could not read this image. Try JPEG or PNG (HEIC may need conversion).",
      );
    }
  } else {
    try {
      const meta = await parseBuffer(buffer, { mimeType });
      if (meta.format.duration) {
        durationMs = Math.round(meta.format.duration * 1000);
      }
    } catch {
      durationMs = 0;
    }
  }

  const folder =
    type === "THEME_IMAGE"
      ? "tolg/theme"
      : type === "PHYSIQUE_PHOTO"
        ? "tolg/physique"
        : "tolg/music";

  const uploaded = await uploadOriginalToBlob(buffer, {
    folder,
    fileName: input.file.name,
    contentHash,
    contentType: mimeType || "application/octet-stream",
  });

  const thumbnailUrl =
    type === "MUSIC"
      ? null
      : await uploadImageThumbnailToBlob(buffer, contentHash);

  const customTagIds = await resolveCustomTags(input.customTags ?? []);
  const allTagIds = [...new Set([...(input.tagIds ?? []), ...customTagIds])];

  // Avoid interactive $transaction — Neon pooled connections break them.
  const asset = await prisma.mediaAsset.create({
    data: {
      userId: input.userId,
      type,
      fileName: input.file.name,
      originalFileName: input.file.name,
      mimeType: mimeType || "application/octet-stream",
      fileSizeBytes: buffer.byteLength,
      storageProvider: "vercel-blob",
      storagePublicId: uploaded.publicId,
      storageUrl: uploaded.secureUrl,
      thumbnailUrl,
      width: width ?? null,
      height: height ?? null,
      aspectRatio: aspectRatio ?? null,
      contentHash,
    },
  });

  try {
    if (type === "PHYSIQUE_PHOTO") {
      await prisma.physiquePhotoMetadata.create({
        data: {
          mediaAssetId: asset.id,
          orientation: orientation ?? null,
          year: input.year ?? null,
        },
      });
    }

    if (type === "THEME_IMAGE") {
      await prisma.themeImageMetadata.create({
        data: {
          mediaAssetId: asset.id,
          description: input.description ?? null,
        },
      });
    }

    if (type === "MUSIC") {
      await prisma.musicMetadata.create({
        data: {
          mediaAssetId: asset.id,
          title: input.title?.trim() || input.file.name.replace(/\.[^.]+$/, ""),
          durationMs,
        },
      });
    }

    if (allTagIds.length > 0) {
      await prisma.mediaTag.createMany({
        data: allTagIds.map((tagId) => ({
          mediaAssetId: asset.id,
          tagId,
          source: "manual",
        })),
        skipDuplicates: true,
      });
    }
  } catch (error) {
    // Soft-clean DB row if metadata write fails after blob upload succeeded
    await prisma.mediaAsset
      .delete({ where: { id: asset.id } })
      .catch(() => undefined);
    throw error;
  }

  return prisma.mediaAsset.findUniqueOrThrow({
    where: { id: asset.id },
    include: {
      physiqueMetadata: true,
      themeMetadata: true,
      musicMetadata: true,
      mediaTags: { include: { tag: true } },
    },
  });
}

export { deleteFromBlob };
