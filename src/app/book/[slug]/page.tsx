import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { BookingForm, type IntakeField } from "@/components/booking/booking-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await prisma.business.findUnique({
    where: { slug },
    include: {
      settings: true,
      services: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });
  if (!business) notFound();

  const rawIntake = business.settings?.intakeFieldsJson;
  const intakeFields: IntakeField[] = Array.isArray(rawIntake)
    ? (rawIntake as IntakeField[])
    : [];

  const locationOptions: ("MOBILE" | "PREMISES")[] =
    business.businessType === "MOBILE"
      ? ["MOBILE"]
      : business.businessType === "PREMISES"
        ? ["PREMISES"]
        : ["MOBILE", "PREMISES"];

  const accent = business.brandingColor || "#C9A227";

  return (
    <div className="min-h-dvh">
      <div
        className="border-b border-white/10 px-4 py-12"
        style={{
          background: `radial-gradient(800px 320px at 20% 0%, ${accent}33, transparent 55%)`,
        }}
      >
        <div className="mx-auto max-w-2xl animate-fade-up">
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: accent }}>
            Book with
          </p>
          <h1 className="mt-2 font-display text-4xl md:text-5xl">{business.name}</h1>
          <p className="mt-3 max-w-xl text-white/65">
            Request a service below. Your submission is a request only — not a confirmed
            appointment until the business confirms.
          </p>
          {business.isDemo ? (
            <p className="mt-3 text-xs text-[var(--accent)]">
              Demonstration business — all data is fictional.
            </p>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Booking request</CardTitle>
          </CardHeader>
          <CardContent>
            <BookingForm
              businessSlug={business.slug}
              businessName={business.name}
              accent={accent}
              services={business.services}
              intakeFields={intakeFields}
              locationOptions={locationOptions}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
