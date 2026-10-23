import Link from "next/link";
import { redirect } from "next/navigation";
import { EnquiryStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser, getUserPrimaryBusiness } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";
import { ENQUIRY_STATUS_LABELS, enquiryBadgeVariant } from "@/lib/status-labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function DashboardOverviewPage() {
  const user = await requireUser();
  const membership = await getUserPrimaryBusiness(user.id);
  if (!membership) redirect("/onboarding");
  const businessId = membership.businessId;
  const tz = membership.business.timezone;
  const now = new Date();

  const [
    newCount,
    awaitingCount,
    upcomingCount,
    completedCount,
    followUpsDue,
    recentEnquiries,
  ] = await Promise.all([
    prisma.enquiry.count({ where: { businessId, status: EnquiryStatus.NEW } }),
    prisma.enquiry.count({ where: { businessId, status: EnquiryStatus.AWAITING_RESPONSE } }),
    prisma.appointment.count({
      where: {
        businessId,
        startsAt: { gte: now },
        status: { in: ["CONFIRMED", "PENDING", "REQUESTED"] },
      },
    }),
    prisma.appointment.count({ where: { businessId, status: "COMPLETED" } }),
    prisma.enquiry.count({
      where: {
        businessId,
        nextFollowUpAt: { lte: now },
        status: { notIn: ["BOOKED", "CLOSED", "LOST"] },
      },
    }),
    prisma.enquiry.findMany({
      where: { businessId },
      include: { customer: true, service: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const stats = [
    { label: "New enquiries", value: newCount, href: "/dashboard/enquiries?status=NEW" },
    { label: "Awaiting response", value: awaitingCount, href: "/dashboard/enquiries?status=AWAITING_RESPONSE" },
    { label: "Upcoming appointments", value: upcomingCount, href: "/dashboard/bookings" },
    { label: "Completed", value: completedCount, href: "/dashboard/bookings" },
    { label: "Follow-ups due", value: followUpsDue, href: "/dashboard/enquiries" },
  ];

  return (
    <div className="space-y-8 animate-fade-up">
      <div>
        <h2 className="font-display text-2xl md:text-3xl">Overview</h2>
        <p className="mt-1 text-sm text-white/55">Your enquiry and booking pulse for {membership.business.name}.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="h-full p-4 transition hover:border-[var(--accent)]/40">
              <p className="text-xs text-white/45">{s.label}</p>
              <p className="mt-2 font-display text-3xl">{s.value}</p>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Recent enquiries</CardTitle>
          <Button asChild size="sm" variant="secondary">
            <Link href="/dashboard/enquiries">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentEnquiries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center">
              <p className="text-sm text-white/60">No enquiries yet.</p>
              <p className="mt-1 text-xs text-white/40">Share your public booking page to start receiving requests.</p>
              <Button asChild className="mt-4" size="sm">
                <Link href={`/book/${membership.business.slug}`}>Open booking page</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {recentEnquiries.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/dashboard/enquiries/${e.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-white/[0.02]"
                  >
                    <div>
                      <p className="text-sm font-medium">{e.customer.name}</p>
                      <p className="text-xs text-white/45">
                        {e.service?.name ?? "No service"} · {formatDate(e.createdAt, tz)}
                      </p>
                    </div>
                    <Badge variant={enquiryBadgeVariant(e.status)}>{ENQUIRY_STATUS_LABELS[e.status]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
