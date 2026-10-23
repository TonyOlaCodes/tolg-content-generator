import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, getUserPrimaryBusiness } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";
import {
  ENQUIRY_SOURCE_LABELS,
  ENQUIRY_STATUS_LABELS,
  enquiryBadgeVariant,
} from "@/lib/status-labels";
import { EnquiryActions } from "@/components/dashboard/enquiry-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function EnquiryDetailPage({
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

  const enquiry = await prisma.enquiry.findFirst({
    where: { id, businessId },
    include: {
      customer: { include: { vehicles: true } },
      service: true,
      activities: { orderBy: { createdAt: "desc" } },
      appointments: { orderBy: { startsAt: "desc" } },
    },
  });
  if (!enquiry) notFound();

  const intake =
    enquiry.intakeJson && typeof enquiry.intakeJson === "object" && !Array.isArray(enquiry.intakeJson)
      ? (enquiry.intakeJson as Record<string, string>)
      : {};

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
            <Link href="/dashboard/enquiries">← Enquiries</Link>
          </Button>
          <h2 className="font-display text-2xl">{enquiry.customer.name}</h2>
          <p className="mt-1 text-sm text-white/55">
            {enquiry.service?.name ?? "No service"} · {ENQUIRY_SOURCE_LABELS[enquiry.source]} ·{" "}
            {formatDate(enquiry.createdAt, tz)}
          </p>
        </div>
        <Badge variant={enquiryBadgeVariant(enquiry.status)}>
          {ENQUIRY_STATUS_LABELS[enquiry.status]}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <span className="text-white/45">Email:</span> {enquiry.customer.email ?? "—"}
            </p>
            <p>
              <span className="text-white/45">Phone:</span> {enquiry.customer.phone ?? "—"}
            </p>
            <p>
              <span className="text-white/45">Preferred:</span>{" "}
              {enquiry.preferredDate ? formatDate(enquiry.preferredDate, tz) : "—"}{" "}
              {enquiry.preferredTime ?? ""}
            </p>
            <p>
              <span className="text-white/45">Location:</span>{" "}
              {[enquiry.locationType, enquiry.locationText].filter(Boolean).join(" · ") || "—"}
            </p>
            <p>
              <span className="text-white/45">Message:</span>{" "}
              {enquiry.message || "No message"}
            </p>
            {Object.keys(intake).length > 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="mb-2 text-xs uppercase tracking-wide text-white/40">Intake</p>
                <dl className="space-y-1">
                  {Object.entries(intake).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <dt className="text-white/45">{k}</dt>
                      <dd>{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
            <Link
              href={`/dashboard/customers/${enquiry.customerId}`}
              className="inline-block text-[var(--accent)] hover:underline"
            >
              View customer profile →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <EnquiryActions
              businessId={businessId}
              enquiryId={enquiry.id}
              currentStatus={enquiry.status}
              defaultDurationMinutes={enquiry.service?.durationMinutes ?? 60}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {enquiry.activities.length === 0 ? (
            <p className="text-sm text-white/50">No activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {enquiry.activities.map((a) => (
                <li key={a.id} className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-sm">
                  <div className="flex justify-between gap-2 text-xs text-white/40">
                    <span className="uppercase tracking-wide">{a.type}</span>
                    <span>{formatDate(a.createdAt, tz)}</span>
                  </div>
                  {a.body ? <p className="mt-1 text-white/80">{a.body}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {enquiry.appointments.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Linked appointments</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {enquiry.appointments.map((a) => (
                <li key={a.id} className="flex justify-between gap-2 border-b border-white/5 py-2">
                  <span>{formatDate(a.startsAt, tz)}</span>
                  <Badge variant="muted">{a.status}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
