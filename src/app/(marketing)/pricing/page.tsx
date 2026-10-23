import Link from "next/link";
import { pricing } from "@/lib/config/pricing";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 animate-fade-up">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Pricing</p>
      <h1 className="mt-2 font-display text-4xl md:text-5xl">Proposed plans</h1>
      <p className="mt-4 max-w-2xl text-lg text-white/60">
        Figures come from editable configuration (`PLAN_*_EUR` env vars). They are not claimed as
        validated market pricing. Stripe test mode is optional and inactive without API keys.
      </p>

      <div className="mt-12 grid gap-4 md:grid-cols-2">
        <Card className="p-8">
          <p className="text-[var(--accent)]">Starter</p>
          <p className="font-display text-5xl">
            €{pricing.starterMonthlyEur}
            <span className="text-lg text-white/50">/mo</span>
          </p>
          <ul className="mt-6 space-y-2 text-sm text-white/70">
            <li>Branded booking-request page</li>
            <li>Enquiry dashboard & statuses</li>
            <li>Appointment calendar</li>
            <li>Basic email notifications (when Resend is configured)</li>
            <li>1 workspace</li>
          </ul>
        </Card>
        <Card className="border-[var(--accent)]/40 p-8">
          <p className="text-[var(--accent)]">Growth</p>
          <p className="font-display text-5xl">
            €{pricing.growthMonthlyEur}
            <span className="text-lg text-white/50">/mo</span>
          </p>
          <ul className="mt-6 space-y-2 text-sm text-white/70">
            <li>Everything in Starter</li>
            <li>Automation rule configuration</li>
            <li>Team member access</li>
            <li>Enhanced analytics estimates</li>
          </ul>
          <p className="mt-6 text-xs text-white/45">
            Optional setup fee: €{pricing.setupFeeEur} (configurable via SETUP_FEE_EUR).
          </p>
        </Card>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/signup">Start with an account</Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/contact">Talk to us</Link>
        </Button>
      </div>
    </div>
  );
}
