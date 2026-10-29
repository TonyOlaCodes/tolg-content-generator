/** Map MediaPipe normalized coords ↔ displayed video with object-fit: contain. */

export type VideoBox = {
  /** Offset of the video content inside the element (CSS pixels). */
  offsetX: number;
  offsetY: number;
  /** Drawn video width/height inside the element. */
  drawW: number;
  drawH: number;
  elW: number;
  elH: number;
  videoW: number;
  videoH: number;
};

export function computeContainBox(
  elW: number,
  elH: number,
  videoW: number,
  videoH: number,
): VideoBox {
  if (elW <= 0 || elH <= 0 || videoW <= 0 || videoH <= 0) {
    return { offsetX: 0, offsetY: 0, drawW: elW, drawH: elH, elW, elH, videoW, videoH };
  }
  const scale = Math.min(elW / videoW, elH / videoH);
  const drawW = videoW * scale;
  const drawH = videoH * scale;
  const offsetX = (elW - drawW) / 2;
  const offsetY = (elH - drawH) / 2;
  return { offsetX, offsetY, drawW, drawH, elW, elH, videoW, videoH };
}

/** Landmark (0–1 in video image space) → canvas pixel in the element. */
export function landmarkToCanvas(
  x: number,
  y: number,
  box: VideoBox,
): { x: number; y: number } {
  return {
    x: box.offsetX + x * box.drawW,
    y: box.offsetY + y * box.drawH,
  };
}

/** Element pixel → video-normalized 0–1 (clamped). */
export function canvasToLandmark(
  px: number,
  py: number,
  box: VideoBox,
): { x: number; y: number } {
  const x = (px - box.offsetX) / Math.max(1e-6, box.drawW);
  const y = (py - box.offsetY) / Math.max(1e-6, box.drawH);
  return {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
  };
}
