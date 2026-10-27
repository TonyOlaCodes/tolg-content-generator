"use client";

/**
 * All sound is synthesised in the browser with the Web Audio API - no audio
 * files ship with the game, so there is nothing to license and nothing to
 * download. Cue names match the `sfx` hints the server attaches to feed events.
 */

const THROTTLE_MS = 120;

export class Sfx {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private lastPlayed = new Map<string, number>();
  muted = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.muted = window.localStorage.getItem("eitr.muted") === "1";
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("eitr.muted", muted ? "1" : "0");
    }
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.context.currentTime, 0.02);
    }
  }

  /** browsers require a user gesture before audio can start */
  unlock(): void {
    const context = this.ensure();
    if (context && context.state === "suspended") void context.resume();
  }

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (this.context) return this.context;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.context = new Ctor();
    this.master = this.context.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.context.destination);
    return this.context;
  }

  private tone(
    frequency: number,
    duration: number,
    options: {
      type?: OscillatorType;
      gain?: number;
      sweepTo?: number;
      delay?: number;
      vibrato?: number;
    } = {},
  ): void {
    const context = this.ensure();
    if (!context || !this.master || this.muted) return;
    const start = context.currentTime + (options.delay ?? 0);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = options.type ?? "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    if (options.sweepTo !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, options.sweepTo), start + duration);
    }
    if (options.vibrato) {
      const lfo = context.createOscillator();
      const lfoGain = context.createGain();
      lfo.frequency.value = options.vibrato;
      lfoGain.gain.value = frequency * 0.06;
      lfo.connect(lfoGain);
      lfoGain.connect(oscillator.frequency);
      lfo.start(start);
      lfo.stop(start + duration);
    }
    const peak = options.gain ?? 0.25;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.03, duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private noise(
    duration: number,
    options: { gain?: number; filter?: number; sweepTo?: number; delay?: number } = {},
  ): void {
    const context = this.ensure();
    if (!context || !this.master || this.muted) return;
    const start = context.currentTime + (options.delay ?? 0);
    const frames = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) {
      channel[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(options.filter ?? 800, start);
    if (options.sweepTo !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(80, options.sweepTo), start + duration);
    }
    filter.Q.value = 0.9;
    const gain = context.createGain();
    gain.gain.value = options.gain ?? 0.3;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  play(name: string): void {
    if (this.muted) return;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const last = this.lastPlayed.get(name) ?? 0;
    if (now - last < THROTTLE_MS) return;
    this.lastPlayed.set(name, now);

    switch (name) {
      case "trumpet":
        this.tone(196, 0.5, { type: "sawtooth", gain: 0.3, sweepTo: 392, vibrato: 12 });
        this.tone(294, 0.45, { type: "square", gain: 0.12, sweepTo: 520, delay: 0.04 });
        break;
      case "grow":
        this.tone(110, 0.9, { type: "sawtooth", gain: 0.28, sweepTo: 660 });
        this.tone(220, 0.9, { type: "triangle", gain: 0.16, sweepTo: 880, delay: 0.05 });
        break;
      case "crash":
        this.noise(0.45, { gain: 0.4, filter: 1400, sweepTo: 200 });
        this.tone(90, 0.3, { type: "square", gain: 0.2, sweepTo: 50 });
        break;
      case "bang":
        this.noise(0.25, { gain: 0.35, filter: 700 });
        this.tone(70, 0.25, { type: "sine", gain: 0.25, sweepTo: 45 });
        break;
      case "thud":
        this.tone(82, 0.22, { type: "sine", gain: 0.3, sweepTo: 48 });
        break;
      case "spot":
        this.tone(660, 0.16, { type: "square", gain: 0.22 });
        this.tone(392, 0.3, { type: "square", gain: 0.22, delay: 0.16 });
        break;
      case "ding":
        this.tone(880, 0.14, { type: "triangle", gain: 0.2 });
        this.tone(1320, 0.2, { type: "triangle", gain: 0.16, delay: 0.09 });
        break;
      case "whoosh":
        this.noise(0.35, { gain: 0.22, filter: 300, sweepTo: 2200 });
        break;
      case "splat":
        this.noise(0.3, { gain: 0.3, filter: 500, sweepTo: 140 });
        this.tone(180, 0.3, { type: "sine", gain: 0.2, sweepTo: 60 });
        break;
      case "splash":
        this.noise(0.5, { gain: 0.28, filter: 1200, sweepTo: 300 });
        break;
      case "munch":
        this.noise(0.12, { gain: 0.3, filter: 220, delay: 0.35 });
        this.noise(0.12, { gain: 0.3, filter: 200, delay: 0.2 });
        this.noise(0.12, { gain: 0.3, filter: 240 });
        break;
      case "snore":
        this.tone(80, 0.7, { type: "sawtooth", gain: 0.18, sweepTo: 60, vibrato: 6 });
        this.tone(96, 0.5, { type: "sine", gain: 0.12, sweepTo: 70, delay: 0.75 });
        break;
      case "arrest":
        this.tone(523, 0.18, { type: "square", gain: 0.2 });
        this.tone(392, 0.3, { type: "square", gain: 0.2, delay: 0.16 });
        break;
      case "alarm":
        this.tone(760, 0.14, { type: "square", gain: 0.18 });
        this.tone(960, 0.14, { type: "square", gain: 0.18, delay: 0.16 });
        this.tone(760, 0.14, { type: "square", gain: 0.18, delay: 0.32 });
        break;
      case "vip":
        this.tone(523, 0.16, { type: "triangle", gain: 0.22 });
        this.tone(659, 0.16, { type: "triangle", gain: 0.22, delay: 0.14 });
        this.tone(784, 0.28, { type: "triangle", gain: 0.24, delay: 0.28 });
        break;
      case "win":
        [523, 659, 784, 1046].forEach((frequency, index) => {
          this.tone(frequency, 0.28, { type: "triangle", gain: 0.24, delay: index * 0.13 });
        });
        break;
      case "lose":
        [392, 349, 294, 233].forEach((frequency, index) => {
          this.tone(frequency, 0.34, { type: "sawtooth", gain: 0.18, delay: index * 0.16 });
        });
        break;
      case "growl":
        this.tone(120, 0.6, { type: "sawtooth", gain: 0.22, sweepTo: 90, vibrato: 9 });
        break;
      case "click":
        this.tone(1200, 0.05, { type: "square", gain: 0.12 });
        break;
      default:
        this.tone(520, 0.08, { type: "triangle", gain: 0.12 });
    }
  }
}

export const sfx = new Sfx();
