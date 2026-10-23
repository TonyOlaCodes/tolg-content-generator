import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, getUserPrimaryBusiness } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TeamPage() {
  const user = await requireUser();
  const membership = await getUserPrimaryBusiness(user.id);
  if (!membership) redirect("/onboarding");
  const businessId = membership.businessId;
  const tz = membership.business.timezone;

  const members = await prisma.businessMember.findMany({
    where: { businessId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h2 className="font-display text-2xl">Team</h2>
        <p className="mt-1 text-sm text-white/55">
          People with access to this workspace. Invites ship in a later phase.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-white/50">No members found.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-4"
                >
                  <div>
                    <p className="font-medium">{m.user.name ?? "Unnamed"}</p>
                    <p className="text-sm text-white/50">{m.user.email}</p>
                    <p className="text-xs text-white/35">Joined {formatDate(m.createdAt, tz)}</p>
                  </div>
                  <Badge variant={m.role === "OWNER" ? "accent" : "muted"}>{m.role}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
