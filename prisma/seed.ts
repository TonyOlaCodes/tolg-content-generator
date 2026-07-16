import "dotenv/config";

import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { ALL_SYSTEM_TAGS } from "../src/lib/constants/tags";
import { FALLBACK_HOOK_TEMPLATES } from "../src/lib/constants/hooks";
import { DEFAULT_SETTINGS } from "../src/lib/constants/settings";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for seeding");
  }

  const email = (
    process.env.SEED_USER_EMAIL ?? "admin@tolg.local"
  ).toLowerCase();
  const password = process.env.SEED_USER_PASSWORD ?? "tolg-admin-change-me";
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: "TOLG Admin",
      passwordHash,
    },
    update: {
      passwordHash,
      name: "TOLG Admin",
    },
  });

  for (const tag of ALL_SYSTEM_TAGS) {
    await prisma.tag.upsert({
      where: {
        slug_category: { slug: tag.slug, category: tag.category },
      },
      create: {
        name: tag.name,
        slug: tag.slug,
        category: tag.category,
        isSystem: true,
      },
      update: {
        name: tag.name,
        isSystem: true,
      },
    });
  }

  // Clear and re-seed hook templates for idempotent seed of system content
  const existingHooks = await prisma.hookTemplate.count();
  if (existingHooks === 0) {
    await prisma.hookTemplate.createMany({
      data: FALLBACK_HOOK_TEMPLATES.map((hook) => ({
        category: hook.category,
        hookText: hook.hookText,
        themeMoodTags: hook.themeMoodTags,
        requiredPhotoCount: hook.requiredPhotoCount,
        photoRules: hook.photoRules,
        photoOrder: hook.photoOrder,
        preferredMatching: hook.preferredMatching,
        captionStyle: hook.captionStyle,
        isActive: true,
      })),
    });
  }

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.appSetting.upsert({
      where: { userId_key: { userId: user.id, key } },
      create: {
        userId: user.id,
        key,
        value,
        group: key.split(".")[0] ?? "general",
      },
      update: {},
    });
  }

  const providers = [
    "OPENAI",
    "TIKTOK",
    "CLOUDINARY",
    "RENDER_WORKER",
  ] as const;

  for (const provider of providers) {
    await prisma.externalConnection.upsert({
      where: {
        userId_provider: { userId: user.id, provider },
      },
      create: {
        userId: user.id,
        provider,
        isEnabled: false,
        statusMessage: "Not configured",
      },
      update: {},
    });
  }

  console.log("Seed complete");
  console.log(`  User: ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  System tags: ${ALL_SYSTEM_TAGS.length}`);
  console.log(`  Hook templates: ${FALLBACK_HOOK_TEMPLATES.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
