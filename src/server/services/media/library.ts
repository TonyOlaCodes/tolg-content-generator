import "server-only";

import type { MediaType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { deleteFromCloudinary } from "@/lib/cloudinary";
import { slugify } from "@/lib/utils";
import type { z } from "zod";
import type {
  bulkDeleteSchema,
  bulkTagSchema,
  mediaListQuerySchema,
  updateMediaTagsSchema,
} from "@/lib/validations/media";

type ListQuery = z.infer<typeof mediaListQuerySchema> & {
  userId: string;
  type: MediaType;
};

export async function listMedia(query: ListQuery) {
  const where: Prisma.MediaAssetWhereInput = {
    userId: query.userId,
    type: query.type,
    deletedAt: null,
  };

  if (query.search) {
    where.OR = [
      { fileName: { contains: query.search, mode: "insensitive" } },
      { originalFileName: { contains: query.search, mode: "insensitive" } },
      {
        musicMetadata: {
          title: { contains: query.search, mode: "insensitive" },
        },
      },
      {
        themeMetadata: {
          description: { contains: query.search, mode: "insensitive" },
        },
      },
    ];
  }

  if (query.tags.length > 0) {
    where.AND = query.tags.map((tagSlugOrId) => ({
      mediaTags: {
        some: {
          OR: [{ tagId: tagSlugOrId }, { tag: { slug: tagSlugOrId } }],
        },
      },
    }));
  }

  const orderBy: Prisma.MediaAssetOrderByWithRelationInput[] = (() => {
    switch (query.sort) {
      case "oldest":
        return [{ createdAt: "asc" }];
      case "name":
        return [{ fileName: "asc" }];
      case "usage":
        return [{ usageCount: "desc" }, { createdAt: "desc" }];
      case "lastUsed":
        return [{ lastUsedAt: "desc" }, { createdAt: "desc" }];
      default:
        return [{ createdAt: "desc" }];
    }
  })();

  const [total, items] = await Promise.all([
    prisma.mediaAsset.count({ where }),
    prisma.mediaAsset.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        physiqueMetadata: true,
        themeMetadata: true,
        musicMetadata: true,
        mediaTags: { include: { tag: true } },
      },
    }),
  ]);

  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function updateMediaTags(
  userId: string,
  input: z.infer<typeof updateMediaTagsSchema>,
) {
  const asset = await prisma.mediaAsset.findFirst({
    where: { id: input.mediaId, userId, deletedAt: null },
  });
  if (!asset) throw new Error("Media not found");

  const customIds: string[] = [];
  for (const name of input.customTags) {
    const slug = slugify(name);
    if (!slug) continue;
    const tag = await prisma.tag.upsert({
      where: { slug_category: { slug, category: "CUSTOM" } },
      create: { name, slug, category: "CUSTOM", isSystem: false },
      update: {},
    });
    customIds.push(tag.id);
  }

  const tagIds = [...new Set([...input.tagIds, ...customIds])];

  return prisma.$transaction(async (tx) => {
    await tx.mediaTag.deleteMany({ where: { mediaAssetId: asset.id } });
    if (tagIds.length) {
      await tx.mediaTag.createMany({
        data: tagIds.map((tagId) => ({
          mediaAssetId: asset.id,
          tagId,
          source: "manual",
        })),
      });
    }

    if (asset.type === "PHYSIQUE_PHOTO" && input.year !== undefined) {
      await tx.physiquePhotoMetadata.update({
        where: { mediaAssetId: asset.id },
        data: { year: input.year },
      });
    }

    if (asset.type === "THEME_IMAGE") {
      await tx.themeImageMetadata.update({
        where: { mediaAssetId: asset.id },
        data: {
          description:
            input.description !== undefined ? input.description : undefined,
          contentStyles: input.contentStyles,
          progressionConcepts: input.progressionConcepts,
        },
      });
    }

    if (asset.type === "MUSIC" && input.musicTitle) {
      await tx.musicMetadata.update({
        where: { mediaAssetId: asset.id },
        data: { title: input.musicTitle },
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

export async function bulkUpdateTags(
  userId: string,
  input: z.infer<typeof bulkTagSchema>,
) {
  const assets = await prisma.mediaAsset.findMany({
    where: {
      id: { in: input.mediaIds },
      userId,
      deletedAt: null,
    },
    select: { id: true },
  });

  const ids = assets.map((a) => a.id);

  await prisma.$transaction(async (tx) => {
    if (input.removeTagIds.length) {
      await tx.mediaTag.deleteMany({
        where: {
          mediaAssetId: { in: ids },
          tagId: { in: input.removeTagIds },
        },
      });
    }

    if (input.addTagIds.length) {
      for (const mediaAssetId of ids) {
        await tx.mediaTag.createMany({
          data: input.addTagIds.map((tagId) => ({
            mediaAssetId,
            tagId,
            source: "manual",
          })),
          skipDuplicates: true,
        });
      }
    }
  });

  return { updated: ids.length };
}

export async function bulkDeleteMedia(
  userId: string,
  input: z.infer<typeof bulkDeleteSchema>,
) {
  const assets = await prisma.mediaAsset.findMany({
    where: {
      id: { in: input.mediaIds },
      userId,
      deletedAt: null,
    },
  });

  for (const asset of assets) {
    try {
      await deleteFromCloudinary(
        asset.storagePublicId,
        asset.type === "MUSIC" ? "video" : "image",
      );
    } catch {
      // Soft-delete even if remote delete fails
    }
  }

  await prisma.mediaAsset.updateMany({
    where: { id: { in: assets.map((a) => a.id) }, userId },
    data: { deletedAt: new Date() },
  });

  return { deleted: assets.length };
}

export async function getMediaStats(userId: string) {
  const [theme, physique, music, drafts, approved] = await Promise.all([
    prisma.mediaAsset.count({
      where: { userId, type: "THEME_IMAGE", deletedAt: null },
    }),
    prisma.mediaAsset.count({
      where: { userId, type: "PHYSIQUE_PHOTO", deletedAt: null },
    }),
    prisma.mediaAsset.count({
      where: { userId, type: "MUSIC", deletedAt: null },
    }),
    prisma.draft.count({ where: { userId } }),
    prisma.draft.count({ where: { userId, status: "APPROVED" } }),
  ]);

  return { theme, physique, music, drafts, approved };
}
