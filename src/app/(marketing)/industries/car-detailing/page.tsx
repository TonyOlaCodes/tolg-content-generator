import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function CarDetailingIndustryPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 animate-fade-up">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Industry</p>
      <h1 className="mt-2 font-display text-4xl">Car detailing & valeting</h1>
      <p className="mt-4 text-lg text-white/65">
        DetailFlow’s default template is built for mobile and premises detailers who take enquiries
        by phone, Instagram, and web — and need one place to turn them into booked jobs.
      </p>

      <Card className="mt-8 space-y-3 p-6 text-sm text-white/70">
        <p>Vehicle make, model, size, and condition on the booking request.</p>
        <p>Service packages with duration and EUR pricing.</p>
        <p>Mobile vs premises location fields.</p>
        <p>Clear separation between a customer request and a confirmed appointment.</p>
      </Card>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/demo">Try the CleanCar demo</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/signup">Create account</Link>
        </Button>
      </div>
    </div>
  );
}
