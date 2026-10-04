export type MicPermission = "granted" | "denied" | "prompt" | "unsupported";

export async function getMicPermissionState(): Promise<MicPermission> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return "unsupported";
  }
  try {
    const status = await navigator.permissions?.query({ name: "microphone" as PermissionName });
    if (status?.state === "granted" || status?.state === "denied" || status?.state === "prompt") {
      return status.state;
    }
  } catch {
    // permissions query not supported — fall through
  }
  return "prompt";
}

export async function requestMicrophone(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone API unavailable in this browser.");
  }
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
}

/** Records microphone only — beat stays on a separate element and is not mixed in. */
export class MicRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private stream: MediaStream | null = null;
  private startedAt = 0;

  async start(): Promise<void> {
    this.stream = await requestMicrophone();
    this.chunks = [];
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : undefined;
    this.mediaRecorder = mime
      ? new MediaRecorder(this.stream, { mimeType: mime })
      : new MediaRecorder(this.stream);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size) this.chunks.push(e.data);
    };
    this.mediaRecorder.start(250);
    this.startedAt = Date.now();
  }

  pause(): void {
    if (this.mediaRecorder?.state === "recording") this.mediaRecorder.pause();
  }

  resume(): void {
    if (this.mediaRecorder?.state === "paused") this.mediaRecorder.resume();
  }

  async stop(): Promise<{ blob: Blob; durationSec: number; mimeType: string }> {
    const mr = this.mediaRecorder;
    if (!mr) throw new Error("Recorder not started");
    const blob = await new Promise<Blob>((resolve) => {
      mr.onstop = () => {
        resolve(new Blob(this.chunks, { type: mr.mimeType || "audio/webm" }));
      };
      if (mr.state !== "inactive") mr.stop();
      else resolve(new Blob(this.chunks, { type: mr.mimeType || "audio/webm" }));
    });
    this.cleanup();
    return {
      blob,
      durationSec: Math.max(1, (Date.now() - this.startedAt) / 1000),
      mimeType: blob.type,
    };
  }

  cleanup(): void {
    this.mediaRecorder = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }
}

export async function keepAwake(): Promise<WakeLockSentinel | null> {
  try {
    if ("wakeLock" in navigator) {
      return await navigator.wakeLock.request("screen");
    }
  } catch {
    return null;
  }
  return null;
}
