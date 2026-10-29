"use client";

import { useMemo, useState } from "react";
import { EXERCISE_LIBRARY, readyExercises } from "@/lib/gym/registry";
import type { ExerciseDefinition } from "@/lib/gym/types";

const CATEGORY_LABEL: Record<string, string> = {
  powerlifting: "Powerlifting & compounds",
  bodybuilding: "Bodybuilding",
  calisthenics: "Calisthenics",
  core: "Abs & core",
};

export default function ExerciseSelect({
  onBack,
  onPick,
}: {
  onBack: () => void;
  onPick: (exercise: ExerciseDefinition) => void;
}) {
  const [filter, setFilter] = useState<"ready" | "all">("ready");
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const base = filter === "ready" ? readyExercises() : EXERCISE_LIBRARY;
    const qq = q.trim().toLowerCase();
    return qq ? base.filter((e) => e.name.toLowerCase().includes(qq)) : base;
  }, [filter, q]);

  const grouped = useMemo(() => {
    const out: Record<string, ExerciseDefinition[]> = {};
    for (const e of list) (out[e.category] ??= []).push(e);
    return out;
  }, [list]);

  return (
    <div className="pu-screen">
      <button type="button" className="pu-back" onClick={onBack}>
        ← Back
      </button>
      <header className="pu-hero compact">
        <h1>Select exercise</h1>
        <p className="pu-sub">
          Ready exercises run real tracking. Planned exercises are listed but will not invent
          results.
        </p>
      </header>

      <div className="pu-ex-toolbar">
        <input
          className="pu-ex-search"
          placeholder="Search exercises…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="pu-ex-filters">
          <button
            type="button"
            className={filter === "ready" ? "on" : ""}
            onClick={() => setFilter("ready")}
          >
            Ready ({readyExercises().length})
          </button>
          <button
            type="button"
            className={filter === "all" ? "on" : ""}
            onClick={() => setFilter("all")}
          >
            Full library ({EXERCISE_LIBRARY.length})
          </button>
        </div>
      </div>

      {Object.entries(grouped).map(([cat, items]) => (
        <section key={cat} className="pu-ex-section">
          <h2>{CATEGORY_LABEL[cat] ?? cat}</h2>
          <div className="pu-ex-grid">
            {items.map((ex) => (
              <button
                key={ex.id}
                type="button"
                className={`pu-ex-card ${ex.status === "planned" ? "is-planned" : ""}`}
                onClick={() => {
                  if (ex.status !== "ready") return;
                  onPick(ex);
                }}
                disabled={ex.status !== "ready"}
              >
                <span className="pu-ex-status">{ex.status === "ready" ? "Ready" : "Planned"}</span>
                <strong>{ex.name}</strong>
                <span className="pu-ex-blurb">{ex.blurb}</span>
                <span className="pu-ex-cam">Camera: {ex.cameraHint}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
