/** Procedural ambient + interaction tones via Web Audio API. */

type ToneOpts = {
  freq?: number;
  duration?: number;
  type?: OscillatorType;
  gain?: number;
};

export class MuseumAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambient: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;
  private lfo: OscillatorNode | null = null;
  muted = false;
  volume = 0.55;

  ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (!this.muted && this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  startAmbient(kind: "void" | "exhibit" | "finale" = "void"): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    this.stopAmbient();
    const base = kind === "finale" ? 55 : kind === "exhibit" ? 72 : 48;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = base;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = kind === "finale" ? 8 : 4;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(g);
    g.connect(this.master);
    osc.start();
    lfo.start();
    g.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 2.5);
    this.ambient = osc;
    this.ambientGain = g;
    this.lfo = lfo;
  }

  stopAmbient(): void {
    try {
      this.ambient?.stop();
      this.lfo?.stop();
    } catch {
      /* already stopped */
    }
    this.ambient = null;
    this.lfo = null;
    this.ambientGain = null;
  }

  tone(opts: ToneOpts = {}): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.muted) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? "triangle";
    osc.frequency.value = opts.freq ?? 440;
    const dur = opts.duration ?? 0.35;
    const peak = (opts.gain ?? 0.08) * this.volume;
    g.gain.value = 0.0001;
    osc.connect(g);
    g.connect(this.master);
    const t0 = ctx.currentTime;
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  chord(freqs: number[]): void {
    freqs.forEach((f, i) => {
      window.setTimeout(() => this.tone({ freq: f, duration: 0.55, type: "sine", gain: 0.06 }), i * 40);
    });
  }

  whoosh(): void {
    this.tone({ freq: 180, duration: 0.45, type: "sawtooth", gain: 0.04 });
    this.tone({ freq: 90, duration: 0.55, type: "sine", gain: 0.05 });
  }

  chime(): void {
    this.chord([523.25, 659.25, 783.99]);
  }

  dispose(): void {
    this.stopAmbient();
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }
}

export const museumAudio = new MuseumAudio();
