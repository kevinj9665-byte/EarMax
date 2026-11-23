import React, { useState } from 'react';
import {
  Bluetooth,
  BluetoothOff,
  ChevronDown,
  Headphones,
  MicOff,
  Mic,
  Pause,
  Play,
  RefreshCw,
  SkipBack,
  SkipForward,
  Star,
  Volume2,
  X,
  Plus,
  Check,
  Radio,
} from 'lucide-react';
import { useEarshot } from '../context/EarshotContext';
import {
  BatteryDial,
  EarshotCard,
  FieldSlider,
  FieldSwitch,
  InfoBanner,
  LegendHeading,
  SubScreenHeader,
  SupportTierBadge,
} from '../components/EarshotPrimitives';
import { DEMO_DEVICES } from '../data/virtualDevices';
import { NoiseSettings, SpatialAudio, SupportTier } from '../types/earshot';

function deriveSupportTier(
  caps: ReturnType<typeof useEarshot>['headphone']['capabilities'],
  status: string,
): SupportTier | null {
  if (status !== 'CONNECTED') return null;
  if (!caps.ownSettings) return caps.batteryOnly ? 'BATTERY_ONLY' : 'ANY_HEADSET';
  if (caps.batteryOnly) return 'BATTERY_ONLY';
  if (caps.tested) return 'TESTED';
  return 'EXPERIMENTAL';
}

function formatHoursLeft(minutes?: number | null): string | null {
  if (!minutes || minutes <= 0) return null;
  const hrs = Math.round(minutes / 60);
  return `Lasts about ${hrs} h`;
}

