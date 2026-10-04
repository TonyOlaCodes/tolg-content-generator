"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card } from "@/components/ui/card";
import { useAppStore } from "@/lib/store/use-app-store";
import { SKILL_LABELS } from "@/lib/data/skills";
import { ACHIEVEMENTS } from "@/lib/data/achievements";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type Range = "7d" | "30d" | "3m" | "all";

export default function ProgressPage() {
  const profile = useAppStore((s) => s.profile);
  const progress = useAppStore((s) => s.progress);
  const vocab = useAppStore((s) => s.vocab);
  const insights = useAppStore((s) => s.getInsights)();
  const recordings = useAppStore((s) => s.recordings);
  const [range, setRange] = useState<Range>("30d");

  const data = useMemo(() => {
    const now = Date.now();
    const cutoff =
      range === "7d"
        ? now - 7 * 86400000
        : range === "30d"
          ? now - 30 * 86400000
          : range === "3m"
            ? now - 90 * 86400000
            : 0;
    return progress
      .filter((p) => new Date(p.date).getTime() >= cutoff)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [progress, range]);

  const topWords = Object.entries(vocab.wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const topRefs = Object.entries(vocab.referenceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const edges = [...vocab.associationEdges].sort((a, b) => b.count - a.count).slice(0, 8);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl">Progress</h1>
        <p className="mt-1 text-[var(--text-secondary)]">Scores, endurance, vocabulary habits, and limiters.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["7d", "7 days"],
            ["30d", "30 days"],
            ["3m", "3 months"],
            ["all", "All time"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setRange(k)}
            className={`rounded-full px-3 py-1.5 text-sm ${range === k ? "bg-white text-black" : "bg-white/5 text-[var(--text-secondary)]"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <Card className="!p-4">
        <p className="mb-3 text-sm text-[var(--text-secondary)]">Overall freestyle score</p>
        <div className="h-48">
          {data.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" stroke="#6b6b76" tick={{ fontSize: 10 }} />
                <YAxis stroke="#6b6b76" tick={{ fontSize: 10 }} domain={[0, 1000]} />
                <Tooltip
                  contentStyle={{ background: "#141418", border: "1px solid #26262e", borderRadius: 12 }}
                />
                <Line type="monotone" dataKey="overall" stroke="#3ddea8" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
              Record freestyles to populate charts.
            </div>
          )}
        </div>
      </Card>

      <section className="grid grid-cols-1 gap-2">
        <Card className="!p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Strongest</p>
          <p className="font-display text-2xl">{SKILL_LABELS[insights.strongest]}</p>
        </Card>
        <Card className="!p-4 border-[var(--warning)]/30">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--warning)]">Your biggest limiter</p>
          <p className="font-display text-2xl">{SKILL_LABELS[insights.weakest]}</p>
          <div className="mt-3 space-y-2">
            {insights.recommendations.map((r) => (
              <p key={r.title} className="text-sm text-[var(--text-secondary)]">
                Recommended: {r.title}
              </p>
            ))}
          </div>
          <Link href="/practice" className="mt-3 inline-block">
            <Button size="sm" variant="accent">
              Train limiter
            </Button>
          </Link>
        </Card>
        <Card className="!p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Fastest improving focus</p>
          <p className="font-display text-2xl">{SKILL_LABELS[insights.fastestImproving]}</p>
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl">Personal dictionary</h2>
        <Card className="!p-4">
          <p className="text-xs text-[var(--text-muted)]">Most used words</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {topWords.length ? (
              topWords.map(([w, c]) => (
                <span key={w} className="rounded-full bg-white/5 px-3 py-1 text-sm">
                  {w} · {c}
                </span>
              ))
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">No vocabulary profile yet.</p>
            )}
          </div>
          {topWords.length >= 3 && (
            <p className="mt-3 text-sm text-[var(--warning)]">
              Watch repetition — branch into new semantic areas in the Reference Library.
            </p>
          )}
        </Card>
        <Card className="!p-4">
          <p className="text-xs text-[var(--text-muted)]">Most used references / prompts</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {topRefs.map(([w, c]) => (
              <span key={w} className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-sm text-[var(--accent)]">
                {w} · {c}
              </span>
            ))}
          </div>
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl">Personal association map</h2>
        <Card className="!p-4 space-y-2">
          {edges.length ? (
            edges.map((e) => (
              <p key={`${e.from}-${e.to}`} className="text-sm text-[var(--text-secondary)]">
                {e.from} → {e.to} <span className="text-[var(--text-muted)]">×{e.count}</span>
              </p>
            ))
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">Run Association Lab to build your network.</p>
          )}
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl">Achievements</h2>
        <div className="grid grid-cols-1 gap-2">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = profile.unlockedAchievements.includes(a.id);
            return (
              <Card key={a.id} className={unlocked ? "" : "opacity-45"}>
                <p className="font-medium">{a.title}</p>
                <p className="text-sm text-[var(--text-secondary)]">{a.description}</p>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl">Recent freestyles</h2>
        {recordings.slice(0, 8).map((r) => (
          <Link key={r.id} href={`/freestyle/result/${r.id}`}>
            <Card interactive>
              <p className="font-medium">{r.beatTitle ?? "Freestyle"}</p>
              <p className="text-sm text-[var(--text-secondary)]">
                {new Date(r.createdAt).toLocaleString()} · {Math.round(r.durationSec)}s · {r.mode}
              </p>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
