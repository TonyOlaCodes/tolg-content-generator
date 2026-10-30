"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { museumAudio } from "@/lib/museum/audio";
import { createRng } from "@/lib/museum/seeds";

const NOTES = [
  { name: "C", freq: 261.63, hue: 340 },
  { name: "D", freq: 293.66, hue: 20 },
  { name: "E", freq: 329.63, hue: 48 },
  { name: "F", freq: 349.23, hue: 120 },
  { name: "G", freq: 392.0, hue: 168 },
  { name: "A", freq: 440.0, hue: 210 },
  { name: "B", freq: 493.88, hue: 270 },
] as const;

const TARGET = new Set([0, 2, 4]);
const WINDOW_MS = 4000;

type Props = {
  onBack: () => void;
  onCollect: () => void;
  seed: string;
  reducedMotion?: boolean;
  onChord?: () => void;
};

export default function Orchestra({
  onBack,
  onCollect,
  seed,
  reducedMotion,
  onChord,
}: Props) {
  const [active, setActive] = useState<number | null>(null);
  const [lit, setLit] = useState<Set<number>>(() => new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);
  const hitsRef = useRef<{ i: number; t: number }[]>([]);
  const collectedRef = useRef(false);
  const glowRef = useRef(0);
  const padsRef = useRef<HTMLButtonElement[]>([]);
  const rng = useRef(createRng(`orchestra:${seed}`));

  const flashToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const trySolve = useCallback(
    (nextHits: { i: number; t: number }[]) => {
      const now = performance.now();
      const recent = nextHits.filter((h) => now - h.t <= WINDOW_MS);
      hitsRef.current = recent;
      const unique = new Set(recent.map((h) => h.i));
      setLit(new Set(unique));
      if (unique.size !== 3) return;
      let ok = true;
      for (const i of TARGET) {
        if (!unique.has(i)) {
          ok = false;
          break;
        }
      }
      if (!ok) return;
      if (solved) return;
      setSolved(true);
      museumAudio.chord([261.63, 329.63, 392.0]);
      museumAudio.chime();
      onChord?.();
      flashToast("The Archivist’s triad — light remembers.");
      if (!collectedRef.current) {
        collectedRef.current = true;
        onCollect();
      }
    },
    [flashToast, onChord, onCollect, solved],
  );

  const playPad = useCallback(
    (i: number) => {
      const note = NOTES[i];
      museumAudio.tone({ freq: note.freq, duration: 0.5, type: "sine", gain: 0.09 });
      setActive(i);
      window.setTimeout(() => setActive(null), reducedMotion ? 120 : 280);
      const next = [...hitsRef.current, { i, t: performance.now() }];
      trySolve(next);
    },
    [reducedMotion, trySolve],
  );

  useEffect(() => {
    if (reducedMotion || solved) return;
    let raf = 0;
    const tick = () => {
      glowRef.current += 0.016;
      padsRef.current.forEach((el, i) => {
        if (!el) return;
        const pulse = 0.55 + Math.sin(glowRef.current * 1.4 + i * 0.7) * 0.25;
        el.style.setProperty("--pad-pulse", String(pulse));
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion, solved]);

  // Seeded idle shimmer offsets (deterministic layout variance)
  const offsets = useRef(
    NOTES.map(() => ({
      x: (rng.current() - 0.5) * 12,
      y: (rng.current() - 0.5) * 10,
      scale: 0.92 + rng.current() * 0.16,
    })),
  ).current;

  return (
    <div className="im-exhibit" style={{ background: "radial-gradient(ellipse at 50% 30%, #2a1020, #050508 70%)" }}>
      <header className="im-exhibit-head">
        <h1 className="im-serif">The Orchestra of Light</h1>
        <p>Touch luminous bodies. Find the chord the museum listens for.</p>
      </header>

      <div className="im-exhibit-body" style={{ display: "grid", placeItems: "center", padding: "0.5rem" }}>
        {toast && <div className="im-toast">{toast}</div>}
        <div
          role="group"
          aria-label="Light orchestra pads"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.85rem",
            justifyContent: "center",
            maxWidth: 520,
            padding: "1rem",
          }}
        >
          {NOTES.map((note, i) => {
            const isLit = lit.has(i);
            const isActive = active === i;
            const off = offsets[i];
            return (
              <button
                key={note.name}
                type="button"
                ref={(el) => {
                  if (el) padsRef.current[i] = el;
                }}
                aria-label={`Note ${note.name}`}
                onClick={() => playPad(i)}
                className="im-btn"
                style={{
                  "--pad-pulse": 0.7,
                  width: `${72 * off.scale}px`,
                  height: `${72 * off.scale}px`,
                  borderRadius: "50%",
                  padding: 0,
                  border: `1px solid hsla(${note.hue}, 80%, 70%, ${isLit || isActive ? 0.9 : 0.35})`,
                  background: `radial-gradient(circle at 35% 30%, hsla(${note.hue}, 90%, 78%, 0.95), hsla(${note.hue}, 70%, 42%, calc(var(--pad-pulse) * 0.85)) 55%, hsla(${note.hue}, 60%, 18%, 0.9))`,
                  boxShadow: isActive
                    ? `0 0 36px hsla(${note.hue}, 90%, 60%, 0.85), 0 0 12px hsla(${note.hue}, 80%, 70%, 0.9)`
                    : isLit
                      ? `0 0 22px hsla(${note.hue}, 80%, 55%, 0.55)`
                      : `0 0 14px hsla(${note.hue}, 70%, 50%, 0.25)`,
                  transform: `translate(${off.x}px, ${off.y}px) scale(${isActive ? 1.12 : 1})`,
                  transition: reducedMotion ? "none" : "transform 180ms ease, box-shadow 180ms ease",
                  color: "#fff",
                  fontFamily: "Cormorant Garamond, Georgia, serif",
                  fontSize: "1.15rem",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                } as CSSProperties}
              >
                {note.name}
              </button>
            );
          })}
        </div>
        <p className="im-serif" style={{ color: "var(--im-muted)", fontSize: "1.05rem", marginTop: "0.5rem", textAlign: "center", maxWidth: 360 }}>
          {solved
            ? "Resonance locked. The prism drinks the chord."
            : "Within four seconds: the triad C · E · G — any order."}
        </p>
        <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.75rem" }} aria-hidden>
          {[0, 2, 4].map((i) => (
            <span
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: lit.has(i) ? `hsl(${NOTES[i].hue}, 80%, 60%)` : "rgba(255,255,255,0.15)",
                boxShadow: lit.has(i) ? `0 0 10px hsl(${NOTES[i].hue}, 80%, 60%)` : "none",
              }}
            />
          ))}
        </div>
      </div>

      <div className="im-exhibit-controls">
        <button type="button" className="im-btn ghost" onClick={onBack}>
          Return
        </button>
        <button
          type="button"
          className="im-btn"
          onClick={() => {
            hitsRef.current = [];
            setLit(new Set());
            flashToast("Sequence cleared.");
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
