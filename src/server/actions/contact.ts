"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  business: z.string().optional(),
  message: z.string().min(10),
  website: z.string().optional(),
});

export async function submitContactRequest(input: z.infer<typeof schema>) {
  const data = schema.parse(input);
  if (data.website) return { ok: true as const, ignored: true };

  if (!checkRateLimit(`contact:${data.email}`, 5, 60_000)) {
    return { error: "Too many requests. Please wait a minute." };
  }

  const row = await prisma.contactRequest.create({
    data: {
      name: data.name,
      email: data.email.toLowerCase(),
      business: data.business || null,
      message: data.message,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "contact.submitted",
      targetType: "ContactRequest",
      targetId: row.id,
      metaJson: { email: data.email, business: data.business },
    },
  });

  return { ok: true as const };
}
