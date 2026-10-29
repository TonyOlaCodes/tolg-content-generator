"use client";

import { useEffect, useRef } from "react";
import type { JointId, LiveFrame } from "@/lib/pullup-sim";

const BONES: Array<[JointId, JointId]> = [
  ["lShoulder", "rShoulder"],
  ["lShoulder", "lElbow"],
  ["lElbow", "lWrist"],
  ["rShoulder", "rElbow"],
  ["rElbow", "rWrist"],
  ["lShoulder", "lHip"],
  ["rShoulder", "rHip"],
  ["lHip", "rHip"],
  ["lHip", "lKnee"],
  ["lKnee", "lAnkle"],
  ["rHip", "rKnee"],
  ["rKnee", "rAnkle"],
  ["lShoulder", "nose"],
  ["rShoulder", "nose"],
];

function heatColor(t: number): string {
  // blue → purple → magenta → orange (muscle heat legend)
  const stops = [
    [40, 80, 220],
    [120, 40, 200],
    [220, 40, 140],
    [255, 90, 40],
    [255, 180, 40],
  ];
  const x = Math.max(0, Math.min(0.999, t)) * (stops.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = stops[i];
  const b = stops[i + 1] ?? stops[i];
  const r = Math.round(a[0] + (b[0] - a[0]) * f);
  const g = Math.round(a[1] + (b[1] - a[1]) * f);
  const bl = Math.round(a[2] + (b[2] - a[2]) * f);
  return `rgb(${r},${g},${bl})`;
}

export default function PullUpCanvas({ frame }: { frame: LiveFrame }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(frame);
  frameRef.current = frame;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let running = true;

    const resize = (): void => {
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

    const drawBackground = (w: number, h: number, time: number): void => {
      // Soft outdoor backdrop (trees / sky) so overlays read like the reel
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#8eb8d4");
      sky.addColorStop(0.35, "#a8c5b0");
      sky.addColorStop(0.7, "#5a7a58");
      sky.addColorStop(1, "#2e3d2c");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Distant mountains
      ctx.fillStyle = "rgba(90, 110, 120, 0.45)";
      ctx.beginPath();
      ctx.moveTo(0, h * 0.42);
      ctx.quadraticCurveTo(w * 0.25, h * 0.28, w * 0.5, h * 0.4);
      ctx.quadraticCurveTo(w * 0.75, h * 0.3, w, h * 0.38);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.fill();

      // Tree silhouettes
      for (let i = 0; i < 14; i++) {
        const x = (i / 13) * w + Math.sin(i * 1.7) * 12;
        const base = h * 0.55 + (i % 3) * 8;
        const th = h * (0.22 + (i % 4) * 0.03);
        ctx.fillStyle = `rgba(20, 45, 28, ${0.55 + (i % 3) * 0.1})`;
        ctx.beginPath();
        ctx.moveTo(x, base - th);
        ctx.lineTo(x + 28 + (i % 5) * 4, base);
        ctx.lineTo(x - 28 - (i % 4) * 4, base);
        ctx.closePath();
        ctx.fill();
      }

      // Soft mist
      ctx.fillStyle = "rgba(200, 220, 230, 0.12)";
      ctx.fillRect(0, h * 0.35, w, h * 0.2);

      // Subtle film grain via time-shifted noise dots
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      for (let i = 0; i < 40; i++) {
        const gx = ((i * 97 + time * 30) % w);
        const gy = ((i * 53 + time * 17) % h);
        ctx.fillRect(gx, gy, 2, 2);
      }
    };

    const drawAthlete = (w: number, h: number, f: LiveFrame): void => {
      const j = f.joints;
      const px = (p: { x: number; y: number }) => ({ x: p.x * w, y: p.y * h });

      const ls = px(j.lShoulder);
      const rs = px(j.rShoulder);
      const lh = px(j.lHip);
      const rh = px(j.rHip);
      const nose = px(j.nose);
      const midShoulder = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
      const midHip = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };

      // Muscle heat aura (magenta → orange core like the reel)
      const heat = f.muscleHeat;
      const aura = ctx.createRadialGradient(
        midShoulder.x,
        (midShoulder.y + midHip.y) * 0.48,
        6,
        midShoulder.x,
        midHip.y,
        h * 0.3,
      );
      aura.addColorStop(0, `rgba(255, ${Math.round(90 + 80 * heat)}, 40, ${0.55 + heat * 0.35})`);
      aura.addColorStop(0.35, `rgba(220, 40, ${Math.round(100 + 40 * heat)}, ${0.4 + heat * 0.25})`);
      aura.addColorStop(0.7, `rgba(90, 50, 200, ${0.28 + heat * 0.2})`);
      aura.addColorStop(1, "rgba(40,60,200,0)");
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.ellipse(midShoulder.x, (midShoulder.y + midHip.y) / 2, w * 0.16, h * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();

      // Arms heat glow
      for (const [a, b] of [
        [j.lShoulder, j.lElbow],
        [j.lElbow, j.lWrist],
        [j.rShoulder, j.rElbow],
        [j.rElbow, j.rWrist],
      ] as Array<[{ x: number; y: number }, { x: number; y: number }]>) {
        const pa = px(a);
        const pb = px(b);
        ctx.strokeStyle = heatColor(0.55 + heat * 0.4);
        ctx.lineWidth = 22;
        ctx.lineCap = "round";
        ctx.globalAlpha = 0.22 + heat * 0.35;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
      ctx.restore();

      // Body fill under skeleton (dark athlete)
      ctx.fillStyle = "rgba(28, 24, 32, 0.92)";
      ctx.beginPath();
      ctx.moveTo(ls.x - 2, ls.y);
      ctx.lineTo(rs.x + 2, rs.y);
      ctx.lineTo(rh.x + 4, rh.y);
      ctx.lineTo(lh.x - 4, lh.y);
      ctx.closePath();
      ctx.fill();

      // Head
      const headR = Math.min(w, h) * 0.03;
      ctx.beginPath();
      ctx.arc(nose.x, nose.y - headR * 0.15, headR, 0, Math.PI * 2);
      ctx.fill();

      // Legs silhouette
      ctx.strokeStyle = "rgba(28, 24, 32, 0.92)";
      ctx.lineWidth = 15;
      ctx.lineCap = "round";
      for (const [a, b] of [
        [j.lHip, j.lKnee],
        [j.lKnee, j.lAnkle],
        [j.rHip, j.rKnee],
        [j.rKnee, j.rAnkle],
      ] as Array<[{ x: number; y: number }, { x: number; y: number }]>) {
        const pa = px(a);
        const pb = px(b);
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }

      // Pull-up bar
      const barY = f.barY * h;
      ctx.save();
      ctx.setLineDash([10, 8]);
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w * 0.22, barY);
      ctx.lineTo(w * 0.78, barY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = `600 ${Math.max(10, w * 0.028)}px system-ui, sans-serif`;
      ctx.fillText("BAR", w * 0.79, barY + 4);
      ctx.restore();

      // Skeleton bones
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      for (const [a, b] of BONES) {
        const pa = px(j[a]);
        const pb = px(j[b]);
        // Upper arm tint blue like screenshots
        if (
          (a === "lShoulder" && b === "lElbow") ||
          (a === "rShoulder" && b === "rElbow")
        ) {
          ctx.strokeStyle = "rgba(120, 190, 255, 0.95)";
        } else {
          ctx.strokeStyle = "rgba(255,255,255,0.95)";
        }
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }

      // Joints
      for (const id of Object.keys(j) as JointId[]) {
        const p = px(j[id]);
        ctx.beginPath();
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.arc(p.x, p.y, id.includes("Elbow") || id.includes("Shoulder") ? 4.5 : 3.5, 0, Math.PI * 2);
        ctx.fill();
        if (id.includes("Elbow")) {
          ctx.strokeStyle = "rgba(255,255,255,0.7)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    };

    const loop = (now: number): void => {
      if (!running) return;
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      const f = frameRef.current;
      drawBackground(w, h, now / 1000);
      drawAthlete(w, h, f);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="pullup-canvas" aria-hidden />;
}
