import Link from "next/link";
import { redirect } from "next/navigation";
import { EnquiryStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser, getUserPrimaryBusiness } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";
import {
  ENQUIRY_SOURCE_LABELS,
  ENQUIRY_STATUS_LABELS,
  enquiryBadgeVariant,
} from "@/lib/status-labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const STATUSES = Object.keys(EnquiryStatus) as EnquiryStatus[];

export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const user = await requireUser();
  const membership = await getUserPrimaryBusiness(user.id);
  if (!membership) redirect("/onboarding");
  const { status, q } = await searchParams;
  const businessId = membership.businessId;
  const tz = membership.business.timezone;

  const where: Prisma.EnquiryWhereInput = { businessId };
  if (status && STATUSES.includes(status as EnquiryStatus)) {
    where.status = status as EnquiryStatus;
  }
  if (q?.trim()) {
    const term = q.trim();
    where.OR = [
      { message: { contains: term, mode: "insensitive" } },
      { customer: { name: { contains: term, mode: "insensitive" } } },
      { customer: { email: { contains: term, mode: "insensitive" } } },
      { customer: { phone: { contains: term, mode: "insensitive" } } },
    ];
  }

  const enquiries = await prisma.enquiry.findMany({
    where,
    include: { customer: true, service: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h2 className="font-display text-2xl">Enquiries</h2>
        <p className="mt-1 text-sm text-white/55">Track every request from first contact to booking.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 sm:flex-row" method="get">
            <Input name="q" placeholder="Search name, email, phone…" defaultValue={q ?? ""} className="sm:flex-1" />
            <select
              name="status"
              defaultValue={status ?? ""}
              className="h-11 rounded-xl border border-white/10 bg-[#111113] px-3 text-sm"
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ENQUIRY_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary">
              Apply
            </Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/dashboard/enquiries">
              <Badge variant={!status ? "accent" : "muted"}>All</Badge>
            </Link>
            {STATUSES.map((s) => (
              <Link key={s} href={`/dashboard/enquiries?status=${s}`}>
                <Badge variant={status === s ? "accent" : "muted"}>{ENQUIRY_STATUS_LABELS[s]}</Badge>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          {enquiries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 px-4 py-12 text-center text-sm text-white/55">
              No enquiries match this filter.
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {enquiries.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/dashboard/enquiries/${e.id}`}
                    className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{e.customer.name}</p>
                      <p className="text-sm text-white/50">
                        {e.service?.name ?? "No service"} · {ENQUIRY_SOURCE_LABELS[e.source]} ·{" "}
                        {formatDate(e.createdAt, tz)}
                      </p>
                      {e.message ? (
                        <p className="mt-1 line-clamp-1 text-sm text-white/65">{e.message}</p>
                      ) : null}
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
