"use server";

import { EnquiryStatus, AppointmentStatus } from "@prisma/client";
import { z } from "zod";
import { addMinutes } from "date-fns";
import { prisma } from "@/lib/db";
import { assertBusinessAccess } from "@/lib/tenant";
import { hasAppointmentConflict } from "@/lib/appointments/conflicts";
import { brandedEmail, sendBusinessEmail } from "@/lib/notifications/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { revalidatePath } from "next/cache";

const publicEnquirySchema = z.object({
  businessSlug: z.string().min(1),
  serviceId: z.string().min(1),
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  message: z.string().optional(),
  preferredDate: z.string().optional(),
  preferredTime: z.string().optional(),
  locationType: z.enum(["MOBILE", "PREMISES"]).optional(),
  locationText: z.string().optional(),
  intake: z.record(z.string()).optional(),
  website: z.string().optional(), // honeypot
});

export async function submitPublicEnquiry(input: z.infer<typeof publicEnquirySchema>) {
  const data = publicEnquirySchema.parse(input);
  if (data.website) return { ok: true as const, ignored: true };

  const ipKey = `enquiry:${data.businessSlug}:${data.email}`;
  if (!checkRateLimit(ipKey, 8, 60_000)) {
    return { error: "Too many requests. Please wait a minute and try again." };
  }

  const business = await prisma.business.findUnique({
    where: { slug: data.businessSlug },
    include: { settings: true },
  });
  if (!business) return { error: "Business not found." };

  const service = await prisma.service.findFirst({
    where: { id: data.serviceId, businessId: business.id, isActive: true },
  });
  if (!service) return { error: "Service not found." };

  const existingCustomer = await prisma.customer.findFirst({
    where: { businessId: business.id, email: data.email.toLowerCase() },
  });
  const customer = existingCustomer
    ? await prisma.customer.update({
        where: { id: existingCustomer.id },
        data: { name: data.name, phone: data.phone },
      })
    : await prisma.customer.create({
        data: {
          businessId: business.id,
          name: data.name,
          email: data.email.toLowerCase(),
          phone: data.phone,
        },
      });

  const intake = data.intake ?? {};
  if (intake.vehicleMake || intake.vehicleModel) {
    await prisma.customerVehicle.create({
      data: {
        customerId: customer.id,
        make: intake.vehicleMake,
        model: intake.vehicleModel,
        size: intake.vehicleSize,
        condition: intake.vehicleCondition,
      },
    });
  }

  const enquiry = await prisma.enquiry.create({
    data: {
      businessId: business.id,
      customerId: customer.id,
      serviceId: service.id,
      source: business.isDemo ? "DEMO" : "BOOKING_PAGE",
      status: "NEW",
      message: data.message,
      preferredDate: data.preferredDate ? new Date(data.preferredDate) : null,
      preferredTime: data.preferredTime,
      locationType: data.locationType,
      locationText: data.locationText,
      intakeJson: intake,
      activities: {
        create: { type: "created", body: "Booking request submitted." },
      },
    },
  });

  if (business.settings?.notifyOwnerOnEnquiry) {
    await sendBusinessEmail({
      businessId: business.id,
      eventType: "enquiry.owner_notification",
      to: business.email,
      subject: `New enquiry from ${customer.name}`,
      html: brandedEmail({
        businessName: business.name,
        accent: business.brandingColor,
        title: "New booking request",
        body: `<p><strong>${customer.name}</strong> requested <strong>${service.name}</strong>.</p>
        <p>${data.message || "No message provided."}</p>
        <p>Preferred: ${data.preferredDate || "n/a"} ${data.preferredTime || ""}</p>`,
      }),
    });
  }

  if (business.settings?.ackCustomerOnEnquiry && customer.email) {
    await sendBusinessEmail({
      businessId: business.id,
      eventType: "enquiry.customer_ack",
      to: customer.email,
      subject: `We received your request — ${business.name}`,
      html: brandedEmail({
        businessName: business.name,
        accent: business.brandingColor,
        title: "Thanks — we received your request",
        body: `<p>Hi ${customer.name},</p>
        <p>Thanks for requesting <strong>${service.name}</strong>. This is an acknowledgement, not a confirmed appointment. We'll be in touch shortly.</p>`,
      }),
    });
  }

  revalidatePath(`/book/${business.slug}`);
  revalidatePath("/dashboard/enquiries");
  revalidatePath("/demo");
  return { ok: true as const, enquiryId: enquiry.id };
}

