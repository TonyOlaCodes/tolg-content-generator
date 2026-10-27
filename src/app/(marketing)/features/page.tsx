import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const features = [
  {
    title: "Public booking-request page",
    body: "Share a branded /book/[slug] link. Customers pick a service, fill intake fields, and submit a request — clearly labelled as not a confirmed appointment.",
  },
  {
    title: "Enquiry inbox",
    body: "Every request lands with status, source, preferred time, and an activity trail. Filter by status and search by customer.",
  },
  {
    title: "Convert to appointment",
    body: "When you are ready, pick a start time. DetailFlow checks conflicts including buffer minutes, then confirms and can email the customer.",
  },
  {
    title: "Calendar & bookings",
    body: "Month view by day plus a bookings list with cancel actions. Statuses stay explicit: requested, pending, confirmed, completed, cancelled.",
  },
  {
    title: "Customers & vehicles",
    body: "Profiles collect contact details, vehicle intake (for detailing), and full enquiry/booking history per customer.",
  },
  {
    title: "Services catalogue",
    body: "Duration, price, and active flag. Only active services appear on the public page.",
  },
  {
    title: "Automation rules (Phase 1 config)",
    body: "Rules for owner alerts, unanswered reminders, appointment reminders, and quote follow-ups are stored per business. The full send engine is Phase 2.",
  },
  {
    title: "Analytics estimates",
    body: "Live counts by status and source, plus simple conversion and completion estimates — labelled as estimates, not audited KPIs.",
  },
];

export default function FeaturesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 animate-fade-up">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Features</p>
      <h1 className="mt-2 font-display text-4xl md:text-5xl">Built around the enquiry-to-booking loop</h1>
      <p className="mt-4 max-w-2xl text-lg text-white/60">
        DetailFlow organises customer enquiries, appointments, and follow-ups for appointment-based
        service businesses — starting with car detailing templates.
      </p>

      <div className="mt-12 grid gap-4 md:grid-cols-2">
        {features.map((f) => (
          <Card key={f.title} className="p-6">
            <h2 className="font-display text-xl">{f.title}</h2>
            <p className="mt-2 text-sm text-white/60">{f.body}</p>
          </Card>
        ))}
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/demo">Try the demo</Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/pricing">See pricing</Link>
        </Button>
      </div>
    </div>
  );
}
