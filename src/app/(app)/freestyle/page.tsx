"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Music2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BUILT_IN_BEATS, BEAT_CATEGORY_LABELS } from "@/lib/data/beats";
import { useAppStore } from "@/lib/store/use-app-store";
import type { Difficulty, PracticeModeId } from "@/lib/types";
import { cn, formatDuration } from "@/lib/utils";

const DURATIONS = [
  { label: "60s", value: 60 },
  { label: "2m", value: 120 },
  { label: "5m", value: 300 },
  { label: "10m", value: 600 },
  { label: "∞", value: null },
];

export default function FreestyleSetupPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const profile = useAppStore((s) => s.profile);
  const pending = useAppStore((s) => s.pendingSession);
  const customBeats = useAppStore((s) => s.customBeats);
  const setPendingSession = useAppStore((s) => s.setPendingSession);
  const importBeatFile = useAppStore((s) => s.importBeatFile);
  const removeCustomBeat = useAppStore((s) => s.removeCustomBeat);
  const setLastBeatId = useAppStore((s) => s.setLastBeatId);

  const lastId = profile.settings.lastBeatId;
  const [beatId, setBeatId] = useState<string | null>(
    pending?.beatId ?? lastId ?? customBeats[0]?.id ?? null,
  );
  const [durationSec, setDurationSec] = useState<number | null>(pending?.durationSec ?? 180);
  const [mode, setMode] = useState<PracticeModeId>(pending?.mode ?? "free");
  const [livePrompts, setLivePrompts] = useState(pending?.livePrompts ?? false);
  const [aiFeedback, setAiFeedback] = useState(pending?.aiFeedback ?? true);
  const [showMore, setShowMore] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showBuiltIns, setShowBuiltIns] = useState(false);

  const selected =
    beatId === null
      ? null
      : customBeats.find((b) => b.id === beatId) ?? BUILT_IN_BEATS.find((b) => b.id === beatId) ?? null;

  const yourMusic = useMemo(() => customBeats, [customBeats]);

  async function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("audio/") && !/\.(mp3|wav|m4a|aac|ogg|flac|webm)$/i.test(file.name)) {
      toast.error("Pick an audio file (mp3, wav, m4a, etc.)");
      return;
    }
    setImporting(true);
    try {
      const beat = await importBeatFile(file);
      setBeatId(beat.id);
      toast.success(`Loaded “${beat.title}”`);
    } catch {
      toast.error("Couldn't import that file. Try mp3 or wav.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function start() {
    if (beatId) setLastBeatId(beatId);
    setPendingSession({
      beatId,
      durationSec,
      mode,
      promptFrequencySec: profile.settings.promptFrequencySec,
      difficulty: profile.settings.difficulty as Difficulty,
      aiFeedback,
      livePrompts: mode === "blind" ? false : livePrompts,
      distractionFree: false,
    });
    router.push("/freestyle/session");
  }

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <h1 className="font-display text-3xl">Freestyle</h1>
        <p className="mt-1 text-[var(--text-secondary)]">
          Drop in your own instrumental — then hit start.
        </p>
      </header>

      <input
        ref={fileRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.webm"
        className="hidden"
        onChange={(e) => void onFiles(e.target.files)}
      />

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={importing}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(e) => {
          e.preventDefault();
          void onFiles(e.dataTransfer.files);
        }}
        className="card-surface flex w-full flex-col items-center justify-center gap-3 border-dashed border-[var(--accent)]/40 !p-8 text-center transition hover:border-[var(--accent)] hover:bg-[var(--card-hover)]"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)] text-black">
          <Upload className="h-7 w-7" />
        </span>
        <div>
          <p className="font-display text-xl">{importing ? "Importing…" : "Add your music"}</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            MP3, WAV, M4A from Files / Downloads — stays on this device
          </p>
        </div>
      </button>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Your library</h2>
        {yourMusic.length === 0 ? (
          <Card className="!p-5 text-sm text-[var(--text-secondary)]">
            No tracks yet. Import a real beat or instrumental above — the built-in placeholders are only backups.
          </Card>
        ) : (
          <div className="space-y-2">
            {yourMusic.map((beat) => (
              <div
                key={beat.id}
                className={cn(
                  "card-surface flex items-center gap-3 p-3",
                  beatId === beat.id && "border-[var(--accent)] ring-1 ring-[var(--accent)]",
                )}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => {
                    setBeatId(beat.id);
                    setLastBeatId(beat.id);
                  }}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5">
                    <Music2 className="h-5 w-5 text-[var(--accent)]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{beat.title}</span>
                    <span className="block text-xs text-[var(--text-muted)]">
                      {formatDuration(beat.durationSec)} · saved on device
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="rounded-xl p-2 text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--danger)]"
                  aria-label={`Delete ${beat.title}`}
                  onClick={() => void removeCustomBeat(beat.id).then(() => {
                    if (beatId === beat.id) setBeatId(customBeats.find((b) => b.id !== beat.id)?.id ?? null);
                  })}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          className={cn(
            "card-surface w-full p-4 text-left",
            beatId === null && "border-[var(--accent)] ring-1 ring-[var(--accent)]",
          )}
          onClick={() => setBeatId(null)}
        >
          <p className="font-medium">No beat — acapella</p>
          <p className="text-sm text-[var(--text-secondary)]">Just mic + timer</p>
        </button>
      </section>

      <section className="space-y-2">
        <button
          type="button"
          className="text-sm text-[var(--text-muted)] underline-offset-4 hover:underline"
          onClick={() => setShowBuiltIns((v) => !v)}
        >
          {showBuiltIns ? "Hide" : "Show"} backup demo beats
        </button>
        {showBuiltIns && (
          <div className="space-y-2">
            {BUILT_IN_BEATS.map((beat) => (
              <button
                key={beat.id}
                type="button"
                onClick={() => setBeatId(beat.id)}
                className={cn(
                  "card-surface w-full p-3 text-left",
                  beatId === beat.id && "border-[var(--accent)] ring-1 ring-[var(--accent)]",
                )}
              >
                <p className="font-medium">{beat.title}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  Demo · {BEAT_CATEGORY_LABELS[beat.category]} · {beat.bpm} BPM
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      {selected && (
        <Card className="!p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Selected</p>
          <p className="mt-1 font-display text-xl">{selected.title}</p>
          <audio controls src={selected.src} className="mt-3 w-full" preload="metadata" />
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-xl">Duration</h2>
        <div className="flex flex-wrap gap-2">
          {DURATIONS.map((d) => (
            <Chip key={String(d.value)} active={durationSec === d.value} onClick={() => setDurationSec(d.value)}>
              {d.label}
            </Chip>
          ))}
        </div>
      </section>

      <button
        type="button"
        className="text-sm text-[var(--text-secondary)] underline-offset-4 hover:underline"
        onClick={() => setShowMore((v) => !v)}
      >
        {showMore ? "Hide options" : "More options"}
      </button>

      {showMore && (
        <Card className="space-y-4 !p-5">
          <ToggleRow label="Live word prompts" value={livePrompts} onChange={setLivePrompts} />
          <ToggleRow label="AI feedback after" value={aiFeedback} onChange={setAiFeedback} />
          <div className="space-y-2">
            <p className="text-sm text-[var(--text-secondary)]">Mode</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["free", "Free"],
                  ["blind", "Blind"],
                  ["random_word", "Random word"],
                  ["survival_60", "60s survival"],
                ] as const
              ).map(([id, label]) => (
                <Chip
                  key={id}
                  active={mode === id}
                  onClick={() => {
                    setMode(id);
                    if (id === "blind") setLivePrompts(false);
                    if (id === "survival_60") setDurationSec(60);
                  }}
                >
                  {label}
                </Chip>
              ))}
            </div>
          </div>
        </Card>
      )}

      <Button size="lg" variant="accent" className="w-full" onClick={start} disabled={importing}>
        {selected ? `Start with “${selected.title}”` : "Start acapella"}
      </Button>
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-4 py-2 text-sm capitalize transition",
        active ? "bg-white text-black" : "bg-white/5 text-[var(--text-secondary)]",
      )}
    >
      {children}
    </button>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button type="button" className="flex w-full items-center justify-between" onClick={() => onChange(!value)}>
      <span>{label}</span>
      <span
        className={cn(
          "flex h-7 w-12 items-center rounded-full px-1 transition",
          value ? "bg-[var(--accent)]" : "bg-white/10",
        )}
      >
        <span className={cn("h-5 w-5 rounded-full bg-white transition", value && "translate-x-5")} />
      </span>
    </button>
  );
}
