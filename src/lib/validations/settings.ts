import { z } from "zod";

export const updateSettingsSchema = z.object({
  settings: z.record(z.string(), z.unknown()),
});

export const connectionConfigSchema = z.object({
  provider: z.enum(["OPENAI", "TIKTOK", "CLOUDINARY", "RENDER_WORKER"]),
  isEnabled: z.boolean().optional(),
  configPublic: z.record(z.string(), z.unknown()).optional(),
  secretValue: z.string().optional(),
});
