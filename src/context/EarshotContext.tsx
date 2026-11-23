import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppearanceMode,
  AudioOutputRoute,
  AutomationLogEntry,
  AutomationRule,
  ButtonActionId,
  CallAudioState,
  CodecState,
  CodecType,
  CustomSound,
  EqBandMode,
  EqPreset,
  HeadphoneState,
  LabReading,
  ListeningMode,
  NightExtra,
  NoiseSettings,
  ParametricBand,
  SavedMix,
  Sidetone,
  SleepAlarm,
  SleepLayer,
  SleepNote,
  SleepPhase,
  SleepPlan,
  TabId,
  ThemePreference,
  TimelineEntry,
  TuningSettings,
} from '../types/earshot';
import { BUILT_IN_PRESETS, makeGraphicBands } from '../dsp/presets';
import {
  applyBtd700ModeTransition,
  applyListeningModePolicy,
  detectExternalAudioRoute,
  EQ_BAND_MODE_CONFIGS,
  ExternalRouteResolution,
  makeModeBands,
} from '../dsp/earmaxLogic';
import { buildDemoDeviceState, runMockLabScan } from '../data/virtualDevices';
import { sleepAudioEngine } from '../audio/sleepAudioEngine';
import { eqAudioEngine } from '../audio/eqAudioEngine';

export interface ActiveSleepSession {
  plan: SleepPlan;
  startedAtMillis: number;
  endsAtMillis: number;
  phase: SleepPhase;
  noiseOffAtMillis: number | null;
  noiseOffDone: boolean;
  headsetName: string | null;
  paused: boolean;
  remainingMsWhenPaused?: number;
}

export interface RingingAlarmState {
  alarm: SleepAlarm;
  startedAtMillis: number;
  phoneFallbackActive: boolean;
  phoneFallbackReason: string | null;
}

interface EarshotStorageSnapshot {
  version: number;
  appearance: AppearanceMode;
  themePreference: ThemePreference;
  demoModeEnabled: boolean;
  demoDeviceId: string;
  lowBatteryAlertPercent: number;
  customDeviceNames: Record<string, string>;
  btd700ModeActive: boolean;
  activeSenseEnabled: boolean;
  selectedAudioRoute: AudioOutputRoute;
  tuning: TuningSettings;
  customPresets: EqPreset[];
  headsetPresetMemory: Record<string, string>;
  sleepPlan: SleepPlan;
  alarms: SleepAlarm[];
  savedMixes: SavedMix[];
  customSounds: CustomSound[];
  codecState: CodecState;
  callAudio: CallAudioState;
  automations: AutomationRule[];
}

const STORAGE_KEY = 'earshot_web_state_v2';

const DEFAULT_BAND_MODE_GAINS: Record<EqBandMode, number[]> = {
  BAND_3: [0, 0, 0],
  BAND_4: [0, 0, 0, 0],
  BAND_5: [0, 0, 0, 0, 0],
  BAND_7: [0, 0, 0, 0, 0, 0, 0],
};

const DEFAULT_PRESET = BUILT_IN_PRESETS[1] ?? BUILT_IN_PRESETS[0];

const DEFAULT_TUNING: TuningSettings = {
  enabled: true,
  globalExperimental: false,
  activePresetId: DEFAULT_PRESET.id,
  bandMode: 'BAND_5',
  bandModeGains: DEFAULT_BAND_MODE_GAINS,
  bands: DEFAULT_PRESET.bands,
  preampDb: DEFAULT_PRESET.preampDb,
  boostDb: 0,
  limiterEnabled: true,
};

const DEFAULT_SLEEP_PLAN: SleepPlan = {
  durationMinutes: 120,
  layers: [{ soundId: 'rain', gain: 0.75 }],
  noiseOffAfterMinutes: 30,
  fadeOutMinutes: 10,
  endAction: 'STOP_SOUNDS',
  nightExtras: [],
  pauseOtherAudio: false,
  soundSide: 'BOTH',
  volume: 0.6,
  volumeCapPercent: 40,
};

const DEFAULT_ALARMS: SleepAlarm[] = [
  {
    id: 'alarm-default-1',
    hour: 7,
    minute: 0,
    days: [1, 2, 3, 4, 5],
    enabled: true,
    output: 'EARBUDS',
    toneId: 'chime',
    wakeWindowMinutes: 10,
    fadeInSeconds: 30,
    snoozeMinutes: 10,
    vibrate: true,
    label: 'Morning wake',
  },
];

const DEFAULT_SAVED_MIXES: SavedMix[] = [
  {
    id: 'mix-cabin',
    name: 'Cabin Rain & Fire',
    layers: [
      { soundId: 'rain', gain: 0.72 },
      { soundId: 'fire', gain: 0.48 },
    ],
  },
  {
    id: 'mix-surf',
    name: 'Deep Ocean Blanket',
    layers: [
      { soundId: 'ocean', gain: 0.8 },
      { soundId: 'brown_noise', gain: 0.35 },
    ],
  },
];

const DEFAULT_AUTOMATIONS: AutomationRule[] = [
  {
    id: 'auto-1',
    name: 'Commute Quiet Mode',
    enabled: true,
    triggerType: 'ON_CONNECT',
    triggerValue: 'Bose QC Ultra 2 HP',
    actionModeName: 'Quiet',
    actionAncEnabled: true,
    actionCancellingLevel: 10,
    actionEqPresetId: 'qc_ultra',
  },
  {
    id: 'auto-2',
    name: 'Evening Wind Down',
    enabled: false,
    triggerType: 'SCHEDULE',
    triggerValue: '22:30',
    actionModeName: 'Aware',
    actionEqPresetId: 'loudness',
  },
];

const DEFAULT_CODEC: CodecState = {
  activeCodec: 'AAC',
  sampleRateHz: 48000,
  bitsPerSample: 24,
  channelMode: 'Stereo',
  bitrateKbps: 256,
  supportedCodecs: ['SBC', 'AAC', 'aptX', 'aptX Adaptive', 'LDAC', 'LC3 (LE Audio)'],
  shizukuAvailable: false,
  streaming: true,
};

const DEFAULT_CALL_AUDIO: CallAudioState = {
  boostEnabled: false,
  boostGainDb: 4,
  callCodec: 'mSBC (Wideband 16 kHz)',
  widebandActive: true,
  autoBoostOnCall: false,
};

function loadInitialSnapshot(): Partial<EarshotStorageSnapshot> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<EarshotStorageSnapshot>;
  } catch {
    return {};
  }
}

interface EarshotContextValue {
  // Navigation
  activeTab: TabId;
  subRoute: string | null;
  navigateTab: (tab: TabId) => void;
  navigateSubRoute: (route: string | null) => void;
  goBack: () => void;

  // Appearance
  appearance: AppearanceMode;
  setAppearance: (a: AppearanceMode) => void;
  themePreference: ThemePreference;
  setThemePreference: (t: ThemePreference) => void;
  isDark: boolean;

  // Demo & Connection
  demoModeEnabled: boolean;
  setDemoModeEnabled: (enabled: boolean) => void;
  demoDeviceId: string;
  selectDemoDevice: (deviceId: string) => void;
  headphone: HeadphoneState;
  connectHeadset: () => void;
  disconnectHeadset: () => void;
  refreshHeadset: () => void;
  customDeviceNames: Record<string, string>;
  renameHeadset: (newName: string) => void;
  forgetDevice: (address: string) => void;
  lowBatteryAlertPercent: number;
  setLowBatteryAlertPercent: (pct: number) => void;

