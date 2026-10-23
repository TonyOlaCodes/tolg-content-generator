import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, getUserPrimaryBusiness } from "@/lib/tenant";
import { formatEur } from "@/lib/utils";
import { ServiceForm, DeactivateServiceButton } from "@/components/dashboard/service-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ServicesPage() {
  const user = await requireUser();
  const membership = await getUserPrimaryBusiness(user.id);
  if (!membership) redirect("/onboarding");
  const businessId = membership.businessId;

  const services = await prisma.service.findMany({
    where: { businessId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h2 className="font-display text-2xl">Services</h2>
        <p className="mt-1 text-sm text-white/55">
          Offered on your public booking page. Deactivating hides them from new requests.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your services</CardTitle>
          </CardHeader>
          <CardContent>
            {services.length === 0 ? (
              <p className="text-sm text-white/50">No services yet. Add one to start taking requests.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {services.map((s) => (
                  <li key={s.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{s.name}</p>
                        <Badge variant={s.isActive ? "success" : "muted"}>
                          {s.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-sm text-white/50">
                        {s.durationMinutes} min · {formatEur(s.priceCents)}
                      </p>
                      {s.description ? (
                        <p className="mt-1 text-sm text-white/60">{s.description}</p>
                      ) : null}
                    </div>
                    {s.isActive ? (
                      <DeactivateServiceButton businessId={businessId} serviceId={s.id} />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add service</CardTitle>
          </CardHeader>
          <CardContent>
            <ServiceForm businessId={businessId} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
