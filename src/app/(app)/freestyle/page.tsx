"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BUILT_IN_BEATS, BEAT_CATEGORY_LABELS } from "@/lib/data/beats";
import { EXERCISES } from "@/lib/data/exercises";
import { useAppStore } from "@/lib/store/use-app-store";
import type { Beat, Difficulty, PracticeModeId } from "@/lib/types";
import { cn, uid } from "@/lib/utils";
import { Upload } from "lucide-react";

const DURATIONS = [
  { label: "60s", value: 60 },
  { label: "2m", value: 120 },
  { label: "5m", value: 300 },
  { label: "10m", value: 600 },
  { label: "15m", value: 900 },
  { label: "∞", value: null },
];

const DIFFS: Difficulty[] = ["beginner", "intermediate", "advanced", "elite", "endless"];
const FREQS = [3, 5, 10, 15, 20, 30];

export default function FreestyleSetupPage() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const pending = useAppStore((s) => s.pendingSession);
  const setPendingSession = useAppStore((s) => s.setPendingSession);
  const addCustomBeat = useAppStore((s) => s.addCustomBeat);
  const customBeats = useAppStore((s) => s.customBeats);

  const beats = useMemo(() => [...BUILT_IN_BEATS, ...customBeats], [customBeats]);
  const [beatId, setBeatId] = useState(pending?.beatId ?? "boom-bap-92");
  const [durationSec, setDurationSec] = useState<number | null>(pending?.durationSec ?? 60);
  const [mode, setMode] = useState<PracticeModeId>(pending?.mode ?? "free");
  const [freq, setFreq] = useState(pending?.promptFrequencySec ?? profile.settings.promptFrequencySec);
  const [difficulty, setDifficulty] = useState<Difficulty>(pending?.difficulty ?? profile.settings.difficulty);
  const [aiFeedback, setAiFeedback] = useState(pending?.aiFeedback ?? true);
  const [livePrompts, setLivePrompts] = useState(pending?.livePrompts ?? mode !== "blind");
  const [distractionFree, setDistractionFree] = useState(false);
  const [category, setCategory] = useState<string>("all");

  const filtered = beats.filter((b) => category === "all" || b.category === category);

  async function onUploadBeat(file: File) {
    const url = URL.createObjectURL(file);
    const beat: Beat = {
      id: uid("beat"),
      title: file.name.replace(/\.[^.]+$/, ""),
      category: "experimental",
      bpm: profile.settings.preferredBpm,
      durationSec: 180,
      style: "Imported",
      src: url,
      isCustom: true,
    };
    addCustomBeat(beat);
    setBeatId(beat.id);
  }

  function start() {
    setPendingSession({
      beatId,
      durationSec,
      mode,
      promptFrequencySec: freq,
      difficulty,
      aiFeedback,
      livePrompts: mode === "blind" ? false : livePrompts,
      distractionFree,
    });
    router.push("/freestyle/session");
  }

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <h1 className="font-display text-3xl">Freestyle</h1>
        <p className="mt-1 text-[var(--text-secondary)]">Two taps from here. Beat, duration, go.</p>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">Choose Beat</h2>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-[var(--accent)]">
            <Upload className="h-4 w-4" />
            Upload
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUploadBeat(f);
              }}
            />
          </label>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Chip active={category === "all"} onClick={() => setCategory("all")}>
            All
          </Chip>
          {Object.entries(BEAT_CATEGORY_LABELS).map(([k, label]) => (
            <Chip key={k} active={category === k} onClick={() => setCategory(k)}>
              {label}
            </Chip>
          ))}
        </div>
        <div className="space-y-2">
          {filtered.map((beat) => (
            <button
              key={beat.id}
              type="button"
              onClick={() => setBeatId(beat.id)}
              className={cn(
                "card-surface w-full p-4 text-left transition",
                beatId === beat.id && "border-[var(--accent)] ring-1 ring-[var(--accent)]",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{beat.title}</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {BEAT_CATEGORY_LABELS[beat.category]} · {beat.style}
                  </p>
                </div>
                <div className="text-right text-xs text-[var(--text-muted)]">
                  <p>{beat.bpm} BPM</p>
                  {beat.key && <p>{beat.key}</p>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

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

      <section className="space-y-3">
        <h2 className="font-display text-xl">Training Mode</h2>
        <div className="grid max-h-56 gap-2 overflow-y-auto pr-1">
          {EXERCISES.map((ex) => (
            <button
              key={ex.id}
              type="button"
              onClick={() => {
                setMode(ex.id);
                if (ex.id === "blind") setLivePrompts(false);
              }}
              className={cn(
                "card-surface w-full p-3 text-left",
                mode === ex.id && "border-[var(--accent)] ring-1 ring-[var(--accent)]",
              )}
            >
              <p className="font-medium">{ex.title}</p>
              <p className="text-xs text-[var(--text-secondary)]">{ex.subtitle}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Prompt frequency</h2>
        <div className="flex flex-wrap gap-2">
          {FREQS.map((f) => (
            <Chip key={f} active={freq === f} onClick={() => setFreq(f)}>
              {f}s
            </Chip>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Difficulty</h2>
        <div className="flex flex-wrap gap-2">
          {DIFFS.map((d) => (
            <Chip key={d} active={difficulty === d} onClick={() => setDifficulty(d)}>
              {d}
            </Chip>
          ))}
        </div>
      </section>

      <Card className="space-y-3 !p-5">
        <ToggleRow label="AI feedback" value={aiFeedback} onChange={setAiFeedback} />
        <ToggleRow label="Live prompts" value={livePrompts} onChange={setLivePrompts} />
        <ToggleRow label="Distraction-free mode" value={distractionFree} onChange={setDistractionFree} />
      </Card>

      <Button size="lg" variant="accent" className="w-full" onClick={start}>
        Start Freestyle
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
