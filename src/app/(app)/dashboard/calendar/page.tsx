import { redirect } from "next/navigation";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser, getUserPrimaryBusiness } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";
import {
  APPOINTMENT_STATUS_LABELS,
  appointmentBadgeVariant,
} from "@/lib/status-labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireUser();
  const membership = await getUserPrimaryBusiness(user.id);
  if (!membership) redirect("/onboarding");
  const { month } = await searchParams;
  const businessId = membership.businessId;
  const tz = membership.business.timezone;

  const base = month && !Number.isNaN(Date.parse(month)) ? new Date(month) : new Date();
  const monthStart = startOfMonth(base);
  const monthEnd = endOfMonth(base);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const appointments = await prisma.appointment.findMany({
    where: {
      businessId,
      startsAt: { gte: monthStart, lte: monthEnd },
    },
    include: { customer: true, service: true },
    orderBy: { startsAt: "asc" },
  });

  const prev = format(subMonths(monthStart, 1), "yyyy-MM-dd");
  const next = format(addMonths(monthStart, 1), "yyyy-MM-dd");

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Calendar</h2>
          <p className="mt-1 text-sm text-white/55">Simple month view — appointments by day.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link href={`/dashboard/calendar?month=${prev}`}>Previous</Link>
          </Button>
          <p className="min-w-[8rem] text-center text-sm font-medium">
            {format(monthStart, "MMMM yyyy")}
          </p>
          <Button asChild size="sm" variant="secondary">
            <Link href={`/dashboard/calendar?month=${next}`}>Next</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {days.map((day) => {
          const dayAppts = appointments.filter((a) => isSameDay(a.startsAt, day));
          if (dayAppts.length === 0 && (day.getDay() === 0 || day.getDay() === 6)) {
            // Still show weekends lightly when empty — keep all days for clarity
          }
          return (
            <Card key={day.toISOString()} className={dayAppts.length ? "" : "opacity-70"}>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium text-white/80">
                  {format(day, "EEE d MMM")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {dayAppts.length === 0 ? (
                  <p className="text-xs text-white/35">No appointments</p>
                ) : (
                  dayAppts.map((a) => (
                    <div key={a.id} className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs">
                      <p className="font-medium text-white/90">{a.customer.name}</p>
                      <p className="text-white/50">
                        {formatDate(a.startsAt, tz)} · {a.service?.name ?? "Service"}
                      </p>
                      <Badge className="mt-1" variant={appointmentBadgeVariant(a.status)}>
                        {APPOINTMENT_STATUS_LABELS[a.status]}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