export const DeviceSwitcherModal: React.FC = () => {
  const {
    deviceSwitcherOpen,
    setDeviceSwitcherOpen,
    demoDeviceId,
    selectDemoDevice,
    headphone,
    connectHeadset,
    disconnectHeadset,
  } = useEarshot();

  if (!deviceSwitcherOpen) return null;

  const grouped = DEMO_DEVICES.reduce<Record<string, typeof DEMO_DEVICES>>((acc, d) => {
    if (!acc[d.brand]) acc[d.brand] = [];
    acc[d.brand].push(d);
    return acc;
  }, {});

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-xs p-0 md:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Switch headset"
      onClick={() => setDeviceSwitcherOpen(false)}
    >
      <div
        className="w-full max-w-xl max-h-[85vh] flex flex-col bg-[var(--earshot-surface)] border border-[var(--earshot-hairline)] rounded-t-[var(--earshot-radius-lg)] md:rounded-[var(--earshot-radius-lg)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--earshot-hairline)]">
          <div>
            <LegendHeading className="text-xl">Switch demo headset</LegendHeading>
            <p className="text-xs text-[var(--earshot-muted)]">
              19 virtual profiles across 7 brands · No real Bluetooth hardware required
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDeviceSwitcherOpen(false)}
            aria-label="Close switcher"
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-[var(--earshot-radius-sm)] hover:bg-[var(--earshot-surface-high)] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between gap-3 p-3 rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-surface-low)] border border-[var(--earshot-hairline)]">
            <div className="text-sm">
              <span className="font-medium">Connection state:</span>{' '}
              <span className="font-mono-tabular">{headphone.status}</span>
            </div>
            {headphone.status === 'CONNECTED' ? (
              <button
                type="button"
                onClick={disconnectHeadset}
                className="px-3 py-1.5 text-xs font-medium rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] hover:bg-[var(--earshot-surface-high)] cursor-pointer whitespace-nowrap"
              >
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                onClick={connectHeadset}
                className="px-3 py-1.5 text-xs font-medium rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-accent)] text-[var(--earshot-on-accent)] cursor-pointer whitespace-nowrap"
              >
                Reconnect
              </button>
            )}
          </div>

          {Object.entries(grouped).map(([brand, list]) => (
            <div key={brand} className="space-y-1.5">
              <div className="text-xs font-mono-tabular uppercase tracking-wider text-[var(--earshot-muted)] px-1">
                {brand}
              </div>
              <div className="space-y-1.5">
                {list.map((d) => {
                  const selected = d.id === demoDeviceId;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        selectDemoDevice(d.id);
                        setDeviceSwitcherOpen(false);
                      }}
                      className={`w-full text-left p-3 rounded-[var(--earshot-radius-sm)] border transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                        selected
                          ? 'bg-[var(--earshot-accent)]/15 border-[var(--earshot-accent)]'
                          : 'bg-[var(--earshot-surface-low)] border-[var(--earshot-hairline)] hover:bg-[var(--earshot-surface-high)]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-[var(--earshot-ink)]">{d.displayName}</span>
                          <SupportTierBadge tier={d.tier} />
                        </div>
                        <p className="text-xs text-[var(--earshot-muted)] mt-0.5 truncate">{d.summary}</p>
                      </div>
                      {selected && <Check className="w-4 h-4 text-[var(--earshot-accent)] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const ModesScreen: React.FC = () => {
  const { headphone, goBack, selectMode, toggleModeFavorite, saveModeConfig } = useEarshot();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editSettings, setEditSettings] = useState<NoiseSettings>({
    cancellingLevel: 10,
    ancEnabled: true,
    windBlock: false,
    spatialAudio: 'OFF',
  });

  const startEditing = (idx: number, name: string, settings: NoiseSettings | null) => {
    setEditingIndex(idx);
    setEditName(name);
    setEditSettings(
      settings ?? {
        cancellingLevel: 8,
        ancEnabled: true,
        windBlock: false,
        spatialAudio: 'OFF',
      },
    );
  };

  return (
    <div className="space-y-4">
      <SubScreenHeader
        title="Listening modes"
        subtitle={`${headphone.info.customName} · Tap to switch, star favourites, or edit custom slots`}
        onBack={goBack}
      />

      {editingIndex !== null && (
        <EarshotCard className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <LegendHeading className="text-lg">
              {headphone.modes.some((m) => m.index === editingIndex) ? `Edit "${editName}"` : 'New custom mode'}
            </LegendHeading>
            <button
              type="button"
              onClick={() => setEditingIndex(null)}
              className="text-xs text-[var(--earshot-muted)] hover:text-[var(--earshot-ink)] cursor-pointer"
            >
              Cancel
            </button>
          </div>
          <div>
            <label className="block text-xs font-mono-tabular uppercase text-[var(--earshot-muted)] mb-1">
              Mode name
            </label>
            <input
              type="text"
              value={editName}
              maxLength={24}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface-low)] text-[var(--earshot-ink)]"
            />
          </div>

          {headphone.capabilities.noiseCancelling && (
            <>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Noise cancelling level</span>
                  <span className="font-mono-tabular">{editSettings.cancellingLevel}</span>
                </div>
                <FieldSlider
                  min={0}
                  max={10}
                  value={editSettings.cancellingLevel}
                  onChange={(v) => setEditSettings((s) => ({ ...s, cancellingLevel: v }))}
                />
              </div>
              {headphone.capabilities.windBlock && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Wind Block</span>
                  <FieldSwitch
                    checked={editSettings.windBlock}
                    onChange={(v) => setEditSettings((s) => ({ ...s, windBlock: v }))}
                  />
                </div>
              )}
            </>
          )}

          {headphone.capabilities.spatialAudio && (
            <div className="space-y-1.5">
              <span className="text-sm block">Immersive Audio</span>
              <div className="grid grid-cols-3 border border-[var(--earshot-hairline)] rounded-[var(--earshot-radius-sm)] overflow-hidden">
                {(['OFF', 'ROOM', 'HEAD'] as SpatialAudio[]).map((sa) => (
                  <button
                    key={sa}
                    type="button"
                    onClick={() => setEditSettings((s) => ({ ...s, spatialAudio: sa }))}
                    className={`py-2 text-xs font-medium cursor-pointer transition-colors ${
                      editSettings.spatialAudio === sa
                        ? 'bg-[var(--earshot-control)] text-[var(--earshot-on-control)]'
                        : 'bg-[var(--earshot-surface-low)] text-[var(--earshot-ink)]'
                    }`}
                  >
                    {sa === 'OFF' ? 'OFF' : sa === 'ROOM' ? 'STILL' : 'MOTION'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              if (!editName.trim()) return;
              saveModeConfig(editingIndex, editName.trim(), editSettings);
              setEditingIndex(null);
            }}
            className="w-full py-2.5 px-4 rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-accent)] text-[var(--earshot-on-accent)] font-semibold text-sm cursor-pointer"
          >
            Save mode to headset
          </button>
        </EarshotCard>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {headphone.modes.map((mode) => {
          const active = mode.index === headphone.currentModeIndex;
          return (
            <EarshotCard
              key={mode.index}
              className={`p-4 flex items-center justify-between gap-3 ${
                active ? 'ring-2 ring-[var(--earshot-accent)]' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => selectMode(mode.index)}
                className="flex-1 text-left cursor-pointer min-w-0"
              >
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-lg tracking-wide uppercase truncate">
                    {mode.name}
                  </span>
                  {active && (
                    <span className="text-[11px] font-mono-tabular uppercase text-[var(--earshot-accent)]">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--earshot-muted)] font-mono-tabular mt-0.5">
                  {mode.isPreset ? 'Built-in' : 'Custom slot'} ·{' '}
                  {mode.settings
                    ? `Cancelling ${mode.settings.cancellingLevel}/10${
                        mode.settings.windBlock ? ' · Wind block' : ''
                      }${mode.settings.spatialAudio !== 'OFF' ? ` · ${mode.settings.spatialAudio}` : ''}`
                    : 'No settings'}
                </p>
              </button>
              <div className="flex items-center gap-1.5 shrink-0">
                {headphone.capabilities.favoriteModes && (
                  <button
                    type="button"
                    aria-label={mode.isFavorite ? 'Remove favourite' : 'Star as favourite'}
                    onClick={() => toggleModeFavorite(mode.index)}
                    className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-[var(--earshot-radius-sm)] hover:bg-[var(--earshot-surface-high)] cursor-pointer"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        mode.isFavorite
                          ? 'fill-[var(--earshot-accent)] text-[var(--earshot-accent)]'
                          : 'text-[var(--earshot-muted)]'
                      }`}
                    />
                  </button>
                )}
                {headphone.capabilities.editableModes && mode.isEditable && (
                  <button
                    type="button"
                    onClick={() => startEditing(mode.index, mode.name, mode.settings)}
                    className="px-3 py-1.5 text-xs font-medium rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] hover:bg-[var(--earshot-surface-high)] cursor-pointer"
                  >
                    Edit
                  </button>
                )}
              </div>
            </EarshotCard>
          );
        })}

        {headphone.capabilities.editableModes && (
          <button
            type="button"
            onClick={() => {
              const nextIdx = Math.max(4, ...headphone.modes.map((m) => m.index + 1));
              startEditing(nextIdx, `Custom ${nextIdx - 3}`, headphone.noise);
            }}
            className="p-4 border border-dashed border-[var(--earshot-hairline)] rounded-[var(--earshot-radius-md)] flex items-center justify-center gap-2 text-sm font-medium text-[var(--earshot-muted)] hover:text-[var(--earshot-ink)] hover:bg-[var(--earshot-surface)] transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add custom listening mode
          </button>
        )}
      </div>
    </div>
  );
};

export const HomeScreen: React.FC = () => {
  const {
    headphone,
    subRoute,
    navigateSubRoute,
    setDeviceSwitcherOpen,
    refreshHeadset,
    connectHeadset,
    selectMode,
    toggleModeFavorite,
    updateNoiseSettings,
    btd700ModeActive,
    setBtd700Mode,
    setActiveSense,
    togglePlayback,
    stepTrack,
    setVolume,
    setCrusher,
    setVendorControl,
    answerPairing,
    copyConnectionReport,
    appearance,
  } = useEarshot();

  if (subRoute === 'home/modes') {
    return <ModesScreen />;
  }

  const tier = deriveSupportTier(headphone.capabilities, headphone.status);
  const isConnected = headphone.status === 'CONNECTED';
  const hrsLeft = formatHoursLeft(headphone.battery.overall?.minutesLeft);

  return (
    <div className="space-y-4">
      {/* Pairing prompt (e.g. Skullcandy Crusher Secure) */}
      {headphone.pairing && (
        <InfoBanner
          tone="warn"
          action={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => answerPairing(false)}
                className="px-3 py-1.5 text-xs font-medium rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-warn-ink)]/30 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => answerPairing(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-accent)] text-[var(--earshot-on-accent)] cursor-pointer"
              >
                Confirm {headphone.pairing.passcode}
              </button>
            </div>
          }
        >
          <strong>Pairing check:</strong> Confirm the 6-digit code{' '}
          <span className="font-mono-tabular font-bold">{headphone.pairing.passcode}</span> matches your headset to
          unlock encrypted controls.
        </InfoBanner>
      )}

      {/* Top Row: Connection Header + Now Playing (2 columns on desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <EarshotCard className="lg:col-span-7 p-4 md:p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <BatteryDial
              percent={isConnected ? headphone.batteryPercent : null}
              charging={headphone.isCharging}
              size={84}
            />
            <div className="min-w-0 space-y-1">
              <button
                type="button"
                onClick={() => setDeviceSwitcherOpen(true)}
                className="inline-flex items-center gap-1.5 text-left group cursor-pointer max-w-full"
              >
                <span className="font-display font-bold text-2xl md:text-3xl tracking-wide uppercase truncate text-[var(--earshot-ink)]">
                  {headphone.info.customName}
                </span>
                <ChevronDown className="w-5 h-5 text-[var(--earshot-ink)] shrink-0 group-hover:translate-y-0.5 transition-transform" />
              </button>

              <div className="flex items-center gap-2 text-xs font-mono-tabular uppercase tracking-wide text-[var(--earshot-muted)]">
                <Headphones className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{headphone.info.modelName}</span>
              </div>

              {headphone.battery.left || headphone.battery.right || headphone.battery.case ? (
                <div className="flex items-center gap-3 text-xs font-mono-tabular text-[var(--earshot-ink)] pt-0.5">
                  {headphone.battery.left?.percent !== undefined && <span>L {headphone.battery.left.percent}%</span>}
                  {headphone.battery.right?.percent !== undefined && <span>R {headphone.battery.right.percent}%</span>}
                  {headphone.battery.case?.percent !== undefined && <span>Case {headphone.battery.case.percent}%</span>}
                </div>
              ) : null}

              <div className="flex items-center gap-2 text-xs font-mono-tabular uppercase tracking-wider pt-0.5">
                <span className={isConnected ? 'text-[var(--earshot-ink)] font-semibold' : 'text-[var(--earshot-error)] font-semibold'}>
                  {headphone.status}
                </span>
                {hrsLeft && isConnected && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[var(--earshot-muted)]">{hrsLeft}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={refreshHeadset}
            aria-label="Refresh headset state"
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-[var(--earshot-radius-sm)] hover:bg-[var(--earshot-surface-high)] transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw className="w-5 h-5 text-[var(--earshot-ink)]" />
          </button>
        </EarshotCard>

        {/* Now Playing & Volume */}
        <EarshotCard className="lg:col-span-5 p-4 md:p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <LegendHeading className="text-lg leading-tight">Now playing</LegendHeading>
              <span className="text-xs font-mono-tabular uppercase tracking-wider text-[var(--earshot-muted)]">
                {isConnected ? headphone.playbackState : 'Offline'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                disabled={!isConnected}
                onClick={() => stepTrack('prev')}
                aria-label="Previous track"
                className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-[var(--earshot-radius-sm)] hover:bg-[var(--earshot-surface-high)] disabled:opacity-40 cursor-pointer"
              >
                <SkipBack className="w-5 h-5" />
              </button>
              <button
                type="button"
                disabled={!isConnected}
                onClick={togglePlayback}
                aria-label={headphone.playbackState === 'PLAYING' ? 'Pause' : 'Play'}
                className="w-12 h-11 inline-flex items-center justify-center rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-control)] text-[var(--earshot-on-control)] disabled:opacity-40 cursor-pointer"
              >
                {headphone.playbackState === 'PLAYING' ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <button
                type="button"
                disabled={!isConnected}
                onClick={() => stepTrack('next')}
                aria-label="Next track"
                className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-[var(--earshot-radius-sm)] hover:bg-[var(--earshot-surface-high)] disabled:opacity-40 cursor-pointer"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Volume2 className="w-4 h-4 text-[var(--earshot-muted)] shrink-0" />
            <FieldSlider
              min={0}
              max={headphone.volumeMax}
              value={headphone.volume}
              disabled={!isConnected}
              onChange={setVolume}
              ariaLabel="Headset volume"
            />
            <span className="text-xs font-mono-tabular text-[var(--earshot-ink)] whitespace-nowrap shrink-0">
              {headphone.volume} / {headphone.volumeMax}
            </span>
          </div>
        </EarshotCard>
      </div>

      {/* Status Chips Row */}
      <div className="flex flex-wrap items-center gap-2">
        {isConnected && (
          <>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono-tabular uppercase tracking-wider rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-chip)] text-[var(--earshot-on-chip)]">
              {headphone.micMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              {headphone.micMuted ? 'Mic muted' : 'Mic live'}
            </span>
            {headphone.livePushEnabled && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono-tabular uppercase tracking-wider rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-chip)] text-[var(--earshot-on-chip)]">
                <Radio className="w-3.5 h-3.5 text-[var(--earshot-accent)]" />
                Live updates
              </span>
            )}
          </>
        )}
        {tier && <SupportTierBadge tier={tier} />}
      </div>

      {/* Disconnected Card */}
      {!isConnected && (
        <EarshotCard className="p-6 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-[var(--earshot-surface-high)] flex items-center justify-center">
            <BluetoothOff className="w-6 h-6 text-[var(--earshot-muted)]" />
          </div>
          <div>
            <LegendHeading className="text-xl">{headphone.info.customName} is disconnected</LegendHeading>
            <p className="text-sm text-[var(--earshot-muted)] mt-1 max-w-md mx-auto">
              Pro EQ, Sleep soundscapes, and previously saved automations stay ready. Reconnect or pick another virtual headset.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={connectHeadset}
              className="px-5 py-2.5 text-sm font-semibold rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-accent)] text-[var(--earshot-on-accent)] cursor-pointer inline-flex items-center gap-2"
            >
              <Bluetooth className="w-4 h-4" />
              Connect
            </button>
            <button
              type="button"
              onClick={() => setDeviceSwitcherOpen(true)}
              className="px-4 py-2.5 text-sm font-medium rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] hover:bg-[var(--earshot-surface-high)] cursor-pointer"
            >
              Switch demo headset
            </button>
          </div>
        </EarshotCard>
      )}

      {/* Honest Support Note / Experimental Report Banner */}
      {isConnected && headphone.capabilities.supportNote && (
        <InfoBanner tone="neutral">{headphone.capabilities.supportNote}</InfoBanner>
      )}
      {isConnected && tier === 'EXPERIMENTAL' && (
        <InfoBanner
          tone="warn"
          action={
            <button
              type="button"
              onClick={() => void copyConnectionReport()}
              className="px-3 py-1.5 text-xs font-semibold rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-ink)] text-[var(--earshot-bg)] cursor-pointer whitespace-nowrap"
            >
              Copy report
            </button>
          }
        >
          <strong>Experimental driver:</strong> Built from protocol captures. If you test on real hardware, share a connection report from Tools → Lab.
        </InfoBanner>
      )}

      {/* Listening Modes Carousel */}
      {isConnected && headphone.capabilities.listeningModes && headphone.capabilities.modesOnHome && headphone.modes.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <LegendHeading className="text-xl">Modes</LegendHeading>
            <button
              type="button"
              onClick={() => navigateSubRoute('home/modes')}
              className="text-xs font-mono-tabular uppercase tracking-wider border-b-2 border-[var(--earshot-accent)] pb-0.5 text-[var(--earshot-ink)] hover:opacity-80 cursor-pointer"
            >
              Edit modes
            </button>
          </div>

          <div className="flex items-stretch gap-2.5 overflow-x-auto no-scrollbar pb-1">
            {headphone.modes.map((mode) => {
              const active = mode.index === headphone.currentModeIndex;
              return (
                <div
                  key={mode.index}
                  className={`shrink-0 flex items-center rounded-[var(--earshot-radius-sm)] border transition-colors ${
                    active
                      ? 'bg-[var(--earshot-accent)] text-[var(--earshot-on-accent)] border-[var(--earshot-ink)]'
                      : 'bg-[var(--earshot-surface)] text-[var(--earshot-ink)] border-[var(--earshot-hairline)] hover:bg-[var(--earshot-surface-high)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectMode(mode.index)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (headphone.capabilities.favoriteModes) toggleModeFavorite(mode.index);
                    }}
                    className="px-4 py-3 flex items-center gap-2 font-display font-bold text-base tracking-wide cursor-pointer whitespace-nowrap"
                  >
                    {mode.isFavorite && (
                      <Star
                        className={`w-4 h-4 ${
                          active ? 'fill-[var(--earshot-on-accent)]' : 'fill-[var(--earshot-ink)]'
                        }`}
                      />
                    )}
                    <span className={appearance === 'field' ? 'uppercase' : ''}>{mode.name}</span>
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] font-mono-tabular uppercase tracking-wider text-[var(--earshot-muted)]">
            Tap to switch · Right-click or Edit modes to favourite
          </p>

          {(headphone.capabilities.formFactor === 'EARBUDS' || headphone.capabilities.activeSense) && (
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-[var(--earshot-radius-md)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface)]">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--earshot-ink)]">BTD 700 Mode</div>
                <div className="text-xs text-[var(--earshot-muted)]">
                  {btd700ModeActive
                    ? 'USB-C aptX Lossless Pro EQ active · Defaulted to Quiet (NC 10) & ActiveSense Off — customize freely anytime.'
                    : 'Defaults to Quiet (NC 10) & ActiveSense Off — customize anytime. Unlocks USB aptX Lossless Pro EQ.'}
                </div>
              </div>
              <FieldSwitch
                checked={btd700ModeActive}
                onChange={setBtd700Mode}
                label="Toggle BTD 700 Mode"
              />
            </div>
          )}
        </section>
      )}

      {/* Main Controls Grid on Desktop: Noise Controls + Crusher/Vendor Controls */}
      {isConnected && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {headphone.noise && (headphone.capabilities.noiseCancelling || headphone.capabilities.spatialAudio) && (
            <EarshotCard
              className={`p-4 md:p-5 space-y-4 ${
                headphone.crusher || headphone.vendorControls.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'
              }`}
            >
              <LegendHeading className="text-xl">Noise</LegendHeading>

              {headphone.capabilities.noiseCancelling && (
                <>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Noise cancelling</span>
                      <span className="font-mono-tabular font-semibold">{headphone.noise.cancellingLevel}</span>
                    </div>
                    <FieldSlider
                      min={0}
                      max={10}
                      value={headphone.noise.cancellingLevel}
                      disabled={!headphone.noise.ancEnabled && !headphone.capabilities.ancAlwaysOn}
                      onChange={(val) => updateNoiseSettings({ cancellingLevel: val })}
                      ariaLabel="Noise cancelling level"
                    />
                    <div className="flex justify-between text-[11px] font-mono-tabular uppercase tracking-wider text-[var(--earshot-muted)]">
                      <span>Aware</span>
                      <span>Quiet</span>
                    </div>
                    {btd700ModeActive && (
                      <p className="text-xs text-[var(--earshot-muted)] pt-1">
                        BTD 700 Mode defaulted to Quiet (NC 10) &amp; ActiveSense Off — customize freely anytime.
                      </p>
                    )}
                  </div>

                  {headphone.capabilities.activeSense && (
                    <div className="flex items-center justify-between pt-3 border-t border-dashed border-[var(--earshot-hairline)]">
                      <div className="min-w-0 pr-3">
                        <div className="text-sm font-medium">ActiveSense</div>
                        <div className="text-xs text-[var(--earshot-muted)]">
                          AutoAwareNoise adaptively dampens sudden loud noise
                        </div>
                      </div>
                      <FieldSwitch
                        checked={Boolean(headphone.activeSenseEnabled)}
                        onChange={setActiveSense}
                        label="Toggle ActiveSense"
                      />
                    </div>
                  )}

                  {headphone.capabilities.ancToggle && (
                    <div className="flex items-center justify-between pt-3 border-t border-dashed border-[var(--earshot-hairline)]">
                      <div>
                        <div className="text-sm font-medium">ANC power</div>
                        {headphone.capabilities.ancAlwaysOn && (
                          <div className="text-xs text-[var(--earshot-muted)]">Always active on this model</div>
                        )}
                      </div>
                      <FieldSwitch
                        checked={headphone.noise.ancEnabled}
                        disabled={headphone.capabilities.ancAlwaysOn}
                        onChange={(v) => updateNoiseSettings({ ancEnabled: v })}
                        label="Toggle ANC power"
                      />
                    </div>
                  )}

                  {headphone.capabilities.windBlock && (
                    <div className="flex items-center justify-between pt-3 border-t border-dashed border-[var(--earshot-hairline)]">
                      <span className="text-sm font-medium">Wind Block</span>
                      <FieldSwitch
                        checked={headphone.noise.windBlock}
                        onChange={(v) => updateNoiseSettings({ windBlock: v })}
                        label="Toggle wind block"
                      />
                    </div>
                  )}
                </>
              )}

              {headphone.capabilities.spatialAudio && (
                <div className="space-y-2 pt-3 border-t border-dashed border-[var(--earshot-hairline)]">
                  <span className="text-sm font-medium block">Immersive Audio</span>
                  <div className="grid grid-cols-3 border border-[var(--earshot-hairline)] rounded-[var(--earshot-radius-sm)] overflow-hidden">
                    {([
                      { id: 'OFF', label: 'Off' },
                      { id: 'ROOM', label: 'Still' },
                      { id: 'HEAD', label: 'Motion' },
                    ] as { id: SpatialAudio; label: string }[]).map((opt) => {
                      const active = headphone.noise?.spatialAudio === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => updateNoiseSettings({ spatialAudio: opt.id })}
                          className={`py-2.5 text-xs font-display font-bold tracking-wider cursor-pointer transition-colors ${
                            appearance === 'field' ? 'uppercase' : ''
                          } ${
                            active
                              ? 'bg-[var(--earshot-control)] text-[var(--earshot-on-control)]'
                              : 'bg-[var(--earshot-surface-low)] text-[var(--earshot-ink)] hover:bg-[var(--earshot-surface-high)]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </EarshotCard>
          )}

          {/* Skullcandy Crusher Haptic Bass Card */}
          {headphone.crusher && (
            <EarshotCard className="lg:col-span-5 p-4 md:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <LegendHeading className="text-xl">Crusher Bass</LegendHeading>
                <FieldSwitch
                  checked={headphone.crusher.active}
                  onChange={(active) => setCrusher({ active })}
                  label="Toggle Crusher haptic bass"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Haptic intensity</span>
                  <span className="font-mono-tabular">{headphone.crusher.intensity}%</span>
                </div>
                <FieldSlider
                  min={0}
                  max={headphone.crusher.maxIntensity}
                  value={headphone.crusher.intensity}
                  disabled={!headphone.crusher.active || headphone.crusher.intensityReadOnly}
                  onChange={(intensity) => setCrusher({ intensity })}
                  ariaLabel="Crusher bass intensity"
                />
              </div>

              {headphone.crusher.modeCount > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-dashed border-[var(--earshot-hairline)]">
                  <span className="text-sm font-medium block">Bass feel</span>
                  <div className="grid grid-cols-3 border border-[var(--earshot-hairline)] rounded-[var(--earshot-radius-sm)] overflow-hidden">
                    {['High', 'Medium', 'Low'].map((label, idx) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setCrusher({ mode: idx })}
                        className={`py-2 text-xs font-display font-bold tracking-wider uppercase cursor-pointer ${
                          headphone.crusher?.mode === idx
                            ? 'bg-[var(--earshot-control)] text-[var(--earshot-on-control)]'
                            : 'bg-[var(--earshot-surface-low)] text-[var(--earshot-ink)]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </EarshotCard>
          )}

          {/* Vendor Controls Card (Soundcore, Sennheiser, Sony, JBL) */}
          {headphone.vendorControls.filter((vc) => vc.onHome).length > 0 && (
            <EarshotCard
              className={`p-4 md:p-5 space-y-4 ${
                headphone.noise ? 'lg:col-span-5' : 'lg:col-span-12'
              }`}
            >
              <LegendHeading className="text-xl">{headphone.brand} Controls</LegendHeading>
              <div className="space-y-3.5">
                {headphone.vendorControls
                  .filter((vc) => vc.onHome)
                  .map((vc) => (
                    <div key={vc.id} className="space-y-1.5 pb-3 border-b last:border-b-0 last:pb-0 border-dashed border-[var(--earshot-hairline)]">
                      {vc.options ? (
                        <>
                          <span className="text-sm font-medium block">{vc.title}</span>
                          <div className="flex flex-wrap gap-1.5">
                            {vc.options.map((opt, idx) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => setVendorControl(vc.id, idx)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-[var(--earshot-radius-sm)] border cursor-pointer ${
                                  vc.value === idx
                                    ? 'bg-[var(--earshot-control)] text-[var(--earshot-on-control)] border-transparent'
                                    : 'bg-[var(--earshot-surface-low)] border-[var(--earshot-hairline)]'
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </>
                      ) : vc.range ? (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{vc.title}</span>
                            <span className="font-mono-tabular">
                              {vc.value}
                              {vc.unit ?? ''}
                            </span>
                          </div>
                          <FieldSlider
                            min={vc.range[0]}
                            max={vc.range[1]}
                            value={vc.value ?? vc.range[0]}
                            onChange={(v) => setVendorControl(vc.id, v)}
                            ariaLabel={vc.title}
                          />
                        </>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium">{vc.title}</div>
                            {vc.subtitle && <div className="text-xs text-[var(--earshot-muted)]">{vc.subtitle}</div>}
                          </div>
                          <FieldSwitch
                            checked={vc.value === 1}
                            onChange={(v) => setVendorControl(vc.id, v ? 1 : 0)}
                            label={vc.title}
                          />
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </EarshotCard>
          )}
        </div>
      )}
    </div>
  );
};
