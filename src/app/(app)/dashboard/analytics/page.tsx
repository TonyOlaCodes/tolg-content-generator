import { redirect } from "next/navigation";
import { EnquiryStatus, EnquirySource } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser, getUserPrimaryBusiness } from "@/lib/tenant";
import {
  ENQUIRY_SOURCE_LABELS,
  ENQUIRY_STATUS_LABELS,
} from "@/lib/status-labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AnalyticsPage() {
  const user = await requireUser();
  const membership = await getUserPrimaryBusiness(user.id);
  if (!membership) redirect("/onboarding");
  const businessId = membership.businessId;

  const [enquiries, appointments, byStatus, bySource] = await Promise.all([
    prisma.enquiry.findMany({ where: { businessId }, select: { status: true, source: true } }),
    prisma.appointment.findMany({
      where: { businessId },
      select: { status: true },
    }),
    prisma.enquiry.groupBy({
      by: ["status"],
      where: { businessId },
      _count: { _all: true },
    }),
    prisma.enquiry.groupBy({
      by: ["source"],
      where: { businessId },
      _count: { _all: true },
    }),
  ]);

  const totalEnquiries = enquiries.length;
  const booked = enquiries.filter((e) => e.status === EnquiryStatus.BOOKED).length;
  const conversionEstimate =
    totalEnquiries === 0 ? 0 : Math.round((booked / totalEnquiries) * 1000) / 10;

  const completed = appointments.filter((a) => a.status === "COMPLETED").length;
  const cancellablePool = appointments.filter((a) =>
    ["COMPLETED", "CANCELLED", "CONFIRMED"].includes(a.status),
  ).length;
  const completionEstimate =
    cancellablePool === 0 ? 0 : Math.round((completed / cancellablePool) * 1000) / 10;

  const statusMap = Object.fromEntries(
    byStatus.map((r) => [r.status, r._count._all]),
  ) as Partial<Record<EnquiryStatus, number>>;
  const sourceMap = Object.fromEntries(
    bySource.map((r) => [r.source, r._count._all]),
  ) as Partial<Record<EnquirySource, number>>;

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h2 className="font-display text-2xl">Analytics</h2>
        <p className="mt-1 text-sm text-white/55">
          Counts from your live data. Conversion and completion rates below are simple estimates —
          not audited KPIs.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-white/45">Total enquiries</p>
          <p className="mt-2 font-display text-3xl">{totalEnquiries}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-white/45">Booked enquiries</p>
          <p className="mt-2 font-display text-3xl">{booked}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-white/45">Conversion (estimate)</p>
          <p className="mt-2 font-display text-3xl">{conversionEstimate}%</p>
          <p className="mt-1 text-[10px] text-white/35">Booked ÷ total enquiries</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-white/45">Completion (estimate)</p>
          <p className="mt-2 font-display text-3xl">{completionEstimate}%</p>
          <p className="mt-1 text-[10px] text-white/35">
            Completed ÷ (completed + cancelled + confirmed)
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Enquiries by status</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {(Object.keys(EnquiryStatus) as EnquiryStatus[]).map((s) => (
                <li key={s} className="flex justify-between border-b border-white/5 py-2">
                  <span className="text-white/70">{ENQUIRY_STATUS_LABELS[s]}</span>
                  <span className="font-medium">{statusMap[s] ?? 0}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Enquiries by source</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {(Object.keys(EnquirySource) as EnquirySource[]).map((s) => (
                <li key={s} className="flex justify-between border-b border-white/5 py-2">
                  <span className="text-white/70">{ENQUIRY_SOURCE_LABELS[s]}</span>
                  <span className="font-medium">{sourceMap[s] ?? 0}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
