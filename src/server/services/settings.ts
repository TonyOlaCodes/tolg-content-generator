import "server-only";

import { prisma } from "@/lib/db";
import {
  DEFAULT_SETTINGS,
  type AppSettingsMap,
} from "@/lib/constants/settings";
import { encryptSecret } from "@/lib/crypto";
import type { ConnectionProvider, Prisma } from "@/generated/prisma/client";

export async function ensureDefaultSettings(userId: string) {
  const existing = await prisma.appSetting.findMany({ where: { userId } });
  const existingKeys = new Set(existing.map((s) => s.key));

  const creates = Object.entries(DEFAULT_SETTINGS)
    .filter(([key]) => !existingKeys.has(key))
    .map(([key, value]) => ({
      userId,
      key,
      value,
      group: key.split(".")[0] ?? "general",
    }));

  if (creates.length) {
    await prisma.appSetting.createMany({ data: creates });
  }
}

export async function getSettings(userId: string): Promise<AppSettingsMap> {
  await ensureDefaultSettings(userId);
  const rows = await prisma.appSetting.findMany({ where: { userId } });
  const map = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (row.key in map) {
      (map as Record<string, unknown>)[row.key] = row.value;
    }
  }
  return map;
}

export async function updateSettings(
  userId: string,
  settings: Record<string, unknown>,
) {
  await ensureDefaultSettings(userId);

  await prisma.$transaction(
    Object.entries(settings).map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { userId_key: { userId, key } },
        create: {
          userId,
          key,
          value: value as Prisma.InputJsonValue,
          group: key.split(".")[0] ?? "general",
        },
        update: { value: value as Prisma.InputJsonValue },
      }),
    ),
  );

  return getSettings(userId);
}

export async function listConnections(userId: string) {
  const providers: ConnectionProvider[] = [
    "OPENAI",
    "TIKTOK",
    "CLOUDINARY",
    "RENDER_WORKER",
  ];

  const rows = await prisma.externalConnection.findMany({ where: { userId } });
  const byProvider = new Map(rows.map((r) => [r.provider, r]));

  return providers.map((provider) => {
    const row = byProvider.get(provider);
    return {
      provider,
      isEnabled: row?.isEnabled ?? false,
      configPublic: row?.configPublic ?? null,
      hasSecret: Boolean(row?.secretsEncrypted),
      statusMessage: row?.statusMessage ?? null,
      lastVerifiedAt: row?.lastVerifiedAt ?? null,
    };
  });
}

export async function upsertConnection(
  userId: string,
  input: {
    provider: ConnectionProvider;
    isEnabled?: boolean;
    configPublic?: Record<string, unknown>;
    secretValue?: string;
  },
) {
  const secretsEncrypted = input.secretValue
    ? encryptSecret(input.secretValue)
    : undefined;

  const configPublic = input.configPublic as
    | Prisma.InputJsonValue
    | undefined;

  return prisma.externalConnection.upsert({
    where: {
      userId_provider: { userId, provider: input.provider },
    },
    create: {
      userId,
      provider: input.provider,
      isEnabled: input.isEnabled ?? false,
      configPublic,
      secretsEncrypted,
      statusMessage: secretsEncrypted
        ? "Credentials saved (encrypted)"
        : "Not configured",
    },
    update: {
      isEnabled: input.isEnabled,
      configPublic,
      ...(secretsEncrypted
        ? {
            secretsEncrypted,
            statusMessage: "Credentials saved (encrypted)",
          }
        : {}),
    },
  });
}
