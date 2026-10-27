import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function MobileMechanicsIndustryPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 animate-fade-up">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Industry</p>
      <h1 className="mt-2 font-display text-4xl">Mobile mechanics</h1>
      <p className="mt-4 text-lg text-white/65">
        On-site jobs need clear requests, buffers between visits, and a calendar you can trust.
        DetailFlow keeps requests as enquiries until you confirm travel time and parts availability.
      </p>

      <Card className="mt-8 space-y-3 p-6 text-sm text-white/70">
        <p>Location text for customer sites.</p>
        <p>Conflict checks with buffer minutes between jobs.</p>
        <p>Email acknowledgements that never pretend a job is booked until you say so.</p>
      </Card>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/contact">Request a demo</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/pricing">View pricing</Link>
        </Button>
      </div>
    </div>
  );
}
