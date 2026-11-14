// Ride sound, synthesised with WebAudio (no audio files): an electric hum that
// rises with speed, a whoosh on each drop, a click on arrival. Muted by default.

import { useStore } from '../state/store';

let ctx: AudioContext | null = null;
let master: GainNode, hum: GainNode, o1: OscillatorNode, o2: OscillatorNode, filt: BiquadFilterNode;
let noise: AudioBuffer;

function ensure(): boolean {
  if (useStore.getState().muted) return false;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    hum = ctx.createGain(); hum.gain.value = 0;
    filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 400; filt.Q.value = 6;
    o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 60;
    o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 90.5;
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    o1.connect(filt); o2.connect(g2).connect(filt); filt.connect(hum).connect(master);
    o1.start(); o2.start();
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return true;
}

export const sound = {
  start() { if (ensure()) hum.gain.setTargetAtTime(0.16, ctx!.currentTime, 0.12); },
  update(speed: number, under: boolean) {
    if (!ctx || useStore.getState().muted) { if (ctx) hum.gain.setTargetAtTime(0, ctx.currentTime, 0.05); return; }
    const t = ctx.currentTime;
    o1.frequency.setTargetAtTime(55 + 210 * speed, t, 0.06);
    o2.frequency.setTargetAtTime(82 + 320 * speed, t, 0.06);
    filt.frequency.setTargetAtTime((under ? 300 : 520) + 2600 * speed * (under ? 0.4 : 1), t, 0.08);
    hum.gain.setTargetAtTime(0.1 + 0.16 * speed, t, 0.1);
  },
  whoosh() {
    if (!ensure()) return;
    const t = ctx!.currentTime;
    const src = ctx!.createBufferSource(); src.buffer = noise;
    const bp = ctx!.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(1800, t); bp.frequency.exponentialRampToValueAtTime(180, t + 0.55);
    const g = ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.07); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    src.connect(bp).connect(g).connect(master); src.start(t); src.stop(t + 0.65);
  },
  click() {
    if (!ensure()) return;
    const t = ctx!.currentTime;
    const o = ctx!.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(220, t + 0.09);
    const g = ctx!.createGain();
    g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.18);
  },
  stop() { if (ctx) hum.gain.setTargetAtTime(0, ctx.currentTime, 0.18); },
};
