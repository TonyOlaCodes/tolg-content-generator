"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store/use-app-store";
import type { SkillKey, UserProfile } from "@/lib/types";
import { SKILL_LABELS } from "@/lib/data/skills";
import { cn } from "@/lib/utils";

const STRUGGLES = [
  "Running out of things to say",
  "Rhyming",
  "Flow",
  "Wordplay",
  "References",
  "Punchlines",
  "Staying on topic",
  "Switching topics",
  "Vocabulary",
  "Staying on beat",
];

const FOCUS: { key: SkillKey; label: string }[] = Object.entries(SKILL_LABELS).map(([key, label]) => ({
  key: key as SkillKey,
  label,
}));

export default function OnboardingPage() {
  const router = useRouter();
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const [experience, setExperience] = useState<UserProfile["experience"]>("beginner");
  const [struggles, setStruggles] = useState<string[]>([]);
  const [focusSkills, setFocusSkills] = useState<SkillKey[]>(["references", "continuity"]);

  function toggle(list: string[], value: string, set: (v: string[]) => void) {
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  function finish() {
    completeOnboarding({ experience, struggles, focusSkills });
    router.replace("/home");
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 py-8">
      <div className="animate-fade-up">
        <p className="text-sm text-[var(--text-secondary)]">Welcome</p>
        <h1 className="font-display text-4xl tracking-tight">Freestyle Lab</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Train the mental skills behind elite off-the-top freestyle — not a rhyme dictionary.
        </p>
      </div>

      <div className="mt-8 flex-1 space-y-4">
        {step === 0 && (
          <div className="animate-fade-up space-y-3">
            <h2 className="font-display text-2xl">How experienced are you?</h2>
            {(
              [
                ["beginner", "Beginner"],
                ["some", "Some experience"],
                ["good", "Good"],
                ["advanced", "Advanced"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setExperience(value)}
                className={cn(
                  "card-surface w-full p-4 text-left transition",
                  experience === value && "border-[var(--accent)] ring-1 ring-[var(--accent)]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="animate-fade-up space-y-3">
            <h2 className="font-display text-2xl">What do you struggle with?</h2>
            <div className="grid grid-cols-1 gap-2">
              {STRUGGLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggle(struggles, s, setStruggles)}
                  className={cn(
                    "card-surface w-full p-4 text-left transition",
                    struggles.includes(s) && "border-[var(--accent)] ring-1 ring-[var(--accent)]",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-up space-y-3">
            <h2 className="font-display text-2xl">What do you want to improve most?</h2>
            <div className="grid grid-cols-2 gap-2">
              {FOCUS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() =>
                    setFocusSkills((prev) =>
                      prev.includes(f.key) ? prev.filter((x) => x !== f.key) : [...prev, f.key].slice(0, 4),
                    )
                  }
                  className={cn(
                    "card-surface p-4 text-left transition",
                    focusSkills.includes(f.key) && "border-[var(--accent)] ring-1 ring-[var(--accent)]",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <p className="text-sm text-[var(--text-muted)]">Pick up to four. We&apos;ll build your first plan around them.</p>
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-2">
        {step > 0 && (
          <Button variant="secondary" className="flex-1" onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        )}
        {step < 2 ? (
          <Button className="flex-1" variant="accent" onClick={() => setStep((s) => s + 1)}>
            Continue
          </Button>
        ) : (
          <Button className="flex-1" variant="accent" onClick={finish}>
            Start training
          </Button>
        )}
      </div>
      <button
        type="button"
        className="mt-3 text-center text-sm text-[var(--text-muted)]"
        onClick={() => {
          completeOnboarding({ experience: "beginner", struggles: [], focusSkills: ["references", "rhyming"] });
          router.replace("/home");
        }}
      >
        Skip for now
      </button>
    </div>
  );
}
