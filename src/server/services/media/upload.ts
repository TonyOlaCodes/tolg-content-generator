import "server-only";

import sharp from "sharp";

import {
  buildThumbnailUrl,
  getCloudinaryConfigStatus,
  uploadToCloudinary,
} from "@/lib/cloudinary";
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

function assertFileAllowed(type: MediaType, mimeType: string, size: number) {
  if (type === "MUSIC") {
    if (!MUSIC_MIME_TYPES.includes(mimeType as (typeof MUSIC_MIME_TYPES)[number])) {
      throw new Error(`Unsupported music type: ${mimeType}. Use MP3, WAV, or M4A.`);
    }
    if (size > MAX_MUSIC_BYTES) {
      throw new Error("Music file exceeds 50 MB limit.");
    }
    return;
  }

  if (!IMAGE_MIME_TYPES.includes(mimeType as (typeof IMAGE_MIME_TYPES)[number])) {
    throw new Error(`Unsupported image type: ${mimeType}`);
  }
  if (size > MAX_IMAGE_BYTES) {
    throw new Error("Image exceeds 25 MB limit.");
  }
}

async function resolveCustomTags(
  userId: string,
  names: string[],
): Promise<string[]> {
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
    void userId;
  }
  return ids;
}

export async function uploadMediaAsset(input: UploadInput) {
  const type = mediaTypeSchema.parse(input.type);
  const cloudStatus = getCloudinaryConfigStatus();
  if (!cloudStatus.configured) {
    throw new Error(
      `Cloudinary configuration required. Missing: ${cloudStatus.missing.join(", ")}`,
    );
  }

  const buffer = Buffer.from(await input.file.arrayBuffer());
  assertFileAllowed(type, input.file.type, buffer.byteLength);

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

  if (type !== "MUSIC") {
    const meta = await sharp(buffer).metadata();
    width = meta.width;
    height = meta.height;
    if (width && height) {
      aspectRatio = computeAspectRatio(width, height);
      orientation = detectOrientation(width, height);
    }
  }

  const folder =
    type === "THEME_IMAGE"
      ? "tolg/theme"
      : type === "PHYSIQUE_PHOTO"
        ? "tolg/physique"
        : "tolg/music";

  const uploaded = await uploadToCloudinary(buffer, {
    folder,
    resourceType: type === "MUSIC" ? "video" : "image",
    mimeType: input.file.type,
  });

  const thumbnailUrl =
    type === "MUSIC"
      ? null
      : buildThumbnailUrl(uploaded.publicId, "image");

  const customTagIds = await resolveCustomTags(
    input.userId,
    input.customTags ?? [],
  );
  const allTagIds = [...new Set([...(input.tagIds ?? []), ...customTagIds])];

  return prisma.$transaction(async (tx) => {
    const asset = await tx.mediaAsset.create({
      data: {
        userId: input.userId,
        type,
        fileName: input.file.name,
        originalFileName: input.file.name,
        mimeType: input.file.type,
        fileSizeBytes: buffer.byteLength,
        storageProvider: "cloudinary",
        storagePublicId: uploaded.publicId,
        storageUrl: uploaded.secureUrl,
        thumbnailUrl,
        width: width ?? uploaded.width ?? null,
        height: height ?? uploaded.height ?? null,
        aspectRatio: aspectRatio ?? null,
        contentHash,
      },
    });

    if (type === "PHYSIQUE_PHOTO") {
      await tx.physiquePhotoMetadata.create({
        data: {
          mediaAssetId: asset.id,
          orientation: orientation ?? null,
          year: input.year ?? null,
        },
      });
    }

    if (type === "THEME_IMAGE") {
      await tx.themeImageMetadata.create({
        data: {
          mediaAssetId: asset.id,
          description: input.description ?? null,
        },
      });
    }

    if (type === "MUSIC") {
      await tx.musicMetadata.create({
        data: {
          mediaAssetId: asset.id,
          title: input.title?.trim() || input.file.name.replace(/\.[^.]+$/, ""),
          durationMs: uploaded.durationMs ?? 0,
        },
      });
    }

    if (allTagIds.length > 0) {
      await tx.mediaTag.createMany({
        data: allTagIds.map((tagId) => ({
          mediaAssetId: asset.id,
          tagId,
          source: "manual",
        })),
        skipDuplicates: true,
      });
    }

    return tx.mediaAsset.findUniqueOrThrow({
      where: { id: asset.id },
      include: {
        physiqueMetadata: true,
        themeMetadata: true,
        musicMetadata: true,
        mediaTags: { include: { tag: true } },
      },
    });
  });
}
