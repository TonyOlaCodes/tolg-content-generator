import "server-only";

import { del, put } from "@vercel/blob";
import sharp from "sharp";

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function getBlobConfigStatus(): {
  configured: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    missing.push("BLOB_READ_WRITE_TOKEN");
  }
  return { configured: missing.length === 0, missing };
}

export type StorageUploadResult = {
  publicId: string;
  url: string;
  secureUrl: string;
  width?: number;
  height?: number;
  bytes: number;
  contentType?: string;
  thumbnailUrl?: string | null;
};

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
}

/** Upload original file to Vercel Blob. Does not crop or mutate the source. */
export async function uploadOriginalToBlob(
  buffer: Buffer,
  options: {
    folder: string;
    fileName: string;
    contentHash: string;
    contentType: string;
  },
): Promise<StorageUploadResult> {
  if (!isBlobConfigured()) {
    throw new Error(
      "Vercel Blob is not configured. Missing BLOB_READ_WRITE_TOKEN.",
    );
  }

  const safeName = sanitizeFileName(options.fileName) || "file";
  const pathname = `${options.folder}/${options.contentHash.slice(0, 16)}-${safeName}`;

  const blob = await put(pathname, buffer, {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    contentType: options.contentType || undefined,
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  return {
    publicId: blob.pathname,
    url: blob.url,
    secureUrl: blob.url,
    bytes: buffer.byteLength,
    contentType: blob.contentType,
  };
}

/**
 * Create a separate non-destructive thumbnail from an image buffer.
 * Original upload is never overwritten.
 */
export async function uploadImageThumbnailToBlob(
  buffer: Buffer,
  contentHash: string,
): Promise<string | null> {
  if (!isBlobConfigured()) return null;

  try {
    const thumb = await sharp(buffer)
      .rotate()
      .resize({
        width: 400,
        height: 400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();

    const blob = await put(`tolg/thumbs/${contentHash.slice(0, 16)}.webp`, thumb, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: "image/webp",
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    return blob.url;
  } catch {
    return null;
  }
}

export async function deleteFromBlob(pathnameOrUrl: string): Promise<void> {
  if (!isBlobConfigured()) return;
  await del(pathnameOrUrl, { token: process.env.BLOB_READ_WRITE_TOKEN });
}
