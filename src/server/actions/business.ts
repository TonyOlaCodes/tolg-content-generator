"use server";

import {
  AutomationKind,
  BusinessType,
  Industry,
  MemberRole,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/tenant";
import { slugify } from "@/lib/utils";
import {
  DETAILING_SERVICE_TEMPLATES,
  defaultOperatingHours,
  detailingIntakeFields,
} from "@/lib/industries";
import { pricing } from "@/lib/config/pricing";

const onboardingSchema = z.object({
  name: z.string().min(2),
  industry: z.nativeEnum(Industry),
  email: z.string().email(),
  phone: z.string().optional(),
  county: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  businessType: z.nativeEnum(BusinessType),
  timezone: z.string().default("Europe/Dublin"),
});

export async function createBusinessWorkspace(input: z.infer<typeof onboardingSchema>) {
  const user = await requireUser();
  const data = onboardingSchema.parse(input);

  let slug = slugify(data.name);
  const exists = await prisma.business.findUnique({ where: { slug } });
  if (exists) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  const templates =
    data.industry === Industry.CAR_DETAILING
      ? DETAILING_SERVICE_TEMPLATES
      : [
          {
            name: "Standard appointment",
            description: "Default service — customise in Services.",
            durationMinutes: 60,
            priceCents: 5000,
          },
        ];

  const business = await prisma.$transaction(async (tx) => {
    const b = await tx.business.create({
      data: {
        name: data.name,
        slug,
        industry: data.industry,
        email: data.email,
        phone: data.phone,
        county: data.county,
        city: data.city,
        address: data.address,
        businessType: data.businessType,
        timezone: data.timezone || "Europe/Dublin",
        members: { create: { userId: user.id, role: MemberRole.OWNER } },
        settings: {
          create: {
            operatingHoursJson: defaultOperatingHours(),
            intakeFieldsJson:
              data.industry === Industry.CAR_DETAILING ? detailingIntakeFields() : [],
          },
        },
        subscription: {
          create: {
            plan: SubscriptionPlan.STARTER,
            status: SubscriptionStatus.TRIALING,
            setupFeeCents: Math.round(pricing.setupFeeEur * 100),
          },
        },
        availability: {
          create: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
            dayOfWeek: day,
            startTime: "09:00",
            endTime: "18:00",
            isClosed: day === 0,
          })),
        },
        automations: {
          create: [
            { kind: AutomationKind.OWNER_NEW_ENQUIRY, enabled: true },
            { kind: AutomationKind.OWNER_UNANSWERED_REMINDER, enabled: true, delayMinutes: 120 },
            { kind: AutomationKind.CUSTOMER_APPOINTMENT_REMINDER, enabled: true, delayMinutes: 1440 },
            { kind: AutomationKind.QUOTE_FOLLOW_UP_FLAG, enabled: true, delayMinutes: 2880 },
          ],
        },
        services: {
          create: templates.map((s, i) => ({
            name: s.name,
            description: s.description,
            durationMinutes: s.durationMinutes,
            priceCents: s.priceCents,
            sortOrder: i,
          })),
        },
      },
    });
    await tx.auditLog.create({
      data: {
        businessId: b.id,
        actorUserId: user.id,
        action: "business.created",
        targetType: "Business",
        targetId: b.id,
      },
    });
    return b;
  });

  return { ok: true as const, businessId: business.id, slug: business.slug };
}
