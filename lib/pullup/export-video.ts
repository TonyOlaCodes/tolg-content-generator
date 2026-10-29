"use client";

import type { AnalysisResult } from "./types";
import { drawAnalysisFrame } from "./render-overlays";

export type ExportOptions = {
  includeAudio: boolean;
  /** Target output: 'contain' keeps source AR letterboxed into 9:16. */
  aspect: "source" | "9:16";
  heatmap: boolean;
  onProgress?: (pct: number, message: string) => void;
};

export type ExportResult = {
  blob: Blob;
  mimeType: string;
  extension: string;
  warning?: string;
};

function pickRecorderMime(): { mimeType: string; extension: string; warning?: string } {
  const candidates: Array<{ mimeType: string; extension: string }> = [
    { mimeType: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", extension: "mp4" },
    { mimeType: "video/mp4", extension: "mp4" },
    { mimeType: "video/webm;codecs=vp9,opus", extension: "webm" },
    { mimeType: "video/webm;codecs=vp8,opus", extension: "webm" },
    { mimeType: "video/webm", extension: "webm" },
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c.mimeType)) {
      return {
        ...c,
        warning:
          c.extension === "webm"
            ? "This browser encoded WebM. Instagram/TikTok may require converting to MP4."
            : undefined,
      };
    }
  }
  return {
    mimeType: "",
    extension: "webm",
    warning: "No MediaRecorder MIME type is supported in this browser.",
  };
}

/**
 * Re-render the analysed video with overlays burned in via canvas + MediaRecorder.
 */
export async function exportAnalysedVideo(
  video: HTMLVideoElement,
  analysis: AnalysisResult,
  options: ExportOptions,
): Promise<ExportResult> {
  const pick = pickRecorderMime();
  if (!pick.mimeType) {
    throw new Error(pick.warning || "Video export is not supported in this browser.");
  }

  const srcW = video.videoWidth || analysis.videoWidth;
  const srcH = video.videoHeight || analysis.videoHeight;

  let outW = srcW;
  let outH = srcH;
  if (options.aspect === "9:16") {
    outH = Math.max(srcH, 1280);
    outW = Math.round((outH * 9) / 16);
  }
  // Cap resolution for performance
  const maxSide = 1280;
  if (Math.max(outW, outH) > maxSide) {
    const s = maxSide / Math.max(outW, outH);
    outW = Math.round(outW * s);
    outH = Math.round(outH * s);
  }

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas for export.");

  const fps = 30;
  const stream = canvas.captureStream(fps);
  let audioTracksAdded = false;
  if (options.includeAudio) {
    try {
      const anyVideo = video as HTMLVideoElement & {
        captureStream?: () => MediaStream;
        mozCaptureStream?: () => MediaStream;
      };
      const vStream = anyVideo.captureStream?.() ?? anyVideo.mozCaptureStream?.();
      const track = vStream?.getAudioTracks?.()[0];
      if (track) {
        stream.addTrack(track);
        audioTracksAdded = true;
      }
    } catch {
      /* audio optional */
    }
  }

  const recorder = new MediaRecorder(stream, {
    mimeType: pick.mimeType,
    videoBitsPerSecond: 6_000_000,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("MediaRecorder failed."));
    recorder.onstop = () => resolve(new Blob(chunks, { type: pick.mimeType }));
  });

  video.pause();
  video.currentTime = 0;
  await new Promise<void>((res, rej) => {
    const t = window.setTimeout(() => rej(new Error("Seek timeout")), 10000);
    video.addEventListener(
      "seeked",
      () => {
        window.clearTimeout(t);
        res();
      },
      { once: true },
    );
  });

  recorder.start(250);
  options.onProgress?.(0.02, "Recording…");

  const duration = analysis.duration;
  let stopped = false;

  await new Promise<void>((resolve, reject) => {
    const onEnded = (): void => {
      if (stopped) return;
      stopped = true;
      video.removeEventListener("ended", onEnded);
      window.setTimeout(() => {
        try {
          recorder.stop();
        } catch {
          /* ignore */
        }
        resolve();
      }, 200);
    };
    video.addEventListener("ended", onEnded);

    const draw = (): void => {
      if (stopped) return;
      drawAnalysisFrame(ctx, video, analysis, {
        width: outW,
        height: outH,
        t: video.currentTime,
        heatmap: options.heatmap,
        showHud: true,
        showGraph: true,
        showSummary: false,
      });
      const pct = duration > 0 ? video.currentTime / duration : 0;
      options.onProgress?.(Math.min(0.95, pct), "Recording analysed video…");
      if (!video.paused && !video.ended) {
        requestAnimationFrame(draw);
      }
    };

    video.playbackRate = 1;
    const playPromise = video.play();
    requestAnimationFrame(draw);
    Promise.resolve(playPromise).catch((err) => {
      stopped = true;
      reject(err);
    });
  });

  const blob = await done;
  options.onProgress?.(1, "Export complete");

  return {
    blob,
    mimeType: pick.mimeType,
    extension: pick.extension,
    warning: !audioTracksAdded && options.includeAudio
      ? `${pick.warning ? pick.warning + " " : ""}Audio could not be captured in this browser.`
      : pick.warning,
  };
}
