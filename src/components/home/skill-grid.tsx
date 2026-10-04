"use client";

import { SKILL_KEYS, SKILL_LABELS } from "@/lib/data/skills";
import type { SkillKey } from "@/lib/types";

export function SkillGrid({ skills }: { skills: Record<SkillKey, number> }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {SKILL_KEYS.map((key) => (
        <div key={key} className="card-surface p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-[var(--text-secondary)]">{SKILL_LABELS[key]}</span>
            <span className="font-display text-lg">{skills[key]}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
              style={{ width: `${skills[key]}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
