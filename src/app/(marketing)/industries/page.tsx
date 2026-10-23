import Link from "next/link";
import { Card } from "@/components/ui/card";

const industries = [
  {
    href: "/industries/car-detailing",
    title: "Car detailing & valeting",
    body: "Default template with vehicle intake fields and mobile/premises location options.",
  },
  {
    href: "/industries/cleaning",
    title: "Cleaning",
    body: "Same enquiry inbox and calendar — customise services for domestic or commercial cleans.",
  },
  {
    href: "/industries/mobile-mechanics",
    title: "Mobile mechanics",
    body: "Capture on-site job requests, preferred windows, and convert to confirmed visits.",
  },
];

export default function IndustriesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 animate-fade-up">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Industries</p>
      <h1 className="mt-2 font-display text-4xl md:text-5xl">Appointment-based services</h1>
      <p className="mt-4 max-w-2xl text-lg text-white/60">
        Architecture is industry-independent. Car detailing is the first polished template; cleaning
        and mobile mechanics are supported with the same core workflow.
      </p>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {industries.map((i) => (
          <Link key={i.href} href={i.href}>
            <Card className="h-full p-6 transition hover:border-[var(--accent)]/40">
              <h2 className="font-display text-xl">{i.title}</h2>
              <p className="mt-2 text-sm text-white/60">{i.body}</p>
            </Card>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-sm text-white/45">
        Also planned in the data model: barbers & salons, garden maintenance, window cleaning, and
        other appointment-based work.
      </p>
    </div>
  );
}
