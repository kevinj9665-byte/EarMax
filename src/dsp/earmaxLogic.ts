import {
  AudioOutputRoute,
  EqBandMode,
  EqBandSpec,
  NoiseSettings,
  ParametricBand,
} from '../types/earshot';
import { sampleEqResponse } from './biquad';

export interface EqBandModeConfig {
  mode: EqBandMode;
  shortLabel: string;
  title: string;
  subtitle: string;
  bands: EqBandSpec[];
}

export const EQ_BAND_MODE_CONFIGS: Record<EqBandMode, EqBandModeConfig> = {
  BAND_3: {
    mode: 'BAND_3',
    shortLabel: '3-Band',
    title: 'Bose Style (3-Band)',
    subtitle: 'Bass · Mid · Treble',
    bands: [
      { id: 'b3-bass', title: 'Bass', frequencyLabel: '60 Hz', role: 'Sub & Punch', frequencyHz: 60, q: 0.707, type: 'LOW_SHELF' },
      { id: 'b3-mid', title: 'Mid', frequencyLabel: '1 kHz', role: 'Vocals & Instruments', frequencyHz: 1000, q: 1.0, type: 'PEAK' },
      { id: 'b3-treble', title: 'Treble', frequencyLabel: '8 kHz', role: 'Clarity & Sparkle', frequencyHz: 8000, q: 0.707, type: 'HIGH_SHELF' },
    ],
  },
  BAND_4: {
    mode: 'BAND_4',
    shortLabel: '4-Band',
    title: '4-Band Precision',
    subtitle: 'Bass · Low-Mids · High-Mids · Treble',
    bands: [
      { id: 'b4-bass', title: 'Bass', frequencyLabel: '60 Hz', role: 'Sub & Rumble', frequencyHz: 60, q: 0.707, type: 'LOW_SHELF' },
      { id: 'b4-low-mids', title: 'Low-Mids', frequencyLabel: '300 Hz', role: 'Warmth & Body', frequencyHz: 300, q: 1.2, type: 'PEAK' },
      { id: 'b4-high-mids', title: 'High-Mids', frequencyLabel: '2.5 kHz', role: 'Vocal Presence', frequencyHz: 2500, q: 1.2, type: 'PEAK' },
      { id: 'b4-treble', title: 'Treble', frequencyLabel: '10 kHz', role: 'Air & Detail', frequencyHz: 10000, q: 0.707, type: 'HIGH_SHELF' },
    ],
  },
  BAND_5: {
    mode: 'BAND_5',
    shortLabel: '5-Band',
    title: '5-Band Studio',
    subtitle: 'Sub-Bass · Bass · Mids · High-Mids · Treble',
    bands: [
      { id: 'b5-sub', title: 'Sub-Bass', frequencyLabel: '60 Hz', role: 'Deep Low End', frequencyHz: 60, q: 0.707, type: 'LOW_SHELF' },
      { id: 'b5-bass', title: 'Bass', frequencyLabel: '230 Hz', role: 'Mid-Bass Punch', frequencyHz: 230, q: 1.2, type: 'PEAK' },
      { id: 'b5-mids', title: 'Mids', frequencyLabel: '910 Hz', role: 'Vocals & Guitar', frequencyHz: 910, q: 1.2, type: 'PEAK' },
      { id: 'b5-high-mids', title: 'High-Mids', frequencyLabel: '3.6 kHz', role: 'Clarity & Edge', frequencyHz: 3600, q: 1.2, type: 'PEAK' },
      { id: 'b5-treble', title: 'Treble', frequencyLabel: '14 kHz', role: 'Air & Shimmer', frequencyHz: 14000, q: 0.707, type: 'HIGH_SHELF' },
    ],
  },
  BAND_7: {
    mode: 'BAND_7',
    shortLabel: '7-Band',
    title: '7-Band Pro',
    subtitle: 'Sub-Bass · Mid-Bass · Low-Mids · Mids · High-Mids · Presence · Treble',
    bands: [
      { id: 'b7-sub', title: 'Sub-Bass', frequencyLabel: '60 Hz', role: 'Deep Rumble', frequencyHz: 60, q: 0.707, type: 'LOW_SHELF' },
      { id: 'b7-mid-bass', title: 'Mid-Bass', frequencyLabel: '150 Hz', role: 'Warmth & Kick', frequencyHz: 150, q: 1.2, type: 'PEAK' },
      { id: 'b7-low-mids', title: 'Low-Mids', frequencyLabel: '400 Hz', role: 'Boxiness / Body', frequencyHz: 400, q: 1.3, type: 'PEAK' },
      { id: 'b7-mids', title: 'Mids', frequencyLabel: '1 kHz', role: 'Core Vocals', frequencyHz: 1000, q: 1.3, type: 'PEAK' },
      { id: 'b7-high-mids', title: 'High-Mids', frequencyLabel: '2.4 kHz', role: 'Presence', frequencyHz: 2400, q: 1.3, type: 'PEAK' },
      { id: 'b7-presence', title: 'Presence', frequencyLabel: '6 kHz', role: 'Sibilance / Detail', frequencyHz: 6000, q: 1.3, type: 'PEAK' },
      { id: 'b7-treble', title: 'Treble', frequencyLabel: '14 kHz', role: 'Air & Sparkle', frequencyHz: 14000, q: 0.707, type: 'HIGH_SHELF' },
    ],
  },
};

