import React, { useRef, useState } from 'react';
import {
  Archive,
  Bluetooth,
  ChevronRight,
  Download,
  Info,
  Play,
  Plus,
  Sliders,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react';
import { useEarshot } from '../context/EarshotContext';
import {
  EarshotCard,
  FieldSlider,
  FieldSwitch,
  InfoBanner,
  LegendHeading,
  SubScreenHeader,
  SupportTierBadge,
} from '../components/EarshotPrimitives';
import { DEMO_DEVICES } from '../data/virtualDevices';
import {
  AppearanceMode,
  AutomationRule,
  AutomationTriggerType,
  ThemePreference,
} from '../types/earshot';

// 1. Devices (Universal Remote)
const DevicesScreen: React.FC = () => {
  const {
    headphone,
    connectHeadset,
    disconnectHeadset,
    renameHeadset,
    forgetDevice,
    setDeviceSwitcherOpen,
    lowBatteryAlertPercent,
    setLowBatteryAlertPercent,
    goBack,
  } = useEarshot();
  const [nameInput, setNameInput] = useState(headphone.info.customName);

  return (
    <div className="space-y-4">
      <SubScreenHeader
        title="Devices"
        subtitle="Universal remote, rename & low-battery alerts"
        onBack={goBack}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EarshotCard className="p-4 md:p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <LegendHeading className="text-xl">{headphone.info.customName}</LegendHeading>
              <p className="text-xs text-[var(--earshot-muted)]">
                {headphone.info.modelName} · {headphone.info.bluetoothAddress}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDeviceSwitcherOpen(true)}
              className="px-3 py-1.5 text-xs font-medium rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] hover:bg-[var(--earshot-surface-high)] cursor-pointer"
            >
              Switch model
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="flex-1 px-3 py-2 text-sm rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface-low)]"
            />
            <button
              type="button"
              onClick={() => renameHeadset(nameInput)}
              className="px-4 py-2 text-xs font-semibold rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-control)] text-[var(--earshot-on-control)] cursor-pointer"
            >
              Rename
            </button>
          </div>

          <div className="flex gap-2">
            {headphone.status === 'CONNECTED' ? (
              <button
                type="button"
                onClick={disconnectHeadset}
                className="flex-1 py-2.5 text-xs font-semibold rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] hover:bg-[var(--earshot-surface-high)] cursor-pointer"
              >
                Disconnect headset
              </button>
            ) : (
              <button
                type="button"
                onClick={connectHeadset}
                className="flex-1 py-2.5 text-xs font-semibold rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-accent)] text-[var(--earshot-on-accent)] cursor-pointer"
              >
                Connect headset
              </button>
            )}
          </div>
        </EarshotCard>

        <EarshotCard className="p-4 md:p-5 space-y-4">
          <LegendHeading className="text-xl">Low battery alert</LegendHeading>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Notify when headset drops below</span>
              <span className="font-mono-tabular">
                {lowBatteryAlertPercent === 0 ? 'Off' : `${lowBatteryAlertPercent}%`}
              </span>
            </div>
            <FieldSlider
              min={0}
              max={30}
              step={5}
              value={lowBatteryAlertPercent}
              onChange={setLowBatteryAlertPercent}
            />
          </div>

          <div className="pt-2 border-t border-dashed border-[var(--earshot-hairline)] space-y-2">
            <div className="text-xs font-mono-tabular uppercase text-[var(--earshot-muted)]">
              Paired host devices
            </div>
            {headphone.pairedDevices.map((d) => (
              <div
                key={d.address}
                className="flex items-center justify-between text-xs p-2.5 rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-surface-low)] border border-[var(--earshot-hairline)]"
              >
                <div>
                  <div className="font-medium">{d.name}</div>
                  <div className="font-mono-tabular text-[var(--earshot-muted)]">{d.address}</div>
                </div>
                {!d.isThisPhone && (
                  <button
                    type="button"
                    onClick={() => forgetDevice(d.address)}
                    className="px-2.5 py-1 text-[var(--earshot-error)] border border-[var(--earshot-hairline)] rounded-[var(--earshot-radius-sm)] cursor-pointer"
                  >
                    Forget
                  </button>
                )}
              </div>
            ))}
          </div>
        </EarshotCard>
      </div>
    </div>
  );
};

