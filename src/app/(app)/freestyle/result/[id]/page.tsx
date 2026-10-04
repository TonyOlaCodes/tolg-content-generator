"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAppStore } from "@/lib/store/use-app-store";
import { SKILL_LABELS } from "@/lib/data/skills";
import { cn } from "@/lib/utils";
import { idbGetBlob } from "@/lib/storage/db";
import { useEffect } from "react";
import type { SkillKey } from "@/lib/types";

export default function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const recording = useAppStore((s) => s.recordings.find((r) => r.id === id));
  const analyses = useAppStore((s) => s.analyses);
  const setPendingSession = useAppStore((s) => s.setPendingSession);
  const deleteRecording = useAppStore((s) => s.deleteRecording);
  const analysis = useMemo(
    () => Object.values(analyses).find((a) => a.recordingId === id) ?? (recording?.analysisId ? analyses[recording.analysisId] : undefined),
    [analyses, id, recording],
  );
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [selectedHighlight, setSelectedHighlight] = useState<string | null>(null);
  const transcript = recording?.transcript?.map((s) => s.text).join(". ") ?? "";

  useEffect(() => {
    let url: string | null = null;
    void idbGetBlob(id).then((blob) => {
      if (!blob) return;
      url = URL.createObjectURL(blob);
      setAudioUrl(url);
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);

  if (!recording) {
    return (
      <div className="space-y-4 py-10 text-center">
        <p>Recording not found.</p>
        <Link href="/home">
          <Button>Home</Button>
        </Link>
      </div>
    );
  }

  const skillEntries = analysis
    ? (Object.entries(analysis.skills) as [SkillKey | "promptUsage", number][])
    : [];

  return (
    <div className="space-y-6 pb-8">
      <header className="animate-fade-up">
        <p className="text-sm text-[var(--text-secondary)]">Session complete</p>
        <h1 className="font-display text-3xl">Freestyle Score</h1>
        <p className="mt-3 font-display text-6xl tracking-tight">
          {analysis?.overallScore ?? "—"}
          <span className="text-2xl text-[var(--text-muted)]"> / {analysis?.maxScore ?? 1000}</span>
        </p>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {recording.beatTitle} · {Math.round(recording.durationSec)}s · {recording.mode.replace(/_/g, " ")}
        </p>
      </header>

      {audioUrl && (
        <Card className="!p-4">
          <p className="mb-2 text-sm text-[var(--text-secondary)]">Listen back</p>
          <audio controls src={audioUrl} className="w-full" />
          <Link href={`/freestyle/listen/${id}`} className="mt-3 inline-block text-sm text-[var(--accent)]">
            Listen Mode with transcript →
          </Link>
        </Card>
      )}

      {analysis && (
        <>
          <section className="space-y-2">
            <h2 className="font-display text-xl">Skill breakdown</h2>
            <div className="space-y-2">
              {skillEntries.map(([key, score]) => (
                <div key={key} className="card-surface p-3">
                  <div className="flex justify-between text-sm">
                    <span>{key === "promptUsage" ? "Prompt Usage" : SKILL_LABELS[key]}</span>
                    <span className="font-display text-lg">{score}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-2">
            <Best label="Best bar" value={analysis.bestBar} />
            <Best label="Best reference" value={analysis.bestReference} />
            <Best label="Best rhyme chain" value={analysis.bestRhymeChain} />
            <Best label="Best transition" value={analysis.bestTransition} />
          </section>

          <Card className="!p-5">
            <h2 className="font-display text-xl">Coach notes</h2>
            <p className="mt-2 text-[var(--text-secondary)]">{analysis.summary}</p>
            {analysis.uncertainNotes.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-[var(--warning)]">
                {analysis.uncertainNotes.map((n) => (
                  <li key={n}>Uncertain: {n}</li>
                ))}
              </ul>
            )}
          </Card>

          <section className="space-y-2">
            <h2 className="font-display text-xl">Missed opportunities</h2>
            {analysis.missedOpportunities.map((m) => (
              <Card key={m.idea} className="!p-4">
                <p className="text-sm text-[var(--accent)]">{m.route.join(" → ")}</p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{m.idea}</p>
              </Card>
            ))}
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl">Transcript analysis</h2>
            <Card className="!p-4">
              <HighlightedTranscript
                text={transcript}
                highlights={analysis.highlights}
                selected={selectedHighlight}
                onSelect={setSelectedHighlight}
              />
              {selectedHighlight && (
                <p className="mt-3 rounded-xl bg-white/5 p-3 text-sm text-[var(--text-secondary)]">
                  {selectedHighlight}
                </p>
              )}
            </Card>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl">Train next</h2>
            {analysis.recommendedDrills.map((d) => (
              <Link
                key={d.title}
                href="/freestyle"
                onClick={() =>
                  setPendingSession({
                    beatId: recording.beatId,
                    durationSec: 180,
                    mode: d.mode,
                    promptFrequencySec: 10,
                    difficulty: recording.difficulty,
                    aiFeedback: true,
                    livePrompts: true,
                    distractionFree: false,
                  })
                }
              >
                <Card interactive>
                  <p className="font-medium">{d.title}</p>
                  <p className="text-sm text-[var(--text-secondary)]">{d.reason}</p>
                </Card>
              </Link>
            ))}
          </section>
        </>
      )}

      <div className="grid gap-2">
        <Link
          href="/freestyle/session"
          onClick={() =>
            setPendingSession({
              beatId: recording.beatId,
              durationSec: recording.durationSec,
              mode: recording.mode,
              promptFrequencySec: 10,
              difficulty: recording.difficulty,
              aiFeedback: true,
              livePrompts: recording.mode !== "blind",
              distractionFree: false,
              customPrompts: recording.prompts,
            })
          }
        >
          <Button className="w-full" size="lg" variant="accent">
            Try Again — same beat & prompts
          </Button>
        </Link>
        <Link href="/home">
          <Button className="w-full" size="lg" variant="secondary">
            Done
          </Button>
        </Link>
        <Button
          variant="ghost"
          className="w-full text-[var(--danger)]"
          onClick={async () => {
            await deleteRecording(id);
            window.location.href = "/home";
          }}
        >
          Delete recording
        </Button>
      </div>
    </div>
  );
}

function Best({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <Card className="!p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-[var(--text-secondary)]">{value}</p>
    </Card>
  );
}

function HighlightedTranscript({
  text,
  highlights,
  selected,
  onSelect,
}: {
  text: string;
  highlights: { start: number; end: number; kind: string; label: string; explanation: string }[];
  selected: string | null;
  onSelect: (v: string) => void;
}) {
  if (!text) return <p className="text-sm text-[var(--text-muted)]">Mock transcript unavailable.</p>;
  const sorted = [...highlights].sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  sorted.forEach((h, i) => {
    if (h.start > cursor) parts.push(<span key={`t${i}`}>{text.slice(cursor, h.start)}</span>);
    const slice = text.slice(h.start, h.end) || h.label;
    parts.push(
      <button
        key={`h${i}`}
        type="button"
        onClick={() => onSelect(h.explanation)}
        className={cn(
          "rounded px-0.5",
          h.kind === "reference" && "bg-[var(--accent)]/20 text-[var(--accent)]",
          h.kind === "filler" && "bg-[var(--danger)]/20 text-[var(--danger)]",
          h.kind === "prompt" && "bg-[var(--accent-2)]/20 text-[var(--accent-2)]",
          h.kind === "wordplay" && "bg-[var(--warning)]/20 text-[var(--warning)]",
          h.kind === "rhyme" && "bg-white/15",
          selected === h.explanation && "ring-1 ring-white/40",
        )}
      >
        {slice}
      </button>,
    );
    cursor = Math.max(cursor, h.end);
  });
  if (cursor < text.length) parts.push(<span key="end">{text.slice(cursor)}</span>);
  return <p className="leading-relaxed text-[var(--text-secondary)]">{parts}</p>;
}
