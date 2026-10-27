"use server";

import { AppointmentStatus } from "@prisma/client";
import { z } from "zod";
import { addMinutes } from "date-fns";
import { prisma } from "@/lib/db";
import { assertBusinessAccess } from "@/lib/tenant";
import { hasAppointmentConflict } from "@/lib/appointments/conflicts";
import { brandedEmail, sendBusinessEmail } from "@/lib/notifications/email";
import { revalidatePath } from "next/cache";

const createSchema = z.object({
  businessId: z.string(),
  customerId: z.string(),
  serviceId: z.string().optional(),
  startsAt: z.string(),
  durationMinutes: z.number().int().min(15),
  status: z.nativeEnum(AppointmentStatus).default(AppointmentStatus.CONFIRMED),
  locationType: z.enum(["MOBILE", "PREMISES"]).optional(),
  locationText: z.string().optional(),
  notes: z.string().optional(),
});

export async function createAppointment(input: z.infer<typeof createSchema>) {
  const data = createSchema.parse(input);
  const { business } = await assertBusinessAccess(data.businessId);
  const startsAt = new Date(data.startsAt);
  const endsAt = addMinutes(startsAt, data.durationMinutes);
  const settings = await prisma.businessSettings.findUnique({ where: { businessId: business.id } });
  const bufferedEnd = addMinutes(endsAt, settings?.bufferMinutes ?? 15);

  if (await hasAppointmentConflict({ businessId: business.id, startsAt, endsAt: bufferedEnd })) {
    return { error: "Conflicts with an existing appointment." };
  }

  const appt = await prisma.appointment.create({
    data: {
      businessId: business.id,
      customerId: data.customerId,
      serviceId: data.serviceId,
      startsAt,
      endsAt,
      status: data.status,
      locationType: data.locationType,
      locationText: data.locationText,
      notes: data.notes,
    },
    include: { customer: true, service: true },
  });

  if (settings?.sendBookingConfirm && appt.customer.email && appt.status === "CONFIRMED") {
    await sendBusinessEmail({
      businessId: business.id,
      eventType: "booking.confirmation",
      to: appt.customer.email,
      subject: `Booking confirmed — ${business.name}`,
      html: brandedEmail({
        businessName: business.name,
        accent: business.brandingColor,
        title: "Booking confirmed",
        body: `<p>Hi ${appt.customer.name}, your booking is confirmed for ${startsAt.toISOString()}.</p>`,
      }),
    });
  }

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/calendar");
  return { ok: true as const, id: appt.id };
}

export async function updateAppointmentStatus(
  businessId: string,
  appointmentId: string,
  status: AppointmentStatus,
) {
  const { business } = await assertBusinessAccess(businessId);
  const appt = await prisma.appointment.update({
    where: { id: appointmentId, businessId },
    data: { status },
    include: { customer: true },
  });

  if (status === "CANCELLED" && appt.customer.email) {
    await sendBusinessEmail({
      businessId: business.id,
      eventType: "booking.cancellation",
      to: appt.customer.email,
      subject: `Booking cancelled — ${business.name}`,
      html: brandedEmail({
        businessName: business.name,
        accent: business.brandingColor,
        title: "Booking cancelled",
        body: `<p>Hi ${appt.customer.name}, your booking has been cancelled. Contact us if you need to reschedule.</p>`,
      }),
    });
  }

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/calendar");
  return { ok: true };
}
