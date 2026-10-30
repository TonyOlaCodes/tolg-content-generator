"use client";

import { useEffect, useRef, useState } from "react";
import { museumAudio } from "@/lib/museum/audio";
import { createRng } from "@/lib/museum/seeds";
import { ENDING_COPY } from "@/lib/museum/narrative";
import type { EndingId } from "@/lib/museum/types";

type Props = {
  onBack: () => void;
  onCollect: () => void;
  seed: string;
  reducedMotion?: boolean;
  unlocked: boolean;
  artifacts: number;
  onEnding: (id: EndingId) => void;
};

const CHOICES: Array<{ id: EndingId; label: string; prompt: string }> = [
  {
    id: "observer",
    label: "Observe",
    prompt: "Look without becoming. Leave with evidence and no allegiance.",
  },
  {
    id: "collaborator",
    label: "Collaborate",
    prompt: "Remain. Curate what has not happened yet beside the Archivist.",
  },
  {
    id: "escape",
    label: "Escape",
    prompt: "Pry the seam open from inside and drag a thread of reality with you.",
  },
];

export default function Forbidden({
  onBack,
  onCollect,
  seed,
  reducedMotion,
  unlocked,
  artifacts,
  onEnding,
}: Props) {
  const collectedRef = useRef(false);
  const [chosen, setChosen] = useState<EndingId | null>(null);
  const [pulse, setPulse] = useState(0);
  const rng = useRef(createRng(`forbidden:${seed}`));

  useEffect(() => {
    if (!unlocked) return;
    if (!collectedRef.current) {
      collectedRef.current = true;
      museumAudio.startAmbient("finale");
      museumAudio.chime();
      onCollect();
    }
  }, [unlocked, onCollect]);

  useEffect(() => {
    if (!unlocked || reducedMotion) return;
    let raf = 0;
    let t = 0;
    const tick = () => {
      t += 0.016;
      setPulse(0.5 + Math.sin(t * 1.2) * 0.5);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [unlocked, reducedMotion]);

  const shards = useRef(
    Array.from({ length: 18 }, () => ({
      x: rng.current() * 100,
      y: rng.current() * 100,
      s: 0.4 + rng.current() * 1.6,
      a: 0.15 + rng.current() * 0.45,
    })),
  ).current;

  if (!unlocked) {
    return (
      <div
        className="im-exhibit"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(80,20,60,0.25), transparent 50%), #040208",
        }}
      >
        <header className="im-exhibit-head">
          <h1 className="im-serif">The Forbidden Room</h1>
          <p>Sealed. The twelfth door tastes unfinished truths.</p>
        </header>
        <div className="im-exhibit-body" style={{ display: "grid", placeItems: "center", padding: "1.5rem" }}>
          <div
            style={{
              maxWidth: 380,
              textAlign: "center",
              border: "1px solid rgba(232,121,249,0.35)",
              padding: "1.75rem 1.4rem",
              background: "rgba(8,4,14,0.75)",
            }}
          >
            <div
              aria-hidden
              style={{
                width: 64,
                height: 64,
                margin: "0 auto 1.1rem",
                borderRadius: "50%",
                border: "2px solid rgba(232,121,249,0.5)",
                display: "grid",
                placeItems: "center",
                boxShadow: "0 0 28px rgba(232,121,249,0.25)",
              }}
            >
              <span style={{ fontSize: "1.4rem", letterSpacing: "0.1em" }}>XII</span>
            </div>
            <p className="im-serif" style={{ fontSize: "1.25rem", margin: "0 0 0.85rem", color: "#e8dcc8" }}>
              Requirements unmet
            </p>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                fontSize: "0.8rem",
                letterSpacing: "0.04em",
                color: "var(--im-muted)",
                lineHeight: 1.7,
              }}
            >
              <li>Collect at least 8 artifacts ({artifacts}/8)</li>
              <li>Recover 2+ origin clues from the Library</li>
              <li>Hold 4 of the Archivist’s key relics</li>
            </ul>
            <p className="im-serif" style={{ marginTop: "1.1rem", opacity: 0.7, fontSize: "1.05rem" }}>
              The door listens. It is not yet convinced.
            </p>
          </div>
        </div>
        <div className="im-exhibit-controls">
          <button type="button" className="im-btn ghost" onClick={onBack}>
            Return
          </button>
        </div>
      </div>
    );
  }

  const ending = chosen ? ENDING_COPY[chosen] : null;

  return (
    <div
      className="im-exhibit im-finale"
      style={{
        position: "absolute",
        background: `
          radial-gradient(ellipse at 50% ${40 + pulse * 8}%, rgba(232,121,249,${0.18 + pulse * 0.12}), transparent 55%),
          radial-gradient(ellipse at 30% 80%, rgba(94,234,212,0.12), transparent 45%),
          #02010a
        `,
      }}
    >
      {shards.map((s, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            position: "absolute",
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.s,
            height: s.s,
            borderRadius: "50%",
            background: i % 2 ? "var(--im-magenta)" : "var(--im-cyan)",
            opacity: s.a * (0.6 + pulse * 0.4),
            pointerEvents: "none",
          }}
        />
      ))}

      {!ending ? (
        <div style={{ position: "relative", zIndex: 1, maxWidth: 520, padding: "1rem" }}>
          <p className="im-logo" style={{ opacity: 1, animation: "none", marginBottom: "0.5rem" }}>
            The Impossible Museum
          </p>
          <h1 className="im-serif" style={{ margin: "0 0 0.75rem" }}>
            The Forbidden Room
          </h1>
          <p className="im-serif" style={{ fontSize: "1.25rem", color: "#ddd6c8", marginBottom: "1.5rem" }}>
            The collection has already begun collecting you. Choose how the museum remembers this visit.
          </p>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {CHOICES.map((c) => (
              <button
                key={c.id}
                type="button"
                className="im-btn primary"
                style={{ width: "100%", textAlign: "left", borderRadius: 8, padding: "1rem 1.15rem" }}
                onClick={() => {
                  setChosen(c.id);
                  museumAudio.whoosh();
                  museumAudio.chord([196, 247, 311]);
                  onEnding(c.id);
                }}
              >
                <span style={{ display: "block", letterSpacing: "0.14em", marginBottom: "0.35rem" }}>{c.label}</span>
                <span className="im-serif" style={{ display: "block", fontWeight: 500, textTransform: "none", letterSpacing: 0, fontSize: "1rem", opacity: 0.85 }}>
                  {c.prompt}
                </span>
              </button>
            ))}
          </div>
          <div className="im-exhibit-controls" style={{ background: "transparent", paddingTop: "1.25rem" }}>
            <button type="button" className="im-btn ghost" onClick={onBack}>
              Return
            </button>
          </div>
        </div>
      ) : (
        <div style={{ position: "relative", zIndex: 1, maxWidth: 480, padding: "1rem" }}>
          <h1 className="im-serif">{ending.title}</h1>
          <p className="im-serif">{ending.body}</p>
          <p className="im-serif" style={{ opacity: 0.75 }}>
            {ending.epilogue}
          </p>
          <p style={{ marginTop: "1rem", fontSize: "0.7rem", letterSpacing: "0.12em", color: "var(--im-muted)" }}>
            Seed {seed}
          </p>
          <div className="im-exhibit-controls" style={{ background: "transparent", paddingTop: "1.25rem" }}>
            <button type="button" className="im-btn ghost" onClick={onBack}>
              Leave the chamber
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
