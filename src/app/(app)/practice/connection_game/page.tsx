"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { connectionPair } from "@/lib/training/prompts";
import Link from "next/link";
import { useAppStore } from "@/lib/store/use-app-store";

export default function ConnectionGamePage() {
  const pair = useMemo(() => connectionPair(), []);
  const [chain, setChain] = useState<string[]>([pair.a]);
  const [input, setInput] = useState("");
  const setPendingSession = useAppStore((s) => s.setPendingSession);
  const profile = useAppStore((s) => s.profile);
  const finished = chain[chain.length - 1]?.toLowerCase() === pair.b.toLowerCase() || chain.some((c) => c.toLowerCase() === pair.b.toLowerCase());

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl">Connection Game</h1>
        <p className="mt-1 text-[var(--text-secondary)]">Bridge Topic A to Topic B with logical jumps.</p>
      </header>
      <Card className="!p-5">
        <p className="text-sm text-[var(--text-muted)]">Connect</p>
        <p className="font-display text-2xl">
          {pair.a} <span className="text-[var(--text-muted)]">→</span> {pair.b}
        </p>
      </Card>
      <Card className="!p-4">
        <p className="text-sm text-[var(--accent)]">{chain.join(" → ")}</p>
        <p className="mt-2 text-xs text-[var(--text-muted)]">{Math.max(0, chain.length - 1)} jumps</p>
      </Card>
      {!finished && (
        <div className="flex gap-2">
          <input
            className="h-12 flex-1 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && input.trim()) {
                setChain((c) => [...c, input.trim()]);
                setInput("");
              }
            }}
            placeholder="Next link"
          />
          <Button
            onClick={() => {
              if (!input.trim()) return;
              setChain((c) => [...c, input.trim()]);
              setInput("");
            }}
          >
            Add
          </Button>
          <Button
            variant="secondary"
            onClick={() => setChain((c) => [...c, pair.b])}
          >
            Finish
          </Button>
        </div>
      )}
      {finished && (
        <div className="space-y-3">
          <p className="text-[var(--text-secondary)]">
            Nice chain. Now freestyle the bridge — fewer jumps usually sound cleaner.
          </p>
          <Link
            href="/freestyle"
            onClick={() =>
              setPendingSession({
                beatId: "melodic-130",
                durationSec: 90,
                mode: "connection_game",
                promptFrequencySec: 15,
                difficulty: profile.settings.difficulty,
                aiFeedback: true,
                livePrompts: true,
                distractionFree: false,
                customPrompts: chain,
              })
            }
          >
            <Button className="w-full" size="lg" variant="accent">
              Freestyle this chain
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
