import {
  ButtonActionId,
  HeadphoneState,
  LabGroup,
  LabProfile,
  LabReading,
  SupportTier,
} from '../types/earshot';

export interface DemoDeviceEntry {
  id: string;
  displayName: string;
  brand: string;
  tier: SupportTier;
  summary: string;
}

export const DEMO_DEVICES: DemoDeviceEntry[] = [
  { id: 'qc_ultra', displayName: 'Bose QC Ultra Headphones (2nd Gen)', brand: 'Bose', tier: 'TESTED', summary: 'Full BMAP, modes, live noise, 3-band EQ, LE Audio' },
  { id: 'qc_ultra_earbuds_2', displayName: 'Bose QC Ultra Earbuds (2nd Gen)', brand: 'Bose', tier: 'TESTED', summary: 'Bud + case batteries, per-bud shortcuts, modes' },
  { id: 'qc_earbuds_2', displayName: 'Bose QC Earbuds II', brand: 'Bose', tier: 'EXPERIMENTAL', summary: 'Quiet/Aware + 2 custom slots, no Spatial Audio' },
  { id: 'qc_earbuds', displayName: 'Bose QC Earbuds (2020)', brand: 'Bose', tier: 'EXPERIMENTAL', summary: 'Legacy BMAP layout, CNC level & toggle' },
  { id: 'qc45', displayName: 'Bose QuietComfort 45', brand: 'Bose', tier: 'EXPERIMENTAL', summary: 'ANC always on, Quiet/Aware + custom wind modes' },
  { id: 'nc700', displayName: 'Bose Noise Cancelling Headphones 700', brand: 'Bose', tier: 'EXPERIMENTAL', summary: 'CNC level 0..10 without AudioModes block' },
  { id: 'ultra_open', displayName: 'Bose Ultra Open Earbuds', brand: 'Bose', tier: 'EXPERIMENTAL', summary: 'Open-ear Stereo & Immersion spatial modes, no ANC' },
  { id: 'qc35_ii', displayName: 'Bose QuietComfort 35 II', brand: 'Bose', tier: 'BATTERY_ONLY', summary: 'Bose Connect era — battery read & honest support note' },
  { id: 'soundcore_sleep_a30', displayName: 'Soundcore Sleep A30', brand: 'Soundcore', tier: 'TESTED', summary: 'Sleep earbuds, masking controls, tap & touch lock' },
  { id: 'soundcore_liberty_4_nc', displayName: 'Soundcore Liberty 4 NC', brand: 'Soundcore', tier: 'EXPERIMENTAL', summary: 'Adaptive ANC, 3 ambient modes, HearID controls' },
  { id: 'soundcore_space_one_pro', displayName: 'Soundcore Space One Pro', brand: 'Soundcore', tier: 'EXPERIMENTAL', summary: 'ANC level slider, wear detection, 5-stage transparency' },
  { id: 'sennheiser_momentum_4', displayName: 'Sennheiser MOMENTUM 4', brand: 'Sennheiser', tier: 'EXPERIMENTAL', summary: 'GAIA v3 transparency slider, Anti-Wind, Smart Pause' },
  { id: 'sony_wh1000xm5', displayName: 'Sony WH-1000XM5', brand: 'Sony', tier: 'EXPERIMENTAL', summary: 'Tandem ambient level 0..20, Speak-to-Chat, DSEE' },
  { id: 'crusher', displayName: 'Skullcandy Crusher 1080', brand: 'Skullcandy', tier: 'EXPERIMENTAL', summary: 'Bragi BOS + Crusher Haptic Bass dial & modes' },
  { id: 'crusher_secure', displayName: 'Skullcandy Crusher (pairing)', brand: 'Skullcandy', tier: 'EXPERIMENTAL', summary: 'Demonstrates 6-digit secure session pairing flow' },
  { id: 'method_360', displayName: 'Skullcandy Method 360 ANC', brand: 'Skullcandy', tier: 'EXPERIMENTAL', summary: 'Bragi earbuds: Quiet / Aware / Off, sidetone' },
  { id: 'method_540', displayName: 'Skullcandy Method 540 ANC', brand: 'Skullcandy', tier: 'EXPERIMENTAL', summary: 'Bragi earbuds: Quiet / Aware / Off, sidetone' },
  { id: 'jbl_wave_buds_2', displayName: 'JBL Wave Buds 2', brand: 'JBL', tier: 'EXPERIMENTAL', summary: 'JBL H-AA over BLE: 4 modes, EQ presets, voice prompts' },
  { id: 'airpods_pro', displayName: 'Apple AirPods Pro', brand: 'Apple', tier: 'BATTERY_ONLY', summary: 'BLE Continuity advert: Left 90%, Right 80%, Case 60%' },
];

export const BUTTON_ACTION_LABELS: Record<ButtonActionId, string> = {
  NOT_CONFIGURED: 'Not configured',
  VOICE_ASSISTANT: 'Voice assistant',
  ANC_CYCLE: 'Cycle noise control',
  BATTERY_LEVEL: 'Battery level',
  PLAY_PAUSE: 'Play / pause',
  INCREASE_CNC: 'Increase noise cancelling',
  DECREASE_CNC: 'Decrease noise cancelling',
  SWITCH_DEVICE: 'Switch device',
  CONVERSATION_MODE: 'Conversation mode',
  TRACK_FORWARD: 'Next track',
  TRACK_BACK: 'Previous track',
  WIND_MODE: 'Wind block',
  DISABLED: 'Disabled',
  SPOTIFY_TAP: 'Spotify Tap',
  MODES_CAROUSEL: 'Cycle modes',
  SPATIAL_AUDIO: 'Immersive audio',
};

export interface SleepSoundCatalogItem {
  id: string;
  name: string;
  category: 'Nature' | 'Noise' | 'Ambient';
  description: string;
  credit: string;
}

