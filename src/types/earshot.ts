// Core domain models ported from HeadphoneModels.kt, SleepModels.kt, SupportTier.kt, EqModel.kt, AutomationRepository.kt

export type TabId = 'home' | 'sound' | 'sleep' | 'tools' | 'more';

export type AppearanceMode = 'field' | 'aurora';
export type ThemePreference = 'system' | 'light' | 'dark';

export type ConnectionStatus =
  | 'NO_PERMISSION'
  | 'NO_PAIRED_DEVICE'
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED';

export type SpatialAudio = 'OFF' | 'ROOM' | 'HEAD';
export type Sidetone = 'OFF' | 'LOW' | 'MEDIUM' | 'HIGH';
export type FormFactor = 'HEADPHONES' | 'EARBUDS' | 'OPEN_EARBUDS';
export type SupportTier = 'TESTED' | 'EXPERIMENTAL' | 'BATTERY_ONLY' | 'ANY_HEADSET';
export type PlaybackState = 'STOPPED' | 'PLAYING' | 'PAUSED';

export type ModeSetting = 'CANCELLING_LEVEL' | 'AUTO_CNC' | 'SPATIAL_AUDIO' | 'WIND_BLOCK' | 'ANC';

export interface NoiseSettings {
  cancellingLevel: number; // 0..10
  ancEnabled: boolean;
  windBlock: boolean;
  spatialAudio: SpatialAudio;
}

export interface ListeningMode {
  index: number;
  name: string;
  isPreset: boolean;
  isEditable: boolean;
  isConfigured: boolean;
  isFavorite: boolean;
  settings: NoiseSettings | null;
  changeableSettings?: ModeSetting[];
}

export interface HeadphoneEq {
  bass: number; // -10..10
  mid: number;
  treble: number;
}

export interface BatteryLevel {
  percent: number | null;
  minutesLeft?: number | null;
}

export interface BatteryDetail {
  overall?: BatteryLevel | null;
  left?: BatteryLevel | null;
  right?: BatteryLevel | null;
  case?: BatteryLevel | null;
}

export interface PairedDevice {
  address: string;
  name: string;
  isActiveSource: boolean;
  isThisPhone: boolean;
  isConnected: boolean;
  usesLeAudio?: boolean;
}

export interface DeviceInfo {
  productName: string;
  customName: string;
  firmwareVersion: string;
  serialNumber: string;
  productId: number;
  bluetoothAddress: string;
  protocolVersion?: string;
  modelName: string;
  family: string;
  generation?: string;
}

export interface CrusherBass {
  active: boolean;
  intensity: number;
  maxIntensity: number;
  mode: number | null; // 0=High, 1=Medium, 2=Low
  modeCount: number;
  intensityReadOnly: boolean;
}

export type ButtonActionId =
  | 'NOT_CONFIGURED'
  | 'VOICE_ASSISTANT'
  | 'ANC_CYCLE'
  | 'BATTERY_LEVEL'
  | 'PLAY_PAUSE'
  | 'INCREASE_CNC'
  | 'DECREASE_CNC'
  | 'SWITCH_DEVICE'
  | 'CONVERSATION_MODE'
  | 'TRACK_FORWARD'
  | 'TRACK_BACK'
  | 'WIND_MODE'
  | 'DISABLED'
  | 'SPOTIFY_TAP'
  | 'MODES_CAROUSEL'
  | 'SPATIAL_AUDIO';

export interface ButtonAssignment {
  buttonId: number;
  eventType: number;
  action: ButtonActionId;
  supportedActions: ButtonActionId[];
  buttonLabel: string;
  eventLabel: string;
}

export interface ButtonPress {
  buttonLabel: string;
  eventLabel: string;
  action: ButtonActionId;
  atMillis: number;
}

export interface VendorControl {
  id: string;
  title: string;
  subtitle?: string;
  value: number | null; // 0/1 for switch, option index for choice, or number in range
  options?: string[];
  onHome?: boolean;
  range?: [number, number];
  unit?: string;
}

