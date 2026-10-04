"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Lesson } from "@/lib/types";
import { AssociationTreeView } from "@/components/practice/association-tree-view";
import { getReference } from "@/lib/data/references";
import { getWord } from "@/lib/data/words";
import { useAppStore } from "@/lib/store/use-app-store";
import { useRouter } from "next/navigation";

export function LessonPlayer({ lesson }: { lesson: Lesson }) {
  const [step, setStep] = useState(0);
  const completeLesson = useAppStore((s) => s.completeLesson);
  const done = useAppStore((s) => s.completedLessons.includes(lesson.id));
  const router = useRouter();
  const current = lesson.steps[step]!;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-[var(--text-secondary)]">
          Step {step + 1} / {lesson.steps.length}
        </p>
        <h1 className="font-display text-3xl">{lesson.title}</h1>
      </header>
      <Card className="!p-5 space-y-3">
        <h2 className="font-display text-xl">{current.title}</h2>
        <p className="leading-relaxed text-[var(--text-secondary)]">{current.body}</p>
        {current.interactive?.type === "rhyme_family" && (
          <div className="rounded-2xl bg-white/5 p-4">
            <p className="text-xs text-[var(--text-muted)]">Seed</p>
            <p className="font-display text-2xl">{String(current.interactive.payload.seed)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(current.interactive.payload.family as string[]).map((w) => (
                <span key={w} className="rounded-full bg-[var(--accent)]/15 px-3 py-1 text-sm text-[var(--accent)]">
                  {w}
                </span>
              ))}
            </div>
          </div>
        )}
        {current.interactive?.type === "association_tree" && (
          <AssociationTreeView
            nodes={getReference(String(current.interactive.payload.referenceId))?.associationTree ?? []}
          />
        )}
        {current.interactive?.type === "double_meaning" && (
          <div className="space-y-2">
            {(getWord(String(current.interactive.payload.wordId))?.definitions ?? []).map((d) => (
              <p key={d} className="rounded-xl bg-white/5 px-3 py-2 text-sm">
                {d}
              </p>
            ))}
          </div>
        )}
        {current.interactive?.type === "bridge" && (
          <p className="text-[var(--accent)]">
            {(current.interactive.payload.example as string[]).join(" → ")}
          </p>
        )}
        {current.interactive?.type === "quiz" && (
          <Quiz
            question={String(current.interactive.payload.question)}
            options={current.interactive.payload.options as string[]}
            answer={Number(current.interactive.payload.answer)}
          />
        )}
      </Card>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        {step < lesson.steps.length - 1 ? (
          <Button className="flex-1" variant="accent" onClick={() => setStep((s) => s + 1)}>
            Next
          </Button>
        ) : (
          <Button
            className="flex-1"
            variant="accent"
            onClick={() => {
              if (!done) completeLesson(lesson.id, lesson.xpReward, lesson.skills);
              router.push("/learn");
            }}
          >
            {done ? "Back to Learn" : `Complete · +${lesson.xpReward} XP`}
          </Button>
        )}
      </div>
    </div>
  );
}

function Quiz({ question, options, answer }: { question: string; options: string[]; answer: number }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      <p className="font-medium">{question}</p>
      {options.map((o, i) => (
        <button
          key={o}
          type="button"
          onClick={() => setPicked(i)}
          className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
            picked === i
              ? i === answer
                ? "bg-[var(--accent)]/20 text-[var(--accent)]"
                : "bg-[var(--danger)]/20 text-[var(--danger)]"
              : "bg-white/5"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
