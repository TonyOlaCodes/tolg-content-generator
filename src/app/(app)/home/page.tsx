"use client";

import Link from "next/link";
import { Flame, Mic2, Play, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SkillGrid } from "@/components/home/skill-grid";
import { useAppStore } from "@/lib/store/use-app-store";
import { formatDuration, formatXp } from "@/lib/utils";
import { xpProgress } from "@/lib/progression";
import { REFERENCES } from "@/lib/data/references";
import { pickDaily } from "@/lib/utils";
import { useMemo } from "react";

export default function HomePage() {
  const profile = useAppStore((s) => s.profile);
  const getDailyPlan = useAppStore((s) => s.getDailyPlan);
  const challenge = useAppStore((s) => s.challenge);
  const setPendingSession = useAppStore((s) => s.setPendingSession);
  const plan = getDailyPlan();
  const xp = xpProgress(profile.xp);
  const refOfDay = useMemo(() => pickDaily(REFERENCES, "ref-of-day"), []);

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <p className="text-sm text-[var(--text-secondary)]">Train off-the-top</p>
        <h1 className="font-display text-4xl leading-none tracking-tight">Freestyle Lab</h1>
      </header>

      <section className="animate-fade-up-delay-1 grid grid-cols-2 gap-2">
        <Card className="col-span-2 !p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Current level</p>
              <p className="font-display text-4xl">{profile.level}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-[var(--text-secondary)]">{formatXp(profile.xp)} XP</p>
              <p className="text-xs text-[var(--text-muted)]">
                {xp.into}/{xp.need} to next
              </p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${xp.ratio * 100}%` }} />
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-[var(--warning)]">
            <Flame className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider">Streak</span>
          </div>
          <p className="mt-1 font-display text-2xl">{profile.streak}d</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Rating</p>
          <p className="mt-1 font-display text-2xl">{profile.overallRating}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Freestyles</p>
          <p className="mt-1 font-display text-2xl">{profile.freestylesRecorded}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Minutes</p>
          <p className="mt-1 font-display text-2xl">{Math.round(profile.minutesFreestyled)}</p>
        </Card>
      </section>

      <section className="animate-fade-up-delay-2 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">Today&apos;s Session</h2>
          <span className="text-sm text-[var(--text-muted)]">{plan.totalMin} min</span>
        </div>
        <Card className="space-y-3 !p-5">
          {plan.items.map((item) => (
            <div key={item.title} className="flex items-start justify-between gap-3 border-b border-white/5 pb-3 last:border-0 last:pb-0">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-[var(--text-secondary)]">{item.detail}</p>
              </div>
              <p className="shrink-0 text-sm text-[var(--text-muted)]">
                {item.rounds ? `${item.rounds} rounds` : `${item.durationMin} min`}
              </p>
            </div>
          ))}
        </Card>
        <div className="grid gap-2">
          <Link href="/practice" className="block">
            <Button className="w-full" size="lg" variant="accent">
              <Play className="h-5 w-5" />
              Continue Training
            </Button>
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/freestyle"
              onClick={() =>
                setPendingSession({
                  beatId: "boom-bap-92",
                  durationSec: 60,
                  mode: "free",
                  promptFrequencySec: profile.settings.promptFrequencySec,
                  difficulty: profile.settings.difficulty,
                  aiFeedback: profile.settings.aiFeedback,
                  livePrompts: false,
                  distractionFree: false,
                })
              }
            >
              <Button className="w-full" size="lg" variant="primary">
                <Mic2 className="h-5 w-5" />
                Quick Freestyle
              </Button>
            </Link>
            <Link
              href="/freestyle"
              onClick={() => {
                if (!challenge) return;
                setPendingSession({
                  beatId: "trap-140",
                  durationSec: challenge.targetSec,
                  mode: challenge.mode,
                  promptFrequencySec: 10,
                  difficulty: profile.settings.difficulty,
                  aiFeedback: true,
                  livePrompts: true,
                  distractionFree: false,
                });
              }}
            >
              <Button className="w-full" size="lg" variant="secondary">
                <Zap className="h-5 w-5" />
                Daily Challenge
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--accent)]" />
          <h2 className="font-display text-xl">Reference of the Day</h2>
        </div>
        <Link href={`/library/references/${refOfDay.id}`}>
          <Card interactive className="!p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">{refOfDay.category}</p>
            <p className="mt-1 font-display text-2xl">{refOfDay.name}</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{refOfDay.shortDescription}</p>
            <p className="mt-3 text-sm text-[var(--accent)]">Quiz & association routes →</p>
          </Card>
        </Link>
      </section>

      <section className="space-y-3 pb-2">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">Skill overview</h2>
          <Link href="/progress" className="text-sm text-[var(--accent)]">
            Details
          </Link>
        </div>
        <SkillGrid skills={profile.skills} />
        <p className="text-center text-xs text-[var(--text-muted)]">
          Longest freestyle: {formatDuration(profile.longestFreestyleSec)}
        </p>
        <div className="flex justify-center gap-4 text-sm">
          <Link href="/coach" className="text-[var(--text-secondary)] underline-offset-4 hover:underline">
            Coach
          </Link>
          <Link href="/library" className="text-[var(--text-secondary)] underline-offset-4 hover:underline">
            Library
          </Link>
          <Link href="/settings" className="text-[var(--text-secondary)] underline-offset-4 hover:underline">
            Settings
          </Link>
        </div>
      </section>
    </div>
  );
}
