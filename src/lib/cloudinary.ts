import "server-only";

import { v2 as cloudinary } from "cloudinary";

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

export function getCloudinaryConfigStatus(): {
  configured: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!process.env.CLOUDINARY_CLOUD_NAME) missing.push("CLOUDINARY_CLOUD_NAME");
  if (!process.env.CLOUDINARY_API_KEY) missing.push("CLOUDINARY_API_KEY");
  if (!process.env.CLOUDINARY_API_SECRET) missing.push("CLOUDINARY_API_SECRET");
  return { configured: missing.length === 0, missing };
}

function ensureConfigured() {
  const status = getCloudinaryConfigStatus();
  if (!status.configured) {
    throw new Error(
      `Cloudinary is not configured. Missing: ${status.missing.join(", ")}`,
    );
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export type CloudinaryUploadResult = {
  publicId: string;
  url: string;
  secureUrl: string;
  width?: number;
  height?: number;
  bytes: number;
  format?: string;
  resourceType: string;
  durationMs?: number;
};

export async function uploadToCloudinary(
  buffer: Buffer,
  options: {
    folder: string;
    publicId?: string;
    resourceType?: "image" | "video" | "raw" | "auto";
    mimeType?: string;
  },
): Promise<CloudinaryUploadResult> {
  ensureConfigured();

  const resourceType = options.resourceType ?? "auto";

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        public_id: options.publicId,
        resource_type: resourceType,
        // Preserve originals — no destructive cropping
        overwrite: false,
        unique_filename: true,
        use_filename: true,
      },
      (error, result) => {
        if (error || !result) {
          const message =
            (error as { message?: string } | undefined)?.message ??
            (typeof error === "string" ? error : null) ??
            "Cloudinary upload failed";
          reject(new Error(message));
          return;
        }

        resolve({
          publicId: result.public_id,
          url: result.url,
          secureUrl: result.secure_url,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
          format: result.format,
          resourceType: result.resource_type,
          durationMs:
            typeof result.duration === "number"
              ? Math.round(result.duration * 1000)
              : undefined,
        });
      },
    );

    stream.end(buffer);
  });
}

/** Non-destructive thumbnail via Cloudinary transformation URL (original untouched). */
export function buildThumbnailUrl(
  publicId: string,
  resourceType: "image" | "video" | "raw" = "image",
): string {
  ensureConfigured();
  if (resourceType === "raw") {
    return cloudinary.url(publicId, { resource_type: "raw", secure: true });
  }
  return cloudinary.url(publicId, {
    resource_type: resourceType === "video" ? "video" : "image",
    transformation: [
      { width: 400, height: 400, crop: "limit" },
      { quality: "auto", fetch_format: "auto" },
    ],
    secure: true,
  });
}

export async function deleteFromCloudinary(
  publicId: string,
  resourceType: "image" | "video" | "raw" = "image",
): Promise<void> {
  ensureConfigured();
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}
