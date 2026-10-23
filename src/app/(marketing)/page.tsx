import Link from "next/link";
import { ArrowRight, CalendarDays, Inbox, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { pricing } from "@/lib/config/pricing";

export default function HomePage() {
  return (
    <div>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
        <div className="animate-fade-up space-y-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">DetailFlow</p>
          <h1 className="font-display text-4xl leading-[1.05] md:text-6xl">
            Stop losing track of enquiries. Start turning them into bookings.
          </h1>
          <p className="max-w-xl text-lg text-white/65">
            DetailFlow helps service businesses organise customer enquiries, manage appointments and
            automate follow-ups from one simple dashboard.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/demo">
                Try the demo <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/contact">Request a demo</Link>
            </Button>
          </div>
          <p className="text-xs text-white/40">
            Demonstration data is fictional. No testimonials or customer logos are claimed.
          </p>
        </div>
        <Card className="animate-fade-up overflow-hidden">
          <CardContent className="space-y-4 p-6">
            <p className="text-xs uppercase tracking-[0.16em] text-white/45">Product preview</p>
            <div className="rounded-xl border border-white/10 bg-black/40 p-4">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-white/70">Enquiry inbox</span>
                <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[var(--accent)]">3 new</span>
              </div>
              {["Sean Murphy · Full Detail", "Ciara O'Neill · Exterior Wash", "Tom Walsh · Interior Clean"].map((row) => (
                <div key={row} className="border-t border-white/5 py-3 text-sm text-white/80">
                  {row}
                  <span className="ml-2 text-xs text-white/35">Demo data</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-white/5 p-3"><Inbox className="mx-auto mb-1 h-4 w-4 text-[var(--accent)]" />Inbox</div>
              <div className="rounded-xl bg-white/5 p-3"><CalendarDays className="mx-auto mb-1 h-4 w-4 text-[var(--accent)]" />Calendar</div>
              <div className="rounded-xl bg-white/5 p-3"><Sparkles className="mx-auto mb-1 h-4 w-4 text-[var(--accent)]" />Follow-ups</div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="border-y border-white/10 bg-black/20 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl">How DetailFlow works</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ["1. Share your booking page", "Customers request a service with the details you need."],
              ["2. Manage the inbox", "Every enquiry lands in one place with status and history."],
              ["3. Confirm on the calendar", "Convert requests into appointments and send acknowledgements."],
            ].map(([t, d]) => (
              <Card key={t} className="p-5">
                <p className="font-medium">{t}</p>
                <p className="mt-2 text-sm text-white/60">{d}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-3xl">Built for appointment-based businesses</h2>
        <p className="mt-2 text-white/60">Car detailing is the default template — the architecture stays industry-independent.</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {["Car detailing", "Cleaning", "Mobile mechanics", "Barbers & salons", "Garden maintenance", "Window cleaning"].map((i) => (
            <Card key={i} className="p-4 text-sm">{i}</Card>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-black/20 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl">Proposed pricing</h2>
          <p className="mt-2 text-sm text-white/50">Editable configuration — not validated market pricing.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Card className="p-6">
              <p className="text-[var(--accent)]">Starter</p>
              <p className="font-display text-4xl">€{pricing.starterMonthlyEur}<span className="text-base text-white/50">/mo</span></p>
              <ul className="mt-4 space-y-2 text-sm text-white/70">
                <li>Booking-request page</li>
                <li>Enquiry dashboard</li>
                <li>Appointment calendar</li>
                <li>Basic email notifications</li>
              </ul>
            </Card>
            <Card className="p-6 border-[var(--accent)]/40">
              <p className="text-[var(--accent)]">Growth</p>
              <p className="font-display text-4xl">€{pricing.growthMonthlyEur}<span className="text-base text-white/50">/mo</span></p>
              <ul className="mt-4 space-y-2 text-sm text-white/70">
                <li>Everything in Starter</li>
                <li>Follow-up automation</li>
                <li>Team access</li>
                <li>Enhanced reporting</li>
              </ul>
              <p className="mt-4 text-xs text-white/45">Optional setup fee: €{pricing.setupFeeEur} (configurable).</p>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-3xl">FAQ</h2>
        <div className="mt-6 space-y-4">
          {[
            ["Is this only for car detailers?", "No. Detailing is the first template. Cleaning, mechanics, salons and more are supported architecturally."],
            ["Does a booking request confirm automatically?", "No. Requests stay as enquiries until you confirm an appointment."],
            ["Can I keep my existing website?", "Yes. Use DetailFlow as your booking page and enquiry system alongside your current site."],
          ].map(([q, a]) => (
            <Card key={q} className="p-5">
              <p className="font-medium">{q}</p>
              <p className="mt-2 text-sm text-white/60">{a}</p>
            </Card>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild size="lg"><Link href="/demo">Try the demo</Link></Button>
          <Button asChild size="lg" variant="secondary"><Link href="/signup">Create account</Link></Button>
        </div>
      </section>
    </div>
  );
}
