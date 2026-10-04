"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store/use-app-store";
import { SKILL_LABELS } from "@/lib/data/skills";

const SUGGESTIONS = [
  "Give me 10 things I could reference with LeBron.",
  "How could I flip the word court?",
  "Give me harder words.",
  "Teach me multis.",
  "Give me a 10 minute drill.",
];

export default function CoachPage() {
  const profile = useAppStore((s) => s.profile);
  const coach = useAppStore((s) => s.coach);
  const addCoachMessage = useAppStore((s) => s.addCoachMessage);
  const insights = useAppStore((s) => s.getInsights)();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(message: string) {
    if (!message.trim() || loading) return;
    addCoachMessage("user", message.trim());
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          history: coach.slice(-8).map((m) => ({ role: m.role, content: m.content })),
          profileSummary: `Level ${profile.level}, focus ${profile.focusSkills.join(", ")}, limiter ${SKILL_LABELS[insights.weakest]}`,
          recentContext: `Struggles: ${profile.struggles.join(", ") || "n/a"}`,
        }),
      });
      const data = (await res.json()) as { reply?: string };
      addCoachMessage("assistant", data.reply || "Try Association Lab for 5 minutes, then a blind freestyle.");
    } catch {
      addCoachMessage("assistant", "Coach temporarily unavailable. Try Reference Lab while offline patterns load.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[70dvh] flex-col space-y-4">
      <header>
        <h1 className="font-display text-3xl">Freestyle Coach</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Ask for routes, flips, drills, or why a bar worked. Uses your recent training context when available.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => void send(s)}
            className="rounded-full bg-white/5 px-3 py-1.5 text-left text-xs text-[var(--text-secondary)]"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-3">
        {coach.length === 0 && (
          <div className="card-surface p-4 text-sm text-[var(--text-secondary)]">
            Biggest limiter right now: <span className="text-white">{SKILL_LABELS[insights.weakest]}</span>. Ask for a drill.
          </div>
        )}
        {coach.map((m) => (
          <div
            key={m.id}
            className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
              m.role === "user" ? "ml-auto bg-[var(--accent)] text-black" : "bg-[var(--card)] text-[var(--text-secondary)]"
            }`}
          >
            {m.content}
          </div>
        ))}
      </div>

      <div className="flex gap-2 pb-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void send(input)}
          placeholder="Ask the coach…"
          className="h-12 flex-1 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4"
        />
        <Button variant="accent" disabled={loading} onClick={() => void send(input)}>
          {loading ? "…" : "Send"}
        </Button>
      </div>
    </div>
  );
}
