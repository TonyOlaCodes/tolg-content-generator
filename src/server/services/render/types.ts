/**
 * Rendering abstraction — swappable backends.
 * Vercel hosts the app; workers run elsewhere (local, Railway, Render, Fly.io).
 */

export type RenderBackend = "local" | "railway" | "render" | "fly";

export type ReelRenderRequest = {
  jobId: string;
  draftId: string;
  imageUrls: string[];
  hookText: string;
  themeDurationSec: number;
  physiqueDurationSec: number;
  cutPercent: number;
  fadePercent: number;
  fadeDurationSec: number;
  musicUrl: string;
  musicVolume: number;
  width: number;
  height: number;
  frameRate: number;
};

export type ReelRenderResult = {
  outputUrl: string;
  durationSec: number;
};

export interface RenderWorkerClient {
  enqueue(request: ReelRenderRequest): Promise<{ accepted: boolean }>;
  getStatus(jobId: string): Promise<{
    status: "queued" | "processing" | "completed" | "failed" | "cancelled";
    outputUrl?: string;
    errorMessage?: string;
  }>;
  cancel?(jobId: string): Promise<boolean>;
}
