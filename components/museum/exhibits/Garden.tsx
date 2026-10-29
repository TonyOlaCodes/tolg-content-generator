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

type Species = "lumen" | "spiral" | "glass";

type Plant = {
  id: number;
  x: number;
  y: number;
  species: Species;
  age: number; // 0..1 bloomed
  sway: number;
  hue: number;
};

const SPECIES: Species[] = ["lumen", "spiral", "glass"];
const SPECIES_META: Record<Species, { label: string; grow: number; hue: number }> = {
  lumen: { label: "Lumen Fern", grow: 0.00055, hue: 140 },
  spiral: { label: "Spiral Orchid", grow: 0.00042, hue: 300 },
  glass: { label: "Glass Blossom", grow: 0.00048, hue: 190 },
};

export default function Garden({ onBack, onCollect, seed, reducedMotion }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [species, setSpecies] = useState<Species>("lumen");
  const [count, setCount] = useState(0);
  const [bloomed, setBloomed] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const plants = useRef<Plant[]>([]);
  const collected = useRef(false);
  const nextId = useRef(0);
  const light = useRef(0.65);
  const [lightUi, setLightUi] = useState(0.65);
  const rng = useRef(createRng(`garden:${seed}`));
  const lastTs = useRef(0);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const collectOnce = useCallback(() => {
    if (collected.current) return;
    collected.current = true;
    museumAudio.chime();
    flash("Seed of Never — three blooms that should not exist");
    onCollect();
  }, [flash, onCollect]);

  const plantAt = useCallback(
    (nx: number, ny: number) => {
      if (plants.current.length >= 12) {
        flash("The soil refuses more seeds");
        return;
      }
      const r = rng.current;
      const p: Plant = {
        id: nextId.current++,
        x: nx,
        y: Math.min(0.92, Math.max(0.35, ny)),
        species,
        age: 0,
        sway: r() * Math.PI * 2,
        hue: SPECIES_META[species].hue + (r() - 0.5) * 24,
      };
      plants.current.push(p);
      setCount(plants.current.length);
      museumAudio.tone({
        freq: species === "lumen" ? 520 : species === "spiral" ? 390 : 460,
        duration: 0.22,
        type: "sine",
        gain: 0.05,
      });
    },
    [species, flash],
  );

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

    const drawPlant = (p: Plant, w: number, h: number, t: number) => {
      const x = p.x * w;
      const ground = p.y * h;
      const a = Math.min(1, p.age);
      const sway = reducedMotion ? 0 : Math.sin(t * 0.002 + p.sway) * (6 + a * 8);
      const stemH = 40 + a * 110;
      const tipX = x + sway;
      const tipY = ground - stemH;

      ctx.strokeStyle = `hsla(${p.hue}, 55%, ${25 + light.current * 20}%, 0.85)`;
      ctx.lineWidth = 2 + a * 2;
      ctx.beginPath();
      ctx.moveTo(x, ground);
      ctx.quadraticCurveTo(x + sway * 0.4, ground - stemH * 0.5, tipX, tipY);
      ctx.stroke();

      if (p.species === "lumen") {
        const leaves = Math.floor(2 + a * 7);
        for (let i = 0; i < leaves; i++) {
          const u = (i + 1) / (leaves + 1);
          const lx = x + sway * u;
          const ly = ground - stemH * u;
          const side = i % 2 === 0 ? -1 : 1;
          const len = 12 + a * 28;
          ctx.fillStyle = `hsla(${p.hue + 20}, 80%, ${45 + light.current * 25}%, ${0.35 + a * 0.5})`;
          ctx.beginPath();
          ctx.ellipse(lx + side * len * 0.5, ly, len, 6 + a * 4, side * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
        if (a > 0.75) {
          const bloom = (a - 0.75) / 0.25;
          const g = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 18 * bloom);
          g.addColorStop(0, `hsla(${p.hue}, 100%, 80%, 0.95)`);
          g.addColorStop(1, "transparent");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(tipX, tipY, 18 * bloom, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (p.species === "spiral") {
        const turns = 2 + a * 4;
        ctx.strokeStyle = `hsla(${p.hue}, 70%, 65%, ${0.4 + a * 0.5})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i <= 40; i++) {
          const u = i / 40;
          const ang = u * turns * Math.PI * 2 + t * 0.001;
          const rr = 4 + u * (10 + a * 22);
          const px = tipX + Math.cos(ang) * rr;
          const py = tipY + Math.sin(ang) * rr * 0.7 + u * 8;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        if (a > 0.75) {
          ctx.fillStyle = `hsla(${p.hue + 40}, 90%, 70%, ${(a - 0.75) * 3})`;
          ctx.beginPath();
          ctx.arc(tipX, tipY, 8 + a * 6, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        const petals = Math.floor(3 + a * 6);
        for (let i = 0; i < petals; i++) {
          const ang = (i / petals) * Math.PI * 2 + t * 0.0008;
          const len = 8 + a * 26;
          ctx.strokeStyle = `hsla(${p.hue}, 40%, 80%, ${0.25 + a * 0.55})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(tipX, tipY);
          ctx.quadraticCurveTo(
            tipX + Math.cos(ang) * len * 0.6,
            tipY + Math.sin(ang) * len * 0.6 - 6,
            tipX + Math.cos(ang) * len,
            tipY + Math.sin(ang) * len,
          );
          ctx.stroke();
        }
        if (a > 0.75) {
          ctx.fillStyle = `hsla(${p.hue}, 90%, 75%, ${(a - 0.75) * 3.2})`;
          ctx.beginPath();
          ctx.arc(tipX, tipY, 5 + a * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const frame = (ts: number) => {
      if (!running) return;
      const dt = lastTs.current ? Math.min(40, ts - lastTs.current) : 16;
      lastTs.current = ts;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      // sky / soil
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#060818");
      sky.addColorStop(0.55, `rgba(20, 40, 50, ${0.4 + light.current * 0.3})`);
      sky.addColorStop(0.72, "#0a1a12");
      sky.addColorStop(1, "#050a08");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // mist
      if (!reducedMotion) {
        for (let i = 0; i < 5; i++) {
          const mx = ((ts * 0.01 + i * 120) % (w + 100)) - 50;
          ctx.fillStyle = `rgba(120, 200, 170, ${0.03 + light.current * 0.04})`;
          ctx.beginPath();
          ctx.ellipse(mx, h * 0.55 + i * 12, 80, 20, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ground line
      ctx.strokeStyle = "rgba(124, 252, 154, 0.15)";
      ctx.beginPath();
      ctx.moveTo(0, h * 0.72);
      ctx.lineTo(w, h * 0.72);
      ctx.stroke();

      let fully = 0;
      for (const p of plants.current) {
        const rate = SPECIES_META[p.species].grow * (0.6 + light.current * 1.1) * (reducedMotion ? 1.8 : 1);
        p.age = Math.min(1, p.age + rate * dt);
        if (p.age >= 1) fully += 1;
        drawPlant(p, w, h, ts);
      }

      setBloomed((prev) => (prev !== fully ? fully : prev));
      if (fully >= 3) collectOnce();

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [reducedMotion, collectOnce, seed]);

  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    plantAt((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
  };

  return (
    <section className="im-exhibit" aria-label="The Garden of Tomorrow">
      <header className="im-exhibit-head">
        <h1>The Garden of Tomorrow</h1>
        <p className="im-serif">
          {bloomed}/3 fully bloomed · {count} planted · tap soil to sow
        </p>
      </header>
      <div className="im-exhibit-body">
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", display: "block", cursor: "crosshair", touchAction: "none" }}
          onPointerDown={onPointer}
        />
        {toast ? <div className="im-toast">{toast}</div> : null}
      </div>
      <div className="im-exhibit-controls">
        <button type="button" className="im-btn ghost" onClick={onBack}>
          ← Back
        </button>
        {SPECIES.map((s) => (
          <button
            key={s}
            type="button"
            className={`im-btn ${species === s ? "primary" : ""}`}
            onClick={() => {
              setSpecies(s);
              museumAudio.tone({ freq: 300 + SPECIES.indexOf(s) * 80, duration: 0.12, gain: 0.04 });
            }}
          >
            {SPECIES_META[s].label}
          </button>
        ))}
        <label className="im-slider">
          Light {Math.round(lightUi * 100)}
          <input
            type="range"
            min={10}
            max={100}
            value={Math.round(lightUi * 100)}
            onChange={(e) => {
              const v = Number(e.target.value) / 100;
              setLightUi(v);
              light.current = v;
            }}
          />
        </label>
      </div>
    </section>
  );
}
