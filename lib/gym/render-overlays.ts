import { findFrameAt } from "@/lib/pullup/biomechanics";
import { drawEstimatedEffortHeatmap } from "@/lib/pullup/heatmap";
import { LM, SKELETON_BONES } from "@/lib/pullup/landmarks";
import type { SegmentationMaskData } from "@/lib/pullup/pose-service";
import { computeContainBox, landmarkToCanvas } from "@/lib/pullup/video-layout";
import type { LandmarkPoint, Phase } from "@/lib/pullup/types";
import { getExercise } from "./registry";
import type { GenericRep, GymAnalysisResult } from "./types";

export type GymDrawOpts = {
  width: number;
  height: number;
  t: number;
  heatmap: boolean;
  showHud: boolean;
  showGraph: boolean;
  showSummary: boolean;
  showBarPath?: boolean;
  selectedRepIndex?: number | null;
  segmentationMask?: SegmentationMaskData | null;
  mirrored?: boolean;
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: LandmarkPoint[],
  box: ReturnType<typeof computeContainBox>,
): void {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [a, b, kind] of SKELETON_BONES) {
    const A = landmarks[a];
    const B = landmarks[b];
    if (!A || !B || (A.visibility ?? 0) < 0.25 || (B.visibility ?? 0) < 0.25) continue;
    const pa = landmarkToCanvas(A.x, A.y, box);
    const pb = landmarkToCanvas(B.x, B.y, box);
    ctx.strokeStyle =
      kind === "arm"
        ? "rgba(110,200,255,0.95)"
        : kind === "torso"
          ? "rgba(255,255,255,0.92)"
          : "rgba(255,255,255,0.75)";
    ctx.lineWidth = kind === "arm" ? 3.2 : 2.4;
    ctx.shadowColor = kind === "arm" ? "rgba(80,180,255,0.8)" : "rgba(255,255,255,0.45)";
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  for (const idx of [
    LM.nose,
    LM.leftShoulder,
    LM.rightShoulder,
    LM.leftElbow,
    LM.rightElbow,
    LM.leftWrist,
    LM.rightWrist,
    LM.leftHip,
    LM.rightHip,
    LM.leftKnee,
    LM.rightKnee,
    LM.leftAnkle,
    LM.rightAnkle,
  ]) {
    const p = landmarks[idx];
    if (!p || (p.visibility ?? 0) < 0.25) continue;
    const c = landmarkToCanvas(p.x, p.y, box);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.arc(c.x, c.y, idx === LM.leftElbow || idx === LM.rightElbow ? 4.5 : 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function phaseToHeatmapPhase(phase: string, gauge: number): Phase {
  const p = phase.toUpperCase();
  if (p.includes("LOCKOUT") || p.includes("TOP") || p.includes("PEAK") || p.includes("PAUSE") || p.includes("BOTTOM")) {
    return gauge > 0.75 ? "TOP" : "PULL";
  }
  if (p.includes("PRESS") || p.includes("PULL") || p.includes("ASCENT") || p.includes("FLEXION")) return "PULL";
  if (p.includes("LOWER") || p.includes("DESCENT") || p.includes("RETURN")) return "LOWER";
  if (p.includes("HANG") || p.includes("FLOOR") || p.includes("STAND") || p.includes("EXTENDED")) return "DEAD HANG";
  return gauge > 0.55 ? "PULL" : "REST";
}

function phaseBadgeColor(phase: string): string {
  const p = phase.toUpperCase();
  if (p.includes("PRESS") || p.includes("PULL") || p.includes("ASCENT") || p.includes("FLEXION")) return "#1f9d55";
  if (p.includes("LOWER") || p.includes("DESCENT") || p.includes("RETURN")) return "#2f6fed";
  if (p.includes("PAUSE") || p.includes("BOTTOM") || p.includes("PEAK") || p.includes("TOP") || p.includes("LOCKOUT"))
    return "#f59e0b";
  if (p.includes("NO") || p.includes("UNCERTAIN")) return "#6b7280";
  return "#9ca3af";
}

function repsCompletedAt(reps: GenericRep[], t: number): number {
  return reps.filter((r) => r.endT <= t + 0.05).length;
}

function drawReferenceLine(
  ctx: CanvasRenderingContext2D,
  box: ReturnType<typeof computeContainBox>,
  y: number,
  label: string,
): void {
  const yy = box.offsetY + y * box.drawH;
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(box.offsetX + box.drawW * 0.08, yy);
  ctx.lineTo(box.offsetX + box.drawW * 0.82, yy);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `600 ${Math.max(11, box.drawW * 0.035)}px system-ui,sans-serif`;
  ctx.fillText(label, box.offsetX + box.drawW * 0.84, yy + 4);
  ctx.restore();
}

function drawEquipmentPath(
  ctx: CanvasRenderingContext2D,
  analysis: GymAnalysisResult,
  t: number,
  box: ReturnType<typeof computeContainBox>,
  selectedRep: number | null | undefined,
): void {
  const path = analysis.equipmentPath;
  if (path.length < 2) return;
  const activeRep =
    selectedRep != null
      ? analysis.reps.find((r) => r.index === selectedRep)
      : analysis.reps.find((r) => t >= r.startT && t <= r.endT + 0.15);

  const window = activeRep
    ? path.filter((p) => p.t >= activeRep.startT && p.t <= activeRep.endT)
    : path.filter((p) => p.t <= t + 0.02);

  if (window.length < 2) return;

  ctx.save();
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 1; i < window.length; i++) {
    const a = window[i - 1];
    const b = window[i];
    const phase = analysis.phaseAt(b.t);
    const p = phase.toUpperCase();
    if (p.includes("PAUSE") || p.includes("BOTTOM") || p.includes("PEAK")) ctx.strokeStyle = "#f59e0b";
    else if (p.includes("PRESS") || p.includes("PULL") || p.includes("ASCENT") || p.includes("LOCKOUT"))
      ctx.strokeStyle = "#22c55e";
    else if (p.includes("LOWER") || p.includes("DESCENT") || p.includes("RETURN")) ctx.strokeStyle = "#3b82f6";
    else ctx.strokeStyle = "rgba(255,255,255,0.55)";
    const pa = landmarkToCanvas(a.x, a.y, box);
    const pb = landmarkToCanvas(b.x, b.y, box);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }
  const last = window[window.length - 1];
  const c = landmarkToCanvas(last.x, last.y, box);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHud(
  ctx: CanvasRenderingContext2D,
  analysis: GymAnalysisResult,
  t: number,
  phase: string,
  gauge: number,
  elbow: number | null,
  speedLabel: string,
  w: number,
  h: number,
): void {
  const def = getExercise(analysis.exerciseId);
  const pad = Math.max(12, w * 0.03);
  const cardW = Math.min(190, w * 0.44);
  const repsDone = repsCompletedAt(analysis.reps, t);
  const load =
    analysis.calibration.externalLoadKg != null
      ? ` · ${analysis.calibration.externalLoadKg} KG`
      : "";

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  roundRect(ctx, pad, pad + 8, cardW * 0.58, 70, 10);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `800 ${Math.max(32, w * 0.1)}px system-ui,sans-serif`;
  ctx.fillText(String(repsDone), pad + 12, pad + 52);
  ctx.font = `700 ${Math.max(10, w * 0.028)}px system-ui,sans-serif`;
  ctx.fillText("REPS", pad + 12, pad + 68);

  const pw = Math.max(96, phase.length * 9.5);
  ctx.fillStyle = phaseBadgeColor(phase);
  roundRect(ctx, pad, pad + 86, pw, 30, 8);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `800 ${Math.max(11, w * 0.028)}px system-ui,sans-serif`;
  ctx.fillText(phase, pad + 10, pad + 106);

  const metricsY = pad + 128;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  roundRect(ctx, pad, metricsY, cardW, 92, 10);
  ctx.fill();
  ctx.font = `600 ${Math.max(10, w * 0.025)}px system-ui,sans-serif`;
  const fatigue = analysis.velocityLossPct;
  const lines: Array<[string, string]> = [
    ["ELBOW", elbow != null ? `${Math.round(elbow)}°` : "—"],
    ["SPEED", speedLabel],
    ["VEL. LOSS", fatigue != null ? `${fatigue} %` : "—"],
  ];
  lines.forEach(([k, v], i) => {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(k, pad + 10, metricsY + 24 + i * 26);
    ctx.fillStyle = k === "VEL. LOSS" && fatigue != null && fatigue >= 20 ? "#ffe566" : "#fff";
    ctx.fillText(v, pad + cardW - 10 - ctx.measureText(v).width, metricsY + 24 + i * 26);
  });

  const gx = w - pad - 18;
  const gy = pad + 40;
  const gh = h * 0.28;
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  roundRect(ctx, gx, gy, 10, gh, 6);
  ctx.fill();
  const fillH = Math.max(0, Math.min(1, gauge)) * gh;
  ctx.fillStyle = gauge > 0.85 ? "#22c55e" : gauge > 0.55 ? "#3b82f6" : "#60a5fa";
  roundRect(ctx, gx, gy + gh - fillH, 10, fillH, 6);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(gx + 5, gy + gh - fillH, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(gx - 6, gy + gh / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.font = `700 ${Math.max(9, w * 0.022)}px system-ui,sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.textAlign = "center";
  ctx.fillText(def?.gaugeLabel ?? "SIGNAL", 0, 0);
  ctx.restore();

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = `700 ${Math.max(10, w * 0.024)}px system-ui,sans-serif`;
  ctx.textAlign = "right";
  ctx.fillText(`${analysis.exerciseName.toUpperCase()}${load}`, w - pad, pad + 18);
  ctx.textAlign = "left";
}

function drawGraph(
  ctx: CanvasRenderingContext2D,
  analysis: GymAnalysisResult,
  t: number,
  w: number,
  h: number,
): void {
  const def = getExercise(analysis.exerciseId);
  const graphH = Math.min(150, h * 0.24);
  const x0 = 12;
  const y0 = h - graphH - 12;
  const gw = w - 24;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  roundRect(ctx, x0, y0, gw, graphH, 10);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.font = `800 ${Math.max(9, w * 0.022)}px system-ui,sans-serif`;
  ctx.fillText(def?.graphTitle ?? "MOVEMENT", x0 + 10, y0 + 16);
  ctx.font = `500 ${Math.max(8, w * 0.018)}px system-ui,sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillText(def?.graphSubtitle ?? "", x0 + 10, y0 + 30);

  const plotX = x0 + 28;
  const plotY = y0 + 38;
  const plotW = gw - 40;
  const plotH = graphH - 70;
  const duration = Math.max(0.01, analysis.duration);

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  for (const frac of [0, 0.5, 1]) {
    const y = plotY + (1 - frac) * plotH;
    ctx.beginPath();
    ctx.moveTo(plotX, y);
    ctx.lineTo(plotX + plotW, y);
    ctx.stroke();
  }

  const series = analysis.signal;
  if (series.length > 1) {
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    series.forEach((s, i) => {
      const x = plotX + (s.t / duration) * plotW;
      const y = plotY + (1 - Math.max(0, Math.min(1.15, s.v))) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  for (const rep of analysis.reps) {
    const x = plotX + (rep.peakT / duration) * plotW;
    const y = plotY + (1 - rep.peakNorm) * plotH;
    ctx.fillStyle =
      rep.grade === "valid" ? "#22c55e" : rep.grade === "partial" ? "#f59e0b" : "#ef4444";
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffb020";
    ctx.font = "700 9px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(rep.index), x, y - 6);
    ctx.textAlign = "left";
  }

  const px = plotX + (Math.min(t, duration) / duration) * plotW;
  ctx.strokeStyle = "rgba(46,196,182,0.95)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, plotY);
  ctx.lineTo(px, plotY + plotH);
  ctx.stroke();

  const cellW = Math.min(28, (plotW - 4) / Math.max(analysis.reps.length || 1, 1));
  analysis.reps.forEach((rep, i) => {
    const cx = plotX + i * (cellW + 3);
    const cy = y0 + graphH - 24;
    ctx.fillStyle =
      rep.grade === "valid" ? "#1f9d55" : rep.grade === "partial" ? "#ff9f1c" : "#ef4444";
    roundRect(ctx, cx, cy, cellW, 16, 4);
    ctx.fill();
    ctx.fillStyle = rep.grade === "partial" ? "#111" : "#fff";
    ctx.font = "800 10px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(rep.grade === "valid" ? "✓" : rep.grade === "partial" ? "~" : "✕", cx + cellW / 2, cy + 12);
  });
  ctx.textAlign = "left";
}

function drawSummaryCard(
  ctx: CanvasRenderingContext2D,
  analysis: GymAnalysisResult,
  w: number,
  h: number,
): void {
  const cardW = Math.min(340, w - 28);
  const x = (w - cardW) / 2;
  const y = Math.max(40, h * 0.08);
  ctx.fillStyle = "rgba(12,12,16,0.88)";
  roundRect(ctx, x, y, cardW, Math.min(320, h * 0.55), 14);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "800 22px system-ui,sans-serif";
  ctx.fillText("SET SUMMARY", x + 18, y + 36);
  ctx.font = "500 12px system-ui,sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText(analysis.exerciseName, x + 18, y + 56);
  ctx.fillStyle = "#fff";
  ctx.font = "850 40px system-ui,sans-serif";
  ctx.fillText(String(analysis.reps.length), x + 18, y + 110);
  ctx.fillStyle = "#2ec4b6";
  ctx.fillText(String(analysis.avgQuality), x + cardW / 2, y + 110);
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "600 11px system-ui,sans-serif";
  ctx.fillText("total reps", x + 18, y + 128);
  ctx.fillText("avg quality / 100", x + cardW / 2, y + 128);
  const valid = analysis.reps.filter((r) => r.grade === "valid").length;
  const partial = analysis.reps.filter((r) => r.grade === "partial").length;
  const failed = analysis.reps.filter((r) => r.grade === "failed").length;
  ctx.fillStyle = "#fff";
  ctx.font = "600 12px system-ui,sans-serif";
  ctx.fillText(`valid · partial · failed   ${valid} · ${partial} · ${failed}`, x + 18, y + 160);
  if (analysis.velocityLossPct != null) {
    ctx.fillText(`velocity loss   ${analysis.velocityLossPct}%`, x + 18, y + 182);
  }
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "500 11px system-ui,sans-serif";
  const note = analysis.coachingNotes[0] ?? "";
  wrapText(ctx, note, x + 18, y + 210, cardW - 36, 14);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
): void {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

function speedAt(analysis: GymAnalysisResult, t: number): { norm: number; ms: number | null } {
  const sig = analysis.signal;
  if (sig.length < 2) return { norm: 0, ms: null };
  let best = 0;
  for (let i = 1; i < sig.length; i++) {
    if (Math.abs(sig[i].t - t) < Math.abs(sig[best].t - t)) best = i;
  }
  const i = Math.max(1, best);
  const dt = Math.max(1e-3, sig[i].t - sig[i - 1].t);
  const norm = (sig[i].v - sig[i - 1].v) / dt;
  const scale =
    analysis.calibration.metersPerImageHeight ??
    (analysis.calibration.heightCm != null ? (analysis.calibration.heightCm * 0.0025) : null);
  return { norm, ms: scale != null ? norm * scale : null };
}

/** Draw one composited gym analysis frame. */
export function drawGymAnalysisFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  analysis: GymAnalysisResult,
  opts: GymDrawOpts,
): void {
  const { width: w, height: h, t } = opts;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, w, h);

  const box = computeContainBox(
    w,
    h,
    video.videoWidth || analysis.videoWidth,
    video.videoHeight || analysis.videoHeight,
  );

  ctx.save();
  if (opts.mirrored) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, box.offsetX, box.offsetY, box.drawW, box.drawH);

  const frame = findFrameAt(analysis.frames, t);
  const gauge = analysis.gaugeAt(t);
  const phase = frame?.landmarks ? analysis.phaseAt(t) : "NO POSE";
  const heatPhase = phaseToHeatmapPhase(phase, gauge);

  if (analysis.exerciseId === "pull_up" && analysis.calibration.referenceY != null) {
    drawReferenceLine(ctx, box, analysis.calibration.referenceY, "BAR");
  } else if (
    (analysis.exerciseId === "squat" || analysis.exerciseId === "deadlift") &&
    analysis.calibration.referenceY != null
  ) {
    drawReferenceLine(ctx, box, analysis.calibration.referenceY, "REF");
  }

  if (opts.showBarPath !== false && analysis.equipmentPath.length > 1) {
    drawEquipmentPath(ctx, analysis, t, box, opts.selectedRepIndex);
  }

  if (frame?.landmarks) {
    if (opts.heatmap) {
      drawEstimatedEffortHeatmap(
        ctx,
        box,
        heatPhase,
        gauge,
        frame.landmarks,
        opts.segmentationMask ?? null,
      );
    }
    drawSkeleton(ctx, frame.landmarks, box);
  }
  ctx.restore();

  if (!frame?.landmarks && opts.showHud) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    roundRect(ctx, 16, h * 0.4, Math.min(280, w - 32), 40, 8);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "600 13px system-ui,sans-serif";
    ctx.fillText("No pose detected in this frame", 28, h * 0.4 + 26);
  }

  if (opts.showHud && !opts.showSummary) {
    const elbow =
      frame?.elbowL != null && frame?.elbowR != null
        ? (frame.elbowL + frame.elbowR) / 2
        : (frame?.elbowL ?? frame?.elbowR ?? null);
    const sp = speedAt(analysis, t);
    const speedLabel =
      sp.ms != null ? `${Math.abs(sp.ms).toFixed(2)} m/s` : `${Math.abs(sp.norm).toFixed(2)} rel/s`;
    drawHud(ctx, analysis, t, phase, gauge, elbow, speedLabel, w, h);
  }

  if (opts.showGraph && !opts.showSummary) {
    drawGraph(ctx, analysis, t, w, h);
  }

  if (opts.heatmap && !opts.showSummary) {
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = `700 ${Math.max(8, w * 0.02)}px system-ui,sans-serif`;
    ctx.fillText("EST. EFFORT", w - 92, h * 0.36);
    const lg = ctx.createLinearGradient(w - 88, 0, w - 20, 0);
    lg.addColorStop(0, "#2850dc");
    lg.addColorStop(0.35, "#7828c8");
    lg.addColorStop(0.65, "#dc2878");
    lg.addColorStop(1, "#ffb428");
    ctx.fillStyle = lg;
    roundRect(ctx, w - 88, h * 0.36 + 6, 68, 8, 4);
    ctx.fill();
  }

  if (opts.showSummary) {
    drawSummaryCard(ctx, analysis, w, h);
  }
}