export const EQ_BAND_MODE_ORDER: EqBandMode[] = ['BAND_3', 'BAND_4', 'BAND_5', 'BAND_7'];

export function formatBandSliderLabel(spec: EqBandSpec): string {
  return `${spec.title} (${spec.frequencyLabel} — ${spec.role})`;
}

export function makeModeBands(mode: EqBandMode, gainsDb: number[]): ParametricBand[] {
  const specs = EQ_BAND_MODE_CONFIGS[mode].bands;
  return specs.map((spec, idx) => ({
    id: spec.id,
    frequencyHz: spec.frequencyHz,
    gainDb: Math.max(-15, Math.min(15, Number(((gainsDb[idx] ?? 0)).toFixed(1)))),
    q: spec.q,
    type: spec.type,
    enabled: true,
  }));
}

export function sampleGainsForMode(bands: ParametricBand[], mode: EqBandMode): number[] {
  const specs = EQ_BAND_MODE_CONFIGS[mode].bands;
  // Exact match by frequency & count preserves exact slider positions
  if (
    bands.length === specs.length &&
    specs.every((s, idx) => Math.abs(bands[idx].frequencyHz - s.frequencyHz) < 1)
  ) {
    return bands.map((b) => Math.max(-15, Math.min(15, Math.round(b.gainDb * 2) / 2)));
  }

  const curve = sampleEqResponse(bands, 0, 160, 20, 20000);
  return specs.map((spec) => {
    let nearest = curve[0];
    let bestDist = Infinity;
    for (const pt of curve) {
      const dist = Math.abs(Math.log10(pt.frequencyHz) - Math.log10(spec.frequencyHz));
      if (dist < bestDist) {
        bestDist = dist;
        nearest = pt;
      }
    }
    const snapped = Math.round(nearest.gainDb * 2) / 2;
    return Math.max(-15, Math.min(15, snapped));
  });
}

// ---- External Audio Output Route Detection (USB-C BTD 700 / Bluetooth / Bose Control Link) ----
export interface ExternalRouteInput {
  selectedRoute: AudioOutputRoute;
  btd700ModeActive: boolean;
  controlLinkActive: boolean;
}

export interface ExternalRouteResolution {
  route: AudioOutputRoute;
  isExternalOutputActive: boolean;
  label: string;
  unlockReason: string;
}

export function detectExternalAudioRoute(input: ExternalRouteInput): ExternalRouteResolution {
  if (input.btd700ModeActive) {
    return {
      route: 'BTD700_LOSSLESS',
      isExternalOutputActive: true,
      label: 'USB-C · BTD 700 Lossless',
      unlockReason: 'Sennheiser BTD 700 Mode active — lossless USB DSP path unlocked',
    };
  }
  if (input.selectedRoute === 'USB_AUDIO') {
    return {
      route: 'USB_AUDIO',
      isExternalOutputActive: true,
      label: 'USB-C Audio (BTD 700)',
      unlockReason: 'USB-C Audio device detected — Pro EQ & Volume Boost unlocked',
    };
  }
  if (input.selectedRoute === 'BLUETOOTH_A2DP') {
    return {
      route: 'BLUETOOTH_A2DP',
      isExternalOutputActive: true,
      label: 'Bluetooth Audio',
      unlockReason: 'Bluetooth A2DP / LE Audio active',
    };
  }
  if (input.controlLinkActive) {
    return {
      route: 'BOSE_CONTROL_LINK',
      isExternalOutputActive: true,
      label: 'Bose Control Link',
      unlockReason: 'Bose BMAP/BLE link active — Pro EQ & Volume Boost unlocked',
    };
  }
  return {
    route: 'PHONE_SPEAKER',
    isExternalOutputActive: false,
    label: 'Phone Speaker',
    unlockReason: 'Routing through internal phone speaker — Pro EQ paused',
  };
}

