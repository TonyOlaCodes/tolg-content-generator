import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import {
  ENQUIRY_STATUS_LABELS,
  APPOINTMENT_STATUS_LABELS,
  enquiryBadgeVariant,
  appointmentBadgeVariant,
} from "@/lib/status-labels";
import { ResetDemoButton } from "@/components/demo/reset-demo-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DemoPage() {
  const demoSlug = process.env.DEMO_BUSINESS_SLUG || "cleancar-demo";
  let business = await prisma.business.findFirst({
    where: { isDemo: true, slug: demoSlug },
    include: {
      enquiries: {
        include: { customer: true, service: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      appointments: {
        include: { customer: true, service: true },
        orderBy: { startsAt: "asc" },
        take: 5,
      },
      services: { where: { isActive: true }, take: 4 },
      _count: {
        select: { enquiries: true, appointments: true, customers: true },
      },
    },
  });

  // If seed missing, still render page with empty state + reset
  if (!business) {
    business = await prisma.business.findFirst({
      where: { isDemo: true },
      include: {
        enquiries: {
          include: { customer: true, service: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        appointments: {
          include: { customer: true, service: true },
          orderBy: { startsAt: "asc" },
          take: 5,
        },
        services: { where: { isActive: true }, take: 4 },
        _count: {
          select: { enquiries: true, appointments: true, customers: true },
        },
      },
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-12 animate-fade-up">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Interactive demo</p>
          <h1 className="mt-2 font-display text-4xl">CleanCar Mobile Detailing</h1>
          <p className="mt-2 max-w-2xl text-white/60">
            Fictional demonstration workspace. All customers, enquiries and appointments are sample
            data — not real people or bookings.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ResetDemoButton />
          {business ? (
            <Button asChild>
              <Link href={`/book/${business.slug}`}>Open booking page</Link>
            </Button>
          ) : null}
        </div>
      </div>

      {!business ? (
        <Card className="p-8 text-center">
          <p className="text-white/70">Demo business not loaded yet.</p>
          <p className="mt-2 text-sm text-white/45">
            Click “Reset demo data” to create the fictional CleanCar workspace, or run{" "}
            <code className="text-[var(--accent)]">npm run db:seed</code>.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs text-white/45">Enquiries (demo)</p>
              <p className="font-display text-3xl">{business._count.enquiries}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-white/45">Appointments (demo)</p>
              <p className="font-display text-3xl">{business._count.appointments}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-white/45">Customers (demo)</p>
              <p className="font-display text-3xl">{business._count.customers}</p>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Sample enquiry inbox</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-white/5">
                  {business.enquiries.map((e) => (
                    <li key={e.id} className="flex justify-between gap-2 py-3 text-sm">
                      <div>
                        <p className="font-medium">{e.customer.name}</p>
                        <p className="text-xs text-white/45">
                          {e.service?.name} · {formatDate(e.createdAt, business.timezone)}
                        </p>
                      </div>
                      <Badge variant={enquiryBadgeVariant(e.status)}>
                        {ENQUIRY_STATUS_LABELS[e.status]}
                      </Badge>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-white/35">Demo / fictional</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sample calendar strip</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-white/5">
                  {business.appointments.map((a) => (
                    <li key={a.id} className="flex justify-between gap-2 py-3 text-sm">
                      <div>
                        <p className="font-medium">{a.customer.name}</p>
                        <p className="text-xs text-white/45">
                          {a.service?.name} · {formatDate(a.startsAt, business.timezone)}
                        </p>
                      </div>
                      <Badge variant={appointmentBadgeVariant(a.status)}>
                        {APPOINTMENT_STATUS_LABELS[a.status]}
                      </Badge>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-white/35">Demo / fictional</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Services on the booking page</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 sm:grid-cols-2">
                {business.services.map((s) => (
                  <li key={s.id} className="rounded-xl border border-white/10 px-3 py-2 text-sm">
                    {s.name}
                    <span className="ml-2 text-xs text-white/40">{s.durationMinutes} min</span>
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-4" variant="secondary">
                <Link href={`/book/${business.slug}`}>Try submitting a request</Link>
              </Button>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-white/40">
            Sign in as <code>demo@cleancar.ie</code> / <code>password123</code> (after seed) to open
            the full dashboard for this demo workspace.
          </p>
        </>
      )}
    </div>
  );
}
