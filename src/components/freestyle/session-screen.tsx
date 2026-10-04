"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Square, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BUILT_IN_BEATS } from "@/lib/data/beats";
import { MicRecorder, getMicPermissionState, keepAwake } from "@/lib/audio/recorder";
import { createAnalyser, sampleWaveform } from "@/lib/audio/waveform";
import { nextPrompt } from "@/lib/training/prompts";
import { mockTranscription } from "@/lib/transcription/mock-provider";
import { getClientAI } from "@/lib/ai";
import { useAppStore } from "@/lib/store/use-app-store";
import { formatDuration, uid, cn } from "@/lib/utils";
import type { Prompt } from "@/lib/types";

type Phase = "countdown" | "live" | "paused" | "stopping";

export function SessionScreen() {
  const router = useRouter();
  const pending = useAppStore((s) => s.pendingSession);
  const profile = useAppStore((s) => s.profile);
  const customBeats = useAppStore((s) => s.customBeats);
  const saveRecordingSession = useAppStore((s) => s.saveRecordingSession);
  const completeChallenge = useAppStore((s) => s.completeChallenge);

  const config = pending ?? {
    beatId: profile.settings.lastBeatId,
    durationSec: 180,
    mode: "free" as const,
    promptFrequencySec: profile.settings.promptFrequencySec,
    difficulty: profile.settings.difficulty,
    aiFeedback: true,
    livePrompts: false,
    distractionFree: false,
  };

  const beat = useMemo(() => {
    if (!config.beatId) return null;
    return (
      customBeats.find((b) => b.id === config.beatId) ??
      BUILT_IN_BEATS.find((b) => b.id === config.beatId) ??
      null
    );
  }, [config.beatId, customBeats]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MicRecorder | null>(null);
  const wakeRef = useRef<WakeLockSentinel | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const promptsRef = useRef<string[]>([]);

  const [phase, setPhase] = useState<Phase>("countdown");
  const [countdown, setCountdown] = useState(profile.settings.countdownSec);
  const [elapsed, setElapsed] = useState(0);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [promptLeft, setPromptLeft] = useState(config.promptFrequencySec);
  const [levels, setLevels] = useState<number[]>(Array(28).fill(0.2));
  const [volume, setVolume] = useState(0.85);
  const [showControls, setShowControls] = useState(!config.distractionFree);
  const [micError, setMicError] = useState<string | null>(null);
  const [beatReady, setBeatReady] = useState(false);

  const remaining =
    config.durationSec != null ? Math.max(0, config.durationSec - elapsed) : null;

  const startRecording = useCallback(async () => {
    try {
      const perm = await getMicPermissionState();
      if (perm === "unsupported") {
        setMicError("Microphone recording is not supported in this browser.");
        return;
      }
      const rec = new MicRecorder();
      await rec.start();
      recorderRef.current = rec;
      const stream = rec.getStream();
      if (stream) {
        const { ctx, analyser } = createAnalyser(stream);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
      }
      wakeRef.current = await keepAwake();
      const audio = audioRef.current;
      if (audio && beat?.src) {
        audio.volume = volume;
        audio.loop = true;
        try {
          await audio.play();
        } catch {
          toast.message("Tap the beat controls if playback is blocked.");
        }
      }
      setPhase("live");
    } catch {
      setMicError("Microphone permission denied. Enable mic access to record.");
      setPhase("paused");
    }
  }, [volume, beat?.src]);

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      void startRecording();
      return;
    }
    const t = window.setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [phase, countdown, startRecording]);

  useEffect(() => {
    if (phase !== "live") return;
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "live") return;
    if (config.durationSec != null && elapsed >= config.durationSec) {
      void finish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, phase, config.durationSec]);

  const customPromptIndex = useRef(0);

  useEffect(() => {
    if (phase !== "live" || !config.livePrompts || config.mode === "blind") return;

    const makePrompt = (): Prompt => {
      const customs = config.customPrompts ?? [];
      if (customs.length) {
        const value = customs[customPromptIndex.current % customs.length]!;
        customPromptIndex.current += 1;
        return { id: uid("p"), type: "word", value };
      }
      return nextPrompt(config.mode, config.difficulty);
    };

    if (!prompt) {
      const p = makePrompt();
      setPrompt(p);
      promptsRef.current = [...promptsRef.current, p.value];
      setPromptLeft(config.promptFrequencySec);
      return;
    }
    const t = window.setInterval(() => {
      setPromptLeft((left) => {
        if (left <= 1) {
          const p = makePrompt();
          setPrompt(p);
          promptsRef.current = [...promptsRef.current, p.value];
          return config.promptFrequencySec;
        }
        return left - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [phase, config.livePrompts, config.mode, config.difficulty, config.promptFrequencySec, config.customPrompts, prompt]);

  useEffect(() => {
    if (phase !== "live") return;
    let raf = 0;
    const tick = () => {
      if (analyserRef.current) setLevels(sampleWaveform(analyserRef.current, 28));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (phase === "live" || phase === "paused") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [phase]);

  useEffect(() => {
    return () => {
      recorderRef.current?.cleanup();
      void wakeRef.current?.release();
      void audioCtxRef.current?.close();
      audioRef.current?.pause();
    };
  }, []);

  async function finish() {
    if (phase === "stopping") return;
    setPhase("stopping");
    audioRef.current?.pause();
    let blob = new Blob([], { type: "audio/webm" });
    let durationSec = elapsed || 1;
    try {
      if (recorderRef.current) {
        const result = await recorderRef.current.stop();
        blob = result.blob;
        durationSec = Math.max(elapsed, Math.round(result.durationSec));
      }
    } catch {
      toast.error("Recording stop failed — saving session metadata anyway.");
    }
    void wakeRef.current?.release();

    const id = uid("rec");
    const { text, segments } = await mockTranscription.transcribe(blob);
    let analysis = undefined;
    if (config.aiFeedback) {
      analysis = await getClientAI().analyzeFreestyle({
        transcript: text,
        segments,
        recordingId: id,
        session: {
          ...config,
          prompts: promptsRef.current,
          durationSec,
        },
        profile,
      });
      // Prefer server route when available (keeps keys server-side)
      try {
        const res = await fetch("/api/ai/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: text,
            segments,
            recordingId: id,
            session: { ...config, prompts: promptsRef.current, durationSec },
          }),
        });
        if (res.ok) analysis = await res.json();
      } catch {
        // keep client mock
      }
    }

    await saveRecordingSession({
      meta: {
        id,
        createdAt: new Date().toISOString(),
        durationSec,
        beatId: beat?.id ?? null,
        beatTitle: beat?.title ?? "Acapella",
        mode: config.mode,
        difficulty: config.difficulty,
        prompts: promptsRef.current,
        blobKey: id,
        transcript: segments,
        analysisId: analysis?.id,
      },
      blob,
      analysis,
      transcriptText: text,
    });

    if (config.mode === useAppStore.getState().challenge?.mode) {
      completeChallenge();
    }

    router.replace(`/freestyle/result/${id}`);
  }

  function togglePause() {
    if (phase === "live") {
      recorderRef.current?.pause();
      audioRef.current?.pause();
      setPhase("paused");
    } else if (phase === "paused") {
      recorderRef.current?.resume();
      void audioRef.current?.play();
      setPhase("live");
    }
  }

  const distraction = config.distractionFree && !showControls;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex flex-col bg-[#050506]",
        distraction && "bg-black",
      )}
      onClick={() => {
        if (config.distractionFree) setShowControls((v) => !v);
      }}
      onTouchStart={(e) => {
        if (!config.distractionFree) return;
        const touch = e.changedTouches[0];
        if (touch && touch.clientY > window.innerHeight * 0.8) setShowControls(true);
      }}
    >
      {beat?.src && (
        <audio
          ref={audioRef}
          src={beat.src}
          preload="auto"
          loop
          onCanPlay={() => setBeatReady(true)}
        />
      )}

      <div className="mx-auto flex h-full w-full max-w-lg flex-col px-5 pb-8 pt-10">
        {!distraction && (
          <div className="mb-6 flex items-center justify-between text-sm text-[var(--text-secondary)]">
            <div>
              <p className="font-medium text-white">{beat?.title ?? "Acapella"}</p>
              <p>
                {beat ? `${beat.bpm} BPM · ` : ""}
                {config.mode.replace(/_/g, " ")}
                {beat && !beatReady ? " · loading beat" : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {phase === "live" && <span className="rec-dot h-3 w-3 rounded-full bg-[var(--danger)]" />}
              <span className="uppercase tracking-wider">{phase === "countdown" ? "ready" : phase}</span>
            </div>
          </div>
        )}

        <div className="flex flex-1 flex-col items-center justify-center text-center">
          {phase === "countdown" ? (
            <div className="animate-fade-up">
              <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">Starting in</p>
              <p className="font-display text-[8rem] leading-none">{countdown}</p>
            </div>
          ) : (
            <>
              <p className="font-display text-7xl tabular-nums tracking-tight">
                {remaining != null ? formatDuration(remaining) : formatDuration(elapsed)}
              </p>
              {config.livePrompts && config.mode !== "blind" && prompt && (
                <div className="mt-8 w-full animate-fade-up">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Current prompt</p>
                  <p className="mt-2 font-display text-4xl text-[var(--accent)]">{prompt.value}</p>
                  {!distraction && (
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">Next in {promptLeft}s</p>
                  )}
                  {prompt.type === "image" && typeof prompt.meta?.url === "string" && !distraction && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={prompt.meta.url}
                      alt={prompt.value}
                      className="mx-auto mt-4 h-36 w-full max-w-xs rounded-2xl object-cover"
                    />
                  )}
                </div>
              )}
              {config.mode === "blind" && (
                <p className="mt-6 text-[var(--text-secondary)]">Blind freestyle — no visual prompts.</p>
              )}
            </>
          )}

          <div className="mt-10 flex h-16 items-end justify-center gap-1">
            {levels.map((l, i) => (
              <span
                key={i}
                className="wave-bar w-1.5 rounded-full bg-[var(--accent)]"
                style={{
                  height: `${Math.max(8, l * 64)}px`,
                  animationDelay: `${i * 0.03}s`,
                  opacity: 0.35 + l * 0.65,
                }}
              />
            ))}
          </div>
        </div>

        {micError && (
          <div className="mb-4 rounded-2xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 p-4 text-sm">
            {micError}
          </div>
        )}

        {(showControls || !config.distractionFree) && phase !== "countdown" && (
          <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 text-[var(--text-secondary)]">
              <Volume2 className="h-4 w-4" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  if (audioRef.current) audioRef.current.volume = v;
                }}
                className="w-full accent-[var(--accent)]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button size="lg" variant="secondary" onClick={togglePause}>
                {phase === "paused" ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                {phase === "paused" ? "Resume" : "Pause"}
              </Button>
              <Button size="lg" variant="danger" onClick={() => void finish()} disabled={phase === "stopping"}>
                <Square className="h-5 w-5" />
                {phase === "stopping" ? "Saving…" : "Stop"}
              </Button>
            </div>
            {config.distractionFree && (
              <p className="text-center text-xs text-[var(--text-muted)]">Tap screen to hide controls</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
