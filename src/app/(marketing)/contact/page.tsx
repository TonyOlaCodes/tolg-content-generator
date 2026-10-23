import { ContactForm } from "@/components/marketing/contact-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 animate-fade-up">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Contact</p>
      <h1 className="mt-2 font-display text-4xl">Request a demo</h1>
      <p className="mt-3 text-white/60">
        Tell us about your business. Messages are stored for follow-up — this is not a live chat.
      </p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Message</CardTitle>
        </CardHeader>
        <CardContent>
          <ContactForm />
        </CardContent>
      </Card>
    </div>
  );
}
