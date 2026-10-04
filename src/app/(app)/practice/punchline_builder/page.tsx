"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const SETUPS = [
  "They said I couldn't rise from the basement,",
  "Everybody talking peace while they sharpen a blade,",
  "I keep receipts like the cloud never forgets,",
  "You want the crown but you rented the throne,",
];

const PUNCHES = [
  "so I turned the stairs into a launchpad.",
  "I'm world peace with a defense that still raids.",
  "every lie you told is timestamped in my head.",
  "ownership is quiet — lease agreements scream.",
];

export default function PunchlineBuilderPage() {
  const [mode, setMode] = useState<"setup" | "punch">("setup");
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);

  const prompt = mode === "setup" ? SETUPS[index % SETUPS.length]! : PUNCHES[index % PUNCHES.length]!;
  const reveal = mode === "setup" ? PUNCHES[index % PUNCHES.length]! : SETUPS[index % SETUPS.length]!;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl">Punchline Builder</h1>
        <p className="mt-1 text-[var(--text-secondary)]">Setup → expectation → punch. Or reverse-engineer.</p>
      </header>
      <div className="flex gap-2">
        <Button variant={mode === "setup" ? "accent" : "secondary"} onClick={() => { setMode("setup"); setRevealed(false); setAnswer(""); }}>
          Given setup
        </Button>
        <Button variant={mode === "punch" ? "accent" : "secondary"} onClick={() => { setMode("punch"); setRevealed(false); setAnswer(""); }}>
          Given punch
        </Button>
      </div>
      <Card className="!p-5">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">
          {mode === "setup" ? "Setup" : "Punch"}
        </p>
        <p className="mt-2 font-display text-2xl">{prompt}</p>
      </Card>
      <textarea
        className="min-h-28 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"
        placeholder={mode === "setup" ? "Write your punch…" : "Write a setup that earns this punch…"}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => setRevealed(true)}>
          Show example
        </Button>
        <Button
          variant="accent"
          onClick={() => {
            setIndex((i) => i + 1);
            setAnswer("");
            setRevealed(false);
          }}
        >
          Next
        </Button>
      </div>
      {revealed && (
        <Card className="!p-4">
          <p className="text-xs text-[var(--text-muted)]">Example continuation</p>
          <p className="mt-1 text-[var(--text-secondary)]">{reveal}</p>
        </Card>
      )}
      {answer && (
        <Card className="!p-4">
          <p className="text-xs text-[var(--text-muted)]">Your take</p>
          <p className="mt-1">
            {mode === "setup" ? `${prompt} ${answer}` : `${answer} ${prompt}`}
          </p>
        </Card>
      )}
    </div>
  );
}