  // Headphone Controls
  selectMode: (modeIndex: number) => void;
  toggleModeFavorite: (modeIndex: number) => void;
  saveModeConfig: (modeIndex: number, name: string, settings: NoiseSettings) => void;
  updateNoiseSettings: (patch: Partial<NoiseSettings>) => void;
  btd700ModeActive: boolean;
  setBtd700Mode: (enabled: boolean) => void;
  setActiveSense: (enabled: boolean) => void;
  selectedAudioRoute: AudioOutputRoute;
  setSelectedAudioRoute: (route: AudioOutputRoute) => void;
  externalOutput: ExternalRouteResolution;
  togglePlayback: () => void;
  stepTrack: (dir: 'next' | 'prev') => void;
  setVolume: (vol: number) => void;
  setHeadphoneEq: (bass: number, mid: number, treble: number) => void;
  setCrusher: (patch: Partial<NonNullable<HeadphoneState['crusher']>>) => void;
  setVendorControl: (id: string, value: number) => void;
  setSidetone: (s: Sidetone) => void;
  setSidetonePersistent: (v: boolean) => void;
  setMultipoint: (v: boolean) => void;
  setTouchControls: (v: boolean) => void;
  setVoicePrompts: (v: boolean) => void;
  setAutoPlayPause: (v: boolean) => void;
  setAutoAnswer: (v: boolean) => void;
  setAutoOffMinutes: (mins: number) => void;
  setLeAudioEnabled: (v: boolean) => void;
  switchActivePairedDevice: (address: string) => void;
  setButtonAction: (buttonId: number, action: ButtonActionId) => void;
  simulateDemoButtonPress: (kind: 'play_pause' | 'vol_up' | 'vol_down' | 'main') => void;
  answerPairing: (accept: boolean) => void;

  // Sound / Pro EQ
  tuning: TuningSettings;
  setTuningEnabled: (enabled: boolean) => void;
  setGlobalExperimental: (enabled: boolean) => void;
  setBandMode: (mode: EqBandMode) => void;
  setBandModeGain: (bandIndex: number, gainDb: number) => void;
  allPresets: EqPreset[];
  customPresets: EqPreset[];
  selectPreset: (presetId: string) => void;
  updateGraphicBandGain: (index: number, gainDb: number) => void;
  updateParametricBands: (bands: ParametricBand[], preampDb?: number) => void;
  setEqPreamp: (db: number) => void;
  setEqBoost: (db: number) => void;
  setEqLimiter: (enabled: boolean) => void;
  saveCustomPreset: (name: string) => void;
  deleteCustomPreset: (id: string) => void;
  importAutoEqPreset: (name: string, text: string) => void;
  eqPlaying: boolean;
  toggleEqPlayback: () => void;
  eqTrackLabel: string;
  loadEqAudioFile: (file: File) => Promise<void>;

  // Sleep
  sleepPlan: SleepPlan;
  updateSleepPlan: (patch: Partial<SleepPlan>) => void;
  toggleNightExtra: (extra: NightExtra) => void;
  toggleSleepLayer: (soundId: string) => void;
  setSleepLayerGain: (soundId: string, gain: number) => void;
  sleepSession: ActiveSleepSession | null;
  startSleepSession: () => void;
  pauseOrResumeSleepSession: () => void;
  extendSleepSession: (extraMinutes: number) => void;
  stopSleepSession: () => void;
  sleepPreviewingId: string | null;
  togglePreviewSound: (soundId: string) => void;
  alarms: SleepAlarm[];
  upsertAlarm: (alarm: SleepAlarm) => void;
  toggleAlarmEnabled: (id: string) => void;
  deleteAlarm: (id: string) => void;
  ringingAlarm: RingingAlarmState | null;
  triggerTestAlarm: (alarm?: SleepAlarm) => void;
  snoozeRingingAlarm: () => void;
  dismissRingingAlarm: () => void;
  savedMixes: SavedMix[];
  saveCurrentMix: (name: string) => void;
  loadMix: (mix: SavedMix) => void;
  deleteMix: (id: string) => void;
  customSounds: CustomSound[];
  addCustomSound: (file: File) => Promise<void>;
  deleteCustomSound: (id: string) => void;
  sleepLog: SleepNote[];

  // Tools
  codecState: CodecState;
  setPreferredCodec: (codec: CodecType) => void;
  toggleShizukuMode: () => void;
  callAudio: CallAudioState;
  updateCallAudio: (patch: Partial<CallAudioState>) => void;
  labReadings: LabReading[];
  labPrintConsole: string[];
  labScanning: boolean;
  runLabScan: (groupIds: number[], deep: boolean) => void;
  timeline: TimelineEntry[];
  clearTimeline: () => void;
  copyConnectionReport: () => Promise<string>;

  // Automations
  automations: AutomationRule[];
  automationLog: AutomationLogEntry[];
  upsertAutomation: (rule: AutomationRule) => void;
  toggleAutomation: (id: string) => void;
  deleteAutomation: (id: string) => void;
  runAutomationNow: (id: string) => void;

  // Backup & Restore
  exportBackupJson: () => string;
  importBackupJson: (jsonText: string) => { restoredItems: string[] };
  resetAllData: () => void;

  // Toast Messenger
  toastMessage: string | null;
  showToast: (msg: string) => void;

  // Device Switcher Modal
  deviceSwitcherOpen: boolean;
  setDeviceSwitcherOpen: (open: boolean) => void;
}

const EarshotContext = createContext<EarshotContextValue | null>(null);