// 2. Automations & Editor
const AutomationEditorScreen: React.FC<{ ruleId: string | null }> = ({ ruleId }) => {
  const { automations, upsertAutomation, deleteAutomation, headphone, allPresets, goBack } = useEarshot();
  const existing = automations.find((r) => r.id === ruleId);

  const [name, setName] = useState(existing?.name ?? 'New rule');
  const [triggerType, setTriggerType] = useState<AutomationTriggerType>(existing?.triggerType ?? 'ON_CONNECT');
  const [triggerValue, setTriggerValue] = useState(existing?.triggerValue ?? headphone.info.productName);
  const [actionModeName, setActionModeName] = useState(existing?.actionModeName ?? '');
  const [actionEqPresetId, setActionEqPresetId] = useState(existing?.actionEqPresetId ?? '');
  const [actionCallBoost, setActionCallBoost] = useState<boolean>(existing?.actionCallBoost ?? false);

  const handleSave = () => {
    const rule: AutomationRule = {
      id: existing?.id ?? `auto-${Date.now()}`,
      name: name.trim() || 'Untitled rule',
      enabled: existing?.enabled ?? true,
      triggerType,
      triggerValue: triggerValue.trim(),
      actionModeName: actionModeName || undefined,
      actionEqPresetId: actionEqPresetId || undefined,
      actionCallBoost,
    };
    upsertAutomation(rule);
    goBack();
  };

  return (
    <div className="space-y-4">
      <SubScreenHeader
        title={existing ? 'Edit rule' : 'New automation'}
        onBack={goBack}
        action={
          existing ? (
            <button
              type="button"
              onClick={() => {
                deleteAutomation(existing.id);
                goBack();
              }}
              className="px-3 py-2 text-xs font-medium text-[var(--earshot-error)] rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] cursor-pointer"
            >
              Delete
            </button>
          ) : undefined
        }
      />

      <EarshotCard className="p-4 md:p-5 space-y-4 max-w-xl">
        <div>
          <label className="block text-xs font-mono-tabular uppercase text-[var(--earshot-muted)] mb-1">
            Rule name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface-low)]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-mono-tabular uppercase text-[var(--earshot-muted)] mb-1">
              Trigger
            </label>
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as AutomationTriggerType)}
              className="w-full px-3 py-2 text-sm rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface-low)]"
            >
              <option value="ON_CONNECT">When headset connects</option>
              <option value="SCHEDULE">At scheduled time</option>
              <option value="WIFI_SSID">On Wi-Fi network (SSID)</option>
              <option value="APP_FOREGROUND">When media app opens</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-mono-tabular uppercase text-[var(--earshot-muted)] mb-1">
              Trigger detail
            </label>
            <input
              type="text"
              value={triggerValue}
              onChange={(e) => setTriggerValue(e.target.value)}
              placeholder={triggerType === 'SCHEDULE' ? '22:00' : 'Headset or app name'}
              className="w-full px-3 py-2 text-sm rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface-low)]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-mono-tabular uppercase text-[var(--earshot-muted)] mb-1">
              Set listening mode
            </label>
            <select
              value={actionModeName}
              onChange={(e) => setActionModeName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface-low)]"
            >
              <option value="">Leave unchanged</option>
              {headphone.modes.map((m) => (
                <option key={m.index} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-mono-tabular uppercase text-[var(--earshot-muted)] mb-1">
              Switch Pro EQ preset
            </label>
            <select
              value={actionEqPresetId}
              onChange={(e) => setActionEqPresetId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface-low)]"
            >
              <option value="">Leave unchanged</option>
              {allPresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-dashed border-[var(--earshot-hairline)]">
          <span className="text-sm font-medium">Enable call volume boost</span>
          <FieldSwitch checked={actionCallBoost} onChange={setActionCallBoost} label="Enable call boost" />
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="w-full py-3 px-4 rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-accent)] text-[var(--earshot-on-accent)] font-semibold text-sm cursor-pointer"
        >
          Save automation
        </button>
      </EarshotCard>
    </div>
  );
};

const AutomationsScreen: React.FC = () => {
  const { automations, automationLog, toggleAutomation, runAutomationNow, navigateSubRoute, goBack } = useEarshot();

  return (
    <div className="space-y-4">
      <SubScreenHeader
        title="Automations"
        subtitle="Switch modes, EQ presets, or call boost automatically"
        onBack={goBack}
        action={
          <button
            type="button"
            onClick={() => navigateSubRoute('more/automations/edit')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-control)] text-[var(--earshot-on-control)] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New rule
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 space-y-3">
          {automations.map((rule) => (
            <EarshotCard key={rule.id} className="p-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => navigateSubRoute(`more/automations/edit?id=${rule.id}`)}
                className="flex-1 text-left min-w-0 cursor-pointer"
              >
                <div className="font-semibold text-base truncate">{rule.name}</div>
                <div className="text-xs text-[var(--earshot-muted)] font-mono-tabular mt-0.5">
                  {rule.triggerType.replace('_', ' ')} ({rule.triggerValue})
                  {rule.actionModeName ? ` → Mode: ${rule.actionModeName}` : ''}
                  {rule.actionEqPresetId ? ` · EQ: ${rule.actionEqPresetId}` : ''}
                </div>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => runAutomationNow(rule.id)}
                  title="Test run rule now"
                  className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] hover:bg-[var(--earshot-surface-high)] cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                </button>
                <FieldSwitch
                  checked={rule.enabled}
                  onChange={() => toggleAutomation(rule.id)}
                  label={`Toggle ${rule.name}`}
                />
              </div>
            </EarshotCard>
          ))}
        </div>

        <EarshotCard className="lg:col-span-5 p-4 space-y-3">
          <LegendHeading className="text-lg">Execution log</LegendHeading>
          {automationLog.length === 0 ? (
            <p className="text-xs text-[var(--earshot-muted)]">
              No rules have fired yet. Tap the Play button on any rule to test it immediately.
            </p>
          ) : (
            <div className="space-y-2 text-xs font-mono-tabular">
              {automationLog.map((entry, idx) => (
                <div key={idx} className="pb-2 border-b last:border-b-0 border-dashed border-[var(--earshot-hairline)]">
                  <div className="font-semibold">{entry.ruleName}</div>
                  <div className="text-[var(--earshot-muted)]">
                    {new Date(entry.atMillis).toLocaleTimeString()} · {entry.outcome}
                  </div>
                </div>
              ))}
            </div>
          )}
        </EarshotCard>
      </div>
    </div>
  );
};

