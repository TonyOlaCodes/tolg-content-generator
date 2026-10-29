import { findFrameAt, heightNorm, estimatePhase, verticalSpeed } from "./biomechanics";
import { drawEstimatedEffortHeatmap } from "./heatmap";
import { LM, SKELETON_BONES } from "./landmarks";
import type { SegmentationMaskData } from "./pose-service";
import { computeContainBox, landmarkToCanvas } from "./video-layout";
import type { AnalysisResult, LandmarkPoint, Phase, RepRecord } from "./types";

export type DrawOpts = {
  width: number;
  height: number;
  t: number;
  heatmap: boolean;
  showHud: boolean;
  showGraph: boolean;
  showSummary: boolean;
  selectedRepIndex?: number | null;
  segmentationMask?: SegmentationMaskData | null;
  mirrored?: boolean;
};

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

function drawBar(
  ctx: CanvasRenderingContext2D,
  box: ReturnType<typeof computeContainBox>,
  barY: number,
): void {
  const y = box.offsetY + barY * box.drawH;
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(box.offsetX + box.drawW * 0.08, y);
  ctx.lineTo(box.offsetX + box.drawW * 0.82, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `600 ${Math.max(11, box.drawW * 0.035)}px system-ui,sans-serif`;
  ctx.fillText("BAR", box.offsetX + box.drawW * 0.84, y + 4);
  ctx.restore();
}

function phaseColor(phase: Phase): string {
  if (phase === "PULL") return "#1f9d55";
  if (phase === "LOWER") return "#2f6fed";
  if (phase === "TOP") return "#f59e0b";
  if (phase === "NO POSE") return "#6b7280";
  return "#9ca3af";
}

function repsCompletedAt(reps: RepRecord[], t: number): number {
  return reps.filter((r) => r.endT <= t + 0.05).length;
}

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

function drawHud(
  ctx: CanvasRenderingContext2D,
  analysis: AnalysisResult,
  t: number,
  phase: Phase,
  height: number,
  elbow: number | null,
  speedLabel: string,
  fatigue: number | null,
  w: number,
  h: number,
): void {
  const repsDone = repsCompletedAt(analysis.reps, t);
  const pad = Math.max(12, w * 0.03);
  const cardW = Math.min(190, w * 0.44);

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  roundRect(ctx, pad, pad + 8, cardW * 0.58, 70, 10);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `800 ${Math.max(32, w * 0.1)}px system-ui,sans-serif`;
  ctx.fillText(String(repsDone), pad + 12, pad + 52);
  ctx.font = `700 ${Math.max(10, w * 0.028)}px system-ui,sans-serif`;
  ctx.fillText("REPS", pad + 12, pad + 68);

  const ph = phase;
  ctx.fillStyle = phaseColor(phase);
  const pw = Math.max(96, ph.length * 9.5);
  roundRect(ctx, pad, pad + 86, pw, 30, 8);
  ctx.fill();
  ctx.fillStyle =
    phase === "PULL" || phase === "LOWER" || phase === "TOP" || phase === "NO POSE" ? "#fff" : "#111";
  ctx.font = `800 ${Math.max(11, w * 0.028)}px system-ui,sans-serif`;
  ctx.fillText(ph, pad + 10, pad + 106);

  const metricsY = pad + 128;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  roundRect(ctx, pad, metricsY, cardW, 92, 10);
  ctx.fill();
  ctx.font = `600 ${Math.max(10, w * 0.025)}px system-ui,sans-serif`;
  const lines = [
    ["ELBOW", elbow != null ? `${Math.round(elbow)}°` : "—"],
    ["SPEED", speedLabel],
    ["FATIGUE (speed loss)", fatigue != null ? `${fatigue} %` : "—"],
  ];
  lines.forEach(([k, v], i) => {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(k, pad + 10, metricsY + 24 + i * 26);
    ctx.fillStyle = k.startsWith("FATIGUE") && fatigue != null && fatigue >= 20 ? "#ffe566" : "#fff";
    ctx.fillText(v, pad + cardW - 10 - ctx.measureText(v).width, metricsY + 24 + i * 26);
  });

  const gx = w - pad - 18;
  const gy = pad + 40;
  const gh = h * 0.28;
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  roundRect(ctx, gx, gy, 10, gh, 6);
  ctx.fill();
  const fillH = Math.max(0, Math.min(1, height)) * gh;
  ctx.fillStyle = height > 0.85 ? "#22c55e" : height > 0.55 ? "#3b82f6" : "#60a5fa";
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
  ctx.fillText("CHIN @ BAR", 0, 0);
  ctx.restore();
}

function drawGraph(
  ctx: CanvasRenderingContext2D,
  analysis: AnalysisResult,
  t: number,
  w: number,
  h: number,
): void {
  const graphH = Math.min(150, h * 0.24);
  const x0 = 12;
  const y0 = h - graphH - 12;
  const gw = w - 24;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  roundRect(ctx, x0, y0, gw, graphH, 10);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.font = `800 ${Math.max(9, w * 0.022)}px system-ui,sans-serif`;
  ctx.fillText("SHOULDER HEIGHT", x0 + 10, y0 + 16);
  ctx.font = `500 ${Math.max(8, w * 0.018)}px system-ui,sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillText("0% = dead hang · 100% = best rep", x0 + 10, y0 + 30);

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

  const chinY = plotY + (1 - 0.92) * plotH;
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.moveTo(plotX, chinY);
  ctx.lineTo(plotX + plotW, chinY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "500 8px system-ui,sans-serif";
  ctx.fillText("chin at bar", plotX + plotW - 52, chinY - 4);

  const series = analysis.frames.filter((f) => f.shoulderY != null);
  if (series.length > 1) {
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    series.forEach((f, i) => {
      const hn = heightNorm(f.shoulderY, analysis.hangShoulderY, analysis.bestTopShoulderY);
      const x = plotX + (f.t / duration) * plotW;
      const y = plotY + (1 - hn) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  for (const rep of analysis.reps) {
    const x = plotX + (rep.peakT / duration) * plotW;
    const y = plotY + (1 - rep.peakHeightNorm) * plotH;
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
  analysis: AnalysisResult,
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
  ctx.fillText("Pull Up Analysis", x + 18, y + 56);
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

/**
 * Draw one composited analysis frame (video + overlays) onto a canvas context.
 * Used by live preview and export.
 */
export function drawAnalysisFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  analysis: AnalysisResult,
  opts: DrawOpts,
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
  const height = heightNorm(
    frame?.shoulderY ?? null,
    analysis.hangShoulderY,
    analysis.bestTopShoulderY,
  );

  let speedNorm = 0;
  let speedMs: number | null = null;
  if (frame) {
    const idx = analysis.frames.indexOf(frame);
    if (idx > 0) {
      const sp = verticalSpeed(
        analysis.frames,
        idx,
        analysis.hangShoulderY,
        analysis.bestTopShoulderY,
        analysis.calibration,
      );
      speedNorm = sp.normPerSec;
      speedMs = sp.metersPerSec;
    }
  }

  const phase = estimatePhase(height, speedNorm, Boolean(frame?.landmarks), height > 0.8);

  drawBar(ctx, box, analysis.calibration.barY);

  if (frame?.landmarks) {
    if (opts.heatmap) {
      drawEstimatedEffortHeatmap(
        ctx,
        box,
        phase,
        height,
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
    const speedLabel =
      speedMs != null
        ? `${Math.abs(speedMs).toFixed(2)} m/s`
        : `${Math.abs(speedNorm).toFixed(2)} rel/s`;
    drawHud(ctx, analysis, t, phase, height, elbow, speedLabel, analysis.velocityLossPct, w, h);
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
