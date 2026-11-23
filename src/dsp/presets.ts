import { EqPreset, FilterType, ParametricBand } from '../types/earshot';
import { recommendedPreampDb } from './biquad';

export const GRAPHIC_FREQUENCIES_HZ = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const GRAPHIC_DEFAULT_Q = 1.41;

export function makeGraphicBands(gainsDb: number[]): ParametricBand[] {
  return GRAPHIC_FREQUENCIES_HZ.map((freq, idx) => ({
    id: `g-${freq}`,
    frequencyHz: freq,
    gainDb: gainsDb[idx] ?? 0,
    q: GRAPHIC_DEFAULT_Q,
    type: 'PEAK',
    enabled: true,
  }));
}

/**
 * Parse AutoEq ParametricEQ.txt format:
 * Preamp: -2.8 dB
 * Filter 1: ON LSC Fc 105 Hz Gain -3.0 dB Q 0.70
 */
export function parseAutoEqText(
  text: string,
  id: string,
  name: string,
  description?: string,
  isBuiltIn = false,
): EqPreset {
  let preampDb = 0;
  const bands: ParametricBand[] = [];
  const preampRe = /^\s*Preamp:\s*([-+]?\d+(?:\.\d+)?)\s*dB\s*$/i;
  const filterRe =
    /^\s*Filter\s*\d+\s*:\s*(ON|OFF)\s+(PK|LSC|HSC|LS|HS|PEQ)\s+Fc\s+([-+]?\d+(?:\.\d+)?)\s*Hz\s+Gain\s+([-+]?\d+(?:\.\d+)?)\s*dB(?:\s+Q\s+([-+]?\d+(?:\.\d+)?))?\s*$/i;

  const lines = text.split(/\r?\n/);
  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return;
    const pm = line.match(preampRe);
    if (pm) {
      preampDb = Math.max(-30, Math.min(0, parseFloat(pm[1])));
      return;
    }
    const fm = line.match(filterRe);
    if (!fm) return;
    const enabled = fm[1].toUpperCase() === 'ON';
    const rawType = fm[2].toUpperCase();
    const type: FilterType =
      rawType === 'LSC' || rawType === 'LS'
        ? 'LOW_SHELF'
        : rawType === 'HSC' || rawType === 'HS'
          ? 'HIGH_SHELF'
          : 'PEAK';
    const fc = parseFloat(fm[3]);
    const gain = Math.max(-15, Math.min(15, parseFloat(fm[4])));
    const q = fm[5] ? Math.max(0.1, Math.min(10, parseFloat(fm[5]))) : 0.707;
    if (fc <= 0) return;
    bands.push({
      id: `${id}-f${idx}`,
      frequencyHz: fc,
      gainDb: gain,
      q,
      type,
      enabled,
    });
  });

  if (bands.length === 0) {
    throw new Error("No 'Filter N: ON PK Fc … Hz Gain … dB Q …' lines found");
  }

  return { id, name, bands, preampDb, isBuiltIn, description };
}

export function exportAutoEqText(preset: EqPreset): string {
  const lines: string[] = [`Preamp: ${preset.preampDb.toFixed(1)} dB`];
  preset.bands.forEach((b, idx) => {
    const typeCode = b.type === 'LOW_SHELF' ? 'LSC' : b.type === 'HIGH_SHELF' ? 'HSC' : 'PK';
    const freqStr = Math.abs(b.frequencyHz - Math.round(b.frequencyHz)) < 0.05
      ? String(Math.round(b.frequencyHz))
      : b.frequencyHz.toFixed(1);
    lines.push(
      `Filter ${idx + 1}: ${b.enabled ? 'ON' : 'OFF'} ${typeCode} Fc ${freqStr} Hz Gain ${b.gainDb.toFixed(1)} dB Q ${b.q.toFixed(2)}`,
    );
  });
  return lines.join('\n');
}

const QC_ULTRA_EARBUDS_2_AUTOEQ_TEXT = `Preamp: -3.2 dB
Filter 1: ON LSC Fc 80 Hz Gain -2.5 dB Q 0.70
Filter 2: ON PK Fc 135 Hz Gain -3.1 dB Q 1.15
Filter 3: ON PK Fc 320 Hz Gain 1.8 dB Q 1.45
Filter 4: ON PK Fc 1850 Hz Gain 2.9 dB Q 2.10
Filter 5: ON PK Fc 4300 Hz Gain -2.4 dB Q 3.10
Filter 6: ON PK Fc 8500 Hz Gain 3.2 dB Q 2.60
Filter 7: ON HSC Fc 12500 Hz Gain 2.0 dB Q 0.70`;

const QC_ULTRA_AUTOEQ_TEXT = `Preamp: -2.8 dB
Filter 1: ON LSC Fc 105 Hz Gain -3.0 dB Q 0.70
Filter 2: ON PK Fc 5032 Hz Gain 2.8 dB Q 3.69
Filter 3: ON PK Fc 156 Hz Gain 1.5 dB Q 1.61
Filter 4: ON PK Fc 94 Hz Gain -2.4 dB Q 2.32
Filter 5: ON PK Fc 2373 Hz Gain -2.8 dB Q 5.58
Filter 6: ON HSC Fc 10000 Hz Gain 2.7 dB Q 0.70
Filter 7: ON PK Fc 1633 Hz Gain 2.6 dB Q 3.51
Filter 8: ON PK Fc 491 Hz Gain -1.1 dB Q 2.50
Filter 9: ON PK Fc 2194 Hz Gain -1.0 dB Q 3.76
Filter 10: ON PK Fc 36 Hz Gain -0.5 dB Q 2.83`;

