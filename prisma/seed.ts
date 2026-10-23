import {
  AppointmentStatus,
  AutomationKind,
  BusinessType,
  EnquirySource,
  EnquiryStatus,
  Industry,
  MemberRole,
  PlatformRole,
  PrismaClient,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, addHours, setHours, setMinutes } from "date-fns";
import {
  DETAILING_SERVICE_TEMPLATES,
  defaultOperatingHours,
  detailingIntakeFields,
} from "../src/lib/industries";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);
  const demoSlug = process.env.DEMO_BUSINESS_SLUG || "cleancar-demo";

  const admin = await prisma.user.upsert({
    where: { email: "admin@detailflow.ie" },
    update: {},
    create: {
      email: "admin@detailflow.ie",
      name: "Platform Admin",
      passwordHash,
      platformRole: PlatformRole.PLATFORM_ADMIN,
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: "demo@cleancar.ie" },
    update: {},
    create: {
      email: "demo@cleancar.ie",
      name: "Aoife Byrne",
      passwordHash,
      platformRole: PlatformRole.USER,
    },
  });

  await prisma.business.deleteMany({ where: { slug: demoSlug } });

  const business = await prisma.business.create({
    data: {
      name: "CleanCar Mobile Detailing",
      slug: demoSlug,
      industry: Industry.CAR_DETAILING,
      email: "hello@cleancar.ie",
      phone: "+353 87 000 0000",
      county: "Dublin",
      city: "Dublin",
      address: "Greater Dublin Area",
      businessType: BusinessType.MOBILE,
      timezone: "Europe/Dublin",
      brandingColor: "#C9A227",
      isDemo: true,
      settings: {
        create: {
          operatingHoursJson: defaultOperatingHours(),
          intakeFieldsJson: detailingIntakeFields(),
          bufferMinutes: 15,
        },
      },
      subscription: {
        create: {
          plan: SubscriptionPlan.GROWTH,
          status: SubscriptionStatus.TRIALING,
          setupFeeCents: 14900,
        },
      },
      members: {
        create: { userId: owner.id, role: MemberRole.OWNER },
      },
      availability: {
        create: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
          dayOfWeek: day,
          startTime: day === 0 ? "00:00" : "09:00",
          endTime: day === 0 ? "00:00" : day === 6 ? "16:00" : "18:00",
          isClosed: day === 0,
        })),
      },
      automations: {
        create: [
          { kind: AutomationKind.OWNER_NEW_ENQUIRY, enabled: true, delayMinutes: 0 },
          { kind: AutomationKind.OWNER_UNANSWERED_REMINDER, enabled: true, delayMinutes: 120 },
          { kind: AutomationKind.CUSTOMER_APPOINTMENT_REMINDER, enabled: true, delayMinutes: 1440 },
          { kind: AutomationKind.QUOTE_FOLLOW_UP_FLAG, enabled: true, delayMinutes: 2880 },
        ],
      },
    },
  });

  const services = await Promise.all(
    DETAILING_SERVICE_TEMPLATES.map((s, i) =>
      prisma.service.create({
        data: {
          businessId: business.id,
          name: s.name,
          description: s.description,
          durationMinutes: s.durationMinutes,
          priceCents: s.priceCents,
          sortOrder: i,
        },
      }),
    ),
  );

  const customers = await Promise.all(
    [
      { name: "Sean Murphy", email: "sean.demo@example.com", phone: "+353 86 111 1111" },
      { name: "Ciara O'Neill", email: "ciara.demo@example.com", phone: "+353 85 222 2222" },
      { name: "Tom Walsh", email: "tom.demo@example.com", phone: "+353 87 333 3333" },
    ].map((c) =>
      prisma.customer.create({
        data: {
          businessId: business.id,
          ...c,
          notes: "Demonstration customer — not a real person.",
          vehicles: {
            create: { make: "Toyota", model: "Corolla", size: "Medium", condition: "Average" },
          },
        },
      }),
    ),
  );

  const now = new Date();
  const e1 = await prisma.enquiry.create({
    data: {
      businessId: business.id,
      customerId: customers[0]!.id,
      serviceId: services[2]!.id,
      source: EnquirySource.DEMO,
      status: EnquiryStatus.NEW,
      message: "Need a full detail before a wedding next weekend. Can you come to Ballsbridge?",
      preferredDate: addDays(now, 3),
      preferredTime: "10:00",
      locationType: "MOBILE",
      locationText: "Ballsbridge, Dublin 4",
      intakeJson: { vehicleMake: "BMW", vehicleModel: "3 Series", vehicleSize: "Large" },
      activities: {
        create: { type: "created", body: "Demo enquiry submitted from public booking page." },
      },
    },
  });

  await prisma.enquiry.create({
    data: {
      businessId: business.id,
      customerId: customers[1]!.id,
      serviceId: services[0]!.id,
      source: EnquirySource.DEMO,
      status: EnquiryStatus.AWAITING_RESPONSE,
      message: "Looking for exterior wash mid-week.",
      preferredDate: addDays(now, 2),
      preferredTime: "14:00",
      nextFollowUpAt: addHours(now, 2),
      lastContactAt: addHours(now, -20),
      activities: {
        create: [
          { type: "created", body: "Enquiry received." },
          { type: "status_change", body: "Marked awaiting response." },
        ],
      },
    },
  });

  await prisma.enquiry.create({
    data: {
      businessId: business.id,
      customerId: customers[2]!.id,
      serviceId: services[1]!.id,
      source: EnquirySource.INSTAGRAM,
      status: EnquiryStatus.QUOTED,
      message: "Interior clean after dog hair — quote please.",
      nextFollowUpAt: addDays(now, 1),
      activities: {
        create: { type: "note", body: "Quoted €65. Waiting on confirmation." },
      },
    },
  });

  const start = setMinutes(setHours(addDays(now, 1), 11), 0);
  await prisma.appointment.create({
    data: {
      businessId: business.id,
      customerId: customers[1]!.id,
      serviceId: services[0]!.id,
      enquiryId: e1.id,
      status: AppointmentStatus.CONFIRMED,
      startsAt: start,
      endsAt: addHours(start, 1.5),
      locationType: "MOBILE",
      locationText: "Sandymount",
      notes: "Demo confirmed appointment.",
    },
  });

  await prisma.appointment.create({
    data: {
      businessId: business.id,
      customerId: customers[2]!.id,
      serviceId: services[3]!.id,
      status: AppointmentStatus.REQUESTED,
      startsAt: setMinutes(setHours(addDays(now, 4), 9), 30),
      endsAt: setMinutes(setHours(addDays(now, 4), 10), 45),
      locationType: "MOBILE",
      locationText: "Rathmines",
    },
  });

  console.log("Seed complete");
  console.log({
    admin: admin.email,
    demoOwner: owner.email,
    password: "password123",
    demoSlug,
    note: "All demo customers and enquiries are fictional.",
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
