import { z } from "zod";

export const mediaTypeSchema = z.enum([
  "THEME_IMAGE",
  "PHYSIQUE_PHOTO",
  "MUSIC",
]);

export const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const MUSIC_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
] as const;

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_MUSIC_BYTES = 50 * 1024 * 1024; // 50 MB

export const mediaListQuerySchema = z.object({
  type: mediaTypeSchema.optional(),
  search: z.string().max(200).optional().default(""),
  tags: z.array(z.string()).optional().default([]),
  sort: z
    .enum(["newest", "oldest", "name", "usage", "lastUsed"])
    .optional()
    .default("newest"),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(24),
});

export const updateMediaTagsSchema = z.object({
  mediaId: z.string().cuid(),
  tagIds: z.array(z.string().cuid()),
  customTags: z.array(z.string().min(1).max(64)).optional().default([]),
  year: z.number().int().min(1950).max(2100).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  contentStyles: z.array(z.string().max(64)).optional(),
  progressionConcepts: z.array(z.string().max(128)).optional(),
  musicTitle: z.string().max(200).optional(),
  moodTagIds: z.array(z.string().cuid()).optional(),
});

export const bulkTagSchema = z.object({
  mediaIds: z.array(z.string().cuid()).min(1).max(100),
  addTagIds: z.array(z.string().cuid()).optional().default([]),
  removeTagIds: z.array(z.string().cuid()).optional().default([]),
});

export const bulkDeleteSchema = z.object({
  mediaIds: z.array(z.string().cuid()).min(1).max(100),
});

export const createCustomTagSchema = z.object({
  name: z.string().min(1).max(64),
  category: z
    .enum([
      "TIME",
      "PHASE",
      "QUALITY",
      "PHYSIQUE",
      "POSE",
      "ANGLE",
      "LOCATION",
      "EXPRESSION",
      "THEME_MOOD",
      "THEME_STYLE",
      "THEME_CONCEPT",
      "MUSIC_MOOD",
      "CUSTOM",
    ])
    .default("CUSTOM"),
});