export interface HeadphoneCapabilities {
  spatialAudio: boolean;
  ancToggle: boolean;
  liveNoiseControl: boolean;
  windExcludesCancelling: boolean;
  noiseCancelling: boolean;
  ancAlwaysOn: boolean;
  windBlock: boolean;
  editableModes: boolean;
  favoriteModes: boolean;
  listeningModes: boolean;
  verified: boolean;
  ownSettings: boolean;
  modesOnHome: boolean;
  formFactor: FormFactor;
  supportNote: string | null;
  tested: boolean;
  batteryOnly: boolean;
  hasHeadphoneEq: boolean;
  hasSidetone: boolean;
  hasMultipoint: boolean;
  hasTouchControls: boolean;
  hasVoicePrompts: boolean;
  hasAutoPlayPause: boolean;
  hasAutoAnswer: boolean;
  hasLeAudio: boolean;
  hasLatency: boolean;
  hasStandbyTimer: boolean;
  activeSense: boolean;
}

export interface PairingRequest {
  passcode: number | null;
  digits: number;
}

export interface HeadphoneState {
  deviceId: string;
  brand: string;
  status: ConnectionStatus;
  audioLinked: boolean;
  channelHeldBy?: string | null;
  batteryPercent: number | null;
  isCharging: boolean;
  battery: BatteryDetail;
  currentModeIndex: number | null;
  modes: ListeningMode[];
  noise: NoiseSettings | null;
  eq: HeadphoneEq | null;
  sidetone: Sidetone | null;
  sidetonePersistent: boolean;
  autoPlayPause: boolean | null;
  autoAnswer: boolean | null;
  multipointEnabled: boolean | null;
  voicePromptsEnabled: boolean | null;
  voicePromptLanguage: string;
  pairedDevices: PairedDevice[];
  info: DeviceInfo;
  shortcutButtons: ButtonAssignment[];
  lastButtonPress: ButtonPress | null;
  micMuted: boolean;
  leAudioSupported: boolean;
  leAudioEnabled: boolean;
  latencyMs: number | null;
  latencyRangeMs: [number, number] | null;
  touchControlsEnabled: boolean | null;
  volume: number;
  volumeMax: number;
  playbackState: PlaybackState;
  livePushEnabled: boolean;
  capabilities: HeadphoneCapabilities;
  activeSenseEnabled: boolean | null;
  crusher: CrusherBass | null;
  pairing: PairingRequest | null;
  autoOffMinutes: number | null;
  vendorControls: VendorControl[];
  lastUpdatedMillis: number;
}

// ---- DSP / EQ Models ----
export type FilterType = 'PEAK' | 'LOW_SHELF' | 'HIGH_SHELF';

export type EqBandMode = 'BAND_3' | 'BAND_4' | 'BAND_5' | 'BAND_7';

export type AudioOutputRoute =
  | 'USB_AUDIO'
  | 'BTD700_LOSSLESS'
  | 'BLUETOOTH_A2DP'
  | 'BOSE_CONTROL_LINK'
  | 'PHONE_SPEAKER';

export interface EqBandSpec {
  id: string;
  title: string;
  frequencyLabel: string;
  role: string;
  frequencyHz: number;
  q: number;
  type: FilterType;
}

export interface ParametricBand {
  id: string;
  frequencyHz: number;
  gainDb: number;
  q: number;
  type: FilterType;
  enabled: boolean;
}

export interface EqPreset {
  id: string;
  name: string;
  bands: ParametricBand[];
  preampDb: number;
  isBuiltIn: boolean;
  description?: string;
}

export interface TuningSettings {
  enabled: boolean;
  globalExperimental: boolean;
  activePresetId: string | null;
  bandMode: EqBandMode;
  bandModeGains: Record<EqBandMode, number[]>;
  bands: ParametricBand[];
  preampDb: number;
  boostDb: number; // 0..12
  limiterEnabled: boolean;
}

// ---- Sleep Models ----
export interface SleepLayer {
  soundId: string;
  gain: number; // 0..1
}