export const SLEEP_SOUNDS_CATALOG: SleepSoundCatalogItem[] = [
  { id: 'rain', name: 'Rain', category: 'Nature', description: 'Steady evening rainfall on leaves and slate', credit: 'Synthesized field texture · Earshot DSP' },
  { id: 'heavy_rain', name: 'Heavy Rain', category: 'Nature', description: 'Dense downpour with low distant rumble', credit: 'Synthesized field texture · Earshot DSP' },
  { id: 'ocean', name: 'Ocean', category: 'Nature', description: 'Slow rolling surf with soft pebble wash', credit: 'Synthesized wave envelope · Earshot DSP' },
  { id: 'fire', name: 'Campfire', category: 'Nature', description: 'Warm hearth embers with gentle wood crackle', credit: 'Synthesized hearth · Earshot DSP' },
  { id: 'stream', name: 'Stream', category: 'Nature', description: 'Woodland creek babbling over smooth stones', credit: 'Synthesized resonant flow · Earshot DSP' },
  { id: 'wind', name: 'Wind', category: 'Nature', description: 'Soft alpine breeze sweeping through pines', credit: 'Synthesized swept bandpass · Earshot DSP' },
  { id: 'brown_noise', name: 'Brown Noise', category: 'Noise', description: 'Deep, warm 6 dB/octave low-frequency blanket', credit: 'ColouredNoise DSP generator' },
  { id: 'pink_noise', name: 'Pink Noise', category: 'Noise', description: 'Balanced 3 dB/octave acoustic masking', credit: 'ColouredNoise DSP generator' },
  { id: 'white_noise', name: 'White Noise', category: 'Noise', description: 'Full-spectrum crisp masking noise', credit: 'ColouredNoise DSP generator' },
  { id: 'fan', name: 'Box Fan', category: 'Ambient', description: 'Steady bedroom fan hum and air rush', credit: 'FanSynth DSP generator' },
];

export const ALARM_TONES = [
  { id: 'chime', name: 'Soft Chime', description: 'Warm harmonic bells with slow decay' },
  { id: 'birds', name: 'Morning Birds', description: 'Gentle dawn birdsong chirps' },
  { id: 'classic', name: 'Classic Pulse', description: 'Clear dual-tone digital chime' },
  { id: 'sound:rain', name: 'Wake to Rain', description: 'Gradually swells the Rain sleep sound' },
  { id: 'sound:ocean', name: 'Wake to Ocean', description: 'Gradually swells the Ocean sleep sound' },
];