function withHeadroom(preset: Omit<EqPreset, 'preampDb'>): EqPreset {
  return {
    ...preset,
    preampDb: recommendedPreampDb(preset.bands),
  };
}

export const BUILT_IN_PRESETS: EqPreset[] = [
  {
    id: 'flat',
    name: 'Flat',
    bands: makeGraphicBands(Array(10).fill(0)),
    preampDb: 0,
    isBuiltIn: true,
    description: "No change — the headphones' own sound.",
  },
  parseAutoEqText(
    QC_ULTRA_EARBUDS_2_AUTOEQ_TEXT,
    'qc_ultra_earbuds_2',
    'QC Ultra Earbuds (2nd Gen)',
    'Balanced Harman IE target curve for Bose QuietComfort Ultra Earbuds (2nd Gen) — tightens mid-bass bloom and opens 1.8 kHz–12 kHz presence.',
    true,
  ),
  parseAutoEqText(
    QC_ULTRA_AUTOEQ_TEXT,
    'qc_ultra',
    'Tuned for QC Ultra HP',
    'Correction toward the Harman over-ear target for the Bose QuietComfort Ultra Headphones (AutoEq, Rtings B&K 5128).',
    true,
  ),
  withHeadroom({
    id: 'bass',
    name: 'Bass boost',
    isBuiltIn: true,
    description: 'Fuller low end without muddying the mids.',
    bands: [
      { id: 'b1', frequencyHz: 90, gainDb: 5.0, q: 0.7, type: 'LOW_SHELF', enabled: true },
      { id: 'b2', frequencyHz: 60, gainDb: 1.5, q: 1.0, type: 'PEAK', enabled: true },
      { id: 'b3', frequencyHz: 250, gainDb: -1.0, q: 1.2, type: 'PEAK', enabled: true },
    ],
  }),
  withHeadroom({
    id: 'vocal',
    name: 'Vocal clarity',
    isBuiltIn: true,
    description: 'Lifts presence around 3 kHz and trims the mud below it.',
    bands: [
      { id: 'v1', frequencyHz: 120, gainDb: -2.0, q: 0.7, type: 'LOW_SHELF', enabled: true },
      { id: 'v2', frequencyHz: 300, gainDb: -1.5, q: 1.2, type: 'PEAK', enabled: true },
      { id: 'v3', frequencyHz: 1200, gainDb: 1.0, q: 1.0, type: 'PEAK', enabled: true },
      { id: 'v4', frequencyHz: 2800, gainDb: 2.5, q: 1.1, type: 'PEAK', enabled: true },
      { id: 'v5', frequencyHz: 5500, gainDb: 1.0, q: 1.5, type: 'PEAK', enabled: true },
    ],
  }),
  withHeadroom({
    id: 'treble',
    name: 'Treble sparkle',
    isBuiltIn: true,
    description: 'More air and detail in the top octaves.',
    bands: [
      { id: 't1', frequencyHz: 6000, gainDb: 2.0, q: 1.2, type: 'PEAK', enabled: true },
      { id: 't2', frequencyHz: 9000, gainDb: 3.0, q: 0.7, type: 'HIGH_SHELF', enabled: true },
      { id: 't3', frequencyHz: 3500, gainDb: -0.5, q: 1.5, type: 'PEAK', enabled: true },
    ],
  }),
  withHeadroom({
    id: 'podcast',
    name: 'Podcast',
    isBuiltIn: true,
    description: 'Intelligibility first: less rumble, clearer consonants.',
    bands: [
      { id: 'p1', frequencyHz: 100, gainDb: -4.0, q: 0.7, type: 'LOW_SHELF', enabled: true },
      { id: 'p2', frequencyHz: 200, gainDb: -1.0, q: 1.0, type: 'PEAK', enabled: true },
      { id: 'p3', frequencyHz: 1500, gainDb: 1.5, q: 1.0, type: 'PEAK', enabled: true },
      { id: 'p4', frequencyHz: 3000, gainDb: 2.5, q: 1.2, type: 'PEAK', enabled: true },
      { id: 'p5', frequencyHz: 8000, gainDb: -1.5, q: 0.7, type: 'HIGH_SHELF', enabled: true },
    ],
  }),
  withHeadroom({
    id: 'loudness',
    name: 'Loudness',
    isBuiltIn: true,
    description: 'Soft smile curve for low-volume listening.',
    bands: [
      { id: 'l1', frequencyHz: 100, gainDb: 3.5, q: 0.7, type: 'LOW_SHELF', enabled: true },
      { id: 'l2', frequencyHz: 700, gainDb: -1.0, q: 0.6, type: 'PEAK', enabled: true },
      { id: 'l3', frequencyHz: 8000, gainDb: 2.5, q: 0.7, type: 'HIGH_SHELF', enabled: true },
    ],
  }),
];
