"use server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function getTagsAction() {
  await requireUser();
  return prisma.tag.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}
