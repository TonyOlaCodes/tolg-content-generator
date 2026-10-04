"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAppStore } from "@/lib/store/use-app-store";
import { idbGetBlob } from "@/lib/storage/db";

export default function ListenModePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const recording = useAppStore((s) => s.recordings.find((r) => r.id === id));
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [advice, setAdvice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const transcript = useMemo(
    () => recording?.transcript?.map((s) => s.text).join(". ") ?? "",
    [recording],
  );

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
      <div className="py-10 text-center">
        <p>Recording not found.</p>
        <Link href="/progress">
          <Button className="mt-4">Progress</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl">Listen Mode</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Play back with synced transcript. Select a section for targeted coaching.
        </p>
      </header>
      {audioUrl && <audio controls src={audioUrl} className="w-full" />}
      <Card className="!p-4 space-y-3">
        {(recording.transcript ?? []).map((seg) => (
          <button
            key={seg.id}
            type="button"
            onClick={() => setSelected(seg.text)}
            className={`block w-full rounded-xl px-3 py-2 text-left text-sm ${
              selected === seg.text ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "bg-white/5 text-[var(--text-secondary)]"
            }`}
          >
            <span className="mr-2 text-xs text-[var(--text-muted)]">
              {(seg.startMs / 1000).toFixed(1)}s
            </span>
            {seg.text}
          </button>
        ))}
        {!recording.transcript?.length && (
          <p className="text-sm text-[var(--text-muted)]">{transcript || "No transcript segments."}</p>
        )}
      </Card>
      <Button
        className="w-full"
        variant="accent"
        disabled={!selected || loading}
        onClick={async () => {
          setLoading(true);
          try {
            const res = await fetch("/api/ai/improve-section", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                section: selected,
                surrounding: transcript,
                transcript,
              }),
            });
            const data = (await res.json()) as { reply?: string };
            setAdvice(data.reply ?? "Try adding one concrete reference branch.");
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? "Analyzing…" : "How could I improve this section?"}
      </Button>
      {advice && (
        <Card className="!p-4">
          <p className="whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{advice}</p>
        </Card>
      )}
      <Link href={`/freestyle/result/${id}`}>
        <Button className="w-full" variant="secondary">
          Back to results
        </Button>
      </Link>
    </div>
  );
}
