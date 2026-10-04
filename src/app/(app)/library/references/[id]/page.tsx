"use client";

import { use, useState } from "react";
import Link from "next/link";
import { getReference } from "@/lib/data/references";
import { AssociationTreeView } from "@/components/practice/association-tree-view";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ReferenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const ref = getReference(id);
  const [quizOpen, setQuizOpen] = useState(true);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);

  if (!ref) {
    return (
      <div className="py-10 text-center">
        <p>Reference not found.</p>
        <Link href="/library/references">
          <Button className="mt-4">Back</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">{ref.category}</p>
        <h1 className="font-display text-3xl">{ref.name}</h1>
        <p className="mt-2 text-[var(--text-secondary)]">{ref.shortDescription}</p>
        {ref.aliases.length > 0 && (
          <p className="mt-2 text-sm text-[var(--text-muted)]">Also known as: {ref.aliases.join(" · ")}</p>
        )}
      </header>

      {quizOpen && !revealed && (
        <Card className="!p-5 space-y-3">
          <p className="font-display text-xl">What could you connect this to?</p>
          <textarea
            className="min-h-24 w-full rounded-2xl border border-[var(--border)] bg-black/20 p-3"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="List associations before revealing routes…"
          />
          <Button
            variant="accent"
            className="w-full"
            onClick={() => {
              setRevealed(true);
              setQuizOpen(false);
            }}
          >
            Reveal association routes
          </Button>
        </Card>
      )}

      {(revealed || !quizOpen) && (
        <>
          {answer && (
            <Card className="!p-4">
              <p className="text-xs text-[var(--text-muted)]">Your answer</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{answer}</p>
            </Card>
          )}
          <Card className="!p-4 space-y-2 text-sm">
            <p><span className="text-[var(--text-muted)]">Known for:</span> {ref.knownFor.join(" · ")}</p>
            <p><span className="text-[var(--text-muted)]">Numbers:</span> {ref.importantNumbers.join(" · ") || "—"}</p>
            <p><span className="text-[var(--text-muted)]">People:</span> {ref.people.join(" · ") || "—"}</p>
            <p><span className="text-[var(--text-muted)]">Places:</span> {ref.places.join(" · ") || "—"}</p>
            <p><span className="text-[var(--text-muted)]">Events:</span> {ref.events.join(" · ") || "—"}</p>
          </Card>
          <section className="space-y-2">
            <h2 className="font-display text-xl">Wordplay routes</h2>
            {ref.wordplayRoutes.map((w) => (
              <Card key={w} className="!p-3 text-sm text-[var(--text-secondary)]">
                {w}
              </Card>
            ))}
          </section>
          <section className="space-y-2">
            <h2 className="font-display text-xl">Association tree</h2>
            <Card className="!p-4">
              <AssociationTreeView nodes={ref.associationTree} />
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