export function buildDemoDeviceState(deviceId: string): HeadphoneState {
  const now = Date.now();
  const baseDevices = [
    { address: 'A4:C1:38:92:10:4B', name: 'Pixel 9 Pro', isActiveSource: true, isThisPhone: true, isConnected: true, usesLeAudio: false },
    { address: '7C:2E:BD:44:81:0F', name: 'ThinkPad X1 Carbon', isActiveSource: false, isThisPhone: false, isConnected: true, usesLeAudio: false },
  ];

  const boseActions: ButtonActionId[] = [
    'MODES_CAROUSEL',
    'ANC_CYCLE',
    'VOICE_ASSISTANT',
    'SPOTIFY_TAP',
    'SPATIAL_AUDIO',
    'WIND_MODE',
    'BATTERY_LEVEL',
    'DISABLED',
  ];

  switch (deviceId) {
    case 'qc_ultra':
    default:
      return {
        deviceId: 'qc_ultra',
        brand: 'Bose',
        status: 'CONNECTED',
        audioLinked: true,
        batteryPercent: 72,
        isCharging: false,
        battery: { overall: { percent: 72, minutesLeft: 1020 } },
        currentModeIndex: 0,
        modes: [
          { index: 0, name: 'Quiet', isPreset: true, isEditable: true, isConfigured: true, isFavorite: true, settings: { cancellingLevel: 10, ancEnabled: true, windBlock: false, spatialAudio: 'OFF' }, changeableSettings: ['CANCELLING_LEVEL', 'WIND_BLOCK', 'SPATIAL_AUDIO', 'ANC'] },
          { index: 1, name: 'Aware', isPreset: true, isEditable: true, isConfigured: true, isFavorite: true, settings: { cancellingLevel: 0, ancEnabled: true, windBlock: false, spatialAudio: 'OFF' }, changeableSettings: ['CANCELLING_LEVEL', 'WIND_BLOCK'] },
          { index: 2, name: 'Immersion', isPreset: true, isEditable: true, isConfigured: true, isFavorite: false, settings: { cancellingLevel: 10, ancEnabled: true, windBlock: false, spatialAudio: 'HEAD' }, changeableSettings: ['CANCELLING_LEVEL', 'SPATIAL_AUDIO'] },
          { index: 3, name: 'Cinema', isPreset: true, isEditable: true, isConfigured: true, isFavorite: false, settings: { cancellingLevel: 10, ancEnabled: true, windBlock: false, spatialAudio: 'ROOM' }, changeableSettings: ['CANCELLING_LEVEL', 'SPATIAL_AUDIO'] },
          { index: 4, name: 'Home', isPreset: false, isEditable: true, isConfigured: true, isFavorite: false, settings: { cancellingLevel: 10, ancEnabled: true, windBlock: true, spatialAudio: 'OFF' }, changeableSettings: ['CANCELLING_LEVEL', 'WIND_BLOCK', 'SPATIAL_AUDIO', 'ANC'] },
        ],
        noise: { cancellingLevel: 10, ancEnabled: true, windBlock: false, spatialAudio: 'OFF' },
        eq: { bass: 0, mid: 0, treble: 0 },
        sidetone: 'LOW',
        sidetonePersistent: false,
        autoPlayPause: true,
        autoAnswer: false,
        multipointEnabled: true,
        voicePromptsEnabled: true,
        voicePromptLanguage: 'English (UK)',
        pairedDevices: baseDevices,
        info: {
          productName: 'Bose QC Ultra 2 HP',
          customName: 'Fargo',
          firmwareVersion: '10.12.12+ga927c9a',
          serialNumber: '084921Z61420098AE',
          productId: 0x4054,
          bluetoothAddress: '78:2B:64:E1:9A:02',
          protocolVersion: 'BMAP 1.2.0',
          modelName: 'QuietComfort Ultra Headphones · 2nd Gen',
          family: 'QuietComfort Ultra Headphones',
          generation: '2nd Gen',
        },
        shortcutButtons: [
          {
            buttonId: 0x80,
            eventType: 0x09,
            action: 'NOT_CONFIGURED',
            supportedActions: boseActions,
            buttonLabel: 'Shortcut Button 1',
            eventLabel: 'Long press',
          },
        ],
        lastButtonPress: null,
        micMuted: true,
        leAudioSupported: true,
        leAudioEnabled: false,
        latencyMs: 148,
        latencyRangeMs: [0, 520],
        touchControlsEnabled: true,
        volume: 22,
        volumeMax: 31,
        playbackState: 'PLAYING',
        livePushEnabled: true,
        capabilities: {
          spatialAudio: true,
          ancToggle: true,
          liveNoiseControl: true,
          windExcludesCancelling: false,
          noiseCancelling: true,
          ancAlwaysOn: false,
          windBlock: true,
          editableModes: true,
          favoriteModes: true,
          listeningModes: true,
          verified: true,
          ownSettings: true,
          modesOnHome: true,
          formFactor: 'HEADPHONES',
          supportNote: null,
          tested: true,
          batteryOnly: false,
          hasHeadphoneEq: true,
          hasSidetone: true,
          hasMultipoint: true,
          hasTouchControls: true,
          hasVoicePrompts: true,
          hasAutoPlayPause: true,
          hasAutoAnswer: true,
          hasLeAudio: true,
          hasLatency: true,
          hasStandbyTimer: false,
        },
        crusher: null,
        pairing: null,
        autoOffMinutes: null,
        vendorControls: [],
        lastUpdatedMillis: now,
      };

    case 'qc_ultra_earbuds_2':
      return {
        ...buildDemoDeviceState('qc_ultra'),
        deviceId: 'qc_ultra_earbuds_2',
        batteryPercent: 60,
        battery: {
          overall: { percent: 60, minutesLeft: 320 },
          left: { percent: 65, minutesLeft: 340 },
          right: { percent: 60, minutesLeft: 320 },
          case: { percent: 80, minutesLeft: null },
        },
        info: {
          productName: 'Bose QC Ultra 2 Earbuds',
          customName: 'Ultra Buds',
          firmwareVersion: '8.0.11+g5d1e2a0',
          serialNumber: '083310Z51180042AE',
          productId: 0x4055,
          bluetoothAddress: '78:2B:64:C2:41:18',
          protocolVersion: 'BMAP 1.2.0',
          modelName: 'QuietComfort Ultra Earbuds · 2nd Gen',
          family: 'QuietComfort Ultra Earbuds',
          generation: '2nd Gen',
        },
        shortcutButtons: [
          {
            buttonId: 0x03,
            eventType: 0x09,
            action: 'VOICE_ASSISTANT',
            supportedActions: boseActions,
            buttonLabel: 'Right earbud',
            eventLabel: 'Touch & hold',
          },
          {
            buttonId: 0x04,
            eventType: 0x09,
            action: 'SPATIAL_AUDIO',
            supportedActions: boseActions,
            buttonLabel: 'Left earbud',
            eventLabel: 'Touch & hold',
          },
        ],
        capabilities: {
          ...buildDemoDeviceState('qc_ultra').capabilities,
          formFactor: 'EARBUDS',
          tested: true,
        },
      };

    case 'qc_earbuds_2':
      return {
        ...buildDemoDeviceState('qc_ultra_earbuds_2'),
        deviceId: 'qc_earbuds_2',
        batteryPercent: 78,
        battery: {
          overall: { percent: 78, minutesLeft: 390 },
          left: { percent: 78, minutesLeft: 390 },
          right: { percent: 82, minutesLeft: 410 },
          case: { percent: 95 },
        },
        modes: [
          { index: 0, name: 'Quiet', isPreset: true, isEditable: false, isConfigured: true, isFavorite: true, settings: { cancellingLevel: 10, ancEnabled: true, windBlock: false, spatialAudio: 'OFF' } },
          { index: 1, name: 'Aware', isPreset: true, isEditable: false, isConfigured: true, isFavorite: true, settings: { cancellingLevel: 0, ancEnabled: true, windBlock: false, spatialAudio: 'OFF' } },
          { index: 2, name: 'Music', isPreset: false, isEditable: true, isConfigured: true, isFavorite: false, settings: { cancellingLevel: 7, ancEnabled: true, windBlock: false, spatialAudio: 'OFF' } },
        ],
        autoOffMinutes: 20,
        leAudioSupported: false,
        latencyMs: null,
        info: {
          productName: 'Bose QC Earbuds II',
          customName: 'QC Earbuds II',
          firmwareVersion: '4.0.5+g3a7f2c1',
          serialNumber: '082114Z31019011AE',
          productId: 0x4042,
          bluetoothAddress: '78:2B:64:90:22:0B',
          protocolVersion: 'BMAP 1.1.0',
          modelName: 'QuietComfort Earbuds II',
          family: 'QuietComfort Earbuds',
        },
        capabilities: {
          ...buildDemoDeviceState('qc_ultra_earbuds_2').capabilities,
          spatialAudio: false,
          liveNoiseControl: false,
          windBlock: false,
          tested: false,
          hasLeAudio: false,
          hasLatency: false,
          hasStandbyTimer: true,
        },
      };

    case 'qc_earbuds':
      return {
        ...buildDemoDeviceState('qc_earbuds_2'),
        deviceId: 'qc_earbuds',
        info: {
          productName: 'Bose QuietComfort Earbuds',
          customName: 'QC Earbuds (2020)',
          firmwareVersion: '2.0.7+g8c4d9b2',
          serialNumber: '080511Z01001122AE',
          productId: 0x402d,
          bluetoothAddress: '78:2B:64:14:98:C2',
          protocolVersion: 'BMAP 1.0.2',
          modelName: 'QuietComfort Earbuds (2020)',
          family: 'QuietComfort Earbuds',
        },
        capabilities: {
          ...buildDemoDeviceState('qc_earbuds_2').capabilities,
          hasTouchControls: false,
          hasAutoPlayPause: false,
          hasAutoAnswer: false,
        },
      };

    case 'qc45':
      return {
        ...buildDemoDeviceState('qc_ultra'),
        deviceId: 'qc45',
        batteryPercent: 85,
        battery: { overall: { percent: 85, minutesLeft: 1180 } },
        autoOffMinutes: 20,
        leAudioSupported: false,
        latencyMs: null,
        modes: [
          { index: 0, name: 'Quiet', isPreset: true, isEditable: false, isConfigured: true, isFavorite: true, settings: { cancellingLevel: 10, ancEnabled: true, windBlock: false, spatialAudio: 'OFF' } },
          { index: 1, name: 'Aware', isPreset: true, isEditable: false, isConfigured: true, isFavorite: true, settings: { cancellingLevel: 0, ancEnabled: true, windBlock: false, spatialAudio: 'OFF' } },
          { index: 2, name: 'Commute', isPreset: false, isEditable: true, isConfigured: true, isFavorite: false, settings: { cancellingLevel: 7, ancEnabled: true, windBlock: true, spatialAudio: 'OFF' } },
        ],
        info: {
          productName: 'Bose QC 45',
          customName: 'Bose QC45',
          firmwareVersion: '4.0.4+g1f3e5d7',
          serialNumber: '081901Z21450091AE',
          productId: 0x4033,
          bluetoothAddress: '78:2B:64:55:1A:7E',
          protocolVersion: 'BMAP 1.1.0',
          modelName: 'QuietComfort 45',
          family: 'QuietComfort',
        },
        capabilities: {
          ...buildDemoDeviceState('qc_ultra').capabilities,
          spatialAudio: false,
          ancToggle: false,
          ancAlwaysOn: true,
          liveNoiseControl: false,
          tested: false,
          hasLeAudio: false,
          hasLatency: false,
          hasTouchControls: false,
          hasAutoPlayPause: false,
          hasAutoAnswer: false,
          hasStandbyTimer: true,
        },
      };

    case 'nc700':
      return {
        ...buildDemoDeviceState('qc45'),
        deviceId: 'nc700',
        currentModeIndex: null,
        modes: [],
        info: {
          productName: 'Bose NC 700 Headphones',
          customName: 'Bose NC 700 HP',
          firmwareVersion: '2.0.4+g6b2a8e3',
          serialNumber: '079410Z90320014AE',
          productId: 0x4024,
          bluetoothAddress: '78:2B:64:09:44:D1',
          protocolVersion: 'BMAP 1.0.1',
          modelName: 'Noise Cancelling Headphones 700',
          family: 'NC 700',
        },
        capabilities: {
          ...buildDemoDeviceState('qc45').capabilities,
          listeningModes: false,
          modesOnHome: false,
          editableModes: false,
          favoriteModes: false,
          windBlock: false,
          ancAlwaysOn: false,
          ancToggle: true,
          supportNote: 'This firmware does not expose listening modes. Battery, EQ, settings and noise cancelling level work as usual.',
        },
      };

    case 'ultra_open':
      return {
        ...buildDemoDeviceState('qc_ultra_earbuds_2'),
        deviceId: 'ultra_open',
        modes: [
          { index: 0, name: 'Stereo', isPreset: true, isEditable: false, isConfigured: true, isFavorite: true, settings: { cancellingLevel: 0, ancEnabled: false, windBlock: false, spatialAudio: 'OFF' } },
          { index: 1, name: 'Immersion', isPreset: true, isEditable: false, isConfigured: true, isFavorite: true, settings: { cancellingLevel: 0, ancEnabled: false, windBlock: false, spatialAudio: 'HEAD' } },
        ],
        noise: { cancellingLevel: 0, ancEnabled: false, windBlock: false, spatialAudio: 'OFF' },
        info: {
          productName: 'Bose Ultra Open Earbuds',
          customName: 'Ultra Open',
          firmwareVersion: '4.0.22+g9e1c4f6',
          serialNumber: '084110Z41200077AE',
          productId: 0x4051,
          bluetoothAddress: '78:2B:64:B0:82:33',
          protocolVersion: 'BMAP 1.2.0',
          modelName: 'Ultra Open Earbuds',
          family: 'Ultra Open Earbuds',
        },
        capabilities: {
          ...buildDemoDeviceState('qc_ultra_earbuds_2').capabilities,
          formFactor: 'OPEN_EARBUDS',
          noiseCancelling: false,
          windBlock: false,
          ancToggle: false,
          liveNoiseControl: false,
          tested: false,
          hasLeAudio: false,
          hasLatency: false,
        },
      };

    case 'qc35_ii':
      return {
        ...buildDemoDeviceState('qc_ultra'),
        deviceId: 'qc35_ii',
        batteryPercent: 64,
        battery: { overall: { percent: 64, minutesLeft: 760 } },
        currentModeIndex: null,
        modes: [],
        noise: null,
        eq: null,
        sidetone: null,
        multipointEnabled: null,
        voicePromptsEnabled: null,
        touchControlsEnabled: null,
        autoPlayPause: null,
        autoAnswer: null,
        leAudioSupported: false,
        latencyMs: null,
        shortcutButtons: [],
        info: {
          productName: 'Bose QC35 II',
          customName: 'Bose QC35 II',
          firmwareVersion: '4.8.1',
          serialNumber: '074200Z81102003AE',
          productId: 0x4020,
          bluetoothAddress: '04:52:C7:88:12:4A',
          protocolVersion: 'BMAP Legacy',
          modelName: 'QuietComfort 35 II',
          family: 'QuietComfort 35',
        },
        capabilities: {
          ...buildDemoDeviceState('qc_ultra').capabilities,
          listeningModes: false,
          modesOnHome: false,
          noiseCancelling: false,
          spatialAudio: false,
          windBlock: false,
          ownSettings: false,
          tested: false,
          batteryOnly: true,
          hasHeadphoneEq: false,
          hasSidetone: false,
          hasMultipoint: false,
          hasTouchControls: false,
          hasVoicePrompts: false,
          hasAutoPlayPause: false,
          hasAutoAnswer: false,
          hasLeAudio: false,
          hasLatency: false,
          supportNote: 'Bose Connect-era headsets use an older protocol where Earshot reads battery and runs the Pro EQ, codec and sleep features.',
        },
      };

    case 'soundcore_sleep_a30':
      return {
        ...buildDemoDeviceState('qc_ultra_earbuds_2'),
        deviceId: 'soundcore_sleep_a30',
        brand: 'Soundcore',
        batteryPercent: 88,
        battery: {
          overall: { percent: 88, minutesLeft: 520 },
          left: { percent: 88, minutesLeft: 520 },
          right: { percent: 90, minutesLeft: 540 },
          case: { percent: 100 },
        },
        modes: [
          { index: 0, name: 'Noise cancelling', isPreset: true, isEditable: false, isConfigured: true, isFavorite: true, settings: { cancellingLevel: 10, ancEnabled: true, windBlock: false, spatialAudio: 'OFF' } },
          { index: 1, name: 'Off', isPreset: true, isEditable: false, isConfigured: true, isFavorite: false, settings: { cancellingLevel: 0, ancEnabled: false, windBlock: false, spatialAudio: 'OFF' } },
        ],
        noise: { cancellingLevel: 10, ancEnabled: true, windBlock: false, spatialAudio: 'OFF' },
        eq: null,
        sidetone: null,
        multipointEnabled: null,
        leAudioSupported: false,
        latencyMs: null,
        shortcutButtons: [],
        info: {
          productName: 'Soundcore Sleep A30',
          customName: 'Sleep A30',
          firmwareVersion: '1.42',
          serialNumber: 'SC-A30-88412',
          productId: 0xd130,
          bluetoothAddress: 'AC:12:2F:77:01:9C',
          protocolVersion: 'Soundcore D1301',
          modelName: 'Sleep A30',
          family: 'Soundcore Sleep',
        },
        vendorControls: [
          { id: 'sleep_mode', title: 'Sleep Mode', subtitle: 'Disables alerts and limits tap triggers overnight', value: 1, onHome: true },
          { id: 'snore_masking', title: 'Adaptive Snore Masking', subtitle: 'Adjusts masking floor automatically', value: 1, onHome: true },
          { id: 'touch_lock', title: 'Pillow Touch Lock', subtitle: 'Ignores accidental side-sleep taps', value: 0, onHome: true },
          { id: 'voice_prompts', title: 'Earbud Voice Prompts', value: 0, onHome: false },
        ],
        capabilities: {
          spatialAudio: false,
          ancToggle: true,
          liveNoiseControl: true,
          windExcludesCancelling: false,
          noiseCancelling: true,
          ancAlwaysOn: false,
          windBlock: false,
          editableModes: false,
          favoriteModes: false,
          listeningModes: true,
          verified: true,
          ownSettings: true,
          modesOnHome: false,
          formFactor: 'EARBUDS',
          supportNote: null,
          tested: true,
          batteryOnly: false,
          hasHeadphoneEq: false,
          hasSidetone: false,
          hasMultipoint: false,
          hasTouchControls: true,
          hasVoicePrompts: true,
          hasAutoPlayPause: false,
          hasAutoAnswer: false,
          hasLeAudio: false,
          hasLatency: false,
          hasStandbyTimer: true,
        },
        autoOffMinutes: 60,
      };

    case 'soundcore_liberty_4_nc':
    case 'soundcore_space_one_pro': {
      const isSpace = deviceId === 'soundcore_space_one_pro';
      return {
        ...buildDemoDeviceState('soundcore_sleep_a30'),
        deviceId,
        batteryPercent: 76,
        battery: isSpace
          ? { overall: { percent: 76, minutesLeft: 1800 } }
          : { overall: { percent: 76, minutesLeft: 420 }, left: { percent: 76 }, right: { percent: 79 }, case: { percent: 65 } },
        modes: [
          { index: 0, name: 'Noise Cancelling', isPreset: true, isEditable: false, isConfigured: true, isFavorite: true, settings: { cancellingLevel: 8, ancEnabled: true, windBlock: false, spatialAudio: 'OFF' } },
          { index: 1, name: 'Transparency', isPreset: true, isEditable: false, isConfigured: true, isFavorite: true, settings: { cancellingLevel: 0, ancEnabled: true, windBlock: false, spatialAudio: 'OFF' } },
          { index: 2, name: 'Normal', isPreset: true, isEditable: false, isConfigured: true, isFavorite: false, settings: { cancellingLevel: 0, ancEnabled: false, windBlock: false, spatialAudio: 'OFF' } },
        ],
        info: {
          productName: isSpace ? 'Soundcore Space One Pro' : 'Soundcore Liberty 4 NC',
          customName: isSpace ? 'Space One Pro' : 'Liberty 4 NC',
          firmwareVersion: isSpace ? '3.18' : '4.82',
          serialNumber: isSpace ? 'SC-A3062-119' : 'SC-A3947-504',
          productId: isSpace ? 0xa306 : 0xa394,
          bluetoothAddress: 'AC:12:2F:44:8B:10',
          protocolVersion: 'Soundcore Layout',
          modelName: isSpace ? 'Space One Pro' : 'Liberty 4 NC',
          family: 'Soundcore',
        },
        vendorControls: [
          { id: 'anc_mode', title: 'ANC Profile', value: 0, options: ['Adaptive', 'Manual', 'Transport'], onHome: true },
          { id: 'anc_level', title: 'Cancelling Strength', value: 4, range: [1, 5], onHome: true },
          { id: 'wind_noise', title: 'Wind Noise Reduction', value: 1, onHome: true },
          { id: 'wear_detect', title: 'Wearing Detection', value: 1, onHome: false },
          { id: 'ldac_switch', title: 'LDAC Dual Connection', value: 0, onHome: false },
        ],
        capabilities: {
          ...buildDemoDeviceState('soundcore_sleep_a30').capabilities,
          formFactor: isSpace ? 'HEADPHONES' : 'EARBUDS',
          modesOnHome: true,
          tested: false,
          hasMultipoint: true,
          hasAutoPlayPause: true,
        },
      };
    }

    case 'sennheiser_momentum_4':
      return {
        ...buildDemoDeviceState('qc_ultra'),
        deviceId: 'sennheiser_momentum_4',
        brand: 'Sennheiser',
        batteryPercent: 91,
        battery: { overall: { percent: 91, minutesLeft: 3200 } },
        modes: [
          { index: 0, name: 'ANC', isPreset: true, isEditable: false, isConfigured: true, isFavorite: true, settings: { cancellingLevel: 9, ancEnabled: true, windBlock: false, spatialAudio: 'OFF' } },
          { index: 1, name: 'Transparency', isPreset: true, isEditable: false, isConfigured: true, isFavorite: true, settings: { cancellingLevel: 0, ancEnabled: true, windBlock: false, spatialAudio: 'OFF' } },
          { index: 2, name: 'Adaptive', isPreset: true, isEditable: false, isConfigured: true, isFavorite: false, settings: { cancellingLevel: 6, ancEnabled: true, windBlock: false, spatialAudio: 'OFF' } },
        ],
        info: {
          productName: 'MOMENTUM 4',
          customName: 'MOMENTUM 4',
          firmwareVersion: '2.13.38',
          serialNumber: 'SENN-M4-994810',
          productId: 0x0044,
          bluetoothAddress: '00:1B:66:D4:11:8A',
          protocolVersion: 'GAIA v3',
          modelName: 'MOMENTUM 4 Wireless',
          family: 'MOMENTUM',
        },
        vendorControls: [
          { id: 'anti_wind', title: 'Anti-Wind', value: 1, options: ['Off', 'Auto', 'Max'], onHome: true },
          { id: 'transparency_mix', title: 'Transparency Mix', value: 70, range: [0, 100], unit: '%', onHome: true },
          { id: 'smart_pause', title: 'Smart Pause', subtitle: 'Pause playback when headphones are removed', value: 1, onHome: false },
          { id: 'comfort_call', title: 'Comfort Call', subtitle: 'Keep sidetone natural on calls', value: 1, onHome: false },
        ],
        capabilities: {
          ...buildDemoDeviceState('qc_ultra').capabilities,
          spatialAudio: false,
          tested: false,
          hasLeAudio: false,
          hasLatency: false,
          hasStandbyTimer: true,
        },
        autoOffMinutes: 15,
      };

    case 'sony_wh1000xm5':
      return {
        ...buildDemoDeviceState('qc_ultra'),
        deviceId: 'sony_wh1000xm5',
        brand: 'Sony',
        batteryPercent: 68,
        battery: { overall: { percent: 68, minutesLeft: 1200 } },
        modes: [
          { index: 0, name: 'Noise Cancelling', isPreset: true, isEditable: false, isConfigured: true, isFavorite: true, settings: { cancellingLevel: 10, ancEnabled: true, windBlock: false, spatialAudio: 'OFF' } },
          { index: 1, name: 'Ambient Sound', isPreset: true, isEditable: false, isConfigured: true, isFavorite: true, settings: { cancellingLevel: 2, ancEnabled: true, windBlock: false, spatialAudio: 'OFF' } },
          { index: 2, name: 'Off', isPreset: true, isEditable: false, isConfigured: true, isFavorite: false, settings: { cancellingLevel: 0, ancEnabled: false, windBlock: false, spatialAudio: 'OFF' } },
        ],
        info: {
          productName: 'WH-1000XM5',
          customName: 'WH-1000XM5',
          firmwareVersion: '2.3.1',
          serialNumber: 'SONY-XM5-550129',
          productId: 0x0502,
          bluetoothAddress: '88:C9:E8:31:7F:22',
          protocolVersion: 'Tandem V2',
          modelName: 'WH-1000XM5',
          family: '1000X',
        },
        vendorControls: [
          { id: 'ambient_level', title: 'Ambient Sound Level', value: 14, range: [0, 20], onHome: true },
          { id: 'voice_focus', title: 'Voice Pass-through', value: 1, onHome: true },
          { id: 'speak_to_chat', title: 'Speak-to-Chat', subtitle: 'Automatically pause when you start talking', value: 0, onHome: true },
          { id: 'dsee_extreme', title: 'DSEE Extreme', subtitle: 'Upscale compressed audio inside the headset', value: 1, onHome: false },
        ],
        capabilities: {
          ...buildDemoDeviceState('qc_ultra').capabilities,
          spatialAudio: false,
          windBlock: false,
          tested: false,
          hasStandbyTimer: true,
        },
        autoOffMinutes: 15,
      };

    case 'crusher':
    case 'crusher_secure':
      return {
        ...buildDemoDeviceState('qc_ultra'),
        deviceId,
        brand: 'Skullcandy',
        batteryPercent: 81,
        battery: { overall: { percent: 81, minutesLeft: 1950 } },
        modes: [
          { index: 0, name: 'Quiet', isPreset: true, isEditable: false, isConfigured: true, isFavorite: false, settings: { cancellingLevel: 10, ancEnabled: true, windBlock: false, spatialAudio: 'OFF' } },
          { index: 1, name: 'Aware', isPreset: true, isEditable: false, isConfigured: true, isFavorite: false, settings: { cancellingLevel: 0, ancEnabled: true, windBlock: false, spatialAudio: 'OFF' } },
          { index: 2, name: 'Off', isPreset: true, isEditable: false, isConfigured: true, isFavorite: false, settings: { cancellingLevel: 0, ancEnabled: false, windBlock: false, spatialAudio: 'OFF' } },
        ],
        crusher: {
          active: true,
          intensity: 55,
          maxIntensity: 100,
          mode: 1,
          modeCount: 3,
          intensityReadOnly: false,
        },
        pairing: deviceId === 'crusher_secure' ? { passcode: 482917, digits: 6 } : null,
        info: {
          productName: 'Crusher 1080 ANC',
          customName: deviceId === 'crusher_secure' ? 'Crusher (Pairing)' : 'Crusher 1080',
          firmwareVersion: '5.2.0',
          serialNumber: 'SKDY-C1080-7741',
          productId: 0x1080,
          bluetoothAddress: 'C8:7B:23:19:AA:50',
          protocolVersion: 'Bragi BOS',
          modelName: 'Crusher 1080 ANC',
          family: 'Crusher',
        },
        capabilities: {
          ...buildDemoDeviceState('qc_ultra').capabilities,
          spatialAudio: false,
          windBlock: false,
          favoriteModes: false,
          editableModes: false,
          tested: false,
          hasHeadphoneEq: false,
          hasLeAudio: false,
          hasLatency: false,
        },
      };

    case 'method_360':
    case 'method_540':
      return {
        ...buildDemoDeviceState('crusher'),
        deviceId,
        batteryPercent: 74,
        battery: {
          overall: { percent: 74, minutesLeft: 360 },
          left: { percent: 74 },
          right: { percent: 76 },
          case: { percent: 88 },
        },
        crusher: null,
        info: {
          productName: deviceId === 'method_360' ? 'Method 360 ANC' : 'Method 540 ANC',
          customName: deviceId === 'method_360' ? 'Method 360 ANC' : 'Method 540 ANC',
          firmwareVersion: '3.0.4',
          serialNumber: 'SKDY-MTH-2290',
          productId: deviceId === 'method_360' ? 0x0360 : 0x0540,
          bluetoothAddress: 'C8:7B:23:44:12:09',
          protocolVersion: 'Bragi BOS',
          modelName: deviceId === 'method_360' ? 'Method 360 ANC' : 'Method 540 ANC',
          family: 'Method',
        },
        capabilities: {
          ...buildDemoDeviceState('crusher').capabilities,
          formFactor: 'EARBUDS',
        },
      };

    case 'jbl_wave_buds_2':
      return {
        ...buildDemoDeviceState('soundcore_sleep_a30'),
        deviceId: 'jbl_wave_buds_2',
        brand: 'JBL',
        batteryPercent: 84,
        battery: {
          overall: { percent: 84, minutesLeft: 440 },
          left: { percent: 84 },
          right: { percent: 86 },
          case: { percent: 70 },
        },
        modes: [
          { index: 0, name: 'Noise Cancelling', isPreset: true, isEditable: false, isConfigured: true, isFavorite: true, settings: { cancellingLevel: 10, ancEnabled: true, windBlock: false, spatialAudio: 'OFF' } },
          { index: 1, name: 'Ambient Aware', isPreset: true, isEditable: false, isConfigured: true, isFavorite: true, settings: { cancellingLevel: 0, ancEnabled: true, windBlock: false, spatialAudio: 'OFF' } },
          { index: 2, name: 'TalkThru', isPreset: true, isEditable: false, isConfigured: true, isFavorite: false, settings: { cancellingLevel: 0, ancEnabled: true, windBlock: false, spatialAudio: 'OFF' } },
          { index: 3, name: 'Off', isPreset: true, isEditable: false, isConfigured: true, isFavorite: false, settings: { cancellingLevel: 0, ancEnabled: false, windBlock: false, spatialAudio: 'OFF' } },
        ],
        info: {
          productName: 'JBL Wave Buds 2',
          customName: 'JBL Wave Buds 2',
          firmwareVersion: '1.8.0',
          serialNumber: 'JBL-WB2-33109',
          productId: 0x2002,
          bluetoothAddress: 'FC:58:FA:62:91:04',
          protocolVersion: 'JBL H-AA (BLE)',
          modelName: 'Wave Buds 2',
          family: 'Wave',
        },
        vendorControls: [
          { id: 'jbl_eq_preset', title: 'Headset EQ Preset', value: 0, options: ['Jazz', 'Vocal', 'Bass', 'Club', 'Studio'], onHome: true },
          { id: 'smart_audio', title: 'Smart Audio Mode', value: 0, options: ['Normal', 'Audio', 'Video'], onHome: true },
          { id: 'voice_aware', title: 'VoiceAware (Sidetone)', value: 1, options: ['Low', 'Mid', 'High'], onHome: false },
        ],
        capabilities: {
          ...buildDemoDeviceState('soundcore_sleep_a30').capabilities,
          modesOnHome: true,
          tested: false,
        },
      };

    case 'airpods_pro':
      return {
        ...buildDemoDeviceState('qc35_ii'),
        deviceId: 'airpods_pro',
        brand: 'Apple',
        batteryPercent: 85,
        isCharging: false,
        battery: {
          overall: { percent: 85, minutesLeft: 270 },
          left: { percent: 90, minutesLeft: 280 },
          right: { percent: 80, minutesLeft: 260 },
          case: { percent: 60 },
        },
        info: {
          productName: 'AirPods Pro',
          customName: 'AirPods Pro (demo)',
          firmwareVersion: '6F21',
          serialNumber: 'H2L8X9901059',
          productId: 0x2014,
          bluetoothAddress: 'D4:90:9C:11:3E:F8',
          protocolVersion: 'Apple Continuity BLE',
          modelName: 'AirPods Pro (2nd Gen)',
          family: 'AirPods Pro',
        },
        capabilities: {
          ...buildDemoDeviceState('qc35_ii').capabilities,
          formFactor: 'EARBUDS',
          batteryOnly: true,
          supportNote: 'Apple Continuity BLE advertises left, right, and case battery levels. Pro EQ, Codec, Sleep, and Tools work for every headset.',
        },
      };
  }
}

