"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertBusinessAccess } from "@/lib/tenant";
import { revalidatePath } from "next/cache";

const serviceSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  durationMinutes: z.number().int().min(15).max(24 * 60),
  priceCents: z.number().int().min(0).optional().nullable(),
  isActive: z.boolean().default(true),
});

export async function upsertService(
  businessId: string,
  input: z.infer<typeof serviceSchema> & { id?: string },
) {
  await assertBusinessAccess(businessId);
  const data = serviceSchema.parse(input);
  if (input.id) {
    await prisma.service.update({
      where: { id: input.id, businessId },
      data,
    });
  } else {
    await prisma.service.create({
      data: { ...data, businessId },
    });
  }
  revalidatePath("/dashboard/services");
  revalidatePath(`/book`);
  return { ok: true };
}

export async function deleteService(businessId: string, serviceId: string) {
  await assertBusinessAccess(businessId);
  await prisma.service.update({
    where: { id: serviceId, businessId },
    data: { isActive: false },
  });
  revalidatePath("/dashboard/services");
  return { ok: true };
}
