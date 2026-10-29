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

type Trail = { x: number; y: number; life: number; hue: number };

export default function OceanAbove({ onBack, onCollect, seed, reducedMotion }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stir, setStir] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [turbulence, setTurbulence] = useState(0.5);
  const trails = useRef<Trail[]>([]);
  const pointer = useRef<{ x: number; y: number; active: boolean }>({ x: 0.5, y: 0.2, active: false });
  const interaction = useRef(0);
  const collected = useRef(false);
  const revealT = useRef(0);
  const turbRef = useRef(0.5);
  const rng = useRef(createRng(`ocean:${seed}`));
  const tRef = useRef(0);

  turbRef.current = turbulence;

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  }, []);

  const collectOnce = useCallback(() => {
    if (collected.current) return;
    collected.current = true;
    museumAudio.chime();
    flash("Tide Glass — the leviathan noticed you");
    onCollect();
  }, [flash, onCollect]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let running = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // precompute bubble seeds
    const bubbles = Array.from({ length: 40 }, (_, i) => {
      const r = rng.current;
      return { x: r(), phase: r() * Math.PI * 2, speed: 0.0003 + r() * 0.0008, size: 1 + r() * 3, i };
    });

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
      const step = reducedMotion ? 0.4 : 1;
      tRef.current += step;
      const t = tRef.current;
      const turb = turbRef.current;

      // inverted: water occupies top ~62%
      const surfaceY = h * 0.62;
      const air = ctx.createLinearGradient(0, surfaceY, 0, h);
      air.addColorStop(0, "#0a1520");
      air.addColorStop(1, "#020408");
      ctx.fillStyle = air;
      ctx.fillRect(0, surfaceY, w, h - surfaceY);

      const water = ctx.createLinearGradient(0, 0, 0, surfaceY);
      water.addColorStop(0, "#021828");
      water.addColorStop(0.5, "#043a55");
      water.addColorStop(1, "#0a5f7a");
      ctx.fillStyle = water;
      ctx.fillRect(0, 0, w, surfaceY);

      // wave surface (drawn from below looking up)
      ctx.beginPath();
      ctx.moveTo(0, surfaceY);
      for (let x = 0; x <= w; x += 6) {
        const y =
          surfaceY +
          Math.sin(x * 0.018 + t * 0.04 * (0.5 + turb)) * (6 + turb * 10) +
          Math.sin(x * 0.05 + t * 0.07) * 3;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = "rgba(2, 8, 16, 0.85)";
      ctx.fill();

      // caustic shimmer in water
      if (!reducedMotion) {
        for (let i = 0; i < 18; i++) {
          const cx = ((i * 137 + t * 0.7) % w);
          const cy = ((Math.sin(i + t * 0.02) * 0.5 + 0.5) * surfaceY * 0.85);
          ctx.strokeStyle = `rgba(120, 230, 255, ${0.04 + turb * 0.06})`;
          ctx.beginPath();
          ctx.arc(cx, cy, 20 + (i % 5) * 8, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // bubbles rise toward surface (up = toward y=0 in inverted ocean... wait)
      // Inverted ocean: water is ON TOP. Gravity for water world is toward the surface from above? 
      // Water hangs overhead — bubbles in the hanging ocean would drift "down" into the water body, i.e. toward y=0 (deeper into the hanging sea).
      for (const b of bubbles) {
        const bx = b.x * w + Math.sin(t * 0.02 + b.phase) * 12;
        const by = ((b.phase + t * b.speed * 60 * (0.5 + turb)) % 1) * surfaceY;
        ctx.fillStyle = `rgba(160, 230, 255, ${0.15 + (1 - by / surfaceY) * 0.35})`;
        ctx.beginPath();
        ctx.arc(bx, by, b.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // bioluminescent trails
      trails.current = trails.current.filter((tr) => {
        tr.life -= 0.012 * step;
        if (tr.life <= 0) return false;
        const px = tr.x * w;
        const py = tr.y * h;
        const g = ctx.createRadialGradient(px, py, 0, px, py, 28 * tr.life);
        g.addColorStop(0, `hsla(${tr.hue}, 90%, 70%, ${tr.life * 0.85})`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, 28 * tr.life, 0, Math.PI * 2);
        ctx.fill();
        return true;
      });

      if (pointer.current.active && pointer.current.y < 0.62) {
        trails.current.push({
          x: pointer.current.x,
          y: pointer.current.y,
          life: 1,
          hue: 160 + rng.current() * 80,
        });
        interaction.current += reducedMotion ? 1.6 : 1;
        const s = Math.floor(interaction.current);
        setStir((prev) => (prev !== s ? s : prev));
      }

      const need = 180;
      const progress = Math.min(1, interaction.current / need);
      if (progress >= 1 && revealT.current === 0) {
        revealT.current = 1;
        setRevealed(true);
        museumAudio.whoosh();
        flash("Something vast uncoils in the inverted deep");
        collectOnce();
      }

      if (revealT.current > 0) {
        revealT.current += step;
        const alpha = Math.min(1, revealT.current / 40);
        // leviathan silhouette swimming in upper water
        const lx = w * (0.5 + Math.sin(t * 0.015) * 0.12);
        const ly = surfaceY * (0.35 + Math.sin(t * 0.01) * 0.08);
        ctx.save();
        ctx.globalAlpha = alpha * 0.85;
        ctx.translate(lx, ly);
        ctx.scale(1 + Math.sin(t * 0.02) * 0.03, 1);
        // body
        ctx.fillStyle = "#061820";
        ctx.beginPath();
        ctx.ellipse(0, 0, 120, 28, 0, 0, Math.PI * 2);
        ctx.fill();
        // fins
        ctx.beginPath();
        ctx.moveTo(-40, 0);
        ctx.lineTo(-90, -35);
        ctx.lineTo(-70, 5);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(100, 0);
        ctx.quadraticCurveTo(150, -20, 160, 0);
        ctx.quadraticCurveTo(150, 18, 100, 8);
        ctx.fill();
        // eye glow
        ctx.fillStyle = `hsla(170, 100%, 70%, ${0.5 + 0.5 * Math.sin(t * 0.08)})`;
        ctx.beginPath();
        ctx.arc(70, -4, 5, 0, Math.PI * 2);
        ctx.fill();
        // bioluminescent spots
        for (let i = 0; i < 8; i++) {
          ctx.fillStyle = `hsla(${180 + i * 10}, 90%, 65%, 0.55)`;
          ctx.beginPath();
          ctx.arc(-60 + i * 22, Math.sin(i + t * 0.05) * 6, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else if (progress > 0.4) {
        // foreshadow
        ctx.fillStyle = `rgba(10, 40, 50, ${(progress - 0.4) * 0.5})`;
        ctx.beginPath();
        ctx.ellipse(w * 0.55, surfaceY * 0.3, 80 * progress, 18, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // depth vignette
      const vig = ctx.createRadialGradient(w / 2, surfaceY * 0.4, 40, w / 2, surfaceY * 0.4, h * 0.7);
      vig.addColorStop(0, "transparent");
      vig.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [reducedMotion, seed, collectOnce, flash]);

  const setPointer = (e: React.PointerEvent<HTMLCanvasElement>, active: boolean) => {
    const rect = e.currentTarget.getBoundingClientRect();
    pointer.current = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
      active,
    };
    if (active) {
      museumAudio.tone({ freq: 220 + pointer.current.y * 200, duration: 0.06, type: "sine", gain: 0.025 });
    }
  };

  return (
    <section className="im-exhibit" aria-label="The Ocean Above">
      <header className="im-exhibit-head">
        <h1>The Ocean Above</h1>
        <p className="im-serif">
          {revealed ? "The leviathan watches from the ceiling-sea" : `Disturb the hanging tide · stir ${Math.min(100, Math.round((stir / 180) * 100))}%`}
        </p>
      </header>
      <div className="im-exhibit-body">
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", display: "block", touchAction: "none", cursor: "crosshair" }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setPointer(e, true);
          }}
          onPointerMove={(e) => {
            if (pointer.current.active) setPointer(e, true);
          }}
          onPointerUp={(e) => setPointer(e, false)}
          onPointerCancel={(e) => setPointer(e, false)}
        />
        {toast ? <div className="im-toast">{toast}</div> : null}
      </div>
      <div className="im-exhibit-controls">
        <button type="button" className="im-btn ghost" onClick={onBack}>
          ← Back
        </button>
        <label className="im-slider">
          Turbulence {Math.round(turbulence * 100)}
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(turbulence * 100)}
            onChange={(e) => {
              setTurbulence(Number(e.target.value) / 100);
              museumAudio.tone({ freq: 90 + Number(e.target.value), duration: 0.08, gain: 0.03 });
            }}
          />
        </label>
        <button
          type="button"
          className="im-btn primary"
          onClick={() => {
            interaction.current = Math.min(180, interaction.current + 40);
            setStir(Math.floor(interaction.current));
            museumAudio.whoosh();
            flash("You clap the water — the deep answers");
          }}
        >
          Pulse current
        </button>
      </div>
    </section>
  );
}
