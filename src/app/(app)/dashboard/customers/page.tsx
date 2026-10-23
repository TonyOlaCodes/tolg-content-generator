import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser, getUserPrimaryBusiness } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const membership = await getUserPrimaryBusiness(user.id);
  if (!membership) redirect("/onboarding");
  const { q } = await searchParams;
  const businessId = membership.businessId;
  const tz = membership.business.timezone;

  const where: Prisma.CustomerWhereInput = { businessId };
  if (q?.trim()) {
    const term = q.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { phone: { contains: term, mode: "insensitive" } },
    ];
  }

  const customers = await prisma.customer.findMany({
    where,
    include: {
      _count: { select: { enquiries: true, appointments: true, vehicles: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h2 className="font-display text-2xl">Customers</h2>
        <p className="mt-1 text-sm text-white/55">People who have enquired or booked with you.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-col gap-3 sm:flex-row">
            <Input name="q" placeholder="Name, email or phone…" defaultValue={q ?? ""} className="sm:flex-1" />
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          {customers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 px-4 py-12 text-center text-sm text-white/55">
              No customers yet.
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {customers.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/dashboard/customers/${c.id}`}
                    className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-sm text-white/50">
                        {[c.email, c.phone].filter(Boolean).join(" · ") || "No contact details"}
                      </p>
                    </div>
                    <p className="text-xs text-white/40">
                      {c._count.enquiries} enquiries · {c._count.appointments} bookings · updated{" "}
                      {formatDate(c.updatedAt, tz)}
                    </p>
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
