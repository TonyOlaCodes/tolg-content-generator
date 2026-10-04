"use client";

import Link from "next/link";
import { MODULES, LESSONS } from "@/lib/data/lessons";
import { Card } from "@/components/ui/card";
import { useAppStore } from "@/lib/store/use-app-store";
import { cn } from "@/lib/utils";

export default function LearnPage() {
  const completed = useAppStore((s) => s.completedLessons);

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <h1 className="font-display text-3xl">Learn</h1>
        <p className="mt-1 text-[var(--text-secondary)]">
          Structured modules for the mental skills behind long-form improvisation.
        </p>
      </header>

      <div className="space-y-5">
        {MODULES.map((mod) => {
          const lessons = LESSONS.filter((l) => l.moduleId === mod.id);
          const doneCount = lessons.filter((l) => completed.includes(l.id)).length;
          return (
            <section key={mod.id} className="space-y-2">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Module {mod.number}
                  </p>
                  <h2 className="font-display text-xl">{mod.title}</h2>
                  <p className="text-sm text-[var(--text-secondary)]">{mod.description}</p>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  {doneCount}/{lessons.length}
                </p>
              </div>
              <div className="space-y-2">
                {lessons.map((lesson) => {
                  const done = completed.includes(lesson.id);
                  return (
                    <Link key={lesson.id} href={`/learn/${lesson.id}`}>
                      <Card interactive className={cn(done && "opacity-80")}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{lesson.title}</p>
                            <p className="text-sm text-[var(--text-secondary)]">{lesson.summary}</p>
                          </div>
                          <div className="text-right text-xs text-[var(--text-muted)]">
                            <p>{lesson.durationMin}m</p>
                            <p>{done ? "Done" : `+${lesson.xpReward}`}</p>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