// ---- Two-Stage High-Headroom Volume Boost Plan ----
export const MBC_BAND_COUNT = 4;
export const SUB_BASS_CUTOFF_HZ = 55;

export interface TwoStageMbcBand {
  cutoffHz: number;
  attackMs: number;
  releaseMs: number;
  ratio: number;
  thresholdDb: number;
  kneeWidthDb: number;
  preGainDb: number;
  postGainDb: number;
}

export interface TwoStageLimiterPlan {
  enabled: boolean;
  thresholdDb: number;
  ratio: number;
  attackMs: number;
  releaseMs: number;
}

export interface TwoStageBoostPlan {
  boostDb: number;
  subBassPreGainDb: number;
  makeupGainDb: number;
  mbcBands: TwoStageMbcBand[];
  limiter: TwoStageLimiterPlan;
}

export function planTwoStageBoost(boostDb: number, limiterEnabled: boolean): TwoStageBoostPlan {
  const clamped = Math.max(0, Math.min(12, boostDb));
  const subTrim = clamped <= 0 ? 0 : -Math.min(4.5, (clamped / 12) * 4.5);
  const roundedTrim = Math.round(subTrim * 100) / 100;

  const mbcBands: TwoStageMbcBand[] = [
    {
      cutoffHz: SUB_BASS_CUTOFF_HZ,
      attackMs: 5,
      releaseMs: 80,
      ratio: 3.2,
      thresholdDb: -16,
      kneeWidthDb: 6,
      preGainDb: roundedTrim,
      postGainDb: 0,
    },
    {
      cutoffHz: 300,
      attackMs: 5,
      releaseMs: 80,
      ratio: 2.0,
      thresholdDb: -14,
      kneeWidthDb: 6,
      preGainDb: 0,
      postGainDb: clamped * 0.25,
    },
    {
      cutoffHz: 3500,
      attackMs: 5,
      releaseMs: 80,
      ratio: 1.6,
      thresholdDb: -12,
      kneeWidthDb: 6,
      preGainDb: 0,
      postGainDb: clamped * 0.35,
    },
    {
      cutoffHz: 20000,
      attackMs: 5,
      releaseMs: 80,
      ratio: 1.5,
      thresholdDb: -12,
      kneeWidthDb: 6,
      preGainDb: 0,
      postGainDb: clamped * 0.25,
    },
  ];

  return {
    boostDb: clamped,
    subBassPreGainDb: roundedTrim,
    makeupGainDb: clamped,
    mbcBands,
    limiter: {
      enabled: limiterEnabled,
      thresholdDb: -0.5,
      ratio: 10.0,
      attackMs: 1.5,
      releaseMs: 60,
    },
  };
}

// ---- BTD 700 Mode & ActiveSense Policy ----
export interface Btd700PolicyState {
  btd700ModeActive: boolean;
  activeSenseEnabled: boolean;
  currentModeIndex: number | null;
  noise: NoiseSettings | null;
}

export function applyBtd700ModeTransition(
  state: Btd700PolicyState,
  enabled: boolean,
): Btd700PolicyState {
  if (!enabled) {
    return { ...state, btd700ModeActive: false };
  }
  const spatial = state.noise?.spatialAudio ?? 'OFF';
  return {
    btd700ModeActive: true,
    activeSenseEnabled: false,
    currentModeIndex: 0, // Quiet
    noise: {
      cancellingLevel: 10,
      ancEnabled: true,
      windBlock: false,
      spatialAudio: spatial,
    },
  };
}

export function applyListeningModePolicy(
  state: Btd700PolicyState,
  modeIndex: number,
  modeName: string,
  modeNoise: NoiseSettings | null,
): Btd700PolicyState {
  const isQuiet = modeName.trim().toLowerCase() === 'quiet' || modeIndex === 0;
  const unlockBtd = !isQuiet && state.btd700ModeActive;
  return {
    btd700ModeActive: unlockBtd ? false : state.btd700ModeActive,
    activeSenseEnabled: isQuiet ? false : state.activeSenseEnabled,
    currentModeIndex: modeIndex,
    noise: modeNoise ? { ...modeNoise, windBlock: false } : state.noise,
  };
}
