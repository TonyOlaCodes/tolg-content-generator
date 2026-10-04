"use client";

import { use } from "react";
import Link from "next/link";
import { getWord } from "@/lib/data/words";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function WordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const word = getWord(id);
  if (!word) {
    return (
      <div className="py-10 text-center">
        <p>Word not found.</p>
        <Link href="/library/words">
          <Button className="mt-4">Back</Button>
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl">{word.word}</h1>
      <Section title="Definitions" items={word.definitions} />
      <Section title="Alternate meanings" items={word.alternateMeanings} />
      <Section title="Homophones" items={word.homophones} />
      <Section title="Phrases" items={word.phrases} />
      <Section title="Idioms" items={word.idioms} />
      <Section title="Rhymes" items={word.rhymes} />
      <Section title="Slant rhymes" items={word.slantRhymes} />
      <Section title="Associated concepts" items={word.associatedConcepts} />
      <Section title="Pop culture" items={word.popCulture} />
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <Card className="!p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-[var(--text-secondary)]">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </Card>
  );
}
