import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, getUserPrimaryBusiness } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";
import {
  APPOINTMENT_STATUS_LABELS,
  appointmentBadgeVariant,
} from "@/lib/status-labels";
import { CancelAppointmentButton } from "@/components/dashboard/cancel-appointment-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function BookingsPage() {
  const user = await requireUser();
  const membership = await getUserPrimaryBusiness(user.id);
  if (!membership) redirect("/onboarding");
  const businessId = membership.businessId;
  const tz = membership.business.timezone;

  const appointments = await prisma.appointment.findMany({
    where: { businessId },
    include: { customer: true, service: true },
    orderBy: { startsAt: "asc" },
    take: 100,
  });

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h2 className="font-display text-2xl">Bookings</h2>
        <p className="mt-1 text-sm text-white/55">Confirmed and requested appointments.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{appointments.length} appointment{appointments.length === 1 ? "" : "s"}</CardTitle>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 px-4 py-12 text-center text-sm text-white/55">
              No appointments yet. Convert an enquiry to create one.
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {appointments.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{a.customer.name}</p>
                    <p className="text-sm text-white/50">
                      {a.service?.name ?? "Service"} · {formatDate(a.startsAt, tz)}
                      {a.locationText ? ` · ${a.locationText}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={appointmentBadgeVariant(a.status)}>
                      {APPOINTMENT_STATUS_LABELS[a.status]}
                    </Badge>
                    {a.status !== "CANCELLED" && a.status !== "COMPLETED" ? (
                      <CancelAppointmentButton businessId={businessId} appointmentId={a.id} />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
