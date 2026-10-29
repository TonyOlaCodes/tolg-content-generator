"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { museumAudio } from "@/lib/museum/audio";
import { createRng } from "@/lib/museum/seeds";

type Props = {
  onBack: () => void;
  onCollect: () => void;
  seed: string;
  reducedMotion?: boolean;
  onSecret?: () => void;
};

const COLS = 4;
const ROWS = 3;
const PANEL_COUNT = COLS * ROWS;

export default function Mirrors({ onBack, onCollect, seed, reducedMotion, onSecret }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pointer, setPointer] = useState({ x: 0.5, y: 0.5 });
  const [wrongClicks, setWrongClicks] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);
  const [shimmer, setShimmer] = useState(0);
  const collected = useRef(false);
  const lagRef = useRef({ x: 0.5, y: 0.5 });
  const pointerRef = useRef(pointer);
  pointerRef.current = pointer;

  const wrongIndex = useMemo(() => {
    const r = createRng(`mirrors:${seed}`);
    return Math.floor(r() * PANEL_COUNT);
  }, [seed]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const collectOnce = useCallback(() => {
    if (collected.current) return;
    collected.current = true;
    museumAudio.chime();
    flash("False Reflection — the wrong pane confesses");
    onCollect();
    onSecret?.();
  }, [flash, onCollect, onSecret]);

  useEffect(() => {
    let raf = 0;
    let running = true;
    const tick = () => {
      if (!running) return;
      const p = pointerRef.current;
      const lag = lagRef.current;
      const follow = reducedMotion ? 0.08 : 0.045;
      lag.x += (p.x - lag.x) * follow;
      lag.y += (p.y - lag.y) * follow;
      // occasionally drift wrong
      lag.x += Math.sin(performance.now() * 0.001) * 0.002;
      lag.y += Math.cos(performance.now() * 0.0013) * 0.002;
      setShimmer((s) => s + (reducedMotion ? 0.3 : 1));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [reducedMotion]);

  const onMove = (e: React.PointerEvent) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPointer({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  };

  const onPanelClick = (index: number) => {
    if (solved) return;
    if (index !== wrongIndex) {
      museumAudio.tone({ freq: 180, duration: 0.12, type: "sine", gain: 0.03 });
      flash("This reflection obeys");
      return;
    }
    const next = wrongClicks + 1;
    setWrongClicks(next);
    museumAudio.tone({ freq: 90 + next * 40, duration: 0.35, type: "sawtooth", gain: 0.06 });
    if (next >= 3) {
      setSolved(true);
      flash("Three acknowledgements — the mirror breaks character");
      collectOnce();
    } else {
      flash(`The false pane flinches (${next}/3)`);
    }
  };

  const reflectionFor = (index: number) => {
    const isWrong = index === wrongIndex;
    const src = isWrong ? lagRef.current : pointer;
    // panel-local invert-ish reflection of pointer
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    // correct mirrors invert on both axes relative to panel center feel
    const rx = isWrong ? src.x : 1 - src.x;
    const ry = isWrong ? 1 - src.y : 1 - src.y;
    // slight per-panel parallax for correct ones
    const px = isWrong ? rx : rx + (col - 1.5) * 0.01;
    const py = isWrong ? ry + 0.08 * Math.sin(shimmer * 0.02) : ry + (row - 1) * 0.01;
    return { x: Math.max(0.05, Math.min(0.95, px)), y: Math.max(0.05, Math.min(0.95, py)), wrong: isWrong };
  };

  return (
    <section className="im-exhibit" aria-label="The Hall of Infinite Mirrors">
      <header className="im-exhibit-head">
        <h1>The Hall of Infinite Mirrors</h1>
        <p className="im-serif">
          {solved ? "One reflection refused accuracy" : `Find the lagging pane · strikes ${wrongClicks}/3`}
        </p>
      </header>
      <div className="im-exhibit-body" ref={wrapRef} onPointerMove={onMove} style={{ padding: "0.5rem 1rem" }}>
        <div
          style={{
            height: "100%",
            display: "grid",
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            gridTemplateRows: `repeat(${ROWS}, 1fr)`,
            gap: "0.45rem",
            maxWidth: 720,
            margin: "0 auto",
          }}
        >
          {Array.from({ length: PANEL_COUNT }, (_, i) => {
            const ref = reflectionFor(i);
            const accent = solved && ref.wrong ? "rgba(232, 121, 249, 0.55)" : "rgba(196, 181, 253, 0.35)";
            return (
              <button
                key={i}
                type="button"
                aria-label={ref.wrong ? "Suspicious mirror panel" : `Mirror panel ${i + 1}`}
                onClick={() => onPanelClick(i)}
                style={{
                  position: "relative",
                  border: `1px solid ${accent}`,
                  borderRadius: 4,
                  overflow: "hidden",
                  cursor: "pointer",
                  background: `
                    linear-gradient(145deg, rgba(30, 28, 50, 0.9), rgba(8, 10, 20, 0.95)),
                    repeating-linear-gradient(
                      90deg,
                      transparent 0 12px,
                      rgba(255,255,255,0.02) 12px 13px
                    )
                  `,
                  boxShadow: ref.wrong && wrongClicks > 0 ? "inset 0 0 24px rgba(232,121,249,0.15)" : "inset 0 0 20px rgba(0,0,0,0.4)",
                  padding: 0,
                  minHeight: 0,
                }}
              >
                <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                  <defs>
                    <radialGradient id={`mg${i}`} cx={`${ref.x * 100}%`} cy={`${ref.y * 100}%`} r="45%">
                      <stop offset="0%" stopColor={ref.wrong ? "rgba(232,121,249,0.45)" : "rgba(94,234,212,0.35)"} />
                      <stop offset="100%" stopColor="transparent" />
                    </radialGradient>
                  </defs>
                  <rect width="100" height="100" fill={`url(#mg${i})`} />
                  {/* reflected figure */}
                  <circle
                    cx={ref.x * 100}
                    cy={ref.y * 100}
                    r={solved && ref.wrong ? 8 : 5}
                    fill={ref.wrong ? "rgba(232,121,249,0.85)" : "rgba(243,239,230,0.75)"}
                  />
                  <ellipse
                    cx={ref.x * 100}
                    cy={ref.y * 100 + 14}
                    rx={7}
                    ry={10}
                    fill={ref.wrong ? "rgba(180,120,220,0.35)" : "rgba(200,210,220,0.25)"}
                  />
                  {!reducedMotion && (
                    <path
                      d={`M0 ${50 + Math.sin(shimmer * 0.03 + i) * 8} Q 50 ${40 + (i % 3) * 5}, 100 ${50 + Math.cos(shimmer * 0.02 + i) * 8}`}
                      fill="none"
                      stroke="rgba(255,255,255,0.06)"
                      strokeWidth="0.5"
                    />
                  )}
                </svg>
                {solved && ref.wrong ? (
                  <span
                    className="im-serif"
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "grid",
                      placeItems: "center",
                      color: "var(--im-magenta)",
                      fontSize: "0.85rem",
                      pointerEvents: "none",
                    }}
                  >
                    false
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {toast ? <div className="im-toast">{toast}</div> : null}
      </div>
      <div className="im-exhibit-controls">
        <button type="button" className="im-btn ghost" onClick={onBack}>
          ← Back
        </button>
        <button
          type="button"
          className="im-btn"
          onClick={() => {
            museumAudio.tone({ freq: 440, duration: 0.15, gain: 0.04 });
            flash("Move slowly — honesty has latency");
          }}
        >
          Hint
        </button>
        <span className="im-serif" style={{ color: "var(--im-muted)", fontSize: "0.95rem" }}>
          Most panes invert you. One hesitates.
        </span>
      </div>
    </section>
  );
}