export function getLabProfile(state: HeadphoneState): LabProfile | null {
  if (!state.capabilities.ownSettings || state.status !== 'CONNECTED') return null;

  if (state.brand === 'Bose') {
    const groups: LabGroup[] = [
      { id: 0, code: '0', name: 'ProductInfo', readCount: 6 },
      { id: 1, code: '1', name: 'Settings', readCount: 9 },
      { id: 2, code: '2', name: 'Status', readCount: 6 },
      { id: 4, code: '4', name: 'DeviceManagement', readCount: 7 },
      { id: 5, code: '5', name: 'AudioManagement', readCount: 5 },
      { id: 31, code: '31', name: 'AudioModes', readCount: 5 },
    ];
    return {
      stack: 'Bose BMAP',
      groupNoun: 'Block',
      groups,
      safetyNote: 'Every frame passes the BMAP ReadOnlyWriteGuard — only GET and GET_ALL operators are permitted; firmware update and factory reset blocks are never sent.',
      printConsole: true,
    };
  }

  if (state.brand === 'Sennheiser') {
    return {
      stack: 'Sennheiser GAIA v3',
      groupNoun: 'Feature',
      groups: [
        { id: 1, code: '01', name: 'Core & Battery', readCount: 4 },
        { id: 2, code: '02', name: 'ANC & Transparency', readCount: 5 },
        { id: 3, code: '03', name: 'User EQ & Sound', readCount: 4 },
      ],
      safetyNote: 'Read-only GAIA v3 scanner: only GET feature commands are dispatched.',
      printConsole: false,
    };
  }

  if (state.brand === 'Sony') {
    return {
      stack: 'Sony Tandem V2',
      groupNoun: 'Table',
      groups: [
        { id: 1, code: 'T1', name: 'Device Info & Power', readCount: 5 },
        { id: 2, code: 'T1', name: 'Ambient & Speak-to-Chat', readCount: 4 },
        { id: 3, code: 'T2', name: 'EQ & DSEE Extreme', readCount: 3 },
      ],
      safetyNote: 'Read-only Tandem V2 scanner: only *_GET frames are sent.',
      printConsole: false,
    };
  }

  if (state.brand === 'Skullcandy') {
    return {
      stack: 'Bragi BOS',
      groupNoun: 'Service',
      groups: [
        { id: 1, code: '0x01', name: 'Device Identity & Battery', readCount: 4 },
        { id: 2, code: '0x04', name: 'ANC & Sidetone', readCount: 3 },
        { id: 3, code: '0x08', name: 'Crusher Haptics', readCount: 3 },
      ],
      safetyNote: 'Bragi BOS read-only probe: protobuf SET messages are blocked by the Lab guard.',
      printConsole: false,
    };
  }

  if (state.brand === 'JBL') {
    return {
      stack: 'JBL H-AA (GATT)',
      groupNoun: 'Command Group',
      groups: [
        { id: 1, code: '0x01', name: 'Battery & Firmware', readCount: 3 },
        { id: 2, code: '0x02', name: 'Listening Modes & EQ', readCount: 4 },
      ],
      safetyNote: 'JBL H-AA read-only scanner over GATT notifications.',
      printConsole: false,
    };
  }

  return {
    stack: 'Soundcore Protocol',
    groupNoun: 'Category',
    groups: [
      { id: 1, code: '01', name: 'State & Battery', readCount: 4 },
      { id: 2, code: '06', name: 'Noise & Sound Modes', readCount: 4 },
    ],
    safetyNote: 'Soundcore read-only scanner: only state query frames (0x01) are sent.',
    printConsole: false,
  };
}

