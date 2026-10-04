"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RANDOM_WORDS } from "@/lib/data/words";
import { useAppStore } from "@/lib/store/use-app-store";

export default function RapidAssociationPage() {
  const track = useAppStore((s) => s.trackAssociations);
  const [running, setRunning] = useState(false);
  const [word, setWord] = useState(RANDOM_WORDS[0]!);
  const [intervalMs, setIntervalMs] = useState(2500);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => {
      setWord(RANDOM_WORDS[Math.floor(Math.random() * RANDOM_WORDS.length)]!);
      setIntervalMs((ms) => Math.max(900, ms - 40));
    }, intervalMs);
    return () => window.clearInterval(t);
  }, [running, intervalMs]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl">Rapid Association</h1>
        <p className="mt-1 text-[var(--text-secondary)]">No rapping. First related concept. Speed climbs.</p>
      </header>
      <Card className="!p-8 text-center">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Flash</p>
        <p className="mt-3 font-display text-5xl text-[var(--accent)]">{word}</p>
        <p className="mt-4 text-sm text-[var(--text-muted)]">{(intervalMs / 1000).toFixed(1)}s pace · score {score}</p>
      </Card>
      {!running ? (
        <Button className="w-full" size="lg" variant="accent" onClick={() => setRunning(true)}>
          Start
        </Button>
      ) : (
        <div className="flex gap-2">
          <input
            className="h-12 flex-1 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && answer.trim()) {
                track(word, [answer.trim()]);
                setScore((s) => s + 1);
                setAnswer("");
              }
            }}
            placeholder="First connection"
            autoFocus
          />
          <Button variant="secondary" onClick={() => setRunning(false)}>
            Stop
          </Button>
        </div>
      )}
    </div>
  );
}
