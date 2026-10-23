import { redirect } from "next/navigation";
import { PlatformRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/tenant";
import { formatDate, formatEur } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminPage() {
  const user = await requireUser();
  if (user.platformRole !== PlatformRole.PLATFORM_ADMIN) {
    redirect("/dashboard");
  }

  const businesses = await prisma.business.findMany({
    include: {
      subscription: true,
      _count: { select: { members: true, enquiries: true, appointments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 animate-fade-up">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Platform admin</p>
        <h1 className="font-display text-3xl">Businesses & subscriptions</h1>
        <p className="mt-1 text-sm text-white/55">Visible only to PLATFORM_ADMIN users.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{businesses.length} business{businesses.length === 1 ? "" : "es"}</CardTitle>
        </CardHeader>
        <CardContent>
          {businesses.length === 0 ? (
            <p className="text-sm text-white/50">No businesses yet.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {businesses.map((b) => (
                <li key={b.id} className="space-y-2 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{b.name}</p>
                    <Badge variant="muted">/{b.slug}</Badge>
                    {b.isDemo ? <Badge variant="accent">Demo</Badge> : null}
                  </div>
                  <p className="text-sm text-white/50">
                    {b.email} · {b.industry} · created {formatDate(b.createdAt)}
                  </p>
                  <p className="text-xs text-white/40">
                    {b._count.members} members · {b._count.enquiries} enquiries ·{" "}
                    {b._count.appointments} appointments
                  </p>
                  {b.subscription ? (
                    <p className="text-sm">
                      <Badge variant="accent">{b.subscription.plan}</Badge>{" "}
                      <Badge variant="muted">{b.subscription.status}</Badge>{" "}
                      <span className="text-white/45">
                        setup {formatEur(b.subscription.setupFeeCents)}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-white/45">No subscription</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
