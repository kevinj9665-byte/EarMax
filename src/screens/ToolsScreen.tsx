import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Bluetooth,
  CheckCircle2,
  ChevronRight,
  Copy,
  FlaskConical,
  Hand,
  History,
  Mic,
  Phone,
  Play,
  Radio,
  Square,
  Volume2,
} from 'lucide-react';
import { useEarshot } from '../context/EarshotContext';
import {
  EarshotCard,
  FieldSlider,
  FieldSwitch,
  InfoBanner,
  LegendHeading,
  SubScreenHeader,
} from '../components/EarshotPrimitives';
import { BUTTON_ACTION_LABELS, getLabProfile } from '../data/virtualDevices';
import { sleepAudioEngine } from '../audio/sleepAudioEngine';
import { ButtonActionId, CodecType, Sidetone } from '../types/earshot';

// 1. Controls & Shortcuts Remapper
const ControlsScreen: React.FC = () => {
  const {
    headphone,
    goBack,
    setButtonAction,
    setTouchControls,
    setAutoPlayPause,
    setAutoAnswer,
    simulateDemoButtonPress,
  } = useEarshot();
  const [detectOpen, setDetectOpen] = useState(false);

  return (
    <div className="space-y-4">
      <SubScreenHeader
        title="Controls"
        subtitle="Headset buttons, touch sensors & press detection"
        onBack={goBack}
        action={
          <button
            type="button"
            onClick={() => setDetectOpen((v) => !v)}
            className="px-3 py-2 text-xs font-semibold rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-control)] text-[var(--earshot-on-control)] cursor-pointer"
          >
            {detectOpen ? 'Hide detector' : 'Detect button'}
          </button>
        }
      />

      {detectOpen && (
        <EarshotCard className="p-4 space-y-3 border-[var(--earshot-accent)]">
          <div className="flex items-center justify-between">
            <LegendHeading className="text-lg">Detect headset press</LegendHeading>
            <span className="text-xs font-mono-tabular text-[var(--earshot-muted)]">Demo press simulator</span>
          </div>
          <p className="text-xs text-[var(--earshot-muted)]">
            Trigger a virtual headset button press below to verify how Earshot captures media keys and programmable BMAP pushes:
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => simulateDemoButtonPress('main')}
              className="px-3 py-2 text-xs font-medium rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface-low)] hover:bg-[var(--earshot-surface-high)] cursor-pointer"
            >
              Press Shortcut Button
            </button>
            <button
              type="button"
              onClick={() => simulateDemoButtonPress('play_pause')}
              className="px-3 py-2 text-xs font-medium rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface-low)] hover:bg-[var(--earshot-surface-high)] cursor-pointer"
            >
              Tap Play / Pause
            </button>
            <button
              type="button"
              onClick={() => simulateDemoButtonPress('vol_up')}
              className="px-3 py-2 text-xs font-medium rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface-low)] hover:bg-[var(--earshot-surface-high)] cursor-pointer"
            >
              Swipe Volume Up
            </button>
          </div>
          {headphone.lastButtonPress && (
            <div className="flex items-center gap-2 text-xs font-mono-tabular text-[var(--earshot-ok)] pt-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                Detected: {headphone.lastButtonPress.buttonLabel} ({headphone.lastButtonPress.eventLabel}) →{' '}
                {BUTTON_ACTION_LABELS[headphone.lastButtonPress.action]}
              </span>
            </div>
          )}
        </EarshotCard>
      )}

      {headphone.shortcutButtons.length > 0 && (
        <EarshotCard className="p-4 md:p-5 space-y-4">
          <LegendHeading className="text-xl">Programmable buttons</LegendHeading>
          {headphone.shortcutButtons.map((btn) => (
            <div
              key={btn.buttonId}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b last:border-b-0 last:pb-0 border-dashed border-[var(--earshot-hairline)]"
            >
              <div>
                <div className="font-medium text-sm">{btn.buttonLabel}</div>
                <div className="text-xs text-[var(--earshot-muted)]">{btn.eventLabel}</div>
              </div>
              <select
                value={btn.action}
                onChange={(e) => setButtonAction(btn.buttonId, e.target.value as ButtonActionId)}
                className="px-3 py-2 text-sm rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface-low)]"
              >
                {btn.supportedActions.map((act) => (
                  <option key={act} value={act}>
                    {BUTTON_ACTION_LABELS[act]}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </EarshotCard>
      )}

      <EarshotCard className="p-4 md:p-5 space-y-3.5">
        <LegendHeading className="text-xl">Sensors &amp; Touch</LegendHeading>
        {headphone.capabilities.hasTouchControls && headphone.touchControlsEnabled !== null && (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Touch controls</div>
              <div className="text-xs text-[var(--earshot-muted)]">Enable capacitive earcup/earbud taps and swipes</div>
            </div>
            <FieldSwitch
              checked={headphone.touchControlsEnabled}
              onChange={setTouchControls}
              label="Touch controls"
            />
          </div>
        )}
        {headphone.capabilities.hasAutoPlayPause && headphone.autoPlayPause !== null && (
          <div className="flex items-center justify-between pt-2 border-t border-dashed border-[var(--earshot-hairline)]">
            <div>
              <div className="text-sm font-medium">On-head detection (Auto play/pause)</div>
              <div className="text-xs text-[var(--earshot-muted)]">Pause audio when you take the headphones off</div>
            </div>
            <FieldSwitch checked={headphone.autoPlayPause} onChange={setAutoPlayPause} label="Auto play pause" />
          </div>
        )}
        {headphone.capabilities.hasAutoAnswer && headphone.autoAnswer !== null && (
          <div className="flex items-center justify-between pt-2 border-t border-dashed border-[var(--earshot-hairline)]">
            <div>
              <div className="text-sm font-medium">Auto-answer calls</div>
              <div className="text-xs text-[var(--earshot-muted)]">Pick up incoming calls when putting headphones on</div>
            </div>
            <FieldSwitch checked={headphone.autoAnswer} onChange={setAutoAnswer} label="Auto answer" />
          </div>
        )}
      </EarshotCard>
    </div>
  );
};

// 2. Connection & Latency
const ConnectionScreen: React.FC = () => {
  const {
    headphone,
    goBack,
    setMultipoint,
    setLeAudioEnabled,
    switchActivePairedDevice,
    navigateSubRoute,
  } = useEarshot();

  return (
    <div className="space-y-4">
      <SubScreenHeader
        title="Connection & latency"
        subtitle="Multipoint, LE Audio, latency & paired sources"
        onBack={goBack}
        action={
          <button
            type="button"
            onClick={() => navigateSubRoute('tools/timeline')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] hover:bg-[var(--earshot-surface-high)] cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
            Timeline
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EarshotCard className="p-4 md:p-5 space-y-4">
          <LegendHeading className="text-xl">Radio &amp; Latency</LegendHeading>

          {headphone.latencyMs !== null && (
            <div className="p-3 rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-surface-low)] border border-[var(--earshot-hairline)] flex items-center justify-between">
              <div>
                <div className="text-xs font-mono-tabular uppercase text-[var(--earshot-muted)]">Audio Latency</div>
                <div className="text-2xl font-display font-bold tabular-nums">{headphone.latencyMs} ms</div>
              </div>
              {headphone.latencyRangeMs && (
                <span className="text-xs font-mono-tabular text-[var(--earshot-muted)]">
                  Range {headphone.latencyRangeMs[0]}–{headphone.latencyRangeMs[1]} ms
                </span>
              )}
            </div>
          )}

          {headphone.capabilities.hasMultipoint && headphone.multipointEnabled !== null && (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Multi-point connection</div>
                <div className="text-xs text-[var(--earshot-muted)]">Stay connected to two Bluetooth sources at once</div>
              </div>
              <FieldSwitch checked={headphone.multipointEnabled} onChange={setMultipoint} label="Multipoint" />
            </div>
          )}

          {headphone.capabilities.hasLeAudio && (
            <div className="flex items-center justify-between pt-2 border-t border-dashed border-[var(--earshot-hairline)]">
              <div>
                <div className="text-sm font-medium">LE Audio (LC3)</div>
                <div className="text-xs text-[var(--earshot-muted)]">
                  {headphone.leAudioSupported ? 'Firmware supports LE Audio unicast' : 'Not supported on this firmware'}
                </div>
              </div>
              <FieldSwitch
                checked={headphone.leAudioEnabled}
                disabled={!headphone.leAudioSupported}
                onChange={setLeAudioEnabled}
                label="LE Audio"
              />
            </div>
          )}
        </EarshotCard>

        <EarshotCard className="p-4 md:p-5 space-y-3">
          <LegendHeading className="text-xl">Paired sources</LegendHeading>
          <div className="space-y-2">
            {headphone.pairedDevices.map((dev) => (
              <div
                key={dev.address}
                className="p-3 rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-surface-low)] border border-[var(--earshot-hairline)] flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <span className="truncate">{dev.name}</span>
                    {dev.isThisPhone && (
                      <span className="text-[10px] font-mono-tabular uppercase text-[var(--earshot-accent)]">
                        This device
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-mono-tabular text-[var(--earshot-muted)]">{dev.address}</div>
                </div>
                <button
                  type="button"
                  onClick={() => switchActivePairedDevice(dev.address)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-[var(--earshot-radius-sm)] cursor-pointer shrink-0 ${
                    dev.isActiveSource
                      ? 'bg-[var(--earshot-accent)] text-[var(--earshot-on-accent)]'
                      : 'border border-[var(--earshot-hairline)] hover:bg-[var(--earshot-surface-high)]'
                  }`}
                >
                  {dev.isActiveSource ? 'Active' : 'Switch here'}
                </button>
              </div>
            ))}
          </div>
        </EarshotCard>
      </div>
    </div>
  );
};

// 3. Codec Screen
const CodecScreen: React.FC = () => {
  const { codecState, setPreferredCodec, toggleShizukuMode, goBack } = useEarshot();

  return (
    <div className="space-y-4">
      <SubScreenHeader title="Codec" subtitle="Active Bluetooth A2DP / LE Audio stream parameters" onBack={goBack} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <EarshotCard className="lg:col-span-5 p-4 md:p-5 space-y-4">
          <LegendHeading className="text-xl">Active stream</LegendHeading>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-surface-low)] border border-[var(--earshot-hairline)]">
              <div className="text-[11px] font-mono-tabular uppercase text-[var(--earshot-muted)]">Codec</div>
              <div className="font-display font-bold text-2xl">{codecState.activeCodec}</div>
            </div>
            <div className="p-3 rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-surface-low)] border border-[var(--earshot-hairline)]">
              <div className="text-[11px] font-mono-tabular uppercase text-[var(--earshot-muted)]">Bitrate</div>
              <div className="font-display font-bold text-2xl tabular-nums">{codecState.bitrateKbps} kbps</div>
            </div>
            <div className="p-3 rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-surface-low)] border border-[var(--earshot-hairline)]">
              <div className="text-[11px] font-mono-tabular uppercase text-[var(--earshot-muted)]">Sample rate</div>
              <div className="font-mono-tabular font-semibold text-base">
                {(codecState.sampleRateHz / 1000).toFixed(1)} kHz
              </div>
            </div>
            <div className="p-3 rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-surface-low)] border border-[var(--earshot-hairline)]">
              <div className="text-[11px] font-mono-tabular uppercase text-[var(--earshot-muted)]">Depth</div>
              <div className="font-mono-tabular font-semibold text-base">{codecState.bitsPerSample}-bit</div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-dashed border-[var(--earshot-hairline)]">
            <div>
              <div className="text-sm font-medium">Privileged codec route (Shizuku sim)</div>
              <div className="text-xs text-[var(--earshot-muted)]">
                Simulates elevated A2DP codec switching without Android Developer Options
              </div>
            </div>
            <FieldSwitch
              checked={codecState.shizukuAvailable}
              onChange={toggleShizukuMode}
              label="Privileged codec route"
            />
          </div>
        </EarshotCard>

        <EarshotCard className="lg:col-span-7 p-4 md:p-5 space-y-3">
          <LegendHeading className="text-xl">Switch codec</LegendHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {codecState.supportedCodecs.map((c: CodecType) => {
              const active = codecState.activeCodec === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPreferredCodec(c)}
                  className={`p-3.5 text-left rounded-[var(--earshot-radius-sm)] border cursor-pointer transition-colors ${
                    active
                      ? 'bg-[var(--earshot-accent)] text-[var(--earshot-on-accent)] border-[var(--earshot-ink)]'
                      : 'bg-[var(--earshot-surface-low)] border-[var(--earshot-hairline)] hover:bg-[var(--earshot-surface-high)]'
                  }`}
                >
                  <div className="font-display font-bold text-lg">{c}</div>
                  <div className={`text-xs ${active ? 'opacity-85' : 'text-[var(--earshot-muted)]'}`}>
                    {active ? 'Currently active' : 'Tap to request switch'}
                  </div>
                </button>
              );
            })}
          </div>
        </EarshotCard>
      </div>
    </div>
  );
};

// 4. Call Audio Screen
const CallAudioScreen: React.FC = () => {
  const { headphone, callAudio, updateCallAudio, setSidetone, setSidetonePersistent, goBack } = useEarshot();

  return (
    <div className="space-y-4">
      <SubScreenHeader title="Call audio" subtitle="Call volume boost, sidetone & HFP codec" onBack={goBack} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EarshotCard className="p-4 md:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <LegendHeading className="text-xl">Louder calls</LegendHeading>
              <p className="text-xs text-[var(--earshot-muted)]">Boost quiet voice calls over HFP / LE Audio</p>
            </div>
            <FieldSwitch
              checked={callAudio.boostEnabled}
              onChange={(boostEnabled) => updateCallAudio({ boostEnabled })}
              label="Call boost"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Boost gain</span>
              <span className="font-mono-tabular">+{callAudio.boostGainDb} dB</span>
            </div>
            <FieldSlider
              min={1}
              max={10}
              value={callAudio.boostGainDb}
              disabled={!callAudio.boostEnabled}
              onChange={(boostGainDb) => updateCallAudio({ boostGainDb })}
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-dashed border-[var(--earshot-hairline)]">
            <span className="text-sm font-medium">Auto-boost when call starts</span>
            <FieldSwitch
              checked={callAudio.autoBoostOnCall}
              onChange={(autoBoostOnCall) => updateCallAudio({ autoBoostOnCall })}
              label="Auto boost on call"
            />
          </div>

          <div className="p-3 rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-surface-low)] border border-[var(--earshot-hairline)] text-xs font-mono-tabular flex justify-between">
            <span className="text-[var(--earshot-muted)]">Hands-free codec</span>
            <span>{callAudio.callCodec}</span>
          </div>
        </EarshotCard>

        {headphone.capabilities.hasSidetone && headphone.sidetone && (
          <EarshotCard className="p-4 md:p-5 space-y-4">
            <LegendHeading className="text-xl">Sidetone (own voice)</LegendHeading>
            <p className="text-xs text-[var(--earshot-muted)]">
              Hear your own voice naturally during calls so you don&apos;t shout.
            </p>
            <div className="grid grid-cols-4 border border-[var(--earshot-hairline)] rounded-[var(--earshot-radius-sm)] overflow-hidden">
              {(['OFF', 'LOW', 'MEDIUM', 'HIGH'] as Sidetone[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSidetone(st)}
                  className={`py-2.5 text-xs font-medium cursor-pointer ${
                    headphone.sidetone === st
                      ? 'bg-[var(--earshot-control)] text-[var(--earshot-on-control)]'
                      : 'bg-[var(--earshot-surface-low)]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-dashed border-[var(--earshot-hairline)]">
              <span className="text-sm font-medium">Keep sidetone persistent</span>
              <FieldSwitch
                checked={headphone.sidetonePersistent}
                onChange={setSidetonePersistent}
                label="Persistent sidetone"
              />
            </div>
          </EarshotCard>
        )}
      </div>
    </div>
  );
};

// 5. Mic Check (Real Browser MediaRecorder + Web Audio Analyser)
const MicCheckScreen: React.FC = () => {
  const { goBack } = useEarshot();
  const [status, setStatus] = useState<'idle' | 'recording' | 'recorded' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      setErrorMsg(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        analyser.getByteTimeDomainData(data);
        let maxDev = 0;
        for (let i = 0; i < data.length; i++) {
          const d = Math.abs(data[i] - 128) / 128;
          if (d > maxDev) maxDev = d;
        }
        setLevel(Math.min(100, Math.round(maxDev * 180)));
        rafRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();

      const chunks: BlobPart[] = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setStatus('recorded');
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        stream.getTracks().forEach((t) => t.stop());
        void ctx.close();
      };
      recorderRef.current = rec;
      rec.start();
      setStatus('recording');
    } catch (err) {
      setStatus('error');
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Microphone access was denied or unavailable in this browser.',
      );
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
  };

  return (
    <div className="space-y-4">
      <SubScreenHeader title="Mic check" subtitle="Record a quick clip and play it back" onBack={goBack} />

      <EarshotCard className="p-5 max-w-xl space-y-4">
        <p className="text-sm text-[var(--earshot-muted)]">
          Test how your headset microphone sounds before joining a call. Audio stays completely local in your browser.
        </p>

        {status === 'error' && errorMsg && <InfoBanner tone="warn">{errorMsg}</InfoBanner>}

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-mono-tabular text-[var(--earshot-muted)]">
            <span>Input level</span>
            <span>{status === 'recording' ? `${level}%` : 'Idle'}</span>
          </div>
          <div className="h-3 w-full rounded-full bg-[var(--earshot-track)] overflow-hidden">
            <div
              className="h-full bg-[var(--earshot-accent)] transition-all duration-75"
              style={{ width: `${status === 'recording' ? level : 0}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {status !== 'recording' ? (
            <button
              type="button"
              onClick={() => void startRecording()}
              className="px-5 py-3 rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-control)] text-[var(--earshot-on-control)] text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <Mic className="w-4 h-4" />
              Start recording
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="px-5 py-3 rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-accent)] text-[var(--earshot-on-accent)] text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          )}
        </div>

        {audioUrl && (
          <div className="pt-3 border-t border-dashed border-[var(--earshot-hairline)] space-y-2">
            <div className="text-xs font-mono-tabular uppercase text-[var(--earshot-muted)]">Playback</div>
            <audio controls src={audioUrl} className="w-full" />
          </div>
        )}
      </EarshotCard>
    </div>
  );
};

// 6. Find My Headphones
const FindScreen: React.FC = () => {
  const { headphone, goBack } = useEarshot();
  const [playing, setPlaying] = useState(false);
  const [channel, setChannel] = useState<'BOTH' | 'LEFT' | 'RIGHT'>('BOTH');
  const [volume, setVolume] = useState(0.5);

  useEffect(() => {
    return () => sleepAudioEngine.stopFindBeacon();
  }, []);

  const toggleBeacon = () => {
    if (playing) {
      sleepAudioEngine.stopFindBeacon();
      setPlaying(false);
    } else {
      sleepAudioEngine.startFindBeacon(channel, volume);
      setPlaying(true);
    }
  };

  return (
    <div className="space-y-4">
      <SubScreenHeader title="Find my headphones" subtitle="Play a high-clarity beacon chirp" onBack={goBack} />

      <EarshotCard className="p-5 max-w-xl space-y-4">
        <InfoBanner tone="warn">
          Make sure {headphone.info.customName} are not on your ears before raising the volume.
        </InfoBanner>

        <div className="space-y-1.5">
          <span className="text-xs font-mono-tabular uppercase text-[var(--earshot-muted)] block">Channel</span>
          <div className="grid grid-cols-3 border border-[var(--earshot-hairline)] rounded-[var(--earshot-radius-sm)] overflow-hidden">
            {(['LEFT', 'BOTH', 'RIGHT'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setChannel(c);
                  if (playing) sleepAudioEngine.startFindBeacon(c, volume);
                }}
                className={`py-2.5 text-xs font-medium cursor-pointer ${
                  channel === c
                    ? 'bg-[var(--earshot-control)] text-[var(--earshot-on-control)]'
                    : 'bg-[var(--earshot-surface-low)]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Volume2 className="w-4 h-4" /> Beacon level
            </span>
            <span className="font-mono-tabular">{Math.round(volume * 100)}%</span>
          </div>
          <FieldSlider
            min={0.1}
            max={1}
            step={0.05}
            value={volume}
            onChange={(v) => {
              setVolume(v);
              if (playing) sleepAudioEngine.startFindBeacon(channel, v);
            }}
          />
        </div>

        <button
          type="button"
          onClick={toggleBeacon}
          className={`w-full py-3.5 px-4 rounded-[var(--earshot-radius-sm)] font-semibold text-sm inline-flex items-center justify-center gap-2 cursor-pointer ${
            playing
              ? 'bg-[var(--earshot-accent)] text-[var(--earshot-on-accent)]'
              : 'bg-[var(--earshot-control)] text-[var(--earshot-on-control)]'
          }`}
        >
          {playing ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {playing ? 'Stop beacon' : 'Play beacon chirp'}
        </button>
      </EarshotCard>
    </div>
  );
};

// 7. Timeline Screen
const TimelineScreen: React.FC = () => {
  const { timeline, clearTimeline, goBack } = useEarshot();
  return (
    <div className="space-y-4">
      <SubScreenHeader
        title="Connection timeline"
        subtitle="Protocol events and link state history"
        onBack={goBack}
        action={
          <button
            type="button"
            onClick={clearTimeline}
            className="px-3 py-2 text-xs font-medium rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] cursor-pointer"
          >
            Clear
          </button>
        }
      />

      <EarshotCard className="p-4 space-y-2.5">
        {timeline.length === 0 ? (
          <p className="text-sm text-[var(--earshot-muted)]">No events recorded yet.</p>
        ) : (
          timeline.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start justify-between gap-3 pb-2.5 border-b last:border-b-0 last:pb-0 border-dashed border-[var(--earshot-hairline)]"
            >
              <div>
                <div className="text-sm font-medium">{entry.event}</div>
                <div className="text-xs text-[var(--earshot-muted)]">
                  {entry.deviceName} · {entry.detail}
                </div>
              </div>
              <span className="text-xs font-mono-tabular text-[var(--earshot-muted)] shrink-0">
                {new Date(entry.atMillis).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          ))
        )}
      </EarshotCard>
    </div>
  );
};

// 8. Lab Protocol Explorer
const LabScreen: React.FC = () => {
  const {
    headphone,
    labReadings,
    labPrintConsole,
    labScanning,
    runLabScan,
    copyConnectionReport,
    goBack,
    navigateSubRoute,
  } = useEarshot();
  const profile = getLabProfile(headphone);
  const [selectedGroups, setSelectedGroups] = useState<number[]>([0, 1, 2, 4, 5, 31]);

  const toggleGroup = (id: number) => {
    setSelectedGroups((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-4">
      <SubScreenHeader
        title="Lab"
        subtitle={profile ? `${profile.stack} · Read-only protocol explorer` : 'No vendor stack active'}
        onBack={goBack}
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigateSubRoute('tools/timeline')}
              className="px-3 py-2 text-xs font-medium rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] cursor-pointer"
            >
              Timeline
            </button>
            <button
              type="button"
              onClick={() => void copyConnectionReport()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-control)] text-[var(--earshot-on-control)] cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy report
            </button>
          </div>
        }
      />

      {!profile ? (
        <InfoBanner tone="neutral">
          Connect a supported headset (or pick one in the demo switcher) to scan its protocol blocks.
        </InfoBanner>
      ) : (
        <div className="space-y-4">
          <InfoBanner tone="neutral">{profile.safetyNote}</InfoBanner>

          <EarshotCard className="p-4 space-y-3">
            <LegendHeading className="text-lg">Select {profile.groupNoun}s</LegendHeading>
            <div className="flex flex-wrap gap-2">
              {profile.groups.map((g) => {
                const active = selectedGroups.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGroup(g.id)}
                    className={`px-3 py-1.5 text-xs font-mono-tabular rounded-[var(--earshot-radius-sm)] border cursor-pointer ${
                      active
                        ? 'bg-[var(--earshot-accent)] text-[var(--earshot-on-accent)] border-[var(--earshot-ink)]'
                        : 'bg-[var(--earshot-surface-low)] border-[var(--earshot-hairline)]'
                    }`}
                  >
                    [{g.code}] {g.name} ({g.readCount})
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={labScanning || selectedGroups.length === 0}
                onClick={() => runLabScan(selectedGroups, false)}
                className="px-4 py-2 text-xs font-semibold rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-control)] text-[var(--earshot-on-control)] disabled:opacity-40 cursor-pointer"
              >
                {labScanning ? 'Scanning…' : 'Scan selected'}
              </button>
              <button
                type="button"
                disabled={labScanning}
                onClick={() => runLabScan([], true)}
                className="px-4 py-2 text-xs font-medium rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] hover:bg-[var(--earshot-surface-high)] cursor-pointer"
              >
                Deep scan
              </button>
            </div>
          </EarshotCard>

          {labReadings.length > 0 && (
            <EarshotCard className="p-4 space-y-2.5">
              <LegendHeading className="text-lg">Decoded readings</LegendHeading>
              <div className="space-y-2">
                {labReadings.map((r) => (
                  <div
                    key={r.address}
                    className="p-3 rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-surface-low)] border border-[var(--earshot-hairline)] text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-tabular font-semibold">
                        {r.address} {r.knownName}
                      </span>
                      <span className="text-[var(--earshot-muted)]">{r.groupName}</span>
                    </div>
                    <div className="text-sm text-[var(--earshot-ink)]">{r.decodedSummary}</div>
                    {r.frames.map((f, idx) => (
                      <div key={idx} className="font-mono-tabular text-[11px] text-[var(--earshot-muted)]">
                        {f.operatorName}: {f.payloadHex} {f.errorName ? `(${f.errorName})` : ''}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </EarshotCard>
          )}

          {profile.printConsole && (
            <EarshotCard className="p-4 space-y-2">
              <LegendHeading className="text-lg">Protocol print log</LegendHeading>
              <div className="p-3 rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-surface-low)] border border-[var(--earshot-hairline)] font-mono-tabular text-xs space-y-1 max-h-40 overflow-y-auto">
                {labPrintConsole.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            </EarshotCard>
          )}
        </div>
      )}
    </div>
  );
};

export const ToolsScreen: React.FC = () => {
  const { headphone, codecState, subRoute, navigateSubRoute } = useEarshot();

  if (subRoute === 'tools/controls') return <ControlsScreen />;
  if (subRoute === 'tools/connection') return <ConnectionScreen />;
  if (subRoute === 'tools/codec') return <CodecScreen />;
  if (subRoute === 'tools/call') return <CallAudioScreen />;
  if (subRoute === 'tools/mic') return <MicCheckScreen />;
  if (subRoute === 'tools/find') return <FindScreen />;
  if (subRoute === 'tools/lab') return <LabScreen />;
  if (subRoute === 'tools/timeline') return <TimelineScreen />;

  const primaryButton = headphone.shortcutButtons[0];
  const controlsSummary = primaryButton
    ? `${primaryButton.buttonLabel}: ${BUTTON_ACTION_LABELS[primaryButton.action]} · Touch controls ${
        headphone.touchControlsEnabled ? 'on' : 'off'
      }`
    : 'Button remapping & sensor settings';

  const rows = [
    {
      route: 'tools/controls',
      icon: Hand,
      title: 'Controls',
      subtitle: controlsSummary,
    },
    {
      route: 'tools/connection',
      icon: Bluetooth,
      title: 'Connection & latency',
      subtitle: `LE Audio ${headphone.leAudioEnabled ? 'on' : 'off'}, multipoint, ${
        headphone.latencyMs !== null ? `${headphone.latencyMs} ms` : 'latency'
      }`,
    },
    {
      route: 'tools/codec',
      icon: Radio,
      title: 'Codec',
      subtitle: `${codecState.activeCodec} · ${(codecState.sampleRateHz / 1000).toFixed(1)} kHz / ${codecState.bitsPerSample}-bit`,
    },
    {
      route: 'tools/call',
      icon: Phone,
      title: 'Call audio',
      subtitle: 'Louder calls, sidetone, call codec',
    },
    {
      route: 'tools/mic',
      icon: Mic,
      title: 'Mic check',
      subtitle: 'Record a few seconds and play it back',
    },
    {
      route: 'tools/find',
      icon: Bell,
      title: 'Find my headphones',
      subtitle: 'Play a sound in them and follow it',
    },
    {
      route: 'tools/lab',
      icon: FlaskConical,
      title: 'Lab',
      subtitle: 'Protocol explorer (scanner reads only)',
    },
  ];

  return (
    <div className="space-y-4">
      <LegendHeading className="text-3xl">Tools</LegendHeading>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <button
              key={row.route}
              type="button"
              onClick={() => navigateSubRoute(row.route)}
              className="w-full text-left cursor-pointer group"
            >
              <EarshotCard className="p-4 flex items-center justify-between gap-4 hover:bg-[var(--earshot-surface-high)] transition-colors">
                <div className="flex items-center gap-4 min-w-0">
                  <Icon className="w-5 h-5 text-[var(--earshot-ink)] shrink-0" />
                  <div className="min-w-0">
                    <div className="font-semibold text-base text-[var(--earshot-ink)]">{row.title}</div>
                    <div className="text-xs text-[var(--earshot-muted)] truncate">{row.subtitle}</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[var(--earshot-muted)] group-hover:translate-x-0.5 transition-transform shrink-0" />
              </EarshotCard>
            </button>
          );
        })}
      </div>
    </div>
  );
};
