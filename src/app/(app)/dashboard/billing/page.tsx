import { redirect } from "next/navigation";
import { requireUser, getUserPrimaryBusiness } from "@/lib/tenant";
import { pricing } from "@/lib/config/pricing";
import { formatDate, formatEur } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function BillingPage() {
  const user = await requireUser();
  const membership = await getUserPrimaryBusiness(user.id);
  if (!membership) redirect("/onboarding");
  const sub = membership.business.subscription;
  const tz = membership.business.timezone;
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h2 className="font-display text-2xl">Billing</h2>
        <p className="mt-1 text-sm text-white/55">
          Subscription status for this workspace. Proposed prices are configurable — not validated
          market rates.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {sub ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-white/45">Plan:</span>
                <Badge variant="accent">{sub.plan}</Badge>
                <Badge variant={sub.status === "ACTIVE" || sub.status === "TRIALING" ? "success" : "muted"}>
                  {sub.status}
                </Badge>
              </div>
              <p>
                <span className="text-white/45">Setup fee on record:</span>{" "}
                {formatEur(sub.setupFeeCents)}
              </p>
              <p>
                <span className="text-white/45">Period end:</span>{" "}
                {sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd, tz) : "—"}
              </p>
              <p>
                <span className="text-white/45">Stripe customer:</span>{" "}
                {sub.stripeCustomerId ?? "Not linked"}
              </p>
            </>
          ) : (
            <p className="text-white/50">No subscription record.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <p className="text-[var(--accent)]">Starter</p>
          <p className="font-display text-3xl">
            €{pricing.starterMonthlyEur}
            <span className="text-base text-white/50">/mo</span>
          </p>
          <p className="mt-2 text-xs text-white/40">Proposed · from pricing config</p>
        </Card>
        <Card className="p-6">
          <p className="text-[var(--accent)]">Growth</p>
          <p className="font-display text-3xl">
            €{pricing.growthMonthlyEur}
            <span className="text-base text-white/50">/mo</span>
          </p>
          <p className="mt-2 text-xs text-white/40">
            Optional setup fee €{pricing.setupFeeEur} (configurable)
          </p>
        </Card>
      </div>

      <Card className="p-5">
        <p className="text-sm text-white/65">
          {stripeConfigured
            ? "Stripe keys are present. Checkout/webhook wiring can be enabled for test-mode charges."
            : "Stripe test mode is not configured (missing STRIPE_SECRET_KEY). Billing UI shows plan status only — no live charges."}
        </p>
      </Card>
    </div>
  );
}
