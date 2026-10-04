"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AssociationTreeView } from "@/components/practice/association-tree-view";
import { REFERENCES } from "@/lib/data/references";
import { useAppStore } from "@/lib/store/use-app-store";
import { getClientAI } from "@/lib/ai";

export default function AssociationLabPage() {
  const trackAssociations = useAppStore((s) => s.trackAssociations);
  const profile = useAppStore((s) => s.profile);
  const subject = useMemo(
    () => REFERENCES[Math.floor(Math.random() * REFERENCES.length)]!,
    [],
  );
  const [seconds, setSeconds] = useState(10);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [input, setInput] = useState("");
  const [concepts, setConcepts] = useState<string[]>([]);
  const [tree, setTree] = useState(subject.associationTree);
  const showHints = profile.settings.difficulty === "beginner" || profile.settings.difficulty === "intermediate";

  useEffect(() => {
    if (!running || done) return;
    if (seconds <= 0) {
      setDone(true);
      setRunning(false);
      trackAssociations(subject.name, concepts);
      void getClientAI().generateAssociations(subject.name).then(setTree);
      return;
    }
    const t = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [running, seconds, done, concepts, subject.name, trackAssociations]);

  function addConcept() {
    const c = input.trim();
    if (!c) return;
    setConcepts((prev) => [...new Set([...prev, c])]);
    setInput("");
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-[var(--text-secondary)]">Practice</p>
        <h1 className="font-display text-3xl">Association Lab</h1>
        <p className="mt-1 text-[var(--text-secondary)]">
          10 seconds. Type as many connected concepts as you can.
        </p>
      </header>

      <Card className="!p-5 text-center">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Starting concept</p>
        <p className="mt-2 font-display text-3xl">{subject.name}</p>
        {showHints && !running && !done && (
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            Hints: {subject.associatedWords.slice(0, 4).join(" · ")}
          </p>
        )}
        <p className="mt-4 font-display text-5xl tabular-nums text-[var(--accent)]">{seconds}</p>
      </Card>

      {!running && !done && (
        <Button size="lg" variant="accent" className="w-full" onClick={() => setRunning(true)}>
          Start 10s
        </Button>
      )}

      {(running || done) && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addConcept()}
              disabled={done}
              placeholder="Type a connection"
              className="h-12 flex-1 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 outline-none focus:border-[var(--accent)]"
            />
            <Button onClick={addConcept} disabled={done}>
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {concepts.map((c) => (
              <span key={c} className="rounded-full bg-white/5 px-3 py-1 text-sm">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {done && (
        <section className="space-y-3">
          <h2 className="font-display text-xl">Your map vs possible routes</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            You listed {concepts.length} concepts. Tap branches to expand directions you can freestyle.
          </p>
          <Card className="!p-4">
            <AssociationTreeView nodes={tree} />
          </Card>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => window.location.reload()}>
              New subject
            </Button>
            <Link href="/freestyle">
              <Button className="w-full" variant="accent">
                Freestyle it
              </Button>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
