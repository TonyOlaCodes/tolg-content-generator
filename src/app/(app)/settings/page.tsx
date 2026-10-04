"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAppStore } from "@/lib/store/use-app-store";
import type { Difficulty } from "@/lib/types";

export default function SettingsPage() {
  const profile = useAppStore((s) => s.profile);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const s = profile.settings;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl">Settings</h1>
      </header>

      <Card className="space-y-4 !p-5">
        <Field label="Training goal">
          <input
            className="h-11 w-full rounded-xl border border-[var(--border)] bg-black/20 px-3"
            value={s.trainingGoal}
            onChange={(e) => updateProfile({ settings: { ...s, trainingGoal: e.target.value } })}
          />
        </Field>
        <Field label="Preferred BPM">
          <input
            type="number"
            className="h-11 w-full rounded-xl border border-[var(--border)] bg-black/20 px-3"
            value={s.preferredBpm}
            onChange={(e) => updateProfile({ settings: { ...s, preferredBpm: Number(e.target.value) || 90 } })}
          />
        </Field>
        <Field label="Prompt frequency (sec)">
          <select
            className="h-11 w-full rounded-xl border border-[var(--border)] bg-black/20 px-3"
            value={s.promptFrequencySec}
            onChange={(e) => updateProfile({ settings: { ...s, promptFrequencySec: Number(e.target.value) } })}
          >
            {[3, 5, 10, 15, 20, 30].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Difficulty">
          <select
            className="h-11 w-full rounded-xl border border-[var(--border)] bg-black/20 px-3 capitalize"
            value={s.difficulty}
            onChange={(e) => updateProfile({ settings: { ...s, difficulty: e.target.value as Difficulty } })}
          >
            {["beginner", "intermediate", "advanced", "elite", "endless"].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Daily training duration">
          <select
            className="h-11 w-full rounded-xl border border-[var(--border)] bg-black/20 px-3"
            value={s.dailyTrainingMinutes}
            onChange={(e) =>
              updateProfile({
                settings: { ...s, dailyTrainingMinutes: Number(e.target.value) as 15 | 30 | 60 },
              })
            }
          >
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>60 minutes</option>
          </select>
        </Field>
        <Field label="Countdown duration">
          <select
            className="h-11 w-full rounded-xl border border-[var(--border)] bg-black/20 px-3"
            value={s.countdownSec}
            onChange={(e) => updateProfile({ settings: { ...s, countdownSec: Number(e.target.value) } })}
          >
            {[3, 5, 10].map((n) => (
              <option key={n} value={n}>
                {n}s
              </option>
            ))}
          </select>
        </Field>
        <Toggle
          label="Explicit language"
          value={s.explicitLanguage}
          onChange={(v) => updateProfile({ settings: { ...s, explicitLanguage: v } })}
        />
        <Toggle
          label="AI feedback by default"
          value={s.aiFeedback}
          onChange={(v) => updateProfile({ settings: { ...s, aiFeedback: v } })}
        />
        <Toggle
          label="Live prompts by default"
          value={s.livePrompts}
          onChange={(v) => updateProfile({ settings: { ...s, livePrompts: v } })}
        />
      </Card>

      <Card className="!p-5 text-sm text-[var(--text-secondary)]">
        <p className="font-medium text-white">Microphone & audio</p>
        <p className="mt-2">
          Microphone selection uses the browser default device. Safari/iOS may require a user gesture before recording and beat playback. Beat audio is never mixed into the mic recording unless you intentionally export a mix later.
        </p>
        <p className="mt-2">
          Optional OpenAI analysis uses server-side <code className="text-[var(--accent)]">OPENAI_API_KEY</code>. Without it, mock analysis still returns structured feedback.
        </p>
      </Card>

      <Button
        variant="secondary"
        className="w-full"
        onClick={() => {
          localStorage.clear();
          window.location.href = "/home";
        }}
      >
        Reset local data
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" className="flex w-full items-center justify-between" onClick={() => onChange(!value)}>
      <span className="text-sm">{label}</span>
      <span className={`flex h-7 w-12 items-center rounded-full px-1 ${value ? "bg-[var(--accent)]" : "bg-white/10"}`}>
        <span className={`h-5 w-5 rounded-full bg-white transition ${value ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}
