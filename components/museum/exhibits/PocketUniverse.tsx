"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { museumAudio } from "@/lib/museum/audio";
import { createRng } from "@/lib/museum/seeds";

type Planet = {
  id: number;
  name: string;
  orbit: number;
  size: number;
  speed: number;
  angle: number;
  color: string;
  visited: boolean;
};

type Props = {
  onBack: () => void;
  onCollect: () => void;
  seed: string;
  reducedMotion?: boolean;
};

const NAMES = ["Ashen", "Virelia", "Nox", "Lumen", "Kestrel", "Orryx", "Pale"];

function buildSystem(seed: string): Planet[] {
  const rng = createRng(`pocket:${seed}`);
  const count = 5 + Math.floor(rng() * 3);
  const planets: Planet[] = [];
  for (let i = 0; i < count; i++) {
    const hue = Math.floor(rng() * 360);
    planets.push({
      id: i,
      name: NAMES[i % NAMES.length] + (i >= NAMES.length ? `-${i}` : ""),
      orbit: 48 + i * 28 + rng() * 10,
      size: 5 + rng() * 10,
      speed: 0.15 + rng() * 0.45 * (1 / (i + 1.2)),
      angle: rng() * Math.PI * 2,
      color: `hsl(${hue}, ${55 + rng() * 30}%, ${45 + rng() * 20}%)`,
      visited: false,
    });
  }
  return planets;
}

export default function PocketUniverse({ onBack, onCollect, seed, reducedMotion }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const planetsRef = useRef(buildSystem(seed));
  const [visited, setVisited] = useState(0);
  const [focus, setFocus] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const collectedRef = useRef(false);
  const zoomRef = useRef(1);
  const tRef = useRef(0);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const panRef = useRef({ x: 0, y: 0 });

  const starfield = useMemo(() => {
    const rng = createRng(`stars:${seed}`);
    return Array.from({ length: 90 }, () => ({
      x: rng(),
      y: rng(),
      r: 0.4 + rng() * 1.4,
      a: 0.25 + rng() * 0.7,
    }));
  }, [seed]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

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
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const z = zoomRef.current;
      const pan = panRef.current;
      if (!reducedMotion) tRef.current += 0.016;

      ctx.fillStyle = "#02030a";
      ctx.fillRect(0, 0, w, h);

      const cx = w / 2 + pan.x;
      const cy = h / 2 + pan.y;

      for (const s of starfield) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(230,230,255,${s.a})`;
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Glow nebula
      const g = ctx.createRadialGradient(cx, cy, 10 * z, cx, cy, 180 * z);
      g.addColorStop(0, "rgba(129,140,248,0.22)");
      g.addColorStop(0.5, "rgba(94,234,212,0.06)");
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Sun
      const sunR = 16 * z;
      const sunGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, sunR * 2.2);
      sunGrad.addColorStop(0, "#fff7c2");
      sunGrad.addColorStop(0.35, "#ffb347");
      sunGrad.addColorStop(1, "rgba(255,120,40,0)");
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, sunR * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffe08a";
      ctx.beginPath();
      ctx.arc(cx, cy, sunR, 0, Math.PI * 2);
      ctx.fill();

      for (const p of planetsRef.current) {
        if (!reducedMotion) p.angle += p.speed * 0.012;
        const px = cx + Math.cos(p.angle) * p.orbit * z;
        const py = cy + Math.sin(p.angle) * p.orbit * z * 0.72;

        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.beginPath();
        ctx.ellipse(cx, cy, p.orbit * z, p.orbit * z * 0.72, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.arc(px, py, p.size * z, 0, Math.PI * 2);
        ctx.fill();
        if (p.visited) {
          ctx.strokeStyle = "rgba(94,234,212,0.9)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(px, py, p.size * z + 3, 0, Math.PI * 2);
          ctx.stroke();
          ctx.lineWidth = 1;
        }
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.font = "11px Syne, sans-serif";
        ctx.fillText(p.name, px + p.size * z + 4, py + 3);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [reducedMotion, starfield]);

  const hitTest = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const z = zoomRef.current;
    const cx = canvas.clientWidth / 2 + panRef.current.x;
    const cy = canvas.clientHeight / 2 + panRef.current.y;
    for (const p of planetsRef.current) {
      const px = cx + Math.cos(p.angle) * p.orbit * z;
      const py = cy + Math.sin(p.angle) * p.orbit * z * 0.72;
      const dx = x - px;
      const dy = y - py;
      const hit = p.size * z + 8;
      if (dx * dx + dy * dy <= hit * hit) return p;
    }
    return null;
  }, []);

  const visit = useCallback(
    (p: Planet) => {
      setFocus(p.name);
      museumAudio.tone({ freq: 220 + p.id * 40, duration: 0.35, type: "sine", gain: 0.06 });
      if (!p.visited) {
        p.visited = true;
        const n = planetsRef.current.filter((x) => x.visited).length;
        setVisited(n);
        setToast(`Visited ${p.name} · ${n}/3`);
        window.setTimeout(() => setToast(null), 1800);
        if (n >= 3 && !collectedRef.current) {
          collectedRef.current = true;
          museumAudio.chime();
          onCollect();
          setToast("Pocket seed crystallised.");
        }
      }
    },
    [onCollect],
  );

  return (
    <div className="im-exhibit" style={{ background: "#010106" }}>
      <header className="im-exhibit-head">
        <h1 className="im-serif">The Pocket Universe</h1>
        <p>
          Seed <span style={{ color: "var(--im-cyan)" }}>{seed}</span> — visit three worlds.
        </p>
      </header>

      <div className="im-exhibit-body im-canvas-wrap">
        {toast && <div className="im-toast">{toast}</div>}
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", display: "block", touchAction: "none", cursor: "crosshair" }}
          onPointerDown={(e) => {
            const p = hitTest(e.clientX, e.clientY);
            if (p) {
              visit(p);
              return;
            }
            dragRef.current = { x: e.clientX, y: e.clientY };
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!dragRef.current) return;
            panRef.current.x += e.clientX - dragRef.current.x;
            panRef.current.y += e.clientY - dragRef.current.y;
            dragRef.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
          onWheel={(e) => {
            e.preventDefault();
            setZoom((z) => Math.min(2.4, Math.max(0.55, z - e.deltaY * 0.0015)));
          }}
        />
        {focus && (
          <p
            className="im-serif"
            style={{
              position: "absolute",
              bottom: "0.75rem",
              left: "50%",
              transform: "translateX(-50%)",
              color: "rgba(243,239,230,0.8)",
              fontSize: "1.1rem",
              pointerEvents: "none",
            }}
          >
            Orbiting {focus}
          </p>
        )}
      </div>

      <div className="im-exhibit-controls">
        <button type="button" className="im-btn ghost" onClick={onBack}>
          Return
        </button>
        <label className="im-slider">
          Zoom {zoom.toFixed(2)}×
          <input
            type="range"
            min={0.55}
            max={2.4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
        <span style={{ fontSize: "0.7rem", letterSpacing: "0.08em", color: "var(--im-muted)" }}>
          Visited {visited}/3
        </span>
        <button
          type="button"
          className="im-btn"
          onClick={() => {
            void navigator.clipboard?.writeText(seed);
            setToast("Seed copied");
            window.setTimeout(() => setToast(null), 1400);
            museumAudio.tone({ freq: 660, duration: 0.2 });
          }}
        >
          Copy seed
        </button>
      </div>
    </div>
  );
}
