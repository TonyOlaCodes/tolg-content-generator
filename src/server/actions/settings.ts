"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import {
  connectionConfigSchema,
  updateSettingsSchema,
} from "@/lib/validations/settings";
import {
  getSettings,
  listConnections,
  updateSettings,
  upsertConnection,
} from "@/server/services/settings";
import { getCloudinaryConfigStatus } from "@/lib/cloudinary";

export async function getSettingsAction() {
  const user = await requireUser();
  return getSettings(user.id!);
}

export async function updateSettingsAction(input: unknown) {
  const user = await requireUser();
  const parsed = updateSettingsSchema.parse(input);
  const settings = await updateSettings(user.id!, parsed.settings);
  revalidatePath("/settings");
  return { ok: true as const, settings };
}

export async function getConnectionsAction() {
  const user = await requireUser();
  const connections = await listConnections(user.id!);
  const cloudinaryEnv = getCloudinaryConfigStatus();
  return {
    connections,
    envStatus: {
      cloudinary: cloudinaryEnv,
      openai: {
        configured: Boolean(process.env.OPENAI_API_KEY),
        missing: process.env.OPENAI_API_KEY ? [] : ["OPENAI_API_KEY"],
      },
      tiktok: {
        configured: Boolean(
          process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET,
        ),
        missing: [
          ...(!process.env.TIKTOK_CLIENT_KEY ? ["TIKTOK_CLIENT_KEY"] : []),
          ...(!process.env.TIKTOK_CLIENT_SECRET
            ? ["TIKTOK_CLIENT_SECRET"]
            : []),
        ],
      },
      renderWorker: {
        configured: Boolean(process.env.RENDER_WORKER_URL),
        missing: process.env.RENDER_WORKER_URL ? [] : ["RENDER_WORKER_URL"],
      },
    },
  };
}

export async function upsertConnectionAction(input: unknown) {
  const user = await requireUser();
  const parsed = connectionConfigSchema.parse(input);
  await upsertConnection(user.id!, parsed);
  revalidatePath("/connections");
  return { ok: true as const };
}
