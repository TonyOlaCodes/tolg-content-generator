"use client";

import Link from "next/link";
import { EXERCISES } from "@/lib/data/exercises";
import { Card } from "@/components/ui/card";
import { useAppStore } from "@/lib/store/use-app-store";
import type { PracticeModeId } from "@/lib/types";

export default function PracticePage() {
  const setPendingSession = useAppStore((s) => s.setPendingSession);
  const profile = useAppStore((s) => s.profile);
  const featured = EXERCISES.filter((e) => e.featured);
  const rest = EXERCISES.filter((e) => !e.featured);

  function launch(mode: PracticeModeId) {
    // Dedicated lab UIs manage their own flow — only preconfigure freestyle modes.
    if (labHref(mode) !== "/freestyle") return;
    setPendingSession({
      beatId: profile.settings.lastBeatId ?? "mixkit-403",
      durationSec: mode === "survival_60" ? 60 : mode === "endurance" ? 300 : 180,
      mode,
      promptFrequencySec: profile.settings.promptFrequencySec,
      difficulty: profile.settings.difficulty,
      aiFeedback: profile.settings.aiFeedback,
      livePrompts: !["blind", "free", "endurance", "survival_60"].includes(mode) || mode === "survival_60",
      distractionFree: false,
    });
  }

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <h1 className="font-display text-3xl">Practice</h1>
        <p className="mt-1 text-[var(--text-secondary)]">
          Targeted drills for association, rhyme, references, recovery, and endurance.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Featured</h2>
        <div className="space-y-2">
          {featured.map((ex) => (
            <Link key={ex.id} href={labHref(ex.id)} onClick={() => launch(ex.id)}>
              <Card interactive className="!p-5">
                <p className="font-display text-xl">{ex.title}</p>
                <p className="text-sm text-[var(--accent)]">{ex.subtitle}</p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{ex.description}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3 pb-4">
        <h2 className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">All modes</h2>
        <div className="grid gap-2">
          {rest.map((ex) => (
            <Link key={ex.id} href={labHref(ex.id)} onClick={() => launch(ex.id)}>
              <Card interactive>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{ex.title}</p>
                    <p className="text-sm text-[var(--text-secondary)]">{ex.subtitle}</p>
                  </div>
                  <span className="text-xs text-[var(--text-muted)]">{ex.durationMin}m</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function labHref(mode: PracticeModeId): string {
  if (
    [
      "association_lab",
      "reference_lab",
      "connection_game",
      "double_meaning",
      "punchline_builder",
      "rapid_association",
      "rhyme_chain",
      "surroundings",
    ].includes(mode)
  ) {
    return `/practice/${mode}`;
  }
  return "/freestyle";
}