export interface CustomSound {
  id: string;
  name: string;
  loopSeconds: number;
  dataUrl?: string;
}

export type SleepEndAction = 'STOP_SOUNDS' | 'DISCONNECT' | 'POWER_OFF';
export type NightExtra = 'TOUCH_LOCK' | 'PROMPTS_OFF' | 'DO_NOT_DISTURB' | 'VOLUME_CAP';
export type SoundSide = 'BOTH' | 'MONO' | 'LEFT_ONLY' | 'RIGHT_ONLY';

export interface SleepPlan {
  durationMinutes: number;
  layers: SleepLayer[];
  noiseOffAfterMinutes: number | null; // null=keep, 0=at start, >=duration=at end
  fadeOutMinutes: number;
  endAction: SleepEndAction;
  nightExtras: NightExtra[];
  pauseOtherAudio: boolean;
  soundSide: SoundSide;
  volume: number; // 0..1
  volumeCapPercent: number;
}

export type AlarmOutput = 'EARBUDS' | 'PHONE' | 'BOTH';

export interface SleepAlarm {
  id: string;
  hour: number;
  minute: number;
  days: number[]; // 1=Mon .. 7=Sun, empty = once
  enabled: boolean;
  output: AlarmOutput;
  toneId: string; // 'chime' | 'birds' | 'classic' | 'sound:rain' etc.
  wakeWindowMinutes: number;
  fadeInSeconds: number;
  snoozeMinutes: number | null;
  vibrate: boolean;
  label?: string;
}

export interface SavedMix {
  id: string;
  name: string;
  layers: SleepLayer[];
}

export interface SleepNote {
  atMillis: number;
  text: string;
  isProblem?: boolean;
}

export type SleepPhase = 'FADING_IN' | 'PLAYING' | 'FADING_OUT' | 'TIMER_ONLY';

// ---- Tools Models ----
export type CodecType = 'SBC' | 'AAC' | 'aptX' | 'aptX HD' | 'aptX Adaptive' | 'LDAC' | 'LC3 (LE Audio)';

export interface CodecState {
  activeCodec: CodecType;
  sampleRateHz: number;
  bitsPerSample: number;
  channelMode: 'Stereo' | 'Joint Stereo' | 'Dual Channel';
  bitrateKbps: number;
  supportedCodecs: CodecType[];
  shizukuAvailable: boolean;
  streaming: boolean;
}

export interface CallAudioState {
  boostEnabled: boolean;
  boostGainDb: number;
  callCodec: string;
  widebandActive: boolean;
  autoBoostOnCall: boolean;
}

export interface RawFrame {
  block: number;
  functionId: number;
  operatorName: string;
  payloadHex: string;
  isError: boolean;
  errorName?: string;
}

export interface LabReading {
  address: string;
  block: number;
  functionId: number;
  knownName: string;
  groupName: string;
  decodedSummary: string;
  frames: RawFrame[];
}

export interface LabGroup {
  id: number;
  code: string;
  name: string;
  readCount: number;
}

export interface LabProfile {
  stack: string;
  groupNoun: string;
  groups: LabGroup[];
  safetyNote: string;
  printConsole: boolean;
}

export interface TimelineEntry {
  id: string;
  atMillis: number;
  deviceName: string;
  event: string;
  detail: string;
  level: 'info' | 'warn' | 'ok';
}

// ---- Automations ----
export type AutomationTriggerType = 'ON_CONNECT' | 'SCHEDULE' | 'WIFI_SSID' | 'APP_FOREGROUND';

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  triggerType: AutomationTriggerType;
  triggerValue: string; // e.g. '08:30' or 'HomeWiFi' or 'Spotify' or deviceId
  actionModeName?: string;
  actionAncEnabled?: boolean;
  actionCancellingLevel?: number;
  actionEqPresetId?: string;
  actionCallBoost?: boolean;
  lastFiredMillis?: number;
}

export interface AutomationLogEntry {
  atMillis: number;
  ruleName: string;
  outcome: string;
}
