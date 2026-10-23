import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, getUserPrimaryBusiness } from "@/lib/tenant";
import { AUTOMATION_KIND_LABELS } from "@/lib/status-labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AutomationsPage() {
  const user = await requireUser();
  const membership = await getUserPrimaryBusiness(user.id);
  if (!membership) redirect("/onboarding");
  const businessId = membership.businessId;

  const rules = await prisma.automationRule.findMany({
    where: { businessId },
    orderBy: { kind: "asc" },
  });

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h2 className="font-display text-2xl">Automations</h2>
        <p className="mt-1 text-sm text-white/55">
          Rules configured for this workspace. Full automation engine (scheduled sends, idempotent
          executions) ships in Phase 2 — Phase 1 shows configuration and stores execution history.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Automation rules</CardTitle>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <p className="text-sm text-white/50">No automation rules yet.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {rules.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-4">
                  <div>
                    <p className="font-medium">{AUTOMATION_KIND_LABELS[r.kind]}</p>
                    <p className="text-sm text-white/45">
                      Delay: {r.delayMinutes} minute{r.delayMinutes === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Badge variant={r.enabled ? "success" : "muted"}>
                    {r.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
