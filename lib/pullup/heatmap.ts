import type { SegmentationMaskData } from "./pose-service";
import type { LandmarkPoint, Phase } from "./types";
import { LM, SKELETON_BONES } from "./landmarks";
import { landmarkToCanvas, type VideoBox } from "./video-layout";

export function effortRgb(phase: Phase, height: number): [number, number, number] {
  // purple → blue → pink → red → orange
  if (phase === "TOP" || height > 0.88) return [255, 150, 40];
  if (phase === "PULL" && height > 0.55) return [230, 55, 70];
  if (phase === "PULL") return [210, 50, 140];
  if (phase === "LOWER") return [120, 55, 200];
  if (phase === "DEAD HANG" || phase === "HANDS ON BAR" || phase === "REST") return [55, 70, 210];
  return [90, 50, 190];
}

/**
 * Draw MediaPipe person segmentation as a coloured estimated-effort glow.
 * Falls back to pose-hull glow when mask is unavailable.
 */
export function drawEstimatedEffortHeatmap(
  ctx: CanvasRenderingContext2D,
  box: VideoBox,
  phase: Phase,
  height: number,
  landmarks: LandmarkPoint[] | null,
  mask: SegmentationMaskData | null,
): void {
  const [r, g, b] = effortRgb(phase, height);
  if (mask && mask.values.length) {
    drawMaskHeatmap(ctx, box, mask, r, g, b, height);
    return;
  }
  if (landmarks) drawPoseHullHeatmap(ctx, box, landmarks, phase, height, r, g, b);
}

function drawMaskHeatmap(
  ctx: CanvasRenderingContext2D,
  box: VideoBox,
  mask: SegmentationMaskData,
  r: number,
  g: number,
  b: number,
  height: number,
): void {
  const tmp = document.createElement("canvas");
  tmp.width = mask.width;
  tmp.height = mask.height;
  const tctx = tmp.getContext("2d");
  if (!tctx) return;
  const img = tctx.createImageData(mask.width, mask.height);
  const data = img.data;
  const strength = 0.35 + height * 0.45;
  for (let i = 0; i < mask.values.length; i++) {
    const v = mask.values[i];
    if (v < 0.2) continue;
    const a = Math.min(220, Math.floor(v * strength * 255));
    const o = i * 4;
    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
    data[o + 3] = a;
  }
  tctx.putImageData(img, 0, 0);

  ctx.save();
  ctx.filter = "blur(10px)";
  ctx.globalCompositeOperation = "screen";
  ctx.drawImage(tmp, box.offsetX, box.offsetY, box.drawW, box.drawH);
  ctx.filter = "blur(22px)";
  ctx.globalAlpha = 0.55;
  ctx.drawImage(tmp, box.offsetX, box.offsetY, box.drawW, box.drawH);
  ctx.restore();
}

function drawPoseHullHeatmap(
  ctx: CanvasRenderingContext2D,
  box: VideoBox,
  landmarks: LandmarkPoint[],
  phase: Phase,
  height: number,
  r: number,
  g: number,
  b: number,
): void {
  const ls = landmarks[LM.leftShoulder];
  const rs = landmarks[LM.rightShoulder];
  const lh = landmarks[LM.leftHip];
  const rh = landmarks[LM.rightHip];
  if (!ls || !rs || !lh || !rh) return;

  const midS = landmarkToCanvas((ls.x + rs.x) / 2, (ls.y + rs.y) / 2, box);
  const midH = landmarkToCanvas((lh.x + rh.x) / 2, (lh.y + rh.y) / 2, box);

  ctx.save();
  ctx.filter = "blur(20px)";
  ctx.globalAlpha = 0.75;
  const grad = ctx.createRadialGradient(
    midS.x,
    midS.y,
    6,
    midS.x,
    (midS.y + midH.y) / 2,
    box.drawH * 0.3,
  );
  grad.addColorStop(0, `rgba(${r},${g},${b},0.85)`);
  grad.addColorStop(0.45, `rgba(${r},${g},${b},0.45)`);
  grad.addColorStop(1, "rgba(40,60,200,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(midS.x, (midS.y + midH.y) / 2, box.drawW * 0.17, box.drawH * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();

  for (const [a, bIdx, kind] of SKELETON_BONES) {
    if (kind !== "arm" && kind !== "torso") continue;
    const A = landmarks[a];
    const B = landmarks[bIdx];
    if (!A || !B || (A.visibility ?? 0) < 0.3 || (B.visibility ?? 0) < 0.3) continue;
    const pa = landmarkToCanvas(A.x, A.y, box);
    const pb = landmarkToCanvas(B.x, B.y, box);
    const [ar, ag, ab] = effortRgb(phase, Math.min(1, height + (kind === "arm" ? 0.12 : 0)));
    ctx.strokeStyle = `rgba(${ar},${ag},${ab},0.55)`;
    ctx.lineWidth = kind === "arm" ? 24 : 30;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }
  ctx.restore();
}
