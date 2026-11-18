import React, { useEffect, useRef, useState } from 'react';
import {
  AlarmClock,
  BellRing,
  Ear,
  Moon,
  Pause,
  Play,
  Plus,
  Save,
  Square,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import { useEarshot } from '../context/EarshotContext';
import {
  BatteryDial,
  EarshotCard,
  FieldSlider,
  FieldSwitch,
  LegendHeading,
  SubScreenHeader,
} from '../components/EarshotPrimitives';
import { ALARM_TONES, SLEEP_SOUNDS_CATALOG } from '../data/virtualDevices';
import { AlarmOutput, NightExtra, SleepEndAction, SoundSide } from '../types/earshot';

function formatClock(hour: number, minute: number): { main: string; ampm: string } {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return { main: `${h12}:${String(minute).padStart(2, '0')}`, ampm };
}

function formatFutureTime(minutesFromNow: number): string {
  const dt = new Date(Date.now() + minutesFromNow * 60_000);
  const { main, ampm } = formatClock(dt.getHours(), dt.getMinutes());
  return `${main} ${ampm}`;
}

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatDays(days: number[]): string {
  if (days.length === 0) return 'Once';
  if (days.length === 7) return 'Every day';
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.join(',') === '1,2,3,4,5') return 'Weekdays';
  if (sorted.join(',') === '6,7') return 'Weekends';
  const names = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return sorted.map((d) => names[d]).join(' ');
}

export const AlarmRingingOverlay: React.FC = () => {
  const { ringingAlarm, snoozeRingingAlarm, dismissRingingAlarm } = useEarshot();
  if (!ringingAlarm) return null;
  const { alarm, phoneFallbackActive, phoneFallbackReason } = ringingAlarm;
  const { main, ampm } = formatClock(alarm.hour, alarm.minute);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-[var(--earshot-bg)] text-[var(--earshot-ink)]"
      role="alertdialog"
      aria-modal="true"
      aria-label="Alarm ringing"
    >
      <EarshotCard className="w-full max-w-md p-7 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-[var(--earshot-accent)] text-[var(--earshot-on-accent)] flex items-center justify-center">
          <BellRing className="w-8 h-8 animate-bounce" />
        </div>
        <div className="space-y-1">
          <div className="text-xs font-mono-tabular uppercase tracking-widest text-[var(--earshot-muted)]">
            {alarm.label || 'Wake-up alarm'}
          </div>
          <div className="font-display font-bold text-6xl tracking-tight tabular-nums">
            {main} <span className="text-2xl font-normal">{ampm}</span>
          </div>
          <div className="text-xs text-[var(--earshot-muted)] pt-1">
            {phoneFallbackActive
              ? phoneFallbackReason ?? 'Ringing on phone & earbuds'
              : 'Ringing gently in your earbuds · Phone fallback after 60 s'}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {alarm.snoozeMinutes && (
            <button
              type="button"
              onClick={snoozeRingingAlarm}
              className="w-full py-3.5 px-4 rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface-low)] font-semibold text-sm cursor-pointer"
            >
              Snooze {alarm.snoozeMinutes} min
            </button>
          )}
          <button
            type="button"
            onClick={dismissRingingAlarm}
            className="w-full py-3.5 px-4 rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-control)] text-[var(--earshot-on-control)] font-semibold text-sm cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </EarshotCard>
    </div>
  );
};

