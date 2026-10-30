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

type Phase = "stable" | "unstable" | "supernova" | "blackhole";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  hue: number;
  size: number;
};

export default function StarForge({ onBack, onCollect, seed, reducedMotion }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mass, setMass] = useState(0.45);
  const [temp, setTemp] = useState(0.55);
  const [energy, setEnergy] = useState(0.4);
  const [phase, setPhase] = useState<Phase>("stable");
  const [toast, setToast] = useState<string | null>(null);
  const collected = useRef(false);
  const phaseRef = useRef<Phase>("stable");
  const params = useRef({ mass, temp, energy });
  const particles = useRef<Particle[]>([]);
  const tRef = useRef(0);
  const collapseT = useRef(0);
  const rng = useRef(createRng(`star:${seed}`));

  params.current = { mass, temp, energy };
  phaseRef.current = phase;

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const collectOnce = useCallback(() => {
    if (collected.current) return;
    collected.current = true;
    museumAudio.chime();
    flash("Ember Core recovered from the event horizon");
    onCollect();
  }, [flash, onCollect]);

  useEffect(() => {
    const { mass: m, temp: te, energy: en } = params.current;
    const stress = m * 0.45 + te * 0.25 + en * 0.55;
    if (phaseRef.current === "stable" && stress > 1.35 && m > 0.72 && en > 0.7) {
      setPhase("unstable");
      museumAudio.tone({ freq: 90, duration: 0.6, type: "sawtooth", gain: 0.07 });
      flash("Core instability — the forge is hungry");
    }
  }, [mass, temp, energy, flash]);

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

    const spawnBurst = (cx: number, cy: number, n: number, speed: number, hueBase: number) => {
      const r = rng.current;
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2;
        const s = speed * (0.4 + r());
        particles.current.push({
          x: cx,
          y: cy,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: 0,
          max: 40 + r() * 70,
          hue: hueBase + r() * 40,
          size: 1.5 + r() * 3.5,
        });
      }
    };

    const draw = () => {
      if (!running) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cx = w / 2;
      const cy = h * 0.48;
      const { mass: m, temp: te, energy: en } = params.current;
      const ph = phaseRef.current;
      const step = reducedMotion ? 0.35 : 1;
      tRef.current += step;

      ctx.fillStyle = "rgba(2, 2, 8, 0.28)";
      ctx.fillRect(0, 0, w, h);

      // starfield
      const stars = 80;
      for (let i = 0; i < stars; i++) {
        const sx = ((i * 97 + seed.charCodeAt(i % seed.length) * 13) % 1000) / 1000 * w;
        const sy = ((i * 53 + 17) % 700) / 700 * h;
        const tw = reducedMotion ? 0.5 : 0.35 + 0.65 * Math.abs(Math.sin(tRef.current * 0.02 + i));
        ctx.fillStyle = `rgba(230, 220, 255, ${0.15 + tw * 0.45})`;
        ctx.fillRect(sx, sy, 1.4, 1.4);
      }

      const baseR = 28 + m * 90;
      let radius = baseR;
      let coreHue = 30 + te * 40;
      let glow = 0.35 + en * 0.55;

      if (ph === "unstable") {
        radius = baseR * (1 + 0.08 * Math.sin(tRef.current * 0.25));
        glow = 0.7 + 0.3 * Math.sin(tRef.current * 0.4);
        if (tRef.current % 8 < step && !reducedMotion) {
          spawnBurst(cx, cy, 6, 2 + en * 4, 20);
        }
        collapseT.current += step;
        if (collapseT.current > 90) {
          phaseRef.current = "supernova";
          setPhase("supernova");
          collapseT.current = 0;
          museumAudio.whoosh();
          flash("Supernova");
          spawnBurst(cx, cy, 120, 8, 35);
        }
      } else if (ph === "supernova") {
        collapseT.current += step;
        radius = baseR * (1.2 + collapseT.current * 0.08);
        glow = 1;
        coreHue = 50;
        if (collapseT.current > 55) {
          phaseRef.current = "blackhole";
          setPhase("blackhole");
          museumAudio.tone({ freq: 48, duration: 1.2, type: "sine", gain: 0.09 });
          flash("Collapse complete — a quiet mouth opens");
          collectOnce();
        }
      } else if (ph === "blackhole") {
        radius = Math.max(10, baseR * 0.22);
        glow = 0.15;
        coreHue = 260;
        // accretion
        for (let i = 0; i < 48; i++) {
          const a = tRef.current * 0.04 + (i / 48) * Math.PI * 2;
          const rr = radius * 2.2 + Math.sin(a * 3 + tRef.current * 0.05) * 8;
          const px = cx + Math.cos(a) * rr * 1.6;
          const py = cy + Math.sin(a) * rr * 0.45;
          ctx.fillStyle = `hsla(${200 + i}, 80%, 70%, 0.55)`;
          ctx.beginPath();
          ctx.arc(px, py, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // corona
      if (ph !== "blackhole") {
        const g = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 2.8);
        g.addColorStop(0, `hsla(${coreHue}, 100%, 70%, ${glow})`);
        g.addColorStop(0.35, `hsla(${coreHue + 20}, 95%, 55%, ${glow * 0.45})`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 2.8, 0, Math.PI * 2);
        ctx.fill();

        const core = ctx.createRadialGradient(cx - radius * 0.2, cy - radius * 0.2, 0, cx, cy, radius);
        core.addColorStop(0, "#fff8e8");
        core.addColorStop(0.45, `hsl(${coreHue}, 100%, 62%)`);
        core.addColorStop(1, `hsl(${coreHue + 30}, 90%, 35%)`);
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        // convective cells
        if (!reducedMotion) {
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2 + tRef.current * 0.015 * (1 + en);
            const rr = radius * (0.35 + 0.45 * ((i * 0.17) % 1));
            ctx.fillStyle = `hsla(${coreHue + 40}, 100%, 75%, 0.12)`;
            ctx.beginPath();
            ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, radius * 0.18, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else {
        // event horizon
        const hole = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 3);
        hole.addColorStop(0, "#000");
        hole.addColorStop(0.35, "#050510");
        hole.addColorStop(0.55, "rgba(40, 20, 80, 0.5)");
        hole.addColorStop(1, "transparent");
        ctx.fillStyle = hole;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(180, 140, 255, 0.55)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, radius * 2.4, radius * 0.55, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // particles
      particles.current = particles.current.filter((p) => {
        p.life += step;
        p.x += p.vx * step;
        p.y += p.vy * step;
        if (ph === "blackhole") {
          const dx = cx - p.x;
          const dy = cy - p.y;
          const d = Math.hypot(dx, dy) || 1;
          p.vx += (dx / d) * 0.35;
          p.vy += (dy / d) * 0.35;
        }
        const alpha = 1 - p.life / p.max;
        if (alpha <= 0) return false;
        ctx.fillStyle = `hsla(${p.hue}, 95%, 65%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
        return true;
      });

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [seed, reducedMotion, collectOnce, flash]);

  const forceCollapse = () => {
    if (phase !== "stable" && phase !== "unstable") return;
    setMass(0.95);
    setTemp(0.9);
    setEnergy(0.95);
    setPhase("unstable");
    collapseT.current = 40;
    museumAudio.tone({ freq: 110, duration: 0.4, type: "square", gain: 0.05 });
    flash("You feed the forge past its limit");
  };

  const status =
    phase === "blackhole"
      ? "Black hole — silence with teeth"
      : phase === "supernova"
        ? "Supernova in progress"
        : phase === "unstable"
          ? "Unstable — collapse imminent"
          : "Stable fusion";

  return (
    <section className="im-exhibit" aria-label="The Star Forge">
      <header className="im-exhibit-head">
        <h1>The Star Forge</h1>
        <p className="im-serif">{status}</p>
      </header>
      <div className="im-exhibit-body">
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
        {toast ? <div className="im-toast">{toast}</div> : null}
      </div>
      <div className="im-exhibit-controls">
        <button type="button" className="im-btn ghost" onClick={onBack}>
          ← Back
        </button>
        <label className="im-slider">
          Mass {Math.round(mass * 100)}
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(mass * 100)}
            onChange={(e) => {
              setMass(Number(e.target.value) / 100);
              museumAudio.tone({ freq: 180 + Number(e.target.value), duration: 0.08, gain: 0.03 });
            }}
          />
        </label>
        <label className="im-slider">
          Temp {Math.round(temp * 100)}
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(temp * 100)}
            onChange={(e) => {
              setTemp(Number(e.target.value) / 100);
              museumAudio.tone({ freq: 220 + Number(e.target.value) * 2, duration: 0.08, gain: 0.03 });
            }}
          />
        </label>
        <label className="im-slider">
          Energy {Math.round(energy * 100)}
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(energy * 100)}
            onChange={(e) => {
              setEnergy(Number(e.target.value) / 100);
              museumAudio.tone({ freq: 140 + Number(e.target.value) * 3, duration: 0.08, gain: 0.03 });
            }}
          />
        </label>
        <button type="button" className="im-btn primary" onClick={forceCollapse} disabled={phase === "blackhole" || phase === "supernova"}>
          Overfeed
        </button>
      </div>
    </section>
  );
}
