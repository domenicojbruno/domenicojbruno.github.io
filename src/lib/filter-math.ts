// Closed-form response of the OTA-C blocks in clEAR-ExG, plus the digital
// equivalents used to filter the demo trace. No solver, no SPICE — a 2nd-order
// section has an exact answer and evaluating it is cheaper than integrating one.
//
// Self-check: `node --experimental-strip-types src/lib/filter-math.ts`

export const VT = 0.02585; // thermal voltage kT/q at ~300 K
export const N_SUB = 1.5;  // subthreshold slope factor

/**
 * Transconductance of a subthreshold MOS pair: gm = I_D / (n·V_T).
 * This is the whole reason nanoampere bias works — gm is *linear* in current
 * down here, not square-root, so you can dial gm across decades with the bias.
 */
export const gmFromBias = (iBias: number, n = N_SUB) => iBias / (n * VT);

/**
 * OTA-C corner: f0 = gm_eff / 2πC, where gm_eff = gm / M.
 *
 * M is the gm-division ratio. A raw subthreshold pair at 10 nA has gm ≈ 270 nS;
 * a 100 Hz corner on a 10 pF on-chip cap needs ≈ 6 nS. Real nanopower OTA-C
 * filters close that ~40× gap with current division / source degeneration
 * rather than with an impossible capacitor, so the model carries the ratio
 * explicitly instead of pretending it isn't there.
 */
export const cornerHz = (gm: number, cFarads: number, m = 1) =>
  gm / m / (2 * Math.PI * cFarads);

/** Power burned by one bias branch. */
export const biasPower = (iBias: number, vdd = 1.8) => iBias * vdd;

// ------------------------------------------------------------- analog response
const denom = (w: number, w0: number, q: number) => {
  const re = w0 * w0 - w * w;
  const im = (w0 * w) / q;
  return { re, im, mag: Math.hypot(re, im) };
};

/** |H| in dB for a 2nd-order low-pass: H(s) = ω0² / (s² + (ω0/Q)s + ω0²). */
export function lowpassDb(f: number, f0: number, q: number) {
  const w = 2 * Math.PI * f;
  const w0 = 2 * Math.PI * f0;
  return 20 * Math.log10((w0 * w0) / denom(w, w0, q).mag);
}

/** |H| in dB for a notch: H(s) = (s² + ω0²) / (s² + (ω0/Q)s + ω0²). */
export function notchDb(f: number, f0: number, q: number) {
  const w = 2 * Math.PI * f;
  const w0 = 2 * Math.PI * f0;
  const d = denom(w, w0, q);
  // clamped so a perfect null doesn't plot as -Infinity
  return Math.max(-80, 20 * Math.log10(Math.abs(d.re) / d.mag));
}

/** Phase in degrees for the low-pass. */
export function lowpassPhase(f: number, f0: number, q: number) {
  const w = 2 * Math.PI * f;
  const w0 = 2 * Math.PI * f0;
  const d = denom(w, w0, q);
  return (-Math.atan2(d.im, d.re) * 180) / Math.PI;
}

// ------------------------------------------------------------ digital biquads
// RBJ cookbook forms, used only to filter the on-screen demo waveform.
export type Biquad = [b0: number, b1: number, b2: number, a1: number, a2: number];

function rbj(f0: number, q: number, fs: number, kind: 'lp' | 'notch'): Biquad {
  const w0 = (2 * Math.PI * f0) / fs;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  const [b0, b1, b2] =
    kind === 'notch'
      ? [1, -2 * cos, 1]
      : [(1 - cos) / 2, 1 - cos, (1 - cos) / 2];
  return [b0 / a0, b1 / a0, b2 / a0, (-2 * cos) / a0, (1 - alpha) / a0];
}

export const notchBiquad = (f0: number, q: number, fs: number) => rbj(f0, q, fs, 'notch');
export const lowpassBiquad = (f0: number, q: number, fs: number) => rbj(f0, q, fs, 'lp');

/** Direct-form-I run over a sample buffer. */
export function runBiquad([b0, b1, b2, a1, a2]: Biquad, x: Float32Array) {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const out = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i];
    y2 = y1; y1 = out;
    y[i] = out;
  }
  return y;
}

/**
 * A stand-in EEG trace: a few band-limited rhythms plus jitter, with mains hum
 * laid over the top at a realistically brutal amplitude.
 */
export function eegTrace(n: number, fs: number, humAmp: number, humHz = 60) {
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / fs;
    x[i] =
      0.55 * Math.sin(2 * Math.PI * 10.2 * t) +      // alpha
      0.34 * Math.sin(2 * Math.PI * 5.7 * t + 1.1) + // theta
      0.42 * Math.sin(2 * Math.PI * 2.3 * t + 2.4) + // delta
      0.11 * Math.sin(2 * Math.PI * 23 * t + 0.7) +  // beta
      humAmp * Math.sin(2 * Math.PI * humHz * t);
  }
  return x;
}

// --------------------------------------------------------------------- check
export function demo() {
  // relative tolerance, except against a zero target where that is undefined
  const ok = (label: string, got: number, want: number, tol: number) => {
    const err = want === 0 ? Math.abs(got) : Math.abs(got - want) / Math.abs(want);
    if (err > tol) throw new Error(`${label}: got ${got}, want ~${want} (off by ${err.toPrecision(3)})`);
    console.log(`  ok  ${label.padEnd(34)} ${got.toPrecision(5)}`);
  };

  // The published EEG corner has to fall out of the published bias current.
  const gm = gmFromBias(10.4e-9);
  ok('gm @ 10.4 nA (S)', gm, 268e-9, 0.02);
  ok('EEG corner (Hz)', cornerHz(gm, 10e-12, 42), 101.3, 0.05);
  ok('ECG corner (Hz)', cornerHz(gmFromBias(26e-9), 10e-12, 42), 253, 0.05);
  ok('EEG filter power (W)', biasPower(10.4e-9) * 2, 37.44e-9, 0.05);

  // Response shape: -3 dB at the corner, -40 dB/decade beyond it.
  ok('lowpass @ f0 (dB)', lowpassDb(100, 100, 1 / Math.SQRT2), -3.01, 0.05);
  ok('lowpass @ 10·f0 (dB)', lowpassDb(1000, 100, 1 / Math.SQRT2), -40, 0.05);
  ok('notch @ f0 (dB)', notchDb(60, 60, 8), -80, 0.01);
  ok('notch @ 10·f0 (dB)', notchDb(600, 60, 8), 0, 0.02);

  // The notch must actually remove hum from the trace, not just from the plot.
  const fs = 1000;
  const rms = (a: Float32Array, from = 0) => {
    let s = 0;
    for (let i = from; i < a.length; i++) s += a[i] * a[i];
    return Math.sqrt(s / (a.length - from));
  };
  const dirty = eegTrace(4000, fs, 3);
  const clean = runBiquad(notchBiquad(60, 8, fs), dirty);
  const settled = 500; // skip the transient
  if (!(rms(clean, settled) < rms(dirty, settled) * 0.6)) {
    throw new Error('notch did not attenuate the hum');
  }
  console.log(`  ok  hum removed                       ${rms(dirty, settled).toFixed(2)} -> ${rms(clean, settled).toFixed(2)} RMS`);
  console.log('\nfilter-math: all checks passed');
}

// Runs only when node executes this file directly. Reached through globalThis
// so the module stays browser-typed without pulling in @types/node.
const argv = (globalThis as { process?: { argv?: string[] } }).process?.argv;
if (argv?.[1]?.includes('filter-math')) demo();