const AlarmEditorScreen: React.FC<{ alarmId: string | null }> = ({ alarmId }) => {
  const { alarms, upsertAlarm, deleteAlarm, goBack } = useEarshot();
  const existing = alarms.find((a) => a.id === alarmId);

  const [hour, setHour] = useState(existing?.hour ?? 7);
  const [minute, setMinute] = useState(existing?.minute ?? 0);
  const [days, setDays] = useState<number[]>(existing?.days ?? [1, 2, 3, 4, 5]);
  const [output, setOutput] = useState<AlarmOutput>(existing?.output ?? 'EARBUDS');
  const [toneId, setToneId] = useState(existing?.toneId ?? 'chime');
  const [wakeWindowMinutes, setWakeWindowMinutes] = useState(existing?.wakeWindowMinutes ?? 10);
  const [fadeInSeconds, setFadeInSeconds] = useState(existing?.fadeInSeconds ?? 30);
  const [snoozeMinutes, setSnoozeMinutes] = useState<number | null>(existing?.snoozeMinutes ?? 10);
  const [vibrate, setVibrate] = useState(existing?.vibrate ?? true);
  const [label, setLabel] = useState(existing?.label ?? '');

  const toggleDay = (d: number) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const handleSave = () => {
    upsertAlarm({
      id: existing?.id ?? `alarm-${Date.now()}`,
      hour,
      minute,
      days,
      enabled: existing?.enabled ?? true,
      output,
      toneId,
      wakeWindowMinutes,
      fadeInSeconds,
      snoozeMinutes,
      vibrate,
      label: label.trim() || undefined,
    });
    goBack();
  };

  return (
    <div className="space-y-4">
      <SubScreenHeader
        title={existing ? 'Edit alarm' : 'New alarm'}
        onBack={goBack}
        action={
          existing ? (
            <button
              type="button"
              onClick={() => {
                deleteAlarm(existing.id);
                goBack();
              }}
              className="px-3 py-2 text-xs font-medium text-[var(--earshot-error)] rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] cursor-pointer"
            >
              Delete
            </button>
          ) : undefined
        }
      />

      <EarshotCard className="p-4 md:p-5 space-y-5 max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono-tabular uppercase text-[var(--earshot-muted)] mb-1">
              Time
            </label>
            <input
              type="time"
              value={`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number);
                if (!Number.isNaN(h)) setHour(h);
                if (!Number.isNaN(m)) setMinute(m);
              }}
              className="w-full px-3 py-2.5 text-lg font-mono-tabular rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface-low)]"
            />
          </div>
          <div>
            <label className="block text-xs font-mono-tabular uppercase text-[var(--earshot-muted)] mb-1">
              Label
            </label>
            <input
              type="text"
              placeholder="Morning wake"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface-low)]"
            />
          </div>
        </div>

        <div>
          <span className="block text-xs font-mono-tabular uppercase text-[var(--earshot-muted)] mb-2">
            Repeat days
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[
              { d: 1, l: 'M' },
              { d: 2, l: 'T' },
              { d: 3, l: 'W' },
              { d: 4, l: 'T' },
              { d: 5, l: 'F' },
              { d: 6, l: 'S' },
              { d: 7, l: 'S' },
            ].map((item) => {
              const active = days.includes(item.d);
              return (
                <button
                  key={item.d}
                  type="button"
                  onClick={() => toggleDay(item.d)}
                  className={`w-10 h-10 rounded-[var(--earshot-radius-sm)] font-mono-tabular text-xs font-semibold border cursor-pointer ${
                    active
                      ? 'bg-[var(--earshot-accent)] text-[var(--earshot-on-accent)] border-[var(--earshot-ink)]'
                      : 'bg-[var(--earshot-surface-low)] border-[var(--earshot-hairline)]'
                  }`}
                >
                  {item.l}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <span className="block text-xs font-mono-tabular uppercase text-[var(--earshot-muted)]">
            Output routing
          </span>
          <div className="grid grid-cols-3 border border-[var(--earshot-hairline)] rounded-[var(--earshot-radius-sm)] overflow-hidden">
            {(['EARBUDS', 'PHONE', 'BOTH'] as AlarmOutput[]).map((out) => (
              <button
                key={out}
                type="button"
                onClick={() => setOutput(out)}
                className={`py-2.5 text-xs font-medium cursor-pointer ${
                  output === out
                    ? 'bg-[var(--earshot-control)] text-[var(--earshot-on-control)]'
                    : 'bg-[var(--earshot-surface-low)]'
                }`}
              >
                {out === 'EARBUDS' ? 'Earbuds (+60s net)' : out === 'PHONE' ? 'Phone' : 'Both'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono-tabular uppercase text-[var(--earshot-muted)] mb-1">
              Alarm tone
            </label>
            <select
              value={toneId}
              onChange={(e) => setToneId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface-low)]"
            >
              {ALARM_TONES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-mono-tabular uppercase text-[var(--earshot-muted)] mb-1">
              Wake window (gentle pre-rise)
            </label>
            <select
              value={wakeWindowMinutes}
              onChange={(e) => setWakeWindowMinutes(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface-low)]"
            >
              {[0, 10, 20, 30].map((m) => (
                <option key={m} value={m}>
                  {m === 0 ? 'Off' : `${m} min before`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono-tabular uppercase text-[var(--earshot-muted)] mb-1">
              Fade-in duration
            </label>
            <select
              value={fadeInSeconds}
              onChange={(e) => setFadeInSeconds(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface-low)]"
            >
              {[15, 30, 60, 180].map((s) => (
                <option key={s} value={s}>
                  {s >= 60 ? `${s / 60} min` : `${s} s`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-mono-tabular uppercase text-[var(--earshot-muted)] mb-1">
              Snooze length
            </label>
            <select
              value={snoozeMinutes ?? 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                setSnoozeMinutes(v === 0 ? null : v);
              }}
              className="w-full px-3 py-2 text-sm rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface-low)]"
            >
              <option value={0}>No snooze</option>
              <option value={5}>5 min</option>
              <option value={10}>10 min</option>
              <option value={15}>15 min</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-dashed border-[var(--earshot-hairline)]">
          <span className="text-sm font-medium">Vibrate phone</span>
          <FieldSwitch checked={vibrate} onChange={setVibrate} label="Vibrate phone" />
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="w-full py-3 px-4 rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-accent)] text-[var(--earshot-on-accent)] font-semibold text-sm cursor-pointer"
        >
          Save alarm
        </button>
      </EarshotCard>
    </div>
  );
};

export const SleepScreen: React.FC = () => {
  const {
    headphone,
    subRoute,
    navigateSubRoute,
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
    toggleAlarmEnabled,
    triggerTestAlarm,
    savedMixes,
    saveCurrentMix,
    loadMix,
    deleteMix,
    customSounds,
    addCustomSound,
    deleteCustomSound,
    sleepLog,
    appearance,
  } = useEarshot();

  const [, setNowTick] = useState(Date.now());
  const [mixName, setMixName] = useState('');
  const [showCustomDur, setShowCustomDur] = useState(false);
  const customFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sleepSession) return;
    const t = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [sleepSession]);

  if (subRoute?.startsWith('sleep/alarm')) {
    const idParam = subRoute.includes('id=') ? subRoute.split('id=')[1] : null;
    return <AlarmEditorScreen alarmId={idParam} />;
  }

  const isConnected = headphone.status === 'CONNECTED';
  const hrsLeft = headphone.battery.overall?.minutesLeft
    ? `Lasts about ${Math.round(headphone.battery.overall.minutesLeft / 60)} h`
    : null;
  const nextEnabledAlarm = alarms.find((a) => a.enabled);

  const durationChips = [30, 60, 120, 180, 240, 300, 360];
  const noiseChoices: Array<{ val: number | null; label: string }> = [
    { val: null, label: 'Keep on' },
    { val: 0, label: 'At start' },
    { val: 15, label: 'After 15 min' },
    { val: 30, label: 'After 30 min' },
    { val: 60, label: 'After 1 h' },
    { val: sleepPlan.durationMinutes, label: 'When timer ends' },
  ];

  const remainingMs = sleepSession
    ? sleepSession.paused
      ? sleepSession.remainingMsWhenPaused ?? 0
      : Math.max(0, sleepSession.endsAtMillis - Date.now())
    : 0;

  const getSoundName = (soundId: string) =>
    SLEEP_SOUNDS_CATALOG.find((s) => s.id === soundId)?.name ??
    customSounds.find((c) => c.id === soundId)?.name ??
    soundId;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Headset Sleep Header + Alarms + Tonight Timer */}
        <div className="lg:col-span-6 space-y-4">
          <EarshotCard className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <BatteryDial percent={isConnected ? headphone.batteryPercent : null} size={74} />
              <div className="min-w-0">
                <div className="font-display font-bold text-2xl uppercase tracking-wide truncate">
                  {headphone.info.customName}
                </div>
                <div className="text-xs font-mono-tabular uppercase tracking-wider text-[var(--earshot-muted)]">
                  {isConnected ? hrsLeft ?? 'Connected for sleep' : 'Disconnected · Phone audio fallback'}
                </div>
              </div>
            </div>
            {sleepSession && (
              <span className="px-2.5 py-1 text-xs font-mono-tabular uppercase rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-accent)] text-[var(--earshot-on-accent)] font-semibold shrink-0">
                {sleepSession.paused ? 'Paused' : sleepSession.phase.replace('_', ' ')}
              </span>
            )}
          </EarshotCard>

          {/* Alarms Card */}
          <EarshotCard className="p-4 md:p-5 space-y-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <LegendHeading className="text-xl">Alarms</LegendHeading>
                <p className="text-xs text-[var(--earshot-muted)]">
                  {nextEnabledAlarm
                    ? `Next alarm at ${formatClock(nextEnabledAlarm.hour, nextEnabledAlarm.minute).main} ${formatClock(nextEnabledAlarm.hour, nextEnabledAlarm.minute).ampm}`
                    : 'No active alarms'}
                </p>
              </div>
              {alarms.length > 0 && (
                <button
                  type="button"
                  onClick={() => triggerTestAlarm(alarms[0])}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] hover:bg-[var(--earshot-surface-high)] cursor-pointer inline-flex items-center gap-1.5"
                >
                  <AlarmClock className="w-3.5 h-3.5" />
                  Test ring
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {alarms.map((alarm) => {
                const { main, ampm } = formatClock(alarm.hour, alarm.minute);
                return (
                  <div
                    key={alarm.id}
                    className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0 border-dashed border-[var(--earshot-hairline)]"
                  >
                    <button
                      type="button"
                      onClick={() => navigateSubRoute(`sleep/alarm?id=${alarm.id}`)}
                      className="text-left flex-1 min-w-0 cursor-pointer"
                    >
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-display font-bold text-3xl tabular-nums leading-none">
                          {main}
                        </span>
                        <span className="text-xs font-mono-tabular text-[var(--earshot-muted)]">{ampm}</span>
                        {alarm.label && (
                          <span className="text-xs text-[var(--earshot-muted)] ml-2 truncate">· {alarm.label}</span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--earshot-muted)] mt-1">
                        {formatDays(alarm.days)} ·{' '}
                        {alarm.output === 'EARBUDS'
                          ? 'Earbuds, phone after 60 s'
                          : alarm.output === 'PHONE'
                            ? 'Phone speaker'
                            : 'Earbuds & phone'}
                      </div>
                    </button>
                    <FieldSwitch
                      checked={alarm.enabled}
                      onChange={() => toggleAlarmEnabled(alarm.id)}
                      label={`Toggle ${main} ${ampm} alarm`}
                    />
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => navigateSubRoute('sleep/alarm')}
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--earshot-ink)] hover:text-[var(--earshot-accent)] pt-1 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add alarm
            </button>
          </EarshotCard>

          {/* Tonight Card (Sleep Timer + Noise Cancelling Off) */}
          <EarshotCard className="p-4 md:p-5 space-y-5">
            <LegendHeading className="text-xl">Tonight</LegendHeading>

            {sleepSession ? (
              <div className="p-4 rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-surface-low)] border border-[var(--earshot-hairline)] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-mono-tabular uppercase text-[var(--earshot-muted)]">
                      Remaining
                    </div>
                    <div className="font-display font-bold text-4xl tabular-nums">
                      {formatCountdown(remainingMs)}
                    </div>
                  </div>
                  <div className="text-right text-xs text-[var(--earshot-muted)]">
                    <div>{sleepSession.plan.layers.length > 0 ? `${sleepSession.plan.layers.length} sound layers` : 'Timer only'}</div>
                    <div>Fade out {sleepSession.plan.fadeOutMinutes} min</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={pauseOrResumeSleepSession}
                    className="py-2.5 px-3 rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface)] text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {sleepSession.paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    {sleepSession.paused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    type="button"
                    onClick={() => extendSleepSession(15)}
                    className="py-2.5 px-3 rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface)] text-xs font-semibold cursor-pointer"
                  >
                    +15 min
                  </button>
                  <button
                    type="button"
                    onClick={stopSleepSession}
                    className="py-2.5 px-3 rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-control)] text-[var(--earshot-on-control)] text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5" />
                    Stop
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs font-mono-tabular uppercase tracking-wider text-[var(--earshot-muted)]">
                  Sleep timer
                </div>
                <div className="flex items-start gap-2.5">
                  <Moon className="w-4 h-4 text-[var(--earshot-accent)] shrink-0 mt-1" />
                  <div>
                    <div className="font-semibold text-base">
                      {sleepPlan.layers.length > 0
                        ? `Sounds stop at ${formatFutureTime(sleepPlan.durationMinutes)}`
                        : `Timer ends at ${formatFutureTime(sleepPlan.durationMinutes)}`}
                    </div>
                    <p className="text-xs text-[var(--earshot-muted)]">
                      The sounds fade out over the last {sleepPlan.fadeOutMinutes} min.{' '}
                      {sleepPlan.endAction === 'STOP_SOUNDS'
                        ? 'Your headphones stay connected.'
                        : sleepPlan.endAction === 'DISCONNECT'
                          ? 'Your headphones will disconnect after fade.'
                          : 'Power-off command will be sent after fade.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                  {durationChips.map((mins) => {
                    const active = sleepPlan.durationMinutes === mins && !showCustomDur;
                    return (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => {
                          setShowCustomDur(false);
                          updateSleepPlan({ durationMinutes: mins });
                        }}
                        className={`shrink-0 px-4 py-2.5 text-sm font-semibold rounded-[var(--earshot-radius-sm)] border cursor-pointer ${
                          active
                            ? 'bg-[var(--earshot-accent)] text-[var(--earshot-on-accent)] border-[var(--earshot-ink)]'
                            : 'bg-[var(--earshot-surface-low)] border-[var(--earshot-hairline)]'
                        }`}
                      >
                        {mins >= 60 ? `${mins / 60} h` : `${mins} min`}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setShowCustomDur((v) => !v)}
                    className={`shrink-0 px-4 py-2.5 text-sm font-semibold rounded-[var(--earshot-radius-sm)] border cursor-pointer ${
                      showCustomDur
                        ? 'bg-[var(--earshot-accent)] text-[var(--earshot-on-accent)] border-[var(--earshot-ink)]'
                        : 'bg-[var(--earshot-surface-low)] border-[var(--earshot-hairline)]'
                    }`}
                  >
                    Custom
                  </button>
                </div>

                {showCustomDur && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-mono-tabular">
                      <span>Custom timer</span>
                      <span>{sleepPlan.durationMinutes} min</span>
                    </div>
                    <FieldSlider
                      min={15}
                      max={360}
                      step={5}
                      value={sleepPlan.durationMinutes}
                      onChange={(durationMinutes) => updateSleepPlan({ durationMinutes })}
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={startSleepSession}
                  className="w-full py-3.5 px-4 rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-control)] text-[var(--earshot-on-control)] font-semibold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Moon className="w-4 h-4" />
                  Start sleep
                </button>
              </div>
            )}

            {/* Noise Cancelling Off Schedule */}
            <div className="space-y-3 pt-4 border-t border-dashed border-[var(--earshot-hairline)]">
              <div className="text-xs font-mono-tabular uppercase tracking-wider text-[var(--earshot-muted)]">
                Noise cancelling
              </div>
              <div className="flex items-start gap-2.5">
                <Ear className="w-4 h-4 text-[var(--earshot-accent)] shrink-0 mt-1" />
                <div>
                  <div className="font-semibold text-sm">
                    {sleepPlan.noiseOffAfterMinutes === null
                      ? 'Noise cancelling stays as-is'
                      : sleepPlan.noiseOffAfterMinutes === 0
                        ? 'Noise cancelling switches off when you start'
                        : `Noise cancelling goes off at ${formatFutureTime(sleepPlan.noiseOffAfterMinutes)}`}
                  </div>
                  <p className="text-xs text-[var(--earshot-muted)]">
                    Saves headphone battery overnight without waking you.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {noiseChoices.map((c) => {
                  const active = sleepPlan.noiseOffAfterMinutes === c.val;
                  return (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => updateSleepPlan({ noiseOffAfterMinutes: c.val })}
                      className={`shrink-0 px-3.5 py-2 text-xs font-semibold rounded-[var(--earshot-radius-sm)] border cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-[var(--earshot-accent)] text-[var(--earshot-on-accent)] border-[var(--earshot-ink)]'
                          : 'bg-[var(--earshot-surface-low)] border-[var(--earshot-hairline)]'
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </EarshotCard>
        </div>

        {/* Right Column: Sound Mixer & Library + Night Options + Log */}
        <div className="lg:col-span-6 space-y-4">
          <EarshotCard className="p-4 md:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <LegendHeading className="text-xl">Soundscape &amp; Mixer</LegendHeading>
                <p className="text-xs text-[var(--earshot-muted)]">
                  Pick up to 3 sounds to layer, or leave empty for timer-only
                </p>
              </div>
              <button
                type="button"
                onClick={() => customFileRef.current?.click()}
                className="px-3 py-1.5 text-xs font-medium rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] hover:bg-[var(--earshot-surface-high)] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Add sound
              </button>
              <input
                ref={customFileRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void addCustomSound(f);
                }}
              />
            </div>

            {/* Active Layers & Gains */}
            {sleepPlan.layers.length > 0 && (
              <div className="p-3 rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-surface-low)] border border-[var(--earshot-hairline)] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono-tabular uppercase text-[var(--earshot-muted)]">
                    Active mix ({sleepPlan.layers.length} / 3)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="Mix name..."
                      value={mixName}
                      onChange={(e) => setMixName(e.target.value)}
                      className="w-28 px-2 py-1 text-xs rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface)]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        saveCurrentMix(mixName);
                        setMixName('');
                      }}
                      className="px-2.5 py-1 text-xs font-medium rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-control)] text-[var(--earshot-on-control)] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Save className="w-3 h-3" />
                      Save
                    </button>
                  </div>
                </div>

                {sleepPlan.layers.map((layer) => (
                  <div key={layer.soundId} className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{getSoundName(layer.soundId)}</span>
                      <span className="font-mono-tabular">{Math.round(layer.gain * 100)}%</span>
                    </div>
                    <FieldSlider
                      min={0.05}
                      max={1}
                      step={0.05}
                      value={layer.gain}
                      onChange={(g) => setSleepLayerGain(layer.soundId, g)}
                    />
                  </div>
                ))}

                <div className="flex items-center gap-3 pt-2 border-t border-dashed border-[var(--earshot-hairline)]">
                  <Volume2 className="w-4 h-4 text-[var(--earshot-muted)] shrink-0" />
                  <FieldSlider
                    min={0.05}
                    max={1}
                    step={0.05}
                    value={sleepPlan.volume}
                    onChange={(volume) => updateSleepPlan({ volume })}
                    ariaLabel="Master sleep sound volume"
                  />
                  <span className="text-xs font-mono-tabular whitespace-nowrap">
                    {Math.round(sleepPlan.volume * 100)}%
                  </span>
                </div>
              </div>
            )}

            {/* Saved Mixes */}
            {savedMixes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {savedMixes.map((mix) => (
                  <div
                    key={mix.id}
                    className="inline-flex items-center rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface-low)]"
                  >
                    <button
                      type="button"
                      onClick={() => loadMix(mix)}
                      className="px-2.5 py-1.5 text-xs font-medium hover:text-[var(--earshot-accent)] cursor-pointer"
                    >
                      {mix.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteMix(mix.id)}
                      aria-label={`Delete ${mix.name}`}
                      className="pr-2 text-[var(--earshot-muted)] hover:text-[var(--earshot-error)] cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Built-in + Custom Sound Library */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SLEEP_SOUNDS_CATALOG.map((sound) => {
                const selected = sleepPlan.layers.some((l) => l.soundId === sound.id);
                const previewing = sleepPreviewingId === sound.id;
                return (
                  <div
                    key={sound.id}
                    className={`p-2.5 rounded-[var(--earshot-radius-sm)] border flex items-center justify-between gap-2 ${
                      selected
                        ? 'bg-[var(--earshot-accent)]/12 border-[var(--earshot-accent)]'
                        : 'bg-[var(--earshot-surface-low)] border-[var(--earshot-hairline)]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSleepLayer(sound.id)}
                      className="flex-1 text-left min-w-0 cursor-pointer"
                    >
                      <div className="text-sm font-medium truncate">{sound.name}</div>
                      <div className="text-[11px] text-[var(--earshot-muted)] truncate">{sound.category} · {sound.description}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePreviewSound(sound.id)}
                      aria-label={previewing ? `Stop ${sound.name}` : `Preview ${sound.name}`}
                      className={`w-9 h-9 rounded-[var(--earshot-radius-sm)] inline-flex items-center justify-center shrink-0 cursor-pointer ${
                        previewing
                          ? 'bg-[var(--earshot-accent)] text-[var(--earshot-on-accent)]'
                          : 'border border-[var(--earshot-hairline)] hover:bg-[var(--earshot-surface-high)]'
                      }`}
                    >
                      {previewing ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                );
              })}

              {customSounds.map((cs) => {
                const selected = sleepPlan.layers.some((l) => l.soundId === cs.id);
                const previewing = sleepPreviewingId === cs.id;
                return (
                  <div
                    key={cs.id}
                    className={`p-2.5 rounded-[var(--earshot-radius-sm)] border flex items-center justify-between gap-2 ${
                      selected
                        ? 'bg-[var(--earshot-accent)]/12 border-[var(--earshot-accent)]'
                        : 'bg-[var(--earshot-surface-low)] border-[var(--earshot-hairline)]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSleepLayer(cs.id)}
                      className="flex-1 text-left min-w-0 cursor-pointer"
                    >
                      <div className="text-sm font-medium truncate">{cs.name}</div>
                      <div className="text-[11px] text-[var(--earshot-muted)]">Custom loop · {cs.loopSeconds}s</div>
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => togglePreviewSound(cs.id)}
                        className="w-8 h-8 rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] inline-flex items-center justify-center cursor-pointer"
                      >
                        {previewing ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCustomSound(cs.id)}
                        aria-label={`Delete ${cs.name}`}
                        className="w-8 h-8 inline-flex items-center justify-center text-[var(--earshot-muted)] hover:text-[var(--earshot-error)] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </EarshotCard>

          {/* Night Options Card */}
          <EarshotCard className="p-4 md:p-5 space-y-4">
            <LegendHeading className="text-xl">Night Options</LegendHeading>

            <div className="space-y-1.5">
              <span className="text-xs font-mono-tabular uppercase text-[var(--earshot-muted)] block">
                Sound ear routing (for side sleepers)
              </span>
              <div className="grid grid-cols-4 border border-[var(--earshot-hairline)] rounded-[var(--earshot-radius-sm)] overflow-hidden">
                {(
                  [
                    { id: 'BOTH', label: 'Both' },
                    { id: 'MONO', label: 'Mono' },
                    { id: 'LEFT_ONLY', label: 'Left' },
                    { id: 'RIGHT_ONLY', label: 'Right' },
                  ] as { id: SoundSide; label: string }[]
                ).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => updateSleepPlan({ soundSide: s.id })}
                    className={`py-2 text-xs font-medium cursor-pointer ${
                      sleepPlan.soundSide === s.id
                        ? 'bg-[var(--earshot-control)] text-[var(--earshot-on-control)]'
                        : 'bg-[var(--earshot-surface-low)]'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-mono-tabular uppercase text-[var(--earshot-muted)] block mb-1">
                  Fade out
                </label>
                <select
                  value={sleepPlan.fadeOutMinutes}
                  onChange={(e) => updateSleepPlan({ fadeOutMinutes: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface-low)]"
                >
                  {[5, 10, 15, 30].map((m) => (
                    <option key={m} value={m}>
                      {m} min
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-mono-tabular uppercase text-[var(--earshot-muted)] block mb-1">
                  When timer ends
                </label>
                <select
                  value={sleepPlan.endAction}
                  onChange={(e) => updateSleepPlan({ endAction: e.target.value as SleepEndAction })}
                  className="w-full px-3 py-2 text-sm rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface-low)]"
                >
                  <option value="STOP_SOUNDS">Stop sounds (keep connected)</option>
                  <option value="DISCONNECT">Disconnect headset</option>
                  <option value="POWER_OFF">Power off headset</option>
                </select>
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-dashed border-[var(--earshot-hairline)]">
              {(
                [
                  { id: 'TOUCH_LOCK', title: 'Pillow touch lock', desc: 'Disable earbud touch controls until morning' },
                  { id: 'PROMPTS_OFF', title: 'Voice prompts off', desc: 'Silence "battery low" announcements overnight' },
                  { id: 'VOLUME_CAP', title: 'Overnight volume cap', desc: `Clamp media level below ${sleepPlan.volumeCapPercent}%` },
                ] as { id: NightExtra; title: string; desc: string }[]
              ).map((ex) => (
                <div key={ex.id} className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{ex.title}</div>
                    <div className="text-xs text-[var(--earshot-muted)]">{ex.desc}</div>
                  </div>
                  <FieldSwitch
                    checked={sleepPlan.nightExtras.includes(ex.id)}
                    onChange={() => toggleNightExtra(ex.id)}
                    label={ex.title}
                  />
                </div>
              ))}
            </div>
          </EarshotCard>

          {sleepLog.length > 0 && (
            <EarshotCard className="p-4 space-y-2">
              <LegendHeading className={`text-base ${appearance === 'field' ? 'uppercase' : ''}`}>
                Tonight&apos;s log
              </LegendHeading>
              <div className="space-y-1 max-h-36 overflow-y-auto text-xs font-mono-tabular">
                {sleepLog.map((n, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="text-[var(--earshot-muted)] shrink-0">
                      {new Date(n.atMillis).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={n.isProblem ? 'text-[var(--earshot-error)]' : ''}>{n.text}</span>
                  </div>
                ))}
              </div>
            </EarshotCard>
          )}
        </div>
      </div>
    </div>
  );
};
