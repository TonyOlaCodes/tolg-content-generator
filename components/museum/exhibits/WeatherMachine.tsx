"use client";

import { useEffect, useRef, useState } from "react";
import { museumAudio } from "@/lib/museum/audio";
import { createRng } from "@/lib/museum/seeds";

type Mode = "clear" | "rain" | "storm" | "snow" | "wind" | "eclipse";

type Props = {
  onBack: () => void;
  onCollect: () => void;
  seed: string;
  reducedMotion?: boolean;
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; kind: Mode };

export default function WeatherMachine({ onBack, onCollect, seed, reducedMotion }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>("clear");
  const [intensity, setIntensity] = useState(0.55);
  const [toast, setToast] = useState<string | null>(null);
  const modeRef = useRef<Mode>("clear");
  const intensityRef = useRef(0.55);
  const particles = useRef<Particle[]>([]);
  const collectedRef = useRef(false);
  const tRef = useRef(0);
  const hills = useRef(
    (() => {
      const rng = createRng(`weather-hills:${seed}`);
      return Array.from({ length: 7 }, (_, i) => ({
        peak: 0.55 + rng() * 0.25,
        x: i / 6,
        w: 0.25 + rng() * 0.2,
      }));
    })(),
  );

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    intensityRef.current = intensity;
  }, [intensity]);

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

    const spawn = (w: number, h: number, m: Mode, n: number) => {
      for (let i = 0; i < n; i++) {
        if (m === "rain" || m === "storm") {
          particles.current.push({
            x: Math.random() * w,
            y: -10 - Math.random() * h * 0.3,
            vx: m === "storm" ? -2 - Math.random() * 2 : -0.4,
            vy: 6 + Math.random() * 8 * intensityRef.current,
            life: 1,
            kind: m,
          });
        } else if (m === "snow") {
          particles.current.push({
            x: Math.random() * w,
            y: -5,
            vx: (Math.random() - 0.5) * 1.2,
            vy: 0.6 + Math.random() * 1.4 * intensityRef.current,
            life: 1,
            kind: m,
          });
        } else if (m === "wind") {
          particles.current.push({
            x: -10,
            y: Math.random() * h * 0.7,
            vx: 4 + Math.random() * 6 * intensityRef.current,
            vy: (Math.random() - 0.5) * 0.8,
            life: 1,
            kind: m,
          });
        } else if (m === "eclipse") {
          particles.current.push({
            x: Math.random() * w,
            y: Math.random() * h * 0.5,
            vx: (Math.random() - 0.5) * 0.3,
            vy: -0.2 - Math.random() * 0.4,
            life: 0.6 + Math.random() * 0.4,
            kind: m,
          });
        }
      }
    };

    const draw = () => {
      if (!running) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const m = modeRef.current;
      const inten = intensityRef.current;
      if (!reducedMotion) tRef.current += 0.016;
      const t = tRef.current;

      // Sky
      let skyTop = "#1a2a4a";
      let skyBot = "#6b8cae";
      if (m === "clear") {
        skyTop = "#2a5080";
        skyBot = "#c4a574";
      } else if (m === "rain") {
        skyTop = "#1a2433";
        skyBot = "#3a4a5a";
      } else if (m === "storm") {
        skyTop = "#0c1018";
        skyBot = "#243044";
      } else if (m === "snow") {
        skyTop = "#3a4a62";
        skyBot = "#a8b8c8";
      } else if (m === "wind") {
        skyTop = "#3d5568";
        skyBot = "#8fa0a8";
      } else if (m === "eclipse") {
        skyTop = "#0a0614";
        skyBot = "#1a1028";
      }

      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, skyTop);
      sky.addColorStop(1, skyBot);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Sun / moon / eclipse
      const sunX = w * 0.72;
      const sunY = h * 0.22;
      if (m === "eclipse") {
        const corona = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 55);
        corona.addColorStop(0, "rgba(255,220,160,0.55)");
        corona.addColorStop(0.4, "rgba(232,121,249,0.25)");
        corona.addColorStop(1, "transparent");
        ctx.fillStyle = corona;
        ctx.beginPath();
        ctx.arc(sunX, sunY, 55, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f5e6c8";
        ctx.beginPath();
        ctx.arc(sunX, sunY, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#05040a";
        ctx.beginPath();
        ctx.arc(sunX - 4, sunY, 17, 0, Math.PI * 2);
        ctx.fill();
      } else if (m !== "storm") {
        ctx.fillStyle = m === "clear" ? "#ffe08a" : "rgba(220,230,255,0.7)";
        ctx.beginPath();
        ctx.arc(sunX, sunY, m === "clear" ? 22 : 14, 0, Math.PI * 2);
        ctx.fill();
      }

      // Lightning flash for storm
      if (m === "storm" && !reducedMotion && Math.random() < 0.012 * inten) {
        ctx.fillStyle = "rgba(200,220,255,0.35)";
        ctx.fillRect(0, 0, w, h);
        museumAudio.tone({ freq: 60, duration: 0.15, type: "sawtooth", gain: 0.03 });
      }

      // Hills
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (const hill of hills.current) {
        const hx = hill.x * w;
        const hy = h * hill.peak;
        ctx.quadraticCurveTo(hx, hy - Math.sin(t * 0.3 + hill.x * 4) * (m === "wind" ? 6 : 2), hx + hill.w * w * 0.5, h * 0.78);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = m === "eclipse" ? "#120a1a" : m === "snow" ? "#d8e0e8" : "#1e3a2a";
      ctx.fill();

      // Trees silhouettes
      for (let i = 0; i < 6; i++) {
        const tx = (i + 0.5) * (w / 6) + Math.sin(t * 0.8 + i) * (m === "wind" ? 4 * inten : 0.5);
        const ty = h * 0.72;
        ctx.fillStyle = m === "eclipse" ? "#0a0610" : "#0f2418";
        ctx.beginPath();
        ctx.moveTo(tx, ty - 28);
        ctx.lineTo(tx + 10, ty);
        ctx.lineTo(tx - 10, ty);
        ctx.fill();
      }

      // Particles
      const rate = Math.floor(2 + inten * 14);
      if (m !== "clear") spawn(w, h, m, reducedMotion ? Math.min(2, rate) : rate);

      particles.current = particles.current.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.008;
        if (p.kind === "rain" || p.kind === "storm") {
          ctx.strokeStyle = p.kind === "storm" ? "rgba(180,200,255,0.55)" : "rgba(160,190,220,0.45)";
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 2, p.y + p.vy * 1.5);
          ctx.stroke();
        } else if (p.kind === "snow") {
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === "wind") {
          ctx.strokeStyle = "rgba(220,230,240,0.25)";
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - 18, p.y);
          ctx.stroke();
        } else if (p.kind === "eclipse") {
          ctx.fillStyle = `rgba(232,121,249,${p.life * 0.5})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
        return p.life > 0 && p.y < h + 20 && p.x < w + 40;
      });
      if (particles.current.length > 400) particles.current.splice(0, particles.current.length - 400);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [reducedMotion, seed]);

  const setWeather = (next: Mode) => {
    setMode(next);
    particles.current = [];
    museumAudio.whoosh();
    if (next === "eclipse") {
      museumAudio.tone({ freq: 90, duration: 0.8, type: "sine", gain: 0.07 });
      museumAudio.tone({ freq: 180, duration: 1.1, type: "triangle", gain: 0.04 });
      setToast("Eclipse engaged — the landscape holds its breath.");
      window.setTimeout(() => setToast(null), 2400);
      if (!collectedRef.current) {
        collectedRef.current = true;
        museumAudio.chime();
        onCollect();
      }
    } else {
      setToast(`Atmosphere: ${next}`);
      window.setTimeout(() => setToast(null), 1200);
    }
  };

  const modes: Mode[] = ["clear", "rain", "storm", "snow", "wind", "eclipse"];

  return (
    <div className="im-exhibit" style={{ background: "#060810" }}>
      <header className="im-exhibit-head">
        <h1 className="im-serif">The Weather Machine</h1>
        <p>Command skies over a living miniature. Seek the eclipse.</p>
      </header>

      <div className="im-exhibit-body im-canvas-wrap">
        {toast && <div className="im-toast">{toast}</div>}
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      </div>

      <div className="im-exhibit-controls">
        <button type="button" className="im-btn ghost" onClick={onBack}>
          Return
        </button>
        {modes.map((m) => (
          <button
            key={m}
            type="button"
            className={`im-btn ${mode === m ? "primary" : ""}`}
            onClick={() => setWeather(m)}
          >
            {m}
          </button>
        ))}
        <label className="im-slider">
          Intensity
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.01}
            value={intensity}
            onChange={(e) => setIntensity(Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
