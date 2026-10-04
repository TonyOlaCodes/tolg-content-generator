"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WORDS } from "@/lib/data/words";
import { getClientAI } from "@/lib/ai";
import Link from "next/link";
import { useAppStore } from "@/lib/store/use-app-store";

export default function DoubleMeaningPage() {
  const word = useMemo(() => WORDS[Math.floor(Math.random() * WORDS.length)]!, []);
  const [selected, setSelected] = useState<string[]>([]);
  const [line, setLine] = useState("");
  const [result, setResult] = useState<{ score: number; notes: string[]; uncertain: boolean } | null>(null);
  const setPending = useAppStore((s) => s.setPendingSession);
  const profile = useAppStore((s) => s.profile);
  const meanings = [...word.definitions, ...word.alternateMeanings];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl">Double Meaning Lab</h1>
        <p className="mt-1 text-[var(--text-secondary)]">Identify meanings, then write a bar that stacks two.</p>
      </header>
      <Card className="!p-5 text-center">
        <p className="font-display text-4xl">{word.word}</p>
      </Card>
      <section className="space-y-2">
        <h2 className="text-sm text-[var(--text-muted)]">Meanings — tap at least two</h2>
        {meanings.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() =>
              setSelected((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]))
            }
            className={`card-surface w-full p-4 text-left ${selected.includes(m) ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : ""}`}
          >
            {m}
          </button>
        ))}
      </section>
      <textarea
        className="min-h-28 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 outline-none focus:border-[var(--accent)]"
        placeholder="Write a bar using at least two meanings…"
        value={line}
        onChange={(e) => setLine(e.target.value)}
      />
      <Button
        className="w-full"
        variant="accent"
        disabled={selected.length < 2 || !line.trim()}
        onClick={async () => setResult(await getClientAI().evaluateWordplay(line, word.word))}
      >
        Evaluate wordplay
      </Button>
      {result && (
        <Card className="!p-4 space-y-2">
          <p className="font-display text-2xl">Score {result.score}</p>
          {result.notes.map((n) => (
            <p key={n} className="text-sm text-[var(--text-secondary)]">{n}</p>
          ))}
          {result.uncertain && <p className="text-sm text-[var(--warning)]">Interpretation marked uncertain.</p>}
          <Link
            href="/freestyle"
            onClick={() =>
              setPending({
                beatId: "soul-85",
                durationSec: 60,
                mode: "double_meaning",
                promptFrequencySec: 20,
                difficulty: profile.settings.difficulty,
                aiFeedback: true,
                livePrompts: true,
                distractionFree: false,
                customPrompts: [word.word],
              })
            }
          >
            <Button className="mt-2 w-full" variant="secondary">
              Record a take
            </Button>
          </Link>
        </Card>
      )}
    </div>
  );
}
