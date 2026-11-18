import { FilterType, ParametricBand } from '../types/earshot';

/**
 * RBJ Audio EQ Cookbook Biquad filter transfer function & magnitude evaluation.
 * Ported directly from dsp/src/main/kotlin/dev/earshot/dsp/Biquad.kt & EqResponse.kt & Headroom.kt.
 */
export const DEFAULT_SAMPLE_RATE = 48000;

export interface BiquadCoeffs {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

export function computeBiquadCoeffs(
  type: FilterType,
  f0: number,
  gainDb: number,
  q: number,
  sampleRate: number = DEFAULT_SAMPLE_RATE,
): BiquadCoeffs {
  const fc = Math.max(1, Math.min(sampleRate * 0.499, f0));
  const qq = Math.max(1e-3, q);
  const a = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * fc) / sampleRate;
  const cosW0 = Math.cos(w0);
  const sinW0 = Math.sin(w0);
  const alpha = sinW0 / (2 * qq);

  let nb0 = 1;
  let nb1 = 0;
  let nb2 = 0;
  let na0 = 1;
  let na1 = 0;
  let na2 = 0;

  if (type === 'PEAK') {
    nb0 = 1 + alpha * a;
    nb1 = -2 * cosW0;
    nb2 = 1 - alpha * a;
    na0 = 1 + alpha / a;
    na1 = -2 * cosW0;
    na2 = 1 - alpha / a;
  } else if (type === 'LOW_SHELF') {
    const twoSqrtAAlpha = 2 * Math.sqrt(a) * alpha;
    nb0 = a * (a + 1 - (a - 1) * cosW0 + twoSqrtAAlpha);
    nb1 = 2 * a * (a - 1 - (a + 1) * cosW0);
    nb2 = a * (a + 1 - (a - 1) * cosW0 - twoSqrtAAlpha);
    na0 = a + 1 + (a - 1) * cosW0 + twoSqrtAAlpha;
    na1 = -2 * (a - 1 + (a + 1) * cosW0);
    na2 = a + 1 + (a - 1) * cosW0 - twoSqrtAAlpha;
  } else {
    // HIGH_SHELF
    const twoSqrtAAlpha = 2 * Math.sqrt(a) * alpha;
    nb0 = a * (a + 1 + (a - 1) * cosW0 + twoSqrtAAlpha);
    nb1 = -2 * a * (a - 1 + (a + 1) * cosW0);
    nb2 = a * (a + 1 + (a - 1) * cosW0 - twoSqrtAAlpha);
    na0 = a + 1 - (a - 1) * cosW0 + twoSqrtAAlpha;
    na1 = 2 * (a - 1 - (a + 1) * cosW0);
    na2 = a + 1 - (a - 1) * cosW0 - twoSqrtAAlpha;
  }

  return {
    b0: nb0 / na0,
    b1: nb1 / na0,
    b2: nb2 / na0,
    a1: na1 / na0,
    a2: na2 / na0,
  };
}

export function biquadMagnitudeDb(
  coeffs: BiquadCoeffs,
  freqHz: number,
  sampleRate: number = DEFAULT_SAMPLE_RATE,
): number {
  const w = (2 * Math.PI * freqHz) / sampleRate;
  const cos1 = Math.cos(w);
  const sin1 = Math.sin(w);
  const cos2 = Math.cos(2 * w);
  const sin2 = Math.sin(2 * w);

  const nr = coeffs.b0 + coeffs.b1 * cos1 + coeffs.b2 * cos2;
  const ni = -(coeffs.b1 * sin1 + coeffs.b2 * sin2);
  const dr = 1 + coeffs.a1 * cos1 + coeffs.a2 * cos2;
  const di = -(coeffs.a1 * sin1 + coeffs.a2 * sin2);

  const num = nr * nr + ni * ni;
  const den = dr * dr + di * di;
  if (den <= 0 || num <= 0) return num <= 0 ? -200 : 200;
  return 10 * Math.log10(num / den);
}

export interface ResponsePoint {
  frequencyHz: number;
  gainDb: number;
}

export function sampleEqResponse(
  bands: ParametricBand[],
  preampDb: number,
  nPoints = 200,
  fMin = 20,
  fMax = 20000,
): ResponsePoint[] {
  const active = bands
    .filter((b) => b.enabled)
    .map((b) => computeBiquadCoeffs(b.type, b.frequencyHz, b.gainDb, b.q));

  const lnMin = Math.log(fMin);
  const step = (Math.log(fMax) - lnMin) / (nPoints - 1);
  const out: ResponsePoint[] = [];

  for (let i = 0; i < nPoints; i++) {
    const f = Math.exp(lnMin + step * i);
    let sum = preampDb;
    for (let j = 0; j < active.length; j++) {
      sum += biquadMagnitudeDb(active[j], f);
    }
    out.push({ frequencyHz: f, gainDb: sum });
  }
  return out;
}

export function recommendedPreampDb(bands: ParametricBand[]): number {
  const pts = sampleEqResponse(bands, 0, 256, 20, 20000);
  let peak = 0;
  for (const p of pts) {
    if (p.gainDb > peak) peak = p.gainDb;
  }
  if (peak <= 0.05) return 0;
  return -Math.round(peak * 10) / 10;
}
