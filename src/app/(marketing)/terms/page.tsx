import { Card } from "@/components/ui/card";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 animate-fade-up">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Legal</p>
      <h1 className="mt-2 font-display text-4xl">Terms of service</h1>
      <Card className="mt-4 border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-100/90">
        Template only — legal review required before production use. This is not advice.
      </Card>
      <div className="mt-8 space-y-4 text-sm text-white/70">
        <p>
          DetailFlow is provided as software to help organise enquiries and appointments. A booking
          request submitted by an end customer is not a confirmed appointment unless the business
          confirms it in the product.
        </p>
        <p>
          Proposed pricing on the site is configurable and not a binding offer until agreed in
          writing or via an active paid subscription.
        </p>
        <p>
          Demo workspaces and seed data are fictional. You must not use demo identities as if they
          were real customers.
        </p>
        <p>
          Limitation of liability, acceptable use, and governing law clauses must be completed by
          counsel before commercial launch.
        </p>
      </div>
    </div>
  );
}
