"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { WORDS } from "@/lib/data/words";
import { Card } from "@/components/ui/card";

export default function WordsLibraryPage() {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return WORDS;
    return WORDS.filter((w) => w.word.includes(query) || w.definitions.some((d) => d.toLowerCase().includes(query)));
  }, [q]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-3xl">Words</h1>
        <p className="text-sm text-[var(--text-secondary)]">Double meanings, rhymes, and culture links.</p>
      </header>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search words…"
        className="h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4"
      />
      <div className="space-y-2">
        {results.map((w) => (
          <Link key={w.id} href={`/library/words/${w.id}`}>
            <Card interactive>
              <p className="font-display text-xl">{w.word}</p>
              <p className="text-sm text-[var(--text-secondary)]">{w.definitions[0]}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
