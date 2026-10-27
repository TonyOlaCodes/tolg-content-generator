import { Card } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 animate-fade-up">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Legal</p>
      <h1 className="mt-2 font-display text-4xl">Privacy policy</h1>
      <Card className="mt-4 border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-100/90">
        Template only — legal review required before production use. This is not advice.
      </Card>
      <div className="mt-8 space-y-4 text-sm text-white/70">
        <p>
          DetailFlow processes account data (name, email, password hash), business workspace data,
          customer enquiry details you collect, and optional email delivery metadata.
        </p>
        <p>
          Data is stored in your configured PostgreSQL database (e.g. Neon). Authentication uses
          Auth.js. Email may be sent via Resend when configured.
        </p>
        <p>
          Controllers should document lawful bases, retention, subprocessors, and data-subject
          rights for their jurisdiction (including GDPR where applicable) with qualified counsel.
        </p>
        <p>Contact: use the Contact page for privacy enquiries until a dedicated address is published.</p>
      </div>
    </div>
  );
}
