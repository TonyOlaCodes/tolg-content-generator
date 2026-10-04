"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AssociationTreeView } from "@/components/practice/association-tree-view";
import { REFERENCES } from "@/lib/data/references";
import { useAppStore } from "@/lib/store/use-app-store";

export default function ReferenceLabPage() {
  const trackAssociations = useAppStore((s) => s.trackAssociations);
  const ref = useMemo(() => REFERENCES[Math.floor(Math.random() * REFERENCES.length)]!, []);
  const [seconds, setSeconds] = useState(15);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [input, setInput] = useState("");
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    if (!running || done) return;
    if (seconds <= 0) {
      setDone(true);
      setRunning(false);
      trackAssociations(ref.name, items);
      return;
    }
    const t = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [running, seconds, done, items, ref.name, trackAssociations]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl">Reference Lab</h1>
        <p className="mt-1 text-[var(--text-secondary)]">15 seconds — dump every usable freestyle route.</p>
      </header>
      <Card className="!p-5 text-center">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">{ref.category}</p>
        <p className="mt-2 font-display text-3xl">{ref.name}</p>
        <p className="mt-4 font-display text-5xl text-[var(--accent)]">{seconds}</p>
      </Card>
      {!running && !done && (
        <Button size="lg" className="w-full" variant="accent" onClick={() => setRunning(true)}>
          Start
        </Button>
      )}
      {(running || done) && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              className="h-12 flex-1 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4"
              value={input}
              disabled={done}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && input.trim()) {
                  setItems((p) => [...p, input.trim()]);
                  setInput("");
                }
              }}
              placeholder="Usable reference / route"
            />
            <Button
              disabled={done}
              onClick={() => {
                if (!input.trim()) return;
                setItems((p) => [...p, input.trim()]);
                setInput("");
              }}
            >
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {items.map((i) => (
              <span key={i} className="rounded-full bg-white/5 px-3 py-1 text-sm">
                {i}
              </span>
            ))}
          </div>
        </div>
      )}
      {done && (
        <section className="space-y-3">
          <h2 className="font-display text-xl">Reveal</h2>
          <Card className="!p-4 space-y-2">
            <p className="text-sm text-[var(--text-secondary)]">{ref.shortDescription}</p>
            <p className="text-sm"><span className="text-[var(--text-muted)]">Known for:</span> {ref.knownFor.join(" · ")}</p>
            <p className="text-sm"><span className="text-[var(--text-muted)]">Wordplay:</span> {ref.wordplayRoutes.join(" · ")}</p>
          </Card>
          <Card className="!p-4">
            <AssociationTreeView nodes={ref.associationTree} />
          </Card>
          <Button className="w-full" variant="secondary" onClick={() => window.location.reload()}>
            Another reference
          </Button>
        </section>
      )}
    </div>
  );
}
