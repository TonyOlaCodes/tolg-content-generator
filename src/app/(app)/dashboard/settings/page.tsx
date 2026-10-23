import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, getUserPrimaryBusiness } from "@/lib/tenant";
import { INDUSTRY_LABELS } from "@/lib/industries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const user = await requireUser();
  const membership = await getUserPrimaryBusiness(user.id);
  if (!membership) redirect("/onboarding");
  const business = membership.business;
  const settings = business.settings;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const publicUrl = `${appUrl}/book/${business.slug}`;

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h2 className="font-display text-2xl">Settings</h2>
        <p className="mt-1 text-sm text-white/55">Business profile and notification preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Business</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-white/45">Name:</span> {business.name}
          </p>
          <p>
            <span className="text-white/45">Industry:</span> {INDUSTRY_LABELS[business.industry]}
          </p>
          <p>
            <span className="text-white/45">Email:</span> {business.email}
          </p>
          <p>
            <span className="text-white/45">Phone:</span> {business.phone ?? "—"}
          </p>
          <p>
            <span className="text-white/45">Location:</span>{" "}
            {[business.city, business.county, business.address].filter(Boolean).join(", ") || "—"}
          </p>
          <p>
            <span className="text-white/45">Type:</span> {business.businessType}
          </p>
          <p>
            <span className="text-white/45">Timezone:</span> {business.timezone}
          </p>
          <p>
            <span className="text-white/45">Public slug:</span>{" "}
            <Link href={`/book/${business.slug}`} className="text-[var(--accent)] hover:underline">
              {publicUrl}
            </Link>
          </p>
          {business.isDemo ? <Badge variant="accent">Demo workspace</Badge> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications & scheduling</CardTitle>
        </CardHeader>
        <CardContent>
          {settings ? (
            <ul className="space-y-2 text-sm">
              <Pref label="Notify owner on new enquiry" on={settings.notifyOwnerOnEnquiry} />
              <Pref label="Acknowledge customer on enquiry" on={settings.ackCustomerOnEnquiry} />
              <Pref label="Send booking confirmations" on={settings.sendBookingConfirm} />
              <Pref label="Send reminders" on={settings.sendReminders} />
              <li className="flex justify-between border-b border-white/5 py-2">
                <span className="text-white/70">Buffer between jobs</span>
                <span>{settings.bufferMinutes} min</span>
              </li>
              <li className="flex justify-between border-b border-white/5 py-2">
                <span className="text-white/70">Deposits</span>
                <Badge variant={settings.depositEnabled ? "accent" : "muted"}>
                  {settings.depositEnabled ? "Enabled" : "Off"}
                </Badge>
              </li>
            </ul>
          ) : (
            <p className="text-sm text-white/50">No settings record.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Pref({ label, on }: { label: string; on: boolean }) {
  return (
    <li className="flex justify-between border-b border-white/5 py-2">
      <span className="text-white/70">{label}</span>
      <Badge variant={on ? "success" : "muted"}>{on ? "On" : "Off"}</Badge>
    </li>
  );
}
