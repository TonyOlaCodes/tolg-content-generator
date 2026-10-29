"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { museumAudio } from "@/lib/museum/audio";
import { createRng } from "@/lib/museum/seeds";

type Props = {
  onBack: () => void;
  onCollect: () => void;
  seed: string;
  reducedMotion?: boolean;
};

type Body = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  anchor: boolean;
  label: string;
};

const TARGETS = [
  { x: 0.5, y: 0.42, color: "rgba(94,234,212,0.55)" },
  { x: 0.38, y: 0.58, color: "rgba(232,121,249,0.5)" },
  { x: 0.62, y: 0.58, color: "rgba(212,180,131,0.55)" },
];

const ALIGN_DIST = 28;

export default function ZeroG({ onBack, onCollect, seed, reducedMotion }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bodiesRef = useRef<Body[]>([]);
  const dragId = useRef<number | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [toast, setToast] = useState<string | null>(null);
  const [aligned, setAligned] = useState(0);
  const collectedRef = useRef(false);
  const sizeRef = useRef({ w: 1, h: 1 });
  const solvedRef = useRef(false);

  const initBodies = useCallback(() => {
    const rng = createRng(`zerog:${seed}`);
    const bodies: Body[] = [];
    const accents = ["#a5f3fc", "#e879f9", "#d4b483", "#7dd3fc", "#f9a8d4", "#c4b5fd"];
    for (let i = 0; i < 3; i++) {
      bodies.push({
        id: i,
        x: 0.2 + rng() * 0.6,
        y: 0.2 + rng() * 0.5,
        vx: (rng() - 0.5) * 0.4,
        vy: (rng() - 0.5) * 0.4,
        r: 16,
        color: accents[i],
        anchor: true,
        label: `A${i + 1}`,
      });
    }
    for (let i = 3; i < 9; i++) {
      bodies.push({
        id: i,
        x: rng(),
        y: rng(),
        vx: (rng() - 0.5) * 0.6,
        vy: (rng() - 0.5) * 0.6,
        r: 6 + rng() * 10,
        color: accents[i % accents.length],
        anchor: false,
        label: "",
      });
    }
    bodiesRef.current = bodies;
    solvedRef.current = false;
    setAligned(0);
  }, [seed]);

  useEffect(() => {
    initBodies();
  }, [initBodies]);

  const checkAlign = useCallback(() => {
    const { w, h } = sizeRef.current;
    const anchors = bodiesRef.current.filter((b) => b.anchor);
    let count = 0;
    const used = new Set<number>();
    for (let ti = 0; ti < TARGETS.length; ti++) {
      const t = TARGETS[ti];
      const tx = t.x * w;
      const ty = t.y * h;
      let best = -1;
      let bestD = Infinity;
      for (const a of anchors) {
        if (used.has(a.id)) continue;
        const dx = a.x * w - tx;
        const dy = a.y * h - ty;
        const d = Math.hypot(dx, dy);
        if (d < bestD) {
          bestD = d;
          best = a.id;
        }
      }
      if (best >= 0 && bestD <= ALIGN_DIST) {
        used.add(best);
        count++;
      }
    }
    setAligned(count);
    if (count >= 3 && !collectedRef.current) {
      collectedRef.current = true;
      solvedRef.current = true;
      museumAudio.chime();
      setToast("Anchors locked — gravity recalls itself.");
      onCollect();
    }
  }, [onCollect]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let running = true;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      sizeRef.current = { w, h };
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      if (!running) return;
      const { w, h } = sizeRef.current;

      ctx.fillStyle = "#030510";
      ctx.fillRect(0, 0, w, h);

      // soft void haze
      const haze = ctx.createRadialGradient(w * 0.5, h * 0.5, 20, w * 0.5, h * 0.5, Math.max(w, h) * 0.55);
      haze.addColorStop(0, "rgba(165,243,252,0.06)");
      haze.addColorStop(1, "transparent");
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, w, h);

      // targets
      TARGETS.forEach((t, i) => {
        const tx = t.x * w;
        const ty = t.y * h;
        ctx.strokeStyle = t.color;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(tx, ty, ALIGN_DIST, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = t.color;
        ctx.font = "10px Syne, sans-serif";
        ctx.fillText(`T${i + 1}`, tx - 6, ty + 3);
      });

      for (const b of bodiesRef.current) {
        if (dragId.current !== b.id && !solvedRef.current && !reducedMotion) {
          b.x += b.vx * 0.0025;
          b.y += b.vy * 0.0025;
          // gentle wrap
          if (b.x < 0.05) b.vx = Math.abs(b.vx);
          if (b.x > 0.95) b.vx = -Math.abs(b.vx);
          if (b.y < 0.08) b.vy = Math.abs(b.vy);
          if (b.y > 0.92) b.vy = -Math.abs(b.vy);
          // tiny drift noise
          b.vx += (Math.random() - 0.5) * 0.02;
          b.vy += (Math.random() - 0.5) * 0.02;
          b.vx *= 0.995;
          b.vy *= 0.995;
        }

        const px = b.x * w;
        const py = b.y * h;
        const glow = ctx.createRadialGradient(px, py, 0, px, py, b.r * 2.4);
        glow.addColorStop(0, b.color);
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, b.r * 2.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(px, py, b.r, 0, Math.PI * 2);
        ctx.fill();

        if (b.anchor) {
          ctx.strokeStyle = "rgba(255,255,255,0.85)";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.lineWidth = 1;
          ctx.fillStyle = "#041018";
          ctx.font = "bold 11px Syne, sans-serif";
          ctx.fillText(b.label, px - 7, py + 4);
        }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [reducedMotion]);

  const pick = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const { w, h } = sizeRef.current;
    let best: Body | null = null;
    let bestD = Infinity;
    for (const b of bodiesRef.current) {
      const dx = x - b.x * w;
      const dy = y - b.y * h;
      const d = Math.hypot(dx, dy);
      if (d < b.r + 12 && d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  };

  return (
    <div className="im-exhibit" style={{ background: "#010208" }}>
      <header className="im-exhibit-head">
        <h1 className="im-serif">The Room Without Gravity</h1>
        <p>Drag the three labeled anchors into the glowing targets.</p>
      </header>

      <div className="im-exhibit-body im-canvas-wrap">
        {toast && <div className="im-toast">{toast}</div>}
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", display: "block", touchAction: "none", cursor: "grab" }}
          onPointerDown={(e) => {
            const b = pick(e.clientX, e.clientY);
            if (!b) return;
            dragId.current = b.id;
            const canvas = canvasRef.current!;
            const rect = canvas.getBoundingClientRect();
            dragOffset.current = {
              x: (e.clientX - rect.left) / sizeRef.current.w - b.x,
              y: (e.clientY - rect.top) / sizeRef.current.h - b.y,
            };
            b.vx = 0;
            b.vy = 0;
            museumAudio.tone({ freq: 180 + b.id * 30, duration: 0.12, gain: 0.04 });
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (dragId.current == null) return;
            const b = bodiesRef.current.find((x) => x.id === dragId.current);
            if (!b) return;
            const canvas = canvasRef.current!;
            const rect = canvas.getBoundingClientRect();
            b.x = Math.min(0.96, Math.max(0.04, (e.clientX - rect.left) / sizeRef.current.w - dragOffset.current.x));
            b.y = Math.min(0.96, Math.max(0.06, (e.clientY - rect.top) / sizeRef.current.h - dragOffset.current.y));
          }}
          onPointerUp={() => {
            if (dragId.current != null) {
              const b = bodiesRef.current.find((x) => x.id === dragId.current);
              if (b && !b.anchor) {
                b.vx = (Math.random() - 0.5) * 2;
                b.vy = (Math.random() - 0.5) * 2;
              }
              if (b?.anchor) checkAlign();
            }
            dragId.current = null;
          }}
        />
      </div>

      <div className="im-exhibit-controls">
        <button type="button" className="im-btn ghost" onClick={onBack}>
          Return
        </button>
        <span style={{ fontSize: "0.7rem", letterSpacing: "0.08em", color: "var(--im-muted)" }}>
          Anchors aligned {aligned}/3
        </span>
        <button
          type="button"
          className="im-btn"
          onClick={() => {
            initBodies();
            setToast("Chamber reset");
            window.setTimeout(() => setToast(null), 1200);
            museumAudio.whoosh();
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