// 3. Preferences Screen (Field vs Aurora, Light/Dark/System, Demo Device Picker)
const PreferencesScreen: React.FC = () => {
  const {
    appearance,
    setAppearance,
    themePreference,
    setThemePreference,
    demoModeEnabled,
    setDemoModeEnabled,
    demoDeviceId,
    selectDemoDevice,
    goBack,
  } = useEarshot();

  return (
    <div className="space-y-4">
      <SubScreenHeader title="Preferences" subtitle="Look, theme & virtual demo hardware" onBack={goBack} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EarshotCard className="p-4 md:p-5 space-y-4">
          <LegendHeading className="text-xl">Appearance</LegendHeading>
          <div className="grid grid-cols-2 gap-2.5">
            {(
              [
                { id: 'field', title: 'Field', desc: 'Sand & ink, dot grid, safety orange, condensed type' },
                { id: 'aurora', title: 'Aurora', desc: 'Frosted glass, corner glows, emerald-cyan accents' },
              ] as { id: AppearanceMode; title: string; desc: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAppearance(opt.id)}
                className={`p-3.5 text-left rounded-[var(--earshot-radius-sm)] border cursor-pointer ${
                  appearance === opt.id
                    ? 'bg-[var(--earshot-accent)]/15 border-[var(--earshot-accent)]'
                    : 'bg-[var(--earshot-surface-low)] border-[var(--earshot-hairline)]'
                }`}
              >
                <div className="font-display font-bold text-lg">{opt.title}</div>
                <div className="text-xs text-[var(--earshot-muted)] mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>

          <div className="space-y-1.5 pt-2 border-t border-dashed border-[var(--earshot-hairline)]">
            <span className="text-xs font-mono-tabular uppercase text-[var(--earshot-muted)] block">
              Theme polarity
            </span>
            <div className="grid grid-cols-3 border border-[var(--earshot-hairline)] rounded-[var(--earshot-radius-sm)] overflow-hidden">
              {(['system', 'light', 'dark'] as ThemePreference[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setThemePreference(t)}
                  className={`py-2.5 text-xs font-medium capitalize cursor-pointer ${
                    themePreference === t
                      ? 'bg-[var(--earshot-control)] text-[var(--earshot-on-control)]'
                      : 'bg-[var(--earshot-surface-low)]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </EarshotCard>

        <EarshotCard className="p-4 md:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <LegendHeading className="text-xl">Demo mode</LegendHeading>
              <p className="text-xs text-[var(--earshot-muted)]">
                Explore any of Earshot&apos;s 19 supported headset profiles without hardware
              </p>
            </div>
            <FieldSwitch checked={demoModeEnabled} onChange={setDemoModeEnabled} label="Demo mode" />
          </div>

          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {DEMO_DEVICES.map((d) => {
              const active = d.id === demoDeviceId;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => selectDemoDevice(d.id)}
                  className={`w-full p-2.5 text-left rounded-[var(--earshot-radius-sm)] border flex items-center justify-between gap-2 cursor-pointer ${
                    active
                      ? 'bg-[var(--earshot-accent)]/15 border-[var(--earshot-accent)]'
                      : 'bg-[var(--earshot-surface-low)] border-[var(--earshot-hairline)] hover:bg-[var(--earshot-surface-high)]'
                  }`}
                >
                  <span className="text-xs font-medium truncate">{d.displayName}</span>
                  <SupportTierBadge tier={d.tier} />
                </button>
              );
            })}
          </div>
        </EarshotCard>
      </div>
    </div>
  );
};

// 4. Backup & Restore
const BackupScreen: React.FC = () => {
  const { exportBackupJson, importBackupJson, resetAllData, goBack } = useEarshot();
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDownload = () => {
    const json = exportBackupJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `earshot-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileImport = async (file: File) => {
    try {
      setImportError(null);
      const text = await file.text();
      const { restoredItems } = importBackupJson(text);
      setImportStatus(`Restored: ${restoredItems.join(', ')}`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to parse backup file.');
    }
  };

  return (
    <div className="space-y-4">
      <SubScreenHeader
        title="Back up & restore"
        subtitle="Portable JSON archive of EQ presets, sleep plans, alarms & rules"
        onBack={goBack}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EarshotCard className="p-5 space-y-4">
          <LegendHeading className="text-xl">Export backup</LegendHeading>
          <p className="text-sm text-[var(--earshot-muted)]">
            Saves all custom EQ presets, headset EQ memory, sleep timers, wake-up alarms, mixes, automations, and preferences to a local JSON file.
          </p>
          <button
            type="button"
            onClick={handleDownload}
            className="w-full py-3 px-4 rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-control)] text-[var(--earshot-on-control)] font-semibold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Download backup (.json)
          </button>
        </EarshotCard>

        <EarshotCard className="p-5 space-y-4">
          <LegendHeading className="text-xl">Restore or reset</LegendHeading>
          <p className="text-sm text-[var(--earshot-muted)]">
            Import an earlier Earshot backup file, or reset local browser storage to defaults.
          </p>
          {importStatus && <InfoBanner tone="neutral">{importStatus}</InfoBanner>}
          {importError && <InfoBanner tone="warn">{importError}</InfoBanner>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex-1 py-3 px-4 rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface-low)] hover:bg-[var(--earshot-surface-high)] font-semibold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Restore file
            </button>
            <button
              type="button"
              onClick={resetAllData}
              className="py-3 px-4 rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] text-[var(--earshot-error)] font-semibold text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Reset
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFileImport(f);
            }}
          />
        </EarshotCard>
      </div>
    </div>
  );
};

// 5. About Screen
const AboutScreen: React.FC = () => {
  const { goBack } = useEarshot();
  return (
    <div className="space-y-4">
      <SubScreenHeader title="About Earshot" subtitle="Version 1.0.0-rc2 · MIT Licence" onBack={goBack} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EarshotCard className="p-5 space-y-3">
          <LegendHeading className="text-xl">Philosophy &amp; Privacy</LegendHeading>
          <p className="text-sm leading-relaxed text-[var(--earshot-muted)]">
            Earshot is a universal companion for Bluetooth headsets. It runs with zero accounts, zero cloud sync, and zero analytics — all EQ presets, sleep alarms, automations, and device notes stay strictly on your device.
          </p>
          <p className="text-sm leading-relaxed text-[var(--earshot-muted)]">
            Honest support: models verified on real hardware are marked <strong>Tested</strong>; models implemented from protocol research and virtual rigs are marked <strong>Experimental</strong>; legacy or Apple devices show <strong>Battery only</strong>.
          </p>
        </EarshotCard>

        <EarshotCard className="p-5 space-y-3">
          <LegendHeading className="text-xl">Protocol &amp; Audio Credits</LegendHeading>
          <ul className="text-xs space-y-1.5 text-[var(--earshot-muted)] leading-relaxed">
            <li>• Protocol research: bosectl, Quiet Rebellion, soundcorebridge, momentum4-control, momentumctl, SonyHeadphonesClient, jbl-control</li>
            <li>• AutoEq correction curves by Jaakko Pasanen (MIT Licence)</li>
            <li>• Typography: Barlow, Barlow Condensed, Sora, Plus Jakarta Sans, JetBrains Mono (SIL OFL 1.1)</li>
            <li>• Web Audio DSP &amp; Procedural Sleep Synths: RBJ Biquad cookbook &amp; real-time filtered noise synthesis</li>
          </ul>
        </EarshotCard>
      </div>
    </div>
  );
};

export const MoreScreen: React.FC = () => {
  const {
    headphone,
    subRoute,
    navigateSubRoute,
    setVendorControl,
    setAutoOffMinutes,
    setVoicePrompts,
  } = useEarshot();

  if (subRoute === 'more/devices') return <DevicesScreen />;
  if (subRoute === 'more/automations') return <AutomationsScreen />;
  if (subRoute?.startsWith('more/automations/edit')) {
    const idParam = subRoute.includes('id=') ? subRoute.split('id=')[1] : null;
    return <AutomationEditorScreen ruleId={idParam} />;
  }
  if (subRoute === 'more/preferences') return <PreferencesScreen />;
  if (subRoute === 'more/backup') return <BackupScreen />;
  if (subRoute === 'more/about') return <AboutScreen />;

  const isConnected = headphone.status === 'CONNECTED';

  const navRows = [
    {
      route: 'more/devices',
      icon: Bluetooth,
      title: 'Devices',
      subtitle: 'Connect, disconnect, rename, forget & low battery alert',
    },
    {
      route: 'more/automations',
      icon: Zap,
      title: 'Automations',
      subtitle: 'Rules on connect, schedule, Wi-Fi network or foreground app',
    },
    {
      route: 'more/preferences',
      icon: Sliders,
      title: 'Preferences',
      subtitle: 'Field or Aurora look, light/dark theme, 19 demo headsets',
    },
    {
      route: 'more/backup',
      icon: Archive,
      title: 'Back up & restore',
      subtitle: 'Export or restore presets, sleep plans, alarms & rules',
    },
    {
      route: 'more/about',
      icon: Info,
      title: 'About',
      subtitle: 'Version 1.0.0-rc2 · Privacy & open-source credits',
    },
  ];

  return (
    <div className="space-y-4">
      <LegendHeading className="text-3xl">More</LegendHeading>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 space-y-3">
          {navRows.map((row) => {
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
                      <div className="font-semibold text-base">{row.title}</div>
                      <div className="text-xs text-[var(--earshot-muted)] truncate">{row.subtitle}</div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[var(--earshot-muted)] group-hover:translate-x-0.5 transition-transform shrink-0" />
                </EarshotCard>
              </button>
            );
          })}
        </div>

        {/* Device Info & Quick Settings */}
        <div className="lg:col-span-5 space-y-4">
          <EarshotCard className="p-4 md:p-5 space-y-3">
            <LegendHeading className="text-xl">Device info</LegendHeading>
            <div className="grid grid-cols-2 gap-y-2 text-xs">
              <span className="text-[var(--earshot-muted)]">Model</span>
              <span className="font-medium text-right">{headphone.info.modelName}</span>
              <span className="text-[var(--earshot-muted)]">Firmware</span>
              <span className="font-mono-tabular text-right">{headphone.info.firmwareVersion}</span>
              <span className="text-[var(--earshot-muted)]">Serial</span>
              <span className="font-mono-tabular text-right truncate">{headphone.info.serialNumber}</span>
              <span className="text-[var(--earshot-muted)]">Protocol</span>
              <span className="font-mono-tabular text-right">{headphone.info.protocolVersion ?? 'Generic'}</span>
            </div>

            {isConnected && headphone.capabilities.hasVoicePrompts && headphone.voicePromptsEnabled !== null && (
              <div className="flex items-center justify-between pt-3 border-t border-dashed border-[var(--earshot-hairline)]">
                <div>
                  <div className="text-sm font-medium">Voice prompts</div>
                  <div className="text-xs text-[var(--earshot-muted)]">{headphone.voicePromptLanguage}</div>
                </div>
                <FieldSwitch
                  checked={headphone.voicePromptsEnabled}
                  onChange={setVoicePrompts}
                  label="Voice prompts"
                />
              </div>
            )}

            {isConnected && headphone.capabilities.hasStandbyTimer && headphone.autoOffMinutes !== null && (
              <div className="flex items-center justify-between pt-3 border-t border-dashed border-[var(--earshot-hairline)]">
                <span className="text-sm font-medium">Auto-off timer</span>
                <select
                  value={headphone.autoOffMinutes}
                  onChange={(e) => setAutoOffMinutes(Number(e.target.value))}
                  className="px-2.5 py-1.5 text-xs rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface-low)]"
                >
                  <option value={0}>Never</option>
                  <option value={5}>5 min</option>
                  <option value={20}>20 min</option>
                  <option value={40}>40 min</option>
                  <option value={60}>1 hour</option>
                  <option value={180}>3 hours</option>
                </select>
              </div>
            )}
          </EarshotCard>

          {isConnected && headphone.vendorControls.length > 0 && (
            <EarshotCard className="p-4 md:p-5 space-y-3">
              <LegendHeading className="text-xl">All {headphone.brand} settings</LegendHeading>
              {headphone.vendorControls.map((vc) => (
                <div
                  key={vc.id}
                  className="flex items-center justify-between gap-3 pt-2 first:pt-0 border-t first:border-t-0 border-dashed border-[var(--earshot-hairline)]"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{vc.title}</div>
                    {vc.subtitle && <div className="text-xs text-[var(--earshot-muted)]">{vc.subtitle}</div>}
                  </div>
                  {vc.options ? (
                    <select
                      value={vc.value ?? 0}
                      onChange={(e) => setVendorControl(vc.id, Number(e.target.value))}
                      className="px-2 py-1 text-xs rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface-low)]"
                    >
                      {vc.options.map((opt, idx) => (
                        <option key={opt} value={idx}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : vc.range ? (
                    <span className="text-xs font-mono-tabular">
                      {vc.value}
                      {vc.unit ?? ''}
                    </span>
                  ) : (
                    <FieldSwitch
                      checked={vc.value === 1}
                      onChange={(v) => setVendorControl(vc.id, v ? 1 : 0)}
                      label={vc.title}
                    />
                  )}
                </div>
              ))}
            </EarshotCard>
          )}
        </div>
      </div>
    </div>
  );
};
