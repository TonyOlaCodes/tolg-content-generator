"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { searchReferences } from "@/lib/data/references";
import type { ReferenceCategory } from "@/lib/types";

const CATS: Array<"all" | ReferenceCategory> = [
  "all",
  "basketball",
  "movies",
  "anime",
  "video_games",
  "science",
  "mythology",
  "brands",
  "cities",
  "history",
  "technology",
  "cars",
  "tv",
];

export default function ReferencesLibraryPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATS)[number]>("all");
  const results = useMemo(() => searchReferences(q, cat), [q, cat]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-3xl">References</h1>
      </header>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search people, places, brands…"
        className="h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4"
      />
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm capitalize ${cat === c ? "bg-white text-black" : "bg-white/5 text-[var(--text-secondary)]"}`}
          >
            {c.replace(/_/g, " ")}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {results.map((r) => (
          <Link key={r.id} href={`/library/references/${r.id}`}>
            <Card interactive>
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">{r.category}</p>
              <p className="font-medium">{r.name}</p>
              <p className="text-sm text-[var(--text-secondary)]">{r.shortDescription}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
