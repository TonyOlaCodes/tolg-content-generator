/** Simple time-domain analyser helpers for recording UI. */

export function createAnalyser(stream: MediaStream): { ctx: AudioContext; analyser: AnalyserNode } {
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);
  return { ctx, analyser };
}

export function sampleLevel(analyser: AnalyserNode): number {
  const data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i]! - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / data.length);
}

export function sampleWaveform(analyser: AnalyserNode, bars = 32): number[] {
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  const out: number[] = [];
  const step = Math.floor(data.length / bars);
  for (let i = 0; i < bars; i++) {
    let max = 0;
    for (let j = 0; j < step; j++) max = Math.max(max, data[i * step + j] ?? 0);
    out.push(max / 255);
  }
  return out;
}
