import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function CleaningIndustryPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 animate-fade-up">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Industry</p>
      <h1 className="mt-2 font-display text-4xl">Cleaning businesses</h1>
      <p className="mt-4 text-lg text-white/65">
        Use the same enquiry inbox, calendar, and follow-up flags. Swap detailing services for
        cleans, and adjust intake fields to match the jobs you quote.
      </p>

      <Card className="mt-8 space-y-3 p-6 text-sm text-white/70">
        <p>Collect preferred dates without auto-confirming slots.</p>
        <p>Keep quotes and notes on the enquiry activity trail.</p>
        <p>Convert to confirmed appointments when you have capacity.</p>
      </Card>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/contact">Request a demo</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/features">See features</Link>
        </Button>
      </div>
    </div>
  );
}