export function runMockLabScan(state: HeadphoneState, groupIds: number[]): LabReading[] {
  const out: LabReading[] = [];
  const hexAddr = state.info.bluetoothAddress.replace(/:/g, ' ').toLowerCase();

  if (groupIds.includes(0) || groupIds.includes(1)) {
    out.push({
      address: '[0.1]',
      block: 0,
      functionId: 1,
      knownName: 'BmapVersion',
      groupName: 'ProductInfo',
      decodedSummary: state.info.protocolVersion ?? '1.2.0',
      frames: [{ block: 0, functionId: 1, operatorName: 'STATUS', payloadHex: '31 2e 32 2e 30', isError: false }],
    });
    out.push({
      address: '[0.5]',
      block: 0,
      functionId: 5,
      knownName: 'FirmwareVersion',
      groupName: 'ProductInfo',
      decodedSummary: state.info.firmwareVersion,
      frames: [{ block: 0, functionId: 5, operatorName: 'STATUS', payloadHex: '31 30 2e 31 32 2e 31 32', isError: false }],
    });
    out.push({
      address: '[0.7]',
      block: 0,
      functionId: 7,
      knownName: 'SerialNumber',
      groupName: 'ProductInfo',
      decodedSummary: state.info.serialNumber,
      frames: [{ block: 0, functionId: 7, operatorName: 'STATUS', payloadHex: '30 38 34 39 32 31 5a', isError: false }],
    });
  }

  if (groupIds.includes(1) || groupIds.includes(2)) {
    out.push({
      address: '[2.2]',
      block: 2,
      functionId: 2,
      knownName: 'BatteryLevel',
      groupName: 'Status',
      decodedSummary: `${state.batteryPercent ?? '--'}%${state.isCharging ? ' (charging)' : ''}`,
      frames: [{ block: 2, functionId: 2, operatorName: 'STATUS', payloadHex: `${(state.batteryPercent ?? 0).toString(16).padStart(2, '0')} ff ff 04`, isError: false }],
    });
    out.push({
      address: '[1.2]',
      block: 1,
      functionId: 2,
      knownName: 'ProductName',
      groupName: 'Settings',
      decodedSummary: state.info.customName,
      frames: [{ block: 1, functionId: 2, operatorName: 'STATUS', payloadHex: '00 46 61 72 67 6f', isError: false }],
    });
  }

  if (groupIds.includes(4) || groupIds.includes(2)) {
    out.push({
      address: '[4.9]',
      block: 4,
      functionId: 9,
      knownName: 'AppAddress',
      groupName: 'DeviceManagement',
      decodedSummary: state.info.bluetoothAddress,
      frames: [{ block: 4, functionId: 9, operatorName: 'STATUS', payloadHex: hexAddr, isError: false }],
    });
    out.push({
      address: '[4.1]',
      block: 4,
      functionId: 1,
      knownName: 'PairedDevices',
      groupName: 'DeviceManagement',
      decodedSummary: `${state.pairedDevices.length} paired sources`,
      frames: [{ block: 4, functionId: 1, operatorName: 'STATUS', payloadHex: '02 a4 c1 38 92 10 4b', isError: false }],
    });
  }

  if (groupIds.includes(5) || groupIds.includes(3)) {
    out.push({
      address: '[5.5]',
      block: 5,
      functionId: 5,
      knownName: 'AbsoluteVolume',
      groupName: 'AudioManagement',
      decodedSummary: `${state.volume} / ${state.volumeMax}`,
      frames: [{ block: 5, functionId: 5, operatorName: 'STATUS', payloadHex: `${state.volumeMax.toString(16).padStart(2, '0')} ${state.volume.toString(16).padStart(2, '0')}`, isError: false }],
    });
    if (state.latencyMs !== null) {
      out.push({
        address: '[5.7]',
        block: 5,
        functionId: 7,
        knownName: 'AudioLatency',
        groupName: 'AudioManagement',
        decodedSummary: `${state.latencyMs} ms`,
        frames: [{ block: 5, functionId: 7, operatorName: 'STATUS', payloadHex: `00 ${state.latencyMs.toString(16).padStart(2, '0')} 02 08`, isError: false }],
      });
    }
  }

  if (groupIds.includes(31) || groupIds.includes(2)) {
    out.push({
      address: '[31.10]',
      block: 31,
      functionId: 10,
      knownName: 'LiveNoiseSettings',
      groupName: 'AudioModes',
      decodedSummary: state.noise
        ? `CNC ${state.noise.cancellingLevel}/10 · ANC ${state.noise.ancEnabled ? 'ON' : 'OFF'} · Wind ${state.noise.windBlock ? 'ON' : 'OFF'} · Spatial ${state.noise.spatialAudio}`
        : 'Not supported',
      frames: [
        {
          block: 31,
          functionId: 10,
          operatorName: state.noise ? 'STATUS' : 'ERROR',
          payloadHex: state.noise
            ? `${(10 - state.noise.cancellingLevel).toString(16).padStart(2, '0')} ${state.noise.ancEnabled ? '01' : '00'} ${state.noise.windBlock ? '01' : '00'}`
            : '06',
          isError: !state.noise,
          errorName: state.noise ? undefined : 'FblockNotSupp',
        },
      ],
    });
  }

  return out;
}
