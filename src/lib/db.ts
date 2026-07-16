import "server-only";

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

function createPrismaClient() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  // channel_binding=require can break Node pg with Neon pooler
  const connectionString = rawUrl.replace(/([?&])channel_binding=require&?/g, "$1").replace(/[?&]$/, "");

  // Use a Pool so concurrent queries (uploads + metadata + tags) don't
  // crash a single shared pg Client (common with Neon + Prisma adapter).
  const pool =
    globalForPrisma.pgPool ??
    new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 15_000,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pgPool = pool;
  }

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
