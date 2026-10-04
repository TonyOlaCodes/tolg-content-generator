"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RHYME_FAMILIES } from "@/lib/data/words";
import { useAppStore } from "@/lib/store/use-app-store";

export default function RhymeChainPage() {
  const fam = useMemo(() => RHYME_FAMILIES[Math.floor(Math.random() * RHYME_FAMILIES.length)]!, []);
  const [chain, setChain] = useState<string[]>([fam.seed]);
  const [input, setInput] = useState("");
  const profile = useAppStore((s) => s.profile);
  const updateProfile = useAppStore((s) => s.updateProfile);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl">Rhyme Chain</h1>
        <p className="mt-1 text-[var(--text-secondary)]">Think sounds, not spelling. Keep the family going.</p>
      </header>
      <Card className="!p-5">
        <p className="text-xs text-[var(--text-muted)]">Seed sound</p>
        <p className="font-display text-3xl">{fam.seed}</p>
      </Card>
      <Card className="!p-4">
        <p className="text-[var(--accent)]">{chain.join(" → ")}</p>
        <p className="mt-2 text-xs text-[var(--text-muted)]">{chain.length} links</p>
      </Card>
      <div className="flex gap-2">
        <input
          className="h-12 flex-1 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) {
              const next = [...chain, input.trim()];
              setChain(next);
              setInput("");
              if (next.length >= 20) {
                updateProfile({
                  unlockedAchievements: [...new Set([...profile.unlockedAchievements, "rhyme_20"])],
                });
              }
            }
          }}
          placeholder="Next rhyme"
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
      </div>
      <Card className="!p-4">
        <p className="text-xs text-[var(--text-muted)]">Possible family (peek)</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{fam.family.join(" · ")}</p>
      </Card>
    </div>
  );
}
