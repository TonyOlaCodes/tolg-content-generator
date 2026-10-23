import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, getUserPrimaryBusiness } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";
import {
  APPOINTMENT_STATUS_LABELS,
  ENQUIRY_STATUS_LABELS,
  appointmentBadgeVariant,
  enquiryBadgeVariant,
} from "@/lib/status-labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const membership = await getUserPrimaryBusiness(user.id);
  if (!membership) redirect("/onboarding");
  const { id } = await params;
  const businessId = membership.businessId;
  const tz = membership.business.timezone;

  const customer = await prisma.customer.findFirst({
    where: { id, businessId },
    include: {
      vehicles: { orderBy: { createdAt: "desc" } },
      enquiries: {
        include: { service: true },
        orderBy: { createdAt: "desc" },
      },
      appointments: {
        include: { service: true },
        orderBy: { startsAt: "desc" },
      },
    },
  });
  if (!customer) notFound();

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/dashboard/customers">← Customers</Link>
        </Button>
        <h2 className="font-display text-2xl">{customer.name}</h2>
        <p className="mt-1 text-sm text-white/55">
          {[customer.email, customer.phone].filter(Boolean).join(" · ") || "No contact details"}
        </p>
        {customer.notes ? <p className="mt-2 text-sm text-white/65">{customer.notes}</p> : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vehicles</CardTitle>
        </CardHeader>
        <CardContent>
          {customer.vehicles.length === 0 ? (
            <p className="text-sm text-white/50">No vehicles on file.</p>
          ) : (
            <ul className="space-y-2">
              {customer.vehicles.map((v) => (
                <li key={v.id} className="rounded-xl border border-white/10 px-3 py-2 text-sm">
                  {[v.make, v.model].filter(Boolean).join(" ") || "Vehicle"}
                  {v.size ? ` · ${v.size}` : ""}
                  {v.condition ? ` · ${v.condition}` : ""}
                  {v.notes ? <span className="block text-white/45">{v.notes}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Enquiry history</CardTitle>
          </CardHeader>
          <CardContent>
            {customer.enquiries.length === 0 ? (
              <p className="text-sm text-white/50">No enquiries.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {customer.enquiries.map((e) => (
                  <li key={e.id} className="py-3">
                    <Link href={`/dashboard/enquiries/${e.id}`} className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{e.service?.name ?? "Enquiry"}</p>
                        <p className="text-xs text-white/45">{formatDate(e.createdAt, tz)}</p>
                      </div>
                      <Badge variant={enquiryBadgeVariant(e.status)}>
                        {ENQUIRY_STATUS_LABELS[e.status]}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Booking history</CardTitle>
          </CardHeader>
          <CardContent>
            {customer.appointments.length === 0 ? (
              <p className="text-sm text-white/50">No bookings.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {customer.appointments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 py-3">
                    <div>
                      <p className="text-sm font-medium">{a.service?.name ?? "Appointment"}</p>
                      <p className="text-xs text-white/45">{formatDate(a.startsAt, tz)}</p>
                    </div>
                    <Badge variant={appointmentBadgeVariant(a.status)}>
                      {APPOINTMENT_STATUS_LABELS[a.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
