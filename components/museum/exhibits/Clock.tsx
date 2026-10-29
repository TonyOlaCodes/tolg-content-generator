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

export default function Clock({ onBack, onCollect, seed, reducedMotion }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hour, setHour] = useState(7);
  const [reversed, setReversed] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);
  const hourRef = useRef(hour);
  const revRef = useRef(reversed);
  const freezeRef = useRef(frozen);
  const lockRef = useRef(locked);
  const collected = useRef(false);
  const tRef = useRef(0);
  const gearPhase = useRef(0);
  const rng = useRef(createRng(`clock:${seed}`));

  hourRef.current = hour;
  revRef.current = reversed;
  freezeRef.current = frozen;
  lockRef.current = locked;

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const collectOnce = useCallback(() => {
    if (collected.current) return;
    collected.current = true;
    museumAudio.chime();
    flash("Stolen Hour recovered from the escapement");
    onCollect();
  }, [flash, onCollect]);

  const tryLock = () => {
    if (locked || solved) return;
    if (hourRef.current === 13) {
      setLocked(true);
      setFrozen(true);
      setSolved(true);
      museumAudio.chord([261.63, 329.63, 392.0, 523.25]);
      flash("The thirteenth hour locks into place");
      collectOnce();
    } else {
      museumAudio.tone({ freq: 70, duration: 0.4, type: "square", gain: 0.05 });
      flash(`Hour ${hourRef.current} will not hold — need 13`);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let running = true;
    let acc = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const teethOffsets = Array.from({ length: 3 }, () => rng.current());

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

    const drawGear = (
      cx: number,
      cy: number,
      radius: number,
      teeth: number,
      angle: number,
      color: string,
    ) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < teeth; i++) {
        const a0 = (i / teeth) * Math.PI * 2;
        const a1 = ((i + 0.45) / teeth) * Math.PI * 2;
        const a2 = ((i + 0.55) / teeth) * Math.PI * 2;
        const a3 = ((i + 1) / teeth) * Math.PI * 2;
        const inner = radius * 0.78;
        const outer = radius;
        if (i === 0) ctx.moveTo(Math.cos(a0) * inner, Math.sin(a0) * inner);
        ctx.lineTo(Math.cos(a0) * outer, Math.sin(a0) * outer);
        ctx.lineTo(Math.cos(a1) * outer, Math.sin(a1) * outer);
        ctx.lineTo(Math.cos(a2) * inner, Math.sin(a2) * inner);
        ctx.lineTo(Math.cos(a3) * inner, Math.sin(a3) * inner);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(251, 191, 36, 0.35)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = "#1a1408";
      ctx.fill();
      ctx.restore();
    };

    const frame = () => {
      if (!running) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const step = reducedMotion ? 0.35 : 1;
      tRef.current += step;

      if (!freezeRef.current && !lockRef.current) {
        const dir = revRef.current ? -1 : 1;
        gearPhase.current += 0.02 * dir * step;
        acc += step;
        // auto tick hours 1–12 slowly; 13 is only via nudge
        if (acc > 90 && hourRef.current < 13) {
          acc = 0;
          const wrapped = ((hourRef.current - 1 + dir + 12) % 12) + 1;
          setHour(wrapped);
        }
      }

      // background
      const bg = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, h * 0.7);
      bg.addColorStop(0, "#1a1208");
      bg.addColorStop(1, "#050308");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // brass dust
      for (let i = 0; i < 30; i++) {
        const px = ((i * 97 + teethOffsets[0]! * 100) % 100) / 100 * w;
        const py = ((i * 53 + tRef.current * (freezeRef.current ? 0 : 0.2)) % h);
        ctx.fillStyle = "rgba(251, 191, 36, 0.15)";
        ctx.fillRect(px, py, 1.5, 1.5);
      }

      const cx = w / 2;
      const cy = h * 0.48;
      const a = gearPhase.current;

      drawGear(cx - 70, cy + 10, 58, 14, a, "#5a4020");
      drawGear(cx + 55, cy - 20, 72, 18, -a * 0.78 + teethOffsets[1]!, "#6a4a24");
      drawGear(cx + 10, cy + 55, 42, 10, a * 1.4, "#4a3218");

      // clock face
      const faceR = Math.min(w, h) * 0.22;
      ctx.beginPath();
      ctx.arc(cx, cy - 10, faceR, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(20, 14, 8, 0.92)";
      ctx.fill();
      ctx.strokeStyle = "rgba(251, 191, 36, 0.65)";
      ctx.lineWidth = 3;
      ctx.stroke();

      // hour marks — 12 normal + ghost 13
      for (let i = 1; i <= 12; i++) {
        const ang = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const x1 = cx + Math.cos(ang) * faceR * 0.78;
        const y1 = cy - 10 + Math.sin(ang) * faceR * 0.78;
        ctx.fillStyle = "rgba(243, 239, 230, 0.7)";
        ctx.font = `600 ${Math.max(10, faceR * 0.14)}px Syne, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(i), x1, y1);
      }
      // stolen hour mark
      {
        const ang = (13 / 12) * Math.PI * 2 - Math.PI / 2 + 0.2;
        const x1 = cx + Math.cos(ang) * faceR * 0.55;
        const y1 = cy - 10 + Math.sin(ang) * faceR * 0.55;
        ctx.fillStyle = hourRef.current === 13 ? "rgba(251, 191, 36, 0.95)" : "rgba(251, 191, 36, 0.25)";
        ctx.font = `italic ${Math.max(11, faceR * 0.16)}px "Cormorant Garamond", serif`;
        ctx.fillText("13", x1, y1);
      }

      // hand
      const displayHour = hourRef.current;
      const handAng =
        displayHour === 13
          ? (13 / 12) * Math.PI * 2 - Math.PI / 2 + 0.2
          : (displayHour / 12) * Math.PI * 2 - Math.PI / 2;
      ctx.strokeStyle = lockRef.current ? "rgba(94, 234, 212, 0.95)" : "rgba(251, 191, 36, 0.9)";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(cx + Math.cos(handAng) * faceR * 0.62, cy - 10 + Math.sin(handAng) * faceR * 0.62);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy - 10, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#fbbf24";
      ctx.fill();

      // readout
      ctx.fillStyle = "rgba(251, 191, 36, 0.85)";
      ctx.font = `700 ${Math.max(18, faceR * 0.28)}px Syne, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(
        lockRef.current ? "LOCKED · XIII" : `HOUR ${displayHour}`,
        cx,
        cy + faceR + 36,
      );

      if (freezeRef.current && !reducedMotion) {
        ctx.strokeStyle = "rgba(94, 234, 212, 0.2)";
        ctx.beginPath();
        ctx.arc(cx, cy - 10, faceR + 8 + Math.sin(tRef.current * 0.08) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [reducedMotion, seed]);

  const nudge = (delta: number) => {
    if (locked) return;
    setFrozen(true);
    setHour((h) => {
      // allow 1..13
      let n = h + delta;
      if (n < 1) n = 13;
      if (n > 13) n = 1;
      return n;
    });
    museumAudio.tone({ freq: 330 + delta * 40, duration: 0.12, type: "triangle", gain: 0.045 });
  };

  return (
    <section className="im-exhibit" aria-label="The Clock That Eats Time">
      <header className="im-exhibit-head">
        <h1>The Clock That Eats Time</h1>
        <p className="im-serif">
          {solved ? "The stolen hour sits still" : "Reverse, freeze, nudge — lock the thirteenth hour"}
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
        <button
          type="button"
          className={`im-btn ${reversed ? "primary" : ""}`}
          disabled={locked}
          onClick={() => {
            setReversed((r) => !r);
            museumAudio.whoosh();
          }}
        >
          {reversed ? "Reversed" : "Reverse"}
        </button>
        <button
          type="button"
          className={`im-btn ${frozen ? "primary" : ""}`}
          disabled={locked}
          onClick={() => {
            setFrozen((f) => !f);
            museumAudio.tone({ freq: frozen ? 260 : 140, duration: 0.2, gain: 0.05 });
          }}
        >
          {frozen ? "Frozen" : "Freeze"}
        </button>
        <button type="button" className="im-btn" disabled={locked} onClick={() => nudge(-1)}>
          − Hour
        </button>
        <button type="button" className="im-btn" disabled={locked} onClick={() => nudge(1)}>
          + Hour
        </button>
        <button type="button" className="im-btn primary" disabled={locked || solved} onClick={tryLock}>
          Lock
        </button>
      </div>
    </section>
  );
}
