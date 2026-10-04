"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { OBJECTS } from "@/lib/data/words";
import Link from "next/link";
import { useAppStore } from "@/lib/store/use-app-store";

export default function SurroundingsPage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [objects, setObjects] = useState<string[]>([]);
  const setPending = useAppStore((s) => s.setPendingSession);
  const profile = useAppStore((s) => s.profile);

  function onFile(file: File) {
    const url = URL.createObjectURL(file);
    setPreview(url);
    // Lightweight mock vision: sample common objects as "detected"
    const shuffled = [...OBJECTS].sort(() => Math.random() - 0.5).slice(0, 6);
    setObjects(shuffled);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl">Surroundings Mode</h1>
        <p className="mt-1 text-[var(--text-secondary)]">
          Upload a photo of your space. We&apos;ll surface usable object prompts.
        </p>
      </header>
      <label className="card-surface flex cursor-pointer flex-col items-center justify-center gap-2 !p-8 text-center">
        <span className="font-display text-xl">Take / upload photo</span>
        <span className="text-sm text-[var(--text-secondary)]">Camera or gallery</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </label>
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Surroundings" className="h-48 w-full rounded-2xl object-cover" />
      )}
      {objects.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl">Detected prompts</h2>
          <div className="flex flex-wrap gap-2">
            {objects.map((o) => (
              <span key={o} className="rounded-full bg-white/5 px-3 py-1 text-sm">
                {o}
              </span>
            ))}
          </div>
          <Card className="!p-4 text-sm text-[var(--text-secondary)]">
            Object detection is mocked locally for development. The same interface can later call a vision API.
          </Card>
          <Link
            href="/freestyle"
            onClick={() =>
              setPending({
                beatId: "lofi-76",
                durationSec: 180,
                mode: "surroundings",
                promptFrequencySec: 12,
                difficulty: profile.settings.difficulty,
                aiFeedback: true,
                livePrompts: true,
                distractionFree: false,
                customPrompts: objects,
              })
            }
          >
            <Button className="w-full" size="lg" variant="accent">
              Start freestyle with these prompts
            </Button>
          </Link>
        </section>
      )}
    </div>
  );
}