export async function updateEnquiryStatus(businessId: string, enquiryId: string, status: EnquiryStatus) {
  await assertBusinessAccess(businessId);
  await prisma.enquiry.update({
    where: { id: enquiryId, businessId },
    data: {
      status,
      lastContactAt: new Date(),
      activities: {
        create: { type: "status_change", body: `Status changed to ${status}` },
      },
    },
  });
  revalidatePath("/dashboard/enquiries");
  return { ok: true };
}

export async function addEnquiryNote(businessId: string, enquiryId: string, body: string) {
  await assertBusinessAccess(businessId);
  await prisma.enquiryActivity.create({
    data: { enquiryId, type: "note", body },
  });
  await prisma.enquiry.update({
    where: { id: enquiryId, businessId },
    data: { updatedAt: new Date() },
  });
  revalidatePath(`/dashboard/enquiries/${enquiryId}`);
  return { ok: true };
}

export async function convertEnquiryToAppointment(input: {
  businessId: string;
  enquiryId: string;
  startsAt: string;
  durationMinutes?: number;
}) {
  const { business } = await assertBusinessAccess(input.businessId);
  const enquiry = await prisma.enquiry.findFirst({
    where: { id: input.enquiryId, businessId: input.businessId },
    include: { service: true, customer: true },
  });
  if (!enquiry) return { error: "Enquiry not found" };

  const startsAt = new Date(input.startsAt);
  const duration = input.durationMinutes ?? enquiry.service?.durationMinutes ?? 60;
  const endsAt = addMinutes(startsAt, duration);
  const buffer = (await prisma.businessSettings.findUnique({ where: { businessId: business.id } }))
    ?.bufferMinutes ?? 15;
  const endsWithBuffer = addMinutes(endsAt, buffer);

  if (
    await hasAppointmentConflict({
      businessId: business.id,
      startsAt,
      endsAt: endsWithBuffer,
    })
  ) {
    return { error: "Conflicts with an existing appointment (including buffer time)." };
  }

  const appointment = await prisma.$transaction(async (tx) => {
    const appt = await tx.appointment.create({
      data: {
        businessId: business.id,
        customerId: enquiry.customerId,
        serviceId: enquiry.serviceId,
        enquiryId: enquiry.id,
        status: AppointmentStatus.CONFIRMED,
        startsAt,
        endsAt,
        locationType: enquiry.locationType,
        locationText: enquiry.locationText,
        notes: enquiry.message,
      },
    });
    await tx.enquiry.update({
      where: { id: enquiry.id },
      data: {
        status: EnquiryStatus.BOOKED,
        activities: {
          create: { type: "converted", body: `Converted to confirmed appointment ${appt.id}` },
        },
      },
    });
    return appt;
  });

  if (enquiry.customer.email) {
    await sendBusinessEmail({
      businessId: business.id,
      eventType: "booking.confirmation",
      to: enquiry.customer.email,
      subject: `Booking confirmed — ${business.name}`,
      html: brandedEmail({
        businessName: business.name,
        accent: business.brandingColor,
        title: "Your booking is confirmed",
        body: `<p>Hi ${enquiry.customer.name},</p>
        <p>Your appointment for <strong>${enquiry.service?.name ?? "service"}</strong> is confirmed.</p>
        <p>When: ${startsAt.toISOString()}</p>`,
      }),
    });
  }

  revalidatePath("/dashboard/enquiries");
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/calendar");
  return { ok: true as const, appointmentId: appointment.id };
}
