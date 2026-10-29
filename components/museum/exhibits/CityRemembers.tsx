"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { museumAudio } from "@/lib/museum/audio";
import { createRng } from "@/lib/museum/seeds";

type Props = {
  onBack: () => void;
  onCollect: () => void;
  seed: string;
  reducedMotion?: boolean;
};

const MARKERS = [1200, 1600, 1900, 2100, 2200] as const;

type Building = {
  x: number;
  w: number;
  h1200: number;
  h1600: number;
  h1900: number;
  h2100: number;
  h2200: number;
  style: number;
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function heightAt(b: Building, year: number): number {
  if (year <= 1200) return b.h1200;
  if (year <= 1600) return lerp(b.h1200, b.h1600, (year - 1200) / 400);
  if (year <= 1900) return lerp(b.h1600, b.h1900, (year - 1600) / 300);
  if (year <= 2100) return lerp(b.h1900, b.h2100, (year - 1900) / 200);
  return lerp(b.h2100, b.h2200, Math.min(1, (year - 2100) / 100));
}

export default function CityRemembers({ onBack, onCollect, seed, reducedMotion }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [year, setYear] = useState(1600);
  const [visited, setVisited] = useState<number[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const yearRef = useRef(year);
  const visitedRef = useRef<number[]>([]);
  const collected = useRef(false);
  const tRef = useRef(0);
  yearRef.current = year;
  visitedRef.current = visited;

  const buildings = useMemo(() => {
    const r = createRng(`city:${seed}`);
    const list: Building[] = [];
    let x = 0.02;
    while (x < 0.98) {
      const w = 0.035 + r() * 0.06;
      list.push({
        x,
        w,
        h1200: 0.08 + r() * 0.18,
        h1600: 0.12 + r() * 0.28,
        h1900: 0.18 + r() * 0.4,
        h2100: 0.25 + r() * 0.55,
        h2200: 0.15 + r() * 0.7,
        style: Math.floor(r() * 4),
      });
      x += w + 0.008 + r() * 0.02;
    }
    return list;
  }, [seed]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const collectOnce = useCallback(() => {
    if (collected.current) return;
    collected.current = true;
    museumAudio.chime();
    flash("Century Key — five ages unlocked");
    onCollect();
  }, [flash, onCollect]);

  const markVisit = useCallback(
    (y: number) => {
      const hit = MARKERS.find((m) => Math.abs(m - y) < 18);
      if (!hit) return;
      if (visitedRef.current.includes(hit)) return;
      const next = [...visitedRef.current, hit].sort((a, b) => a - b);
      setVisited(next);
      museumAudio.tone({ freq: 300 + next.length * 60, duration: 0.25, type: "triangle", gain: 0.06 });
      flash(`Memory sealed · ${hit}`);
      if (next.length >= MARKERS.length) collectOnce();
    },
    [flash, collectOnce],
  );

  useEffect(() => {
    markVisit(year);
  }, [year, markVisit]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let running = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
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

    const frame = () => {
      if (!running) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const y = yearRef.current;
      tRef.current += reducedMotion ? 0.3 : 1;
      const t = tRef.current;

      // sky by era
      const night = y < 1800 ? 0.35 : y < 2000 ? 0.55 : 0.75;
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      if (y < 1500) {
        sky.addColorStop(0, "#1a2438");
        sky.addColorStop(1, "#3a2a20");
      } else if (y < 1850) {
        sky.addColorStop(0, "#243048");
        sky.addColorStop(1, "#4a3828");
      } else if (y < 2050) {
        const top = Math.floor(8 + night * 10);
        sky.addColorStop(0, `rgb(${top}, ${12 + top}, ${28 + top})`);
        sky.addColorStop(1, "#1a2030");
      } else {
        sky.addColorStop(0, "#050818");
        sky.addColorStop(0.5, "#12102a");
        sky.addColorStop(1, "#0a2030");
      }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // distant haze / pollution
      if (y > 1850) {
        ctx.fillStyle = `rgba(180, 140, 100, ${(y - 1850) / 2000})`;
        ctx.fillRect(0, h * 0.35, w, h * 0.4);
      }

      const ground = h * 0.82;
      ctx.fillStyle = y < 1700 ? "#1a1612" : y < 2000 ? "#12141a" : "#0a0c14";
      ctx.fillRect(0, ground, w, h - ground);

      // river / glow line
      ctx.fillStyle = y > 2000 ? "rgba(94, 234, 212, 0.25)" : "rgba(80, 120, 160, 0.2)";
      ctx.fillRect(0, ground - 3, w, 4);

      for (const b of buildings) {
        const bh = heightAt(b, y) * h * 0.7;
        const bx = b.x * w;
        const bw = b.w * w;
        const top = ground - bh;

        // building body
        if (y < 1400) {
          ctx.fillStyle = "#2a2218";
        } else if (y < 1750) {
          ctx.fillStyle = `hsl(28, 18%, ${18 + b.style * 3}%)`;
        } else if (y < 2000) {
          ctx.fillStyle = `hsl(220, 10%, ${12 + b.style * 4}%)`;
        } else {
          ctx.fillStyle = `hsl(${200 + b.style * 20}, 30%, ${10 + b.style * 3}%)`;
        }
        ctx.fillRect(bx, top, bw, bh);

        // roof / spire early eras
        if (y < 1650 && b.style % 2 === 0) {
          ctx.fillStyle = "#3a2a1a";
          ctx.beginPath();
          ctx.moveTo(bx, top);
          ctx.lineTo(bx + bw / 2, top - 12 - b.style * 4);
          ctx.lineTo(bx + bw, top);
          ctx.fill();
        }

        // windows
        const lit = y >= 1850;
        const rows = Math.max(1, Math.floor(bh / 14));
        const cols = Math.max(1, Math.floor(bw / 8));
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if ((r + c + b.style) % 3 === 0 && y < 1600) continue;
            const wx = bx + 3 + c * (bw / cols);
            const wy = top + 4 + r * 14;
            if (wy + 6 > ground) continue;
            if (lit) {
              const flicker = reducedMotion ? 1 : 0.7 + 0.3 * Math.sin(t * 0.05 + r * c + b.x * 20);
              const neon = y > 2080;
              ctx.fillStyle = neon
                ? `hsla(${160 + (c * 40) % 120}, 90%, 65%, ${0.55 * flicker})`
                : `hsla(45, 90%, 70%, ${0.35 * flicker})`;
            } else {
              ctx.fillStyle = "rgba(255, 240, 200, 0.08)";
            }
            ctx.fillRect(wx, wy, Math.max(2, bw / cols - 3), 6);
          }
        }

        // antenna / hologram late
        if (y > 2100 && b.style === 3) {
          ctx.strokeStyle = `rgba(94, 234, 212, ${0.4 + 0.4 * Math.sin(t * 0.1 + b.x)})`;
          ctx.beginPath();
          ctx.moveTo(bx + bw / 2, top);
          ctx.lineTo(bx + bw / 2, top - 20);
          ctx.stroke();
        }
      }

      // transit
      if (y >= 1850) {
        const railY = ground - 18;
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.beginPath();
        ctx.moveTo(0, railY);
        ctx.lineTo(w, railY);
        ctx.stroke();
        const trainX = ((t * (y > 2050 ? 3.5 : 2)) % (w + 80)) - 40;
        ctx.fillStyle = y > 2050 ? "rgba(94, 234, 212, 0.7)" : "rgba(240, 200, 120, 0.7)";
        ctx.fillRect(trainX, railY - 8, 36, 8);
        if (y > 2050) {
          // flying transit
          const fx = ((t * 2.2 + 200) % (w + 60)) - 30;
          const fy = ground - 80 - Math.sin(t * 0.04) * 10;
          ctx.fillStyle = "rgba(232, 121, 249, 0.65)";
          ctx.beginPath();
          ctx.ellipse(fx, fy, 18, 4, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (y >= 1400) {
        // carts
        const cx = ((t * 0.8) % (w + 40)) - 20;
        ctx.fillStyle = "#4a3020";
        ctx.fillRect(cx, ground - 10, 16, 8);
      }

      // year ghost text
      ctx.fillStyle = "rgba(240, 194, 123, 0.12)";
      ctx.font = `700 ${Math.min(120, w * 0.18)}px Syne, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(String(Math.round(y)), w / 2, h * 0.28);

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [buildings, reducedMotion]);

  const jumpMarker = (m: number) => {
    setYear(m);
    museumAudio.whoosh();
  };

  return (
    <section className="im-exhibit" aria-label="The City That Remembers">
      <header className="im-exhibit-head">
        <h1>The City That Remembers</h1>
        <p className="im-serif">
          Year {Math.round(year)} · markers {visited.length}/{MARKERS.length}
        </p>
      </header>
      <div className="im-exhibit-body">
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
        {toast ? <div className="im-toast">{toast}</div> : null}
      </div>
      <div className="im-exhibit-controls">
        <button type="button" className="im-btn ghost" onClick={onBack}>
          ← Back
        </button>
        <label className="im-slider" style={{ minWidth: 180 }}>
          Timeline {Math.round(year)}
          <input
            type="range"
            min={1200}
            max={2200}
            step={1}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </label>
        {MARKERS.map((m) => (
          <button
            key={m}
            type="button"
            className={`im-btn ${visited.includes(m) ? "primary" : ""}`}
            onClick={() => jumpMarker(m)}
          >
            {m}
            {visited.includes(m) ? " ✓" : ""}
          </button>
        ))}
      </div>
    </section>
  );
}