export const EarshotProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initial = useMemo(() => loadInitialSnapshot(), []);

  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [subRoute, setSubRoute] = useState<string | null>(null);

  const [appearance, setAppearance] = useState<AppearanceMode>(initial.appearance ?? 'field');
  const [themePreference, setThemePreference] = useState<ThemePreference>(initial.themePreference ?? 'light');
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : false,
  );

  const [demoModeEnabled, setDemoModeEnabled] = useState<boolean>(initial.demoModeEnabled ?? true);
  const [demoDeviceId, setDemoDeviceId] = useState<string>(initial.demoDeviceId ?? 'qc_ultra_earbuds_2');
  const [lowBatteryAlertPercent, setLowBatteryAlertPercent] = useState<number>(initial.lowBatteryAlertPercent ?? 15);
  const [customDeviceNames, setCustomDeviceNames] = useState<Record<string, string>>(initial.customDeviceNames ?? {});

  const [btd700ModeActive, setBtd700ModeActive] = useState<boolean>(initial.btd700ModeActive ?? false);
  const [activeSenseEnabled, setActiveSenseEnabled] = useState<boolean>(initial.activeSenseEnabled ?? false);
  const [selectedAudioRoute, setSelectedAudioRoute] = useState<AudioOutputRoute>(
    initial.selectedAudioRoute ?? 'BLUETOOTH_A2DP',
  );

  const [headphone, setHeadphone] = useState<HeadphoneState>(() => {
    const base = buildDemoDeviceState(initial.demoDeviceId ?? 'qc_ultra_earbuds_2');
    const customName = initial.customDeviceNames?.[base.deviceId];
    const withName = customName ? { ...base, info: { ...base.info, customName } } : base;
    if (initial.btd700ModeActive) {
      const updated = applyBtd700ModeTransition(
        {
          btd700ModeActive: false,
          activeSenseEnabled: withName.activeSenseEnabled ?? false,
          currentModeIndex: withName.currentModeIndex,
          noise: withName.noise,
        },
        true,
      );
      return {
        ...withName,
        currentModeIndex: updated.currentModeIndex,
        noise: updated.noise,
        activeSenseEnabled: updated.activeSenseEnabled,
      };
    }
    return {
      ...withName,
      activeSenseEnabled: initial.activeSenseEnabled ?? withName.activeSenseEnabled ?? false,
    };
  });

  const [tuning, setTuning] = useState<TuningSettings>(() => ({
    ...DEFAULT_TUNING,
    ...(initial.tuning ?? {}),
    bandMode: initial.tuning?.bandMode ?? DEFAULT_TUNING.bandMode,
    bandModeGains: {
      ...DEFAULT_BAND_MODE_GAINS,
      ...(initial.tuning?.bandModeGains ?? {}),
    },
  }));
  const [customPresets, setCustomPresets] = useState<EqPreset[]>(initial.customPresets ?? []);
  const [headsetPresetMemory, setHeadsetPresetMemory] = useState<Record<string, string>>(initial.headsetPresetMemory ?? {});
  const [eqPlaying, setEqPlaying] = useState(false);
  const [eqTrackLabel, setEqTrackLabel] = useState('Earshot Reference Synth Loop');

  const [sleepPlan, setSleepPlan] = useState<SleepPlan>(initial.sleepPlan ?? DEFAULT_SLEEP_PLAN);
  const [alarms, setAlarms] = useState<SleepAlarm[]>(initial.alarms ?? DEFAULT_ALARMS);
  const [savedMixes, setSavedMixes] = useState<SavedMix[]>(initial.savedMixes ?? DEFAULT_SAVED_MIXES);
  const [customSounds, setCustomSounds] = useState<CustomSound[]>(initial.customSounds ?? []);
  const [sleepSession, setSleepSession] = useState<ActiveSleepSession | null>(null);
  const [sleepPreviewingId, setSleepPreviewingId] = useState<string | null>(null);
  const [sleepLog, setSleepLog] = useState<SleepNote[]>([]);
  const [ringingAlarm, setRingingAlarm] = useState<RingingAlarmState | null>(null);

  const [codecState, setCodecState] = useState<CodecState>(initial.codecState ?? DEFAULT_CODEC);
  const [callAudio, setCallAudio] = useState<CallAudioState>(initial.callAudio ?? DEFAULT_CALL_AUDIO);
  const [labReadings, setLabReadings] = useState<LabReading[]>([]);
  const [labPrintConsole, setLabPrintConsole] = useState<string[]>([
    '[0.1] bmap: ready (1.2.0)',
    '[9.2] live notifications subscribed',
  ]);
  const [labScanning, setLabScanning] = useState(false);

  const [timeline, setTimeline] = useState<TimelineEntry[]>([
    {
      id: 'tl-init-1',
      atMillis: Date.now() - 180000,
      deviceName: headphone.info.customName,
      event: 'Control channel open',
      detail: `${headphone.info.protocolVersion ?? 'Control'} link established`,
      level: 'ok',
    },
    {
      id: 'tl-init-2',
      atMillis: Date.now() - 179000,
      deviceName: headphone.info.customName,
      event: 'Live push enabled',
      detail: 'Subscribed to battery, mode, volume, and button pushes',
      level: 'info',
    },
  ]);

  const [automations, setAutomations] = useState<AutomationRule[]>(initial.automations ?? DEFAULT_AUTOMATIONS);
  const [automationLog, setAutomationLog] = useState<AutomationLogEntry[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [deviceSwitcherOpen, setDeviceSwitcherOpen] = useState(false);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 3200);
  }, []);

  const pushTimeline = useCallback((deviceName: string, event: string, detail: string, level: TimelineEntry['level'] = 'info') => {
    setTimeline((prev) => [{ id: `tl-${Date.now()}-${Math.random()}`, atMillis: Date.now(), deviceName, event, detail, level }, ...prev].slice(0, 60));
  }, []);

  const pushSleepNote = useCallback((text: string, isProblem = false) => {
    setSleepLog((prev) => [...prev, { atMillis: Date.now(), text, isProblem }].slice(-40));
  }, []);

  // Listen to OS dark mode
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const isDark = themePreference === 'dark' || (themePreference === 'system' && systemDark);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add('dark');
    else root.classList.remove('dark');
    root.setAttribute('data-appearance', appearance);
  }, [isDark, appearance]);

  // Persist snapshot
  useEffect(() => {
    try {
      const snap: EarshotStorageSnapshot = {
        version: 2,
        appearance,
        themePreference,
        demoModeEnabled,
        demoDeviceId,
        lowBatteryAlertPercent,
        customDeviceNames,
        btd700ModeActive,
        activeSenseEnabled,
        selectedAudioRoute,
        tuning,
        customPresets,
        headsetPresetMemory,
        sleepPlan,
        alarms,
        savedMixes,
        customSounds: customSounds.map((s) => ({ id: s.id, name: s.name, loopSeconds: s.loopSeconds })),
        codecState,
        callAudio,
        automations,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
    } catch {
      // ignore storage quota
    }
  }, [
    appearance,
    themePreference,
    demoModeEnabled,
    demoDeviceId,
    lowBatteryAlertPercent,
    customDeviceNames,
    btd700ModeActive,
    activeSenseEnabled,
    selectedAudioRoute,
    tuning,
    customPresets,
    headsetPresetMemory,
    sleepPlan,
    alarms,
    savedMixes,
    customSounds,
    codecState,
    callAudio,
    automations,
  ]);

  // Sync live EQ audio engine whenever tuning changes
  useEffect(() => {
    if (eqPlaying) {
      eqAudioEngine.rebuildChain(tuning);
    }
  }, [tuning, eqPlaying]);

  // Sleep session tick (timer countdown, noise-off action, fade-out, end-of-timer)
  useEffect(() => {
    if (!sleepSession || sleepSession.paused) return;
    const interval = window.setInterval(() => {
      const now = Date.now();
      setSleepSession((curr) => {
        if (!curr || curr.paused) return curr;

        // Check noise off schedule
        if (curr.noiseOffAtMillis !== null && !curr.noiseOffDone && now >= curr.noiseOffAtMillis) {
          setHeadphone((hp) =>
            hp.noise
              ? { ...hp, noise: { ...hp.noise, ancEnabled: false }, lastUpdatedMillis: now }
              : hp,
          );
          pushSleepNote('Switched noise cancelling off as scheduled');
          return { ...curr, noiseOffDone: true };
        }

        // Check end of sleep timer
        if (now >= curr.endsAtMillis) {
          sleepAudioEngine.stopSoundscape();
          if (curr.plan.endAction === 'DISCONNECT') {
            setHeadphone((hp) => ({ ...hp, status: 'DISCONNECTED', audioLinked: false, lastUpdatedMillis: now }));
            pushSleepNote('Timer finished — sounds stopped and headset disconnected');
          } else if (curr.plan.endAction === 'POWER_OFF') {
            setHeadphone((hp) => ({ ...hp, status: 'DISCONNECTED', audioLinked: false, lastUpdatedMillis: now }));
            pushSleepNote('Timer finished — sounds stopped and power-off sent');
          } else {
            pushSleepNote('Timer finished — sounds faded out; headset stayed connected for alarms');
          }
          return null;
        }

        const fadeStart = curr.endsAtMillis - curr.plan.fadeOutMinutes * 60_000;
        if (curr.plan.layers.length === 0) {
          return curr.phase === 'TIMER_ONLY' ? curr : { ...curr, phase: 'TIMER_ONLY' };
        }
        if (now >= fadeStart && curr.phase !== 'FADING_OUT') {
          const remainingRatio = Math.max(0.05, (curr.endsAtMillis - now) / (curr.plan.fadeOutMinutes * 60_000));
          sleepAudioEngine.updateSoundscapeVolume(curr.plan.volume * remainingRatio, curr.plan.soundSide);
          return { ...curr, phase: 'FADING_OUT' };
        }
        if (curr.phase === 'FADING_OUT') {
          const remainingRatio = Math.max(0.02, (curr.endsAtMillis - now) / Math.max(1, curr.plan.fadeOutMinutes * 60_000));
          sleepAudioEngine.updateSoundscapeVolume(curr.plan.volume * remainingRatio, curr.plan.soundSide);
        }
        return curr;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [sleepSession, pushSleepNote]);

  // Phone fallback escalation timer when alarm rings on EARBUDS
  useEffect(() => {
    if (!ringingAlarm || ringingAlarm.phoneFallbackActive || ringingAlarm.alarm.output !== 'EARBUDS') return;
    const timer = window.setTimeout(() => {
      setRingingAlarm((curr) =>
        curr
          ? {
              ...curr,
              phoneFallbackActive: true,
              phoneFallbackReason: 'Escalated to phone speaker after 60 s without dismissal',
            }
          : null,
      );
    }, 60_000);
    return () => window.clearTimeout(timer);
  }, [ringingAlarm]);

  const navigateTab = useCallback((tab: TabId) => {
    setActiveTab(tab);
    setSubRoute(null);
  }, []);

  const navigateSubRoute = useCallback((route: string | null) => {
    setSubRoute(route);
  }, []);

  const goBack = useCallback(() => {
    if (subRoute) {
      if (subRoute === 'more/automations/edit') setSubRoute('more/automations');
      else setSubRoute(null);
    }
  }, [subRoute]);

  const allPresets = useMemo(() => [...BUILT_IN_PRESETS, ...customPresets], [customPresets]);

  const applyPresetById = useCallback(
    (presetId: string) => {
      const preset = allPresets.find((p) => p.id === presetId);
      if (!preset) return;
      setTuning((prev) => ({
        ...prev,
        activePresetId: preset.id,
        bands: preset.bands.map((b) => ({ ...b })),
        preampDb: preset.preampDb,
      }));
    },
    [allPresets],
  );

  const selectDemoDevice = useCallback(
    (deviceId: string) => {
      setDemoDeviceId(deviceId);
      const next = buildDemoDeviceState(deviceId);
      const customName = customDeviceNames[deviceId];
      const finalState = customName ? { ...next, info: { ...next.info, customName } } : next;
      setHeadphone(finalState);
      setLabReadings([]);
      setLabPrintConsole([
        `[0.1] ${finalState.info.protocolVersion ?? 'Stack'}: ready`,
        `[9.2] ${finalState.info.customName} connected`,
      ]);
      pushTimeline(finalState.info.customName, 'Demo headset switched', finalState.info.modelName, 'ok');

      const rememberedPreset = headsetPresetMemory[deviceId];
      if (rememberedPreset) {
        applyPresetById(rememberedPreset);
      }

      // Evaluate ON_CONNECT automations
      automations
        .filter((r) => r.enabled && r.triggerType === 'ON_CONNECT')
        .forEach((rule) => {
          setAutomationLog((prev) => [
            { atMillis: Date.now(), ruleName: rule.name, outcome: `Applied on connect (${finalState.info.customName})` },
            ...prev.slice(0, 29),
          ]);
        });

      showToast(`Switched to ${finalState.info.modelName}`);
    },
    [customDeviceNames, headsetPresetMemory, applyPresetById, automations, pushTimeline, showToast],
  );

  const connectHeadset = useCallback(() => {
    setHeadphone((hp) => ({ ...hp, status: 'CONNECTING' }));
    window.setTimeout(() => {
      setHeadphone((hp) => ({
        ...hp,
        status: 'CONNECTED',
        audioLinked: true,
        lastUpdatedMillis: Date.now(),
      }));
      pushTimeline(headphone.info.customName, 'Connected', `${headphone.info.modelName} link restored`, 'ok');
      showToast(`Connected to ${headphone.info.customName}`);
    }, 350);
  }, [headphone.info.customName, headphone.info.modelName, pushTimeline, showToast]);

  const disconnectHeadset = useCallback(() => {
    setHeadphone((hp) => ({
      ...hp,
      status: 'DISCONNECTED',
      audioLinked: false,
      lastUpdatedMillis: Date.now(),
    }));
    pushTimeline(headphone.info.customName, 'Disconnected', 'Control & audio links closed', 'warn');
    showToast('Headset disconnected');
  }, [headphone.info.customName, pushTimeline, showToast]);

  const refreshHeadset = useCallback(() => {
    setHeadphone((hp) => ({ ...hp, lastUpdatedMillis: Date.now() }));
    showToast('Refreshed headset state');
  }, [showToast]);

  const renameHeadset = useCallback(
    (newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed) return;
      setCustomDeviceNames((prev) => ({ ...prev, [headphone.deviceId]: trimmed }));
      setHeadphone((hp) => ({
        ...hp,
        info: { ...hp.info, customName: trimmed },
        lastUpdatedMillis: Date.now(),
      }));
      showToast(`Renamed to ${trimmed}`);
    },
    [headphone.deviceId, showToast],
  );

  const forgetDevice = useCallback(
    (address: string) => {
      setHeadphone((hp) => ({
        ...hp,
        pairedDevices: hp.pairedDevices.filter((d) => d.address !== address),
      }));
      showToast('Device removed from paired list');
    },
    [showToast],
  );

  const externalOutput = useMemo(
    () =>
      detectExternalAudioRoute({
        selectedRoute: selectedAudioRoute,
        btd700ModeActive,
        controlLinkActive: headphone.status === 'CONNECTED',
      }),
    [selectedAudioRoute, btd700ModeActive, headphone.status],
  );

  const selectMode = useCallback((modeIndex: number) => {
    setHeadphone((hp) => {
      const mode = hp.modes.find((m) => m.index === modeIndex);
      if (!mode) return hp;
      const updated = applyListeningModePolicy(
        {
          btd700ModeActive,
          activeSenseEnabled: hp.activeSenseEnabled ?? false,
          currentModeIndex: hp.currentModeIndex,
          noise: hp.noise,
        },
        modeIndex,
        mode.name,
        mode.settings,
      );
      setBtd700ModeActive(updated.btd700ModeActive);
      setActiveSenseEnabled(updated.activeSenseEnabled);
      return {
        ...hp,
        currentModeIndex: updated.currentModeIndex,
        noise: updated.noise,
        activeSenseEnabled: updated.activeSenseEnabled,
        lastUpdatedMillis: Date.now(),
      };
    });
  }, [btd700ModeActive]);

  const setBtd700Mode = useCallback(
    (enabled: boolean) => {
      setBtd700ModeActive(enabled);
      if (enabled) {
        setTuning((prev) => ({ ...prev, enabled: true }));
        setCodecState((c) => ({ ...c, activeCodec: 'aptX Adaptive', sampleRateHz: 96000, bitsPerSample: 24, bitrateKbps: 420 }));
      }
      setHeadphone((hp) => {
        const updated = applyBtd700ModeTransition(
          {
            btd700ModeActive: enabled,
            activeSenseEnabled: hp.activeSenseEnabled ?? false,
            currentModeIndex: hp.currentModeIndex,
            noise: hp.noise,
          },
          enabled,
        );
        setActiveSenseEnabled(updated.activeSenseEnabled);
        return {
          ...hp,
          currentModeIndex: updated.currentModeIndex,
          noise: updated.noise,
          activeSenseEnabled: updated.activeSenseEnabled,
          lastUpdatedMillis: Date.now(),
        };
      });
      pushTimeline(
        headphone.info.customName,
        enabled ? 'BTD 700 Mode engaged' : 'BTD 700 Mode released',
        enabled ? 'USB lossless DSP unlocked · Quiet ANC locked to 10 · ActiveSense OFF' : 'Noise Cancelling slider unlocked',
        'ok',
      );
      showToast(
        enabled
          ? 'BTD 700 Mode ON — Quiet ANC locked & ActiveSense OFF'
          : 'BTD 700 Mode OFF — NC slider unlocked',
      );
    },
    [headphone.info.customName, pushTimeline, showToast],
  );

  const setActiveSense = useCallback(
    (enabled: boolean) => {
      if (btd700ModeActive && enabled) {
        showToast('ActiveSense stays OFF while BTD 700 Mode is active');
        return;
      }
      setActiveSenseEnabled(enabled);
      setHeadphone((hp) => ({
        ...hp,
        activeSenseEnabled: enabled,
        lastUpdatedMillis: Date.now(),
      }));
      showToast(enabled ? 'ActiveSense ON' : 'ActiveSense OFF');
    },
    [btd700ModeActive, showToast],
  );

  const toggleModeFavorite = useCallback(
    (modeIndex: number) => {
      setHeadphone((hp) => {
        const target = hp.modes.find((m) => m.index === modeIndex);
        if (!target) return hp;
        const nextFav = !target.isFavorite;
        showToast(nextFav ? `Starred ${target.name}` : `Removed ${target.name} from favourites`);
        return {
          ...hp,
          modes: hp.modes.map((m) => (m.index === modeIndex ? { ...m, isFavorite: nextFav } : m)),
        };
      });
    },
    [showToast],
  );

  const saveModeConfig = useCallback(
    (modeIndex: number, name: string, settings: NoiseSettings) => {
      setHeadphone((hp) => {
        const exists = hp.modes.some((m) => m.index === modeIndex);
        const updatedModes: ListeningMode[] = exists
          ? hp.modes.map((m) => (m.index === modeIndex ? { ...m, name, settings, isConfigured: true } : m))
          : [
              ...hp.modes,
              {
                index: modeIndex,
                name,
                isPreset: false,
                isEditable: true,
                isConfigured: true,
                isFavorite: false,
                settings,
              },
            ];
        return {
          ...hp,
          modes: updatedModes,
          noise: hp.currentModeIndex === modeIndex ? settings : hp.noise,
          lastUpdatedMillis: Date.now(),
        };
      });
      showToast(`Saved mode "${name}"`);
    },
    [showToast],
  );

  const updateNoiseSettings = useCallback(
    (patch: Partial<NoiseSettings>) => {
      setHeadphone((hp) => {
        if (!hp.noise) return hp;
        const next: NoiseSettings = {
          ...hp.noise,
          ...patch,
          ...(btd700ModeActive ? { cancellingLevel: 10, ancEnabled: true } : {}),
        };
        return {
          ...hp,
          noise: next,
          modes: hp.modes.map((m) => (m.index === hp.currentModeIndex ? { ...m, settings: next } : m)),
          lastUpdatedMillis: Date.now(),
        };
      });
    },
    [btd700ModeActive],
  );

  const togglePlayback = useCallback(() => {
    setHeadphone((hp) => ({
      ...hp,
      playbackState: hp.playbackState === 'PLAYING' ? 'PAUSED' : 'PLAYING',
      lastUpdatedMillis: Date.now(),
    }));
  }, []);

  const stepTrack = useCallback(
    (dir: 'next' | 'prev') => {
      setHeadphone((hp) => ({ ...hp, playbackState: 'PLAYING', lastUpdatedMillis: Date.now() }));
      showToast(dir === 'next' ? 'Skipped to next track' : 'Previous track');
    },
    [showToast],
  );

  const setVolume = useCallback((vol: number) => {
    setHeadphone((hp) => ({
      ...hp,
      volume: Math.max(0, Math.min(hp.volumeMax, vol)),
      lastUpdatedMillis: Date.now(),
    }));
  }, []);

  const setHeadphoneEq = useCallback((bass: number, mid: number, treble: number) => {
    setHeadphone((hp) => ({
      ...hp,
      eq: { bass, mid, treble },
      lastUpdatedMillis: Date.now(),
    }));
  }, []);

  const setCrusher = useCallback((patch: Partial<NonNullable<HeadphoneState['crusher']>>) => {
    setHeadphone((hp) => {
      if (!hp.crusher) return hp;
      return {
        ...hp,
        crusher: { ...hp.crusher, ...patch },
        lastUpdatedMillis: Date.now(),
      };
    });
  }, []);

  const setVendorControl = useCallback((id: string, value: number) => {
    setHeadphone((hp) => ({
      ...hp,
      vendorControls: hp.vendorControls.map((vc) => (vc.id === id ? { ...vc, value } : vc)),
      lastUpdatedMillis: Date.now(),
    }));
  }, []);

  const setSidetone = useCallback((sidetone: Sidetone) => {
    setHeadphone((hp) => ({ ...hp, sidetone, lastUpdatedMillis: Date.now() }));
  }, []);

  const setSidetonePersistent = useCallback((sidetonePersistent: boolean) => {
    setHeadphone((hp) => ({ ...hp, sidetonePersistent, lastUpdatedMillis: Date.now() }));
  }, []);

  const setMultipoint = useCallback((multipointEnabled: boolean) => {
    setHeadphone((hp) => ({ ...hp, multipointEnabled, lastUpdatedMillis: Date.now() }));
  }, []);

  const setTouchControls = useCallback((touchControlsEnabled: boolean) => {
    setHeadphone((hp) => ({ ...hp, touchControlsEnabled, lastUpdatedMillis: Date.now() }));
  }, []);

  const setVoicePrompts = useCallback((voicePromptsEnabled: boolean) => {
    setHeadphone((hp) => ({ ...hp, voicePromptsEnabled, lastUpdatedMillis: Date.now() }));
  }, []);

  const setAutoPlayPause = useCallback((autoPlayPause: boolean) => {
    setHeadphone((hp) => ({ ...hp, autoPlayPause, lastUpdatedMillis: Date.now() }));
  }, []);

  const setAutoAnswer = useCallback((autoAnswer: boolean) => {
    setHeadphone((hp) => ({ ...hp, autoAnswer, lastUpdatedMillis: Date.now() }));
  }, []);

  const setAutoOffMinutes = useCallback((autoOffMinutes: number) => {
    setHeadphone((hp) => ({ ...hp, autoOffMinutes, lastUpdatedMillis: Date.now() }));
  }, []);

  const setLeAudioEnabled = useCallback(
    (leAudioEnabled: boolean) => {
      setHeadphone((hp) => ({ ...hp, leAudioEnabled, lastUpdatedMillis: Date.now() }));
      if (leAudioEnabled) {
        setCodecState((c) => ({ ...c, activeCodec: 'LC3 (LE Audio)', bitrateKbps: 160 }));
      } else {
        setCodecState((c) => ({ ...c, activeCodec: 'AAC', bitrateKbps: 256 }));
      }
      showToast(leAudioEnabled ? 'LE Audio enabled (LC3)' : 'Switched back to Classic Bluetooth');
    },
    [showToast],
  );

  const switchActivePairedDevice = useCallback(
    (address: string) => {
      setHeadphone((hp) => ({
        ...hp,
        pairedDevices: hp.pairedDevices.map((d) => ({ ...d, isActiveSource: d.address === address })),
        lastUpdatedMillis: Date.now(),
      }));
      showToast('Switched active audio source');
    },
    [showToast],
  );

  const setButtonAction = useCallback(
    (buttonId: number, action: ButtonActionId) => {
      setHeadphone((hp) => ({
        ...hp,
        shortcutButtons: hp.shortcutButtons.map((b) => (b.buttonId === buttonId ? { ...b, action } : b)),
        lastUpdatedMillis: Date.now(),
      }));
      showToast('Updated headset button action');
    },
    [showToast],
  );

  const simulateDemoButtonPress = useCallback(
    (kind: 'play_pause' | 'vol_up' | 'vol_down' | 'main') => {
      setHeadphone((hp) => {
        if (kind === 'play_pause') {
          return {
            ...hp,
            playbackState: hp.playbackState === 'PLAYING' ? 'PAUSED' : 'PLAYING',
            lastButtonPress: {
              buttonLabel: 'Multifunction / Touch',
              eventLabel: 'Single tap',
              action: 'PLAY_PAUSE',
              atMillis: Date.now(),
            },
          };
        }
        if (kind === 'vol_up' || kind === 'vol_down') {
          const delta = kind === 'vol_up' ? 2 : -2;
          return {
            ...hp,
            volume: Math.max(0, Math.min(hp.volumeMax, hp.volume + delta)),
            lastButtonPress: {
              buttonLabel: 'Touch strip',
              eventLabel: kind === 'vol_up' ? 'Swipe up' : 'Swipe down',
              action: 'NOT_CONFIGURED',
              atMillis: Date.now(),
            },
          };
        }
        const primary = hp.shortcutButtons[0];
        return {
          ...hp,
          lastButtonPress: {
            buttonLabel: primary?.buttonLabel ?? 'Shortcut Button 1',
            eventLabel: primary?.eventLabel ?? 'Long press',
            action: primary?.action ?? 'MODES_CAROUSEL',
            atMillis: Date.now(),
          },
        };
      });
    },
    [],
  );

  const answerPairing = useCallback(
    (accept: boolean) => {
      setHeadphone((hp) => ({ ...hp, pairing: null }));
      showToast(accept ? 'Secure session paired & encrypted' : 'Pairing cancelled');
    },
    [showToast],
  );

  // ---- Sound / EQ ----
  const setTuningEnabled = useCallback((enabled: boolean) => {
    setTuning((t) => ({ ...t, enabled }));
  }, []);

  const setGlobalExperimental = useCallback((globalExperimental: boolean) => {
    setTuning((t) => ({ ...t, globalExperimental }));
  }, []);

  const selectPreset = useCallback(
    (presetId: string) => {
      applyPresetById(presetId);
      setHeadsetPresetMemory((prev) => ({ ...prev, [headphone.deviceId]: presetId }));
    },
    [applyPresetById, headphone.deviceId],
  );

  const setBandMode = useCallback((bandMode: EqBandMode) => {
    setTuning((prev) => {
      const specs = EQ_BAND_MODE_CONFIGS[bandMode].bands;
      const existing = prev.bandModeGains[bandMode];
      const gains = existing && existing.length === specs.length ? existing : specs.map(() => 0);
      return {
        ...prev,
        activePresetId: null,
        bandMode,
        bandModeGains: { ...prev.bandModeGains, [bandMode]: gains },
        bands: makeModeBands(bandMode, gains),
      };
    });
  }, []);

  const setBandModeGain = useCallback((bandIndex: number, gainDb: number) => {
    setTuning((prev) => {
      const mode = prev.bandMode;
      const specs = EQ_BAND_MODE_CONFIGS[mode].bands;
      const baseGains =
        prev.bandModeGains[mode]?.length === specs.length
          ? [...prev.bandModeGains[mode]]
          : specs.map((_, i) => prev.bands[i]?.gainDb ?? 0);
      baseGains[bandIndex] = Math.max(-15, Math.min(15, gainDb));
      return {
        ...prev,
        activePresetId: null,
        bandModeGains: { ...prev.bandModeGains, [mode]: baseGains },
        bands: makeModeBands(mode, baseGains),
      };
    });
  }, []);

  const updateGraphicBandGain = useCallback((index: number, gainDb: number) => {
    setTuning((prev) => {
      const isGraphic = prev.bands.length === 10 && prev.bands[0].frequencyHz === 31;
      const baseBands = isGraphic ? prev.bands : makeGraphicBands(Array(10).fill(0));
      const nextBands = baseBands.map((b, i) => (i === index ? { ...b, gainDb } : b));
      return { ...prev, activePresetId: null, bands: nextBands };
    });
  }, []);

  const updateParametricBands = useCallback((bands: ParametricBand[], preampDb?: number) => {
    setTuning((prev) => ({
      ...prev,
      activePresetId: null,
      bands,
      preampDb: preampDb !== undefined ? preampDb : prev.preampDb,
    }));
  }, []);

  const setEqPreamp = useCallback((preampDb: number) => {
    setTuning((prev) => ({ ...prev, activePresetId: null, preampDb }));
  }, []);

  const setEqBoost = useCallback((boostDb: number) => {
    setTuning((prev) => ({ ...prev, boostDb }));
  }, []);

  const setEqLimiter = useCallback((limiterEnabled: boolean) => {
    setTuning((prev) => ({ ...prev, limiterEnabled }));
  }, []);

  const saveCustomPreset = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const newPreset: EqPreset = {
        id: `custom-${Date.now()}`,
        name: trimmed,
        bands: tuning.bands.map((b) => ({ ...b })),
        preampDb: tuning.preampDb,
        isBuiltIn: false,
      };
      setCustomPresets((prev) => [...prev, newPreset]);
      setTuning((prev) => ({ ...prev, activePresetId: newPreset.id }));
      showToast(`Saved preset "${trimmed}"`);
    },
    [tuning.bands, tuning.preampDb, showToast],
  );

  const deleteCustomPreset = useCallback(
    (id: string) => {
      setCustomPresets((prev) => prev.filter((p) => p.id !== id));
      setTuning((prev) => (prev.activePresetId === id ? { ...prev, activePresetId: null } : prev));
      showToast('Deleted custom preset');
    },
    [showToast],
  );

  const importAutoEqPreset = useCallback(
    (name: string, text: string) => {
      const id = `autoeq-${Date.now()}`;
      import('../dsp/presets').then(({ parseAutoEqText }) => {
        const parsed = parseAutoEqText(text, id, name.trim() || 'Imported AutoEq');
        setCustomPresets((prev) => [...prev, parsed]);
        setTuning((prev) => ({
          ...prev,
          activePresetId: parsed.id,
          bands: parsed.bands,
          preampDb: parsed.preampDb,
        }));
        showToast(`Imported "${parsed.name}" (${parsed.bands.length} bands)`);
      });
    },
    [showToast],
  );

  const toggleEqPlayback = useCallback(() => {
    setEqPlaying((curr) => {
      const next = !curr;
      if (next) {
        eqAudioEngine.start(tuning);
      } else {
        eqAudioEngine.stop();
      }
      return next;
    });
  }, [tuning]);

  const loadEqAudioFile = useCallback(
    async (file: File) => {
      const name = await eqAudioEngine.loadCustomAudio(file);
      setEqTrackLabel(name);
      if (eqPlaying) {
        eqAudioEngine.start(tuning);
      }
      showToast(`Loaded "${name}" for EQ audition`);
    },
    [eqPlaying, tuning, showToast],
  );

  // ---- Sleep ----
  const updateSleepPlan = useCallback((patch: Partial<SleepPlan>) => {
    setSleepPlan((prev) => {
      const next = { ...prev, ...patch };
      if (sleepSession || sleepPreviewingId) {
        sleepAudioEngine.updateSoundscapeVolume(next.volume, next.soundSide);
      }
      return next;
    });
  }, [sleepSession, sleepPreviewingId]);

  const toggleNightExtra = useCallback((extra: NightExtra) => {
    setSleepPlan((prev) => {
      const exists = prev.nightExtras.includes(extra);
      return {
        ...prev,
        nightExtras: exists ? prev.nightExtras.filter((e) => e !== extra) : [...prev.nightExtras, extra],
      };
    });
  }, []);

  const toggleSleepLayer = useCallback((soundId: string) => {
    setSleepPlan((prev) => {
      const exists = prev.layers.some((l) => l.soundId === soundId);
      let nextLayers: SleepLayer[];
      if (exists) {
        nextLayers = prev.layers.filter((l) => l.soundId !== soundId);
      } else {
        if (prev.layers.length >= 3) {
          return prev;
        }
        nextLayers = [...prev.layers, { soundId, gain: 0.7 }];
      }
      return { ...prev, layers: nextLayers };
    });
  }, []);

  const setSleepLayerGain = useCallback((soundId: string, gain: number) => {
    setSleepPlan((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.soundId === soundId ? { ...l, gain } : l)),
    }));
  }, []);

  const startSleepSession = useCallback(() => {
    const now = Date.now();
    setSleepPreviewingId(null);
    const endsAtMillis = now + sleepPlan.durationMinutes * 60_000;
    const noiseOffAtMillis =
      sleepPlan.noiseOffAfterMinutes === null
        ? null
        : now + sleepPlan.noiseOffAfterMinutes * 60_000;

    if (sleepPlan.noiseOffAfterMinutes === 0 && headphone.noise) {
      updateNoiseSettings({ ancEnabled: false });
      pushSleepNote('Switched noise cancelling off at session start');
    }

    if (sleepPlan.nightExtras.includes('TOUCH_LOCK')) {
      setTouchControls(false);
    }
    if (sleepPlan.nightExtras.includes('PROMPTS_OFF')) {
      setVoicePrompts(false);
    }

    if (sleepPlan.layers.length > 0) {
      sleepAudioEngine.startSoundscape(sleepPlan.layers, sleepPlan.volume, sleepPlan.soundSide);
      pushSleepNote(`Sleep soundscape started (${sleepPlan.durationMinutes} min timer)`);
    } else {
      sleepAudioEngine.stopSoundscape();
      pushSleepNote(`Timer-only sleep session started (${sleepPlan.durationMinutes} min)`);
    }

    setSleepSession({
      plan: sleepPlan,
      startedAtMillis: now,
      endsAtMillis,
      phase: sleepPlan.layers.length > 0 ? 'PLAYING' : 'TIMER_ONLY',
      noiseOffAtMillis,
      noiseOffDone: sleepPlan.noiseOffAfterMinutes === 0,
      headsetName: headphone.status === 'CONNECTED' ? headphone.info.customName : null,
      paused: false,
    });
  }, [sleepPlan, headphone, updateNoiseSettings, setTouchControls, setVoicePrompts, pushSleepNote]);

  const pauseOrResumeSleepSession = useCallback(() => {
    setSleepSession((curr) => {
      if (!curr) return null;
      const now = Date.now();
      if (!curr.paused) {
        sleepAudioEngine.stopSoundscape();
        return { ...curr, paused: true, remainingMsWhenPaused: Math.max(0, curr.endsAtMillis - now) };
      } else {
        const rem = curr.remainingMsWhenPaused ?? 60_000;
        if (curr.plan.layers.length > 0) {
          sleepAudioEngine.startSoundscape(curr.plan.layers, curr.plan.volume, curr.plan.soundSide);
        }
        return { ...curr, paused: false, endsAtMillis: now + rem };
      }
    });
  }, []);

  const extendSleepSession = useCallback((extraMinutes: number) => {
    setSleepSession((curr) => {
      if (!curr) return null;
      return {
        ...curr,
        endsAtMillis: curr.endsAtMillis + extraMinutes * 60_000,
        remainingMsWhenPaused: curr.remainingMsWhenPaused
          ? curr.remainingMsWhenPaused + extraMinutes * 60_000
          : undefined,
      };
    });
    showToast(`Added ${extraMinutes} min to sleep timer`);
  }, [showToast]);

  const stopSleepSession = useCallback(() => {
    sleepAudioEngine.stopSoundscape();
    setSleepSession(null);
    pushSleepNote('Sleep session stopped manually');
  }, [pushSleepNote]);

  const togglePreviewSound = useCallback(
    (soundId: string) => {
      if (sleepSession) {
        showToast('Stop the active sleep session to preview individual sounds');
        return;
      }
      setSleepPreviewingId((curr) => {
        if (curr === soundId) {
          sleepAudioEngine.stopSoundscape();
          return null;
        }
        sleepAudioEngine.startSoundscape([{ soundId, gain: 0.75 }], sleepPlan.volume, sleepPlan.soundSide);
        return soundId;
      });
    },
    [sleepSession, sleepPlan.volume, sleepPlan.soundSide, showToast],
  );

  const upsertAlarm = useCallback(
    (alarm: SleepAlarm) => {
      setAlarms((prev) => {
        const idx = prev.findIndex((a) => a.id === alarm.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = alarm;
          return copy;
        }
        return [...prev, alarm];
      });
      showToast('Alarm saved');
    },
    [showToast],
  );

  const toggleAlarmEnabled = useCallback((id: string) => {
    setAlarms((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
  }, []);

  const deleteAlarm = useCallback(
    (id: string) => {
      setAlarms((prev) => prev.filter((a) => a.id !== id));
      showToast('Alarm deleted');
    },
    [showToast],
  );

  const triggerTestAlarm = useCallback(
    (alarm?: SleepAlarm) => {
      const target = alarm ?? alarms[0] ?? DEFAULT_ALARMS[0];
      sleepAudioEngine.stopSoundscape();
      setSleepPreviewingId(null);
      setSleepSession(null);
      if (target.toneId.startsWith('sound:')) {
        const soundId = target.toneId.replace('sound:', '');
        sleepAudioEngine.startSoundscape([{ soundId, gain: 0.85 }], 0.85, 'BOTH');
      } else {
        sleepAudioEngine.startAlarmTone(target.toneId);
      }
      setRingingAlarm({
        alarm: target,
        startedAtMillis: Date.now(),
        phoneFallbackActive: target.output !== 'EARBUDS',
        phoneFallbackReason: null,
      });
    },
    [alarms],
  );

  const snoozeRingingAlarm = useCallback(() => {
    sleepAudioEngine.stopAlarmTone();
    sleepAudioEngine.stopSoundscape();
    const mins = ringingAlarm?.alarm.snoozeMinutes ?? 10;
    setRingingAlarm(null);
    showToast(`Snoozed for ${mins} min`);
    pushSleepNote(`Alarm snoozed for ${mins} min`);
  }, [ringingAlarm, showToast, pushSleepNote]);

  const dismissRingingAlarm = useCallback(() => {
    sleepAudioEngine.stopAlarmTone();
    sleepAudioEngine.stopSoundscape();
    setRingingAlarm(null);
    pushSleepNote('Wake-up alarm dismissed');
    showToast('Good morning — alarm dismissed');
  }, [pushSleepNote, showToast]);

  const saveCurrentMix = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed || sleepPlan.layers.length === 0) return;
      const mix: SavedMix = {
        id: `mix-${Date.now()}`,
        name: trimmed,
        layers: sleepPlan.layers.map((l) => ({ ...l })),
      };
      setSavedMixes((prev) => [...prev, mix]);
      showToast(`Saved mix "${trimmed}"`);
    },
    [sleepPlan.layers, showToast],
  );

  const loadMix = useCallback(
    (mix: SavedMix) => {
      setSleepPlan((prev) => ({ ...prev, layers: mix.layers.map((l) => ({ ...l })) }));
      showToast(`Loaded mix "${mix.name}"`);
    },
    [showToast],
  );

  const deleteMix = useCallback((id: string) => {
    setSavedMixes((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const addCustomSound = useCallback(
    async (file: File) => {
      const id = `custom:${Date.now()}`;
      const buf = await file.arrayBuffer();
      const loopSeconds = await sleepAudioEngine.decodeCustomSound(id, buf);
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      setCustomSounds((prev) => [...prev, { id, name: cleanName, loopSeconds }]);
      showToast(`Added custom sound "${cleanName}" (${loopSeconds}s loop)`);
    },
    [showToast],
  );

  const deleteCustomSound = useCallback((id: string) => {
    setCustomSounds((prev) => prev.filter((s) => s.id !== id));
    setSleepPlan((prev) => ({
      ...prev,
      layers: prev.layers.filter((l) => l.soundId !== id),
    }));
  }, []);

  // ---- Tools ----
  const setPreferredCodec = useCallback(
    (codec: CodecType) => {
      const bitrates: Record<CodecType, { rate: number; bits: number; kbps: number }> = {
        SBC: { rate: 44100, bits: 16, kbps: 328 },
        AAC: { rate: 48000, bits: 24, kbps: 256 },
        aptX: { rate: 48000, bits: 16, kbps: 352 },
        'aptX HD': { rate: 48000, bits: 24, kbps: 576 },
        'aptX Adaptive': { rate: 96000, bits: 24, kbps: 420 },
        LDAC: { rate: 96000, bits: 24, kbps: 990 },
        'LC3 (LE Audio)': { rate: 48000, bits: 24, kbps: 160 },
      };
      const meta = bitrates[codec];
      setCodecState((prev) => ({
        ...prev,
        activeCodec: codec,
        sampleRateHz: meta.rate,
        bitsPerSample: meta.bits,
        bitrateKbps: meta.kbps,
      }));
      showToast(`Switched audio codec to ${codec}`);
    },
    [showToast],
  );

  const toggleShizukuMode = useCallback(() => {
    setCodecState((prev) => ({ ...prev, shizukuAvailable: !prev.shizukuAvailable }));
  }, []);

  const updateCallAudio = useCallback((patch: Partial<CallAudioState>) => {
    setCallAudio((prev) => ({ ...prev, ...patch }));
  }, []);

  const runLabScan = useCallback(
    (groupIds: number[], deep: boolean) => {
      setLabScanning(true);
      window.setTimeout(() => {
        const ids = deep ? [0, 1, 2, 4, 5, 31] : groupIds;
        const results = runMockLabScan(headphone, ids);
        setLabReadings(results);
        setLabPrintConsole((prev) => [
          ...prev,
          `[lab] ${deep ? 'deep scan' : 'scan'} completed: ${results.length} frames decoded (ReadOnlyGuard OK)`,
        ]);
        setLabScanning(false);
        showToast(`Lab scan decoded ${results.length} readings`);
      }, 380);
    },
    [headphone, showToast],
  );

  const clearTimeline = useCallback(() => {
    setTimeline([]);
  }, []);

  const copyConnectionReport = useCallback(async () => {
    const report = [
      `Earshot Connection Report (${new Date().toISOString()})`,
      `Device: ${headphone.info.modelName} (${headphone.brand})`,
      `Firmware: ${headphone.info.firmwareVersion} · Protocol: ${headphone.info.protocolVersion ?? 'Generic'}`,
      `Status: ${headphone.status} · Battery: ${headphone.batteryPercent ?? '--'}%`,
      `Codec: ${codecState.activeCodec} (${codecState.sampleRateHz} Hz / ${codecState.bitsPerSample}-bit)`,
      `Capabilities: modes=${headphone.capabilities.listeningModes}, liveNoise=${headphone.capabilities.liveNoiseControl}, tested=${headphone.capabilities.tested}`,
      `Lab frames: ${labReadings.map((r) => `${r.address} ${r.knownName}=${r.decodedSummary}`).join(' | ') || 'not scanned'}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(report);
      showToast('Connection report copied to clipboard');
    } catch {
      showToast('Connection report generated');
    }
    return report;
  }, [headphone, codecState, labReadings, showToast]);

  // ---- Automations ----
  const upsertAutomation = useCallback(
    (rule: AutomationRule) => {
      setAutomations((prev) => {
        const idx = prev.findIndex((r) => r.id === rule.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = rule;
          return copy;
        }
        return [...prev, rule];
      });
      showToast(`Saved rule "${rule.name}"`);
    },
    [showToast],
  );

  const toggleAutomation = useCallback((id: string) => {
    setAutomations((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  }, []);

  const deleteAutomation = useCallback((id: string) => {
    setAutomations((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const runAutomationNow = useCallback(
    (id: string) => {
      const rule = automations.find((r) => r.id === id);
      if (!rule) return;
      if (rule.actionModeName) {
        const match = headphone.modes.find((m) => m.name.toLowerCase() === rule.actionModeName?.toLowerCase());
        if (match) selectMode(match.index);
      }
      if (rule.actionAncEnabled !== undefined || rule.actionCancellingLevel !== undefined) {
        updateNoiseSettings({
          ...(rule.actionAncEnabled !== undefined ? { ancEnabled: rule.actionAncEnabled } : {}),
          ...(rule.actionCancellingLevel !== undefined ? { cancellingLevel: rule.actionCancellingLevel } : {}),
        });
      }
      if (rule.actionEqPresetId) {
        selectPreset(rule.actionEqPresetId);
      }
      if (rule.actionCallBoost !== undefined) {
        updateCallAudio({ boostEnabled: rule.actionCallBoost });
      }
      setAutomations((prev) => prev.map((r) => (r.id === id ? { ...r, lastFiredMillis: Date.now() } : r)));
      setAutomationLog((prev) => [
        { atMillis: Date.now(), ruleName: rule.name, outcome: 'Executed manually' },
        ...prev.slice(0, 29),
      ]);
      showToast(`Ran "${rule.name}"`);
    },
    [automations, headphone.modes, selectMode, updateNoiseSettings, selectPreset, updateCallAudio, showToast],
  );

  // ---- Backup & Restore ----
  const exportBackupJson = useCallback(() => {
    const payload = {
      app: 'Earshot',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      preferences: {
        appearance,
        themePreference,
        demoModeEnabled,
        demoDeviceId,
        lowBatteryAlertPercent,
        customDeviceNames,
      },
      tuning,
      customPresets,
      headsetPresetMemory,
      sleepPlan,
      alarms,
      savedMixes,
      codecState,
      callAudio,
      automations,
    };
    return JSON.stringify(payload, null, 2);
  }, [
    appearance,
    themePreference,
    demoModeEnabled,
    demoDeviceId,
    lowBatteryAlertPercent,
    customDeviceNames,
    tuning,
    customPresets,
    headsetPresetMemory,
    sleepPlan,
    alarms,
    savedMixes,
    codecState,
    callAudio,
    automations,
  ]);

  const importBackupJson = useCallback(
    (jsonText: string) => {
      const parsed = JSON.parse(jsonText);
      if (!parsed || parsed.app !== 'Earshot') {
        throw new Error('Not a valid Earshot backup file.');
      }
      const restoredItems: string[] = [];
      if (parsed.preferences) {
        if (parsed.preferences.appearance) setAppearance(parsed.preferences.appearance);
        if (parsed.preferences.themePreference) setThemePreference(parsed.preferences.themePreference);
        if (typeof parsed.preferences.lowBatteryAlertPercent === 'number') {
          setLowBatteryAlertPercent(parsed.preferences.lowBatteryAlertPercent);
        }
        if (parsed.preferences.customDeviceNames) setCustomDeviceNames(parsed.preferences.customDeviceNames);
        restoredItems.push('Preferences & device names');
      }
      if (parsed.tuning) {
        setTuning(parsed.tuning);
        restoredItems.push('Pro EQ tuning');
      }
      if (Array.isArray(parsed.customPresets)) {
        setCustomPresets(parsed.customPresets);
        restoredItems.push(`${parsed.customPresets.length} custom EQ presets`);
      }
      if (parsed.sleepPlan) {
        setSleepPlan(parsed.sleepPlan);
        restoredItems.push('Sleep plan');
      }
      if (Array.isArray(parsed.alarms)) {
        setAlarms(parsed.alarms);
        restoredItems.push(`${parsed.alarms.length} sleep alarms`);
      }
      if (Array.isArray(parsed.savedMixes)) {
        setSavedMixes(parsed.savedMixes);
        restoredItems.push(`${parsed.savedMixes.length} sound mixes`);
      }
      if (Array.isArray(parsed.automations)) {
        setAutomations(parsed.automations);
        restoredItems.push(`${parsed.automations.length} automations`);
      }
      showToast(`Restored ${restoredItems.length} sections`);
      return { restoredItems };
    },
    [showToast],
  );

  const resetAllData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAppearance('field');
    setThemePreference('light');
    setDemoModeEnabled(true);
    setDemoDeviceId('qc_ultra_earbuds_2');
    setBtd700ModeActive(false);
    setActiveSenseEnabled(false);
    setSelectedAudioRoute('BLUETOOTH_A2DP');
    setCustomDeviceNames({});
    setHeadphone(buildDemoDeviceState('qc_ultra_earbuds_2'));
    setTuning(DEFAULT_TUNING);
    setCustomPresets([]);
    setSleepPlan(DEFAULT_SLEEP_PLAN);
    setAlarms(DEFAULT_ALARMS);
    setSavedMixes(DEFAULT_SAVED_MIXES);
    setAutomations(DEFAULT_AUTOMATIONS);
    showToast('Reset Earshot to factory defaults');
  }, [showToast]);

  const value: EarshotContextValue = {
    activeTab,
    subRoute,
    navigateTab,
    navigateSubRoute,
    goBack,
    appearance,
    setAppearance,
    themePreference,
    setThemePreference,
    isDark,
    demoModeEnabled,
    setDemoModeEnabled,
    demoDeviceId,
    selectDemoDevice,
    headphone,
    connectHeadset,
    disconnectHeadset,
    refreshHeadset,
    customDeviceNames,
    renameHeadset,
    forgetDevice,
    lowBatteryAlertPercent,
    setLowBatteryAlertPercent,
    selectMode,
    toggleModeFavorite,
    saveModeConfig,
    updateNoiseSettings,
    btd700ModeActive,
    setBtd700Mode,
    setActiveSense,
    selectedAudioRoute,
    setSelectedAudioRoute,
    externalOutput,
    togglePlayback,
    stepTrack,
    setVolume,
    setHeadphoneEq,
    setCrusher,
    setVendorControl,
    setSidetone,
    setSidetonePersistent,
    setMultipoint,
    setTouchControls,
    setVoicePrompts,
    setAutoPlayPause,
    setAutoAnswer,
    setAutoOffMinutes,
    setLeAudioEnabled,
    switchActivePairedDevice,
    setButtonAction,
    simulateDemoButtonPress,
    answerPairing,
    tuning,
    setTuningEnabled,
    setGlobalExperimental,
    setBandMode,
    setBandModeGain,
    allPresets,
    customPresets,
    selectPreset,
    updateGraphicBandGain,
    updateParametricBands,
    setEqPreamp,
    setEqBoost,
    setEqLimiter,
    saveCustomPreset,
    deleteCustomPreset,
    importAutoEqPreset,
    eqPlaying,
    toggleEqPlayback,
    eqTrackLabel,
    loadEqAudioFile,
    sleepPlan,
    updateSleepPlan,
    toggleNightExtra,
    toggleSleepLayer,
    setSleepLayerGain,
    sleepSession,
    startSleepSession,
    pauseOrResumeSleepSession,
    extendSleepSession,
    stopSleepSession,
    sleepPreviewingId,
    togglePreviewSound,
    alarms,
    upsertAlarm,
    toggleAlarmEnabled,
    deleteAlarm,
    ringingAlarm,
    triggerTestAlarm,
    snoozeRingingAlarm,
    dismissRingingAlarm,
    savedMixes,
    saveCurrentMix,
    loadMix,
    deleteMix,
    customSounds,
    addCustomSound,
    deleteCustomSound,
    sleepLog,
    codecState,
    setPreferredCodec,
    toggleShizukuMode,
    callAudio,
    updateCallAudio,
    labReadings,
    labPrintConsole,
    labScanning,
    runLabScan,
    timeline,
    clearTimeline,
    copyConnectionReport,
    automations,
    automationLog,
    upsertAutomation,
    toggleAutomation,
    deleteAutomation,
    runAutomationNow,
    exportBackupJson,
    importBackupJson,
    resetAllData,
    toastMessage,
    showToast,
    deviceSwitcherOpen,
    setDeviceSwitcherOpen,
  };

  return <EarshotContext.Provider value={value}>{children}</EarshotContext.Provider>;
};

export function useEarshot(): EarshotContextValue {
  const ctx = useContext(EarshotContext);
  if (!ctx) throw new Error('useEarshot must be used within EarshotProvider');
  return ctx;
}
