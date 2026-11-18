import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Download,
  FileAudio,
  Pause,
  Play,
  Plus,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEarshot } from '../context/EarshotContext';
import { EarshotCard, FieldSlider, FieldSwitch, InfoBanner, LegendHeading } from '../components/EarshotPrimitives';
import { sampleEqResponse } from '../dsp/biquad';
import { exportAutoEqText, GRAPHIC_FREQUENCIES_HZ } from '../dsp/presets';
import { FilterType, ParametricBand } from '../types/earshot';

const FREQ_TICKS = [
  { hz: 50, label: '50' },
  { hz: 200, label: '200' },
  { hz: 1000, label: '1k' },
  { hz: 5000, label: '5k' },
  { hz: 10000, label: '10k' },
];

function freqToX(hz: number, width: number): number {
  const minLog = Math.log10(20);
  const maxLog = Math.log10(20000);
  return ((Math.log10(Math.max(20, Math.min(20000, hz))) - minLog) / (maxLog - minLog)) * width;
}

function dbToY(db: number, height: number): number {
  const clamped = Math.max(-15, Math.min(15, db));
  return ((15 - clamped) / 30) * height;
}

function formatFreqLabel(hz: number): string {
  return hz >= 1000 ? `${hz / 1000}k` : String(Math.round(hz));
}

export const SoundScreen: React.FC = () => {
  const {
    headphone,
    tuning,
    setTuningEnabled,
    setGlobalExperimental,
    allPresets,
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
    setHeadphoneEq,
    appearance,
    showToast,
  } = useEarshot();

  const [editorMode, setEditorMode] = useState<'graphic' | 'parametric'>('graphic');
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importName, setImportName] = useState('');
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isConnected = headphone.status === 'CONNECTED';

  const curveData = useMemo(() => {
    const pts = sampleEqResponse(tuning.bands, tuning.preampDb, 160, 20, 20000);
    const w = 640;
    const h = 210;
    const padY = 14;
    const innerH = h - padY * 2;
    const zeroY = padY + dbToY(0, innerH);

    const pathD = pts
      .map((p, idx) => {
        const x = freqToX(p.frequencyHz, w);
        const y = padY + dbToY(p.gainDb, innerH);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');

    const areaD = `${pathD} L ${w} ${zeroY.toFixed(1)} L 0 ${zeroY.toFixed(1)} Z`;

    const bandDots = tuning.bands
      .filter((b) => b.enabled)
      .map((b) => {
        const x = freqToX(b.frequencyHz, w);
        const y = padY + dbToY(b.gainDb + tuning.preampDb, innerH);
        return { id: b.id, x, y };
      });

    return { w, h, padY, innerH, zeroY, pathD, areaD, bandDots };
  }, [tuning.bands, tuning.preampDb]);

  // Graphic bands aligned to the 10 ISO frequencies (or mapped to nearest when a parametric preset is loaded)
  const graphicGains = useMemo(() => {
    const isExactGraphic =
      tuning.bands.length === 10 &&
      GRAPHIC_FREQUENCIES_HZ.every((f, i) => Math.abs(tuning.bands[i].frequencyHz - f) < 1);
    if (isExactGraphic) {
      return tuning.bands.map((b) => Math.round(b.gainDb));
    }
    const pts = sampleEqResponse(tuning.bands, 0, 120, 20, 20000);
    return GRAPHIC_FREQUENCIES_HZ.map((hz) => {
      let nearest = pts[0];
      let bestDist = Infinity;
      for (const p of pts) {
        const d = Math.abs(Math.log10(p.frequencyHz) - Math.log10(hz));
        if (d < bestDist) {
          bestDist = d;
          nearest = p;
        }
      }
      return Math.max(-15, Math.min(15, Math.round(nearest.gainDb)));
    });
  }, [tuning.bands]);

  const handleExportAutoEq = async () => {
    const activePreset = allPresets.find((p) => p.id === tuning.activePresetId) ?? {
      id: 'current',
      name: 'Custom EQ',
      bands: tuning.bands,
      preampDb: tuning.preampDb,
      isBuiltIn: false,
    };
    const txt = exportAutoEqText(activePreset);
    try {
      await navigator.clipboard.writeText(txt);
      showToast('Copied AutoEq ParametricEQ.txt to clipboard');
    } catch {
      const blob = new Blob([txt], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activePreset.name.replace(/\s+/g, '_')}_ParametricEQ.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const addParametricBand = () => {
    const newBand: ParametricBand = {
      id: `p-${Date.now()}`,
      frequencyHz: 1000,
      gainDb: 0,
      q: 1.41,
      type: 'PEAK',
      enabled: true,
    };
    updateParametricBands([...tuning.bands, newBand]);
  };

  const updateSingleBand = (id: string, patch: Partial<ParametricBand>) => {
    updateParametricBands(tuning.bands.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const removeBand = (id: string) => {
    if (tuning.bands.length <= 1) return;
    updateParametricBands(tuning.bands.filter((b) => b.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left/Main Column: Pro EQ Card */}
        <EarshotCard className="lg:col-span-8 p-4 md:p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <LegendHeading className="text-xl">Pro EQ</LegendHeading>
              <p className="text-xs text-[var(--earshot-muted)]">
                {tuning.enabled
                  ? eqPlaying
                    ? `Live Biquad DSP active · ${eqTrackLabel}`
                    : 'On — ready for audio playback or headset audition'
                  : 'Off — audio passes untouched'}
              </p>
            </div>
            <FieldSwitch checked={tuning.enabled} onChange={setTuningEnabled} label="Enable Pro EQ" />
          </div>

          <div className="flex items-center justify-between gap-4 pt-2 border-t border-dashed border-[var(--earshot-hairline)]">
            <div className="min-w-0">
              <div className="text-sm font-medium">
                Also apply to apps that don&apos;t share their session (experimental)
              </div>
              <div className="text-xs text-[var(--earshot-muted)]">
                Attaches to global audio output when supported by the device
              </div>
            </div>
            <FieldSwitch
              checked={tuning.globalExperimental}
              onChange={setGlobalExperimental}
              label="Global audio session experimental"
            />
          </div>

          {!isConnected && (
            <InfoBanner tone="warn">
              No Bluetooth headphones connected — the EQ is paused so it doesn&apos;t colour the device speaker. You can still test with the live EQ audition below.
            </InfoBanner>
          )}

          {/* Presets Grid */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {allPresets.map((preset) => {
                const active = tuning.activePresetId === preset.id;
                return (
                  <div key={preset.id} className="inline-flex items-center">
                    <button
                      type="button"
                      onClick={() => selectPreset(preset.id)}
                      className={`px-3 py-2 text-xs font-display font-bold tracking-wider rounded-[var(--earshot-radius-sm)] border cursor-pointer transition-colors whitespace-nowrap ${
                        appearance === 'field' ? 'uppercase' : ''
                      } ${
                        active
                          ? 'bg-[var(--earshot-accent)] text-[var(--earshot-on-accent)] border-[var(--earshot-ink)]'
                          : 'bg-[var(--earshot-surface-low)] text-[var(--earshot-ink)] border-[var(--earshot-hairline)] hover:bg-[var(--earshot-surface-high)]'
                      }`}
                    >
                      {preset.name}
                    </button>
                    {!preset.isBuiltIn && (
                      <button
                        type="button"
                        aria-label={`Delete ${preset.name}`}
                        onClick={() => deleteCustomPreset(preset.id)}
                        className="ml-1 p-1 text-[var(--earshot-muted)] hover:text-[var(--earshot-error)] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-xs text-[var(--earshot-muted)]">
                Each headset remembers its own last chosen preset
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSaveModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] hover:bg-[var(--earshot-surface-high)] cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save as
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportError(null);
                    setImportModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] hover:bg-[var(--earshot-surface-high)] cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  AutoEq import
                </button>
                <button
                  type="button"
                  onClick={() => void handleExportAutoEq()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] hover:bg-[var(--earshot-surface-high)] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                </button>
              </div>
            </div>
          </div>

          {/* Log-Frequency Response Curve Canvas */}
          <div className="rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-surface-low)] border border-[var(--earshot-hairline)] p-3">
            <svg viewBox={`0 0 ${curveData.w} ${curveData.h + 22}`} className="w-full h-auto block select-none">
              {/* Horizontal dB gridlines (-10, -5, 0, +5, +10) */}
              {[-10, -5, 0, 5, 10].map((db) => {
                const y = curveData.padY + dbToY(db, curveData.innerH);
                return (
                  <line
                    key={db}
                    x1={0}
                    y1={y}
                    x2={curveData.w}
                    y2={y}
                    stroke={db === 0 ? 'var(--earshot-ink)' : 'var(--earshot-hairline)'}
                    strokeWidth={db === 0 ? 1.5 : 1}
                    strokeDasharray={db === 0 ? undefined : '4 4'}
                    strokeOpacity={db === 0 ? 0.75 : 0.6}
                  />
                );
              })}

              {/* Vertical log-freq gridlines */}
              {FREQ_TICKS.map((tick) => {
                const x = freqToX(tick.hz, curveData.w);
                return (
                  <g key={tick.hz}>
                    <line
                      x1={x}
                      y1={curveData.padY}
                      x2={x}
                      y2={curveData.h - curveData.padY}
                      stroke="var(--earshot-hairline)"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                      strokeOpacity={0.65}
                    />
                    <text
                      x={x}
                      y={curveData.h + 10}
                      textAnchor="middle"
                      fill="var(--earshot-muted)"
                      fontSize="11"
                      className="font-mono-tabular"
                    >
                      {tick.label}
                    </text>
                  </g>
                );
              })}

              {/* Shaded response fill */}
              <path d={curveData.areaD} fill="var(--earshot-ink)" fillOpacity={0.1} />

              {/* Magnitude Curve */}
              <path
                d={curveData.pathD}
                fill="none"
                stroke={tuning.enabled ? 'var(--earshot-ink)' : 'var(--earshot-muted)'}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Band control points */}
              {curveData.bandDots.map((dot) => (
                <circle
                  key={dot.id}
                  cx={dot.x}
                  cy={dot.y}
                  r={4.5}
                  fill="var(--earshot-ink)"
                  stroke="var(--earshot-surface)"
                  strokeWidth={1.5}
                />
              ))}
            </svg>
          </div>

          {/* Graphic / Parametric Segmented Switch */}
          <div className="grid grid-cols-2 border border-[var(--earshot-hairline)] rounded-[var(--earshot-radius-sm)] overflow-hidden">
            {(['graphic', 'parametric'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setEditorMode(m)}
                className={`py-2.5 text-xs font-display font-bold tracking-wider uppercase cursor-pointer transition-colors ${
                  editorMode === m
                    ? 'bg-[var(--earshot-control)] text-[var(--earshot-on-control)]'
                    : 'bg-[var(--earshot-surface-low)] text-[var(--earshot-ink)]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Graphic 10-band Sliders OR Parametric Band List */}
          {editorMode === 'graphic' ? (
            <div className="grid grid-cols-10 gap-1 sm:gap-2 pt-2">
              {GRAPHIC_FREQUENCIES_HZ.map((hz, idx) => {
                const gain = graphicGains[idx] ?? 0;
                return (
                  <div key={hz} className="flex flex-col items-center gap-2">
                    <span className="text-[11px] font-mono-tabular text-[var(--earshot-ink)]">
                      {gain > 0 ? `+${gain}` : gain}
                    </span>
                    <div className="h-36 flex items-center justify-center">
                      <input
                        type="range"
                        min={-15}
                        max={15}
                        step={1}
                        value={gain}
                        aria-label={`${formatFreqLabel(hz)} Hz gain`}
                        onChange={(e) => updateGraphicBandGain(idx, parseFloat(e.target.value))}
                        className="earshot-slider w-32 -rotate-90 origin-center"
                        style={{
                          background: 'var(--earshot-track)',
                          height: '5px',
                          borderRadius: '3px',
                        }}
                      />
                    </div>
                    <span className="text-[11px] font-mono-tabular text-[var(--earshot-muted)]">
                      {formatFreqLabel(hz)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono-tabular text-[var(--earshot-muted)] uppercase">
                  {tuning.bands.length} active biquad bands
                </span>
                <button
                  type="button"
                  onClick={addParametricBand}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-control)] text-[var(--earshot-on-control)] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add band
                </button>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {tuning.bands.map((band, idx) => (
                  <div
                    key={band.id}
                    className="grid grid-cols-12 gap-2 items-center p-2.5 rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-surface-low)] border border-[var(--earshot-hairline)] text-xs"
                  >
                    <div className="col-span-2 sm:col-span-1 flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={band.enabled}
                        onChange={(e) => updateSingleBand(band.id, { enabled: e.target.checked })}
                        aria-label={`Enable band ${idx + 1}`}
                      />
                      <span className="font-mono-tabular text-[var(--earshot-muted)]">#{idx + 1}</span>
                    </div>
                    <div className="col-span-5 sm:col-span-3">
                      <select
                        value={band.type}
                        onChange={(e) => updateSingleBand(band.id, { type: e.target.value as FilterType })}
                        className="w-full px-2 py-1.5 rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface)]"
                      >
                        <option value="PEAK">Peak (PK)</option>
                        <option value="LOW_SHELF">Low Shelf (LSC)</option>
                        <option value="HIGH_SHELF">High Shelf (HSC)</option>
                      </select>
                    </div>
                    <div className="col-span-5 sm:col-span-3">
                      <label className="text-[10px] text-[var(--earshot-muted)] block">Freq (Hz)</label>
                      <input
                        type="number"
                        min={20}
                        max={20000}
                        value={Math.round(band.frequencyHz)}
                        onChange={(e) =>
                          updateSingleBand(band.id, { frequencyHz: Math.max(20, Math.min(20000, Number(e.target.value) || 20)) })
                        }
                        className="w-full px-2 py-1 font-mono-tabular rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface)]"
                      />
                    </div>
                    <div className="col-span-5 sm:col-span-2">
                      <label className="text-[10px] text-[var(--earshot-muted)] block">Gain (dB)</label>
                      <input
                        type="number"
                        step={0.5}
                        min={-15}
                        max={15}
                        value={band.gainDb}
                        onChange={(e) =>
                          updateSingleBand(band.id, { gainDb: Math.max(-15, Math.min(15, Number(e.target.value) || 0)) })
                        }
                        className="w-full px-2 py-1 font-mono-tabular rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface)]"
                      />
                    </div>
                    <div className="col-span-5 sm:col-span-2">
                      <label className="text-[10px] text-[var(--earshot-muted)] block">Q</label>
                      <input
                        type="number"
                        step={0.1}
                        min={0.1}
                        max={10}
                        value={band.q}
                        onChange={(e) =>
                          updateSingleBand(band.id, { q: Math.max(0.1, Math.min(10, Number(e.target.value) || 0.7)) })
                        }
                        className="w-full px-2 py-1 font-mono-tabular rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface)]"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeBand(band.id)}
                        disabled={tuning.bands.length <= 1}
                        aria-label="Remove band"
                        className="p-1.5 text-[var(--earshot-muted)] hover:text-[var(--earshot-error)] disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </EarshotCard>

        {/* Right Column: Live Audition, Preamp / Volume Boost / Limiter, Headset 3-Band EQ */}
        <div className="lg:col-span-4 space-y-4">
          <EarshotCard className="p-4 md:p-5 space-y-3">
            <LegendHeading className="text-xl">Live EQ Audition</LegendHeading>
            <p className="text-xs text-[var(--earshot-muted)]">
              Hear your biquad curve, preamp, limiter, and volume boost in real time through Web Audio DSP.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleEqPlayback}
                className="flex-1 py-2.5 px-4 rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-control)] text-[var(--earshot-on-control)] font-semibold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {eqPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {eqPlaying ? 'Stop audition' : 'Play test loop'}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Load local audio file"
                className="min-w-[44px] min-h-[42px] px-3 rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] hover:bg-[var(--earshot-surface-high)] inline-flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer"
              >
                <FileAudio className="w-4 h-4" />
                Track
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void loadEqAudioFile(f);
                }}
              />
            </div>
            <div className="text-[11px] font-mono-tabular text-[var(--earshot-muted)] truncate">
              Source: {eqTrackLabel}
            </div>
          </EarshotCard>

          <EarshotCard className="p-4 md:p-5 space-y-4">
            <LegendHeading className="text-xl">Headroom &amp; Boost</LegendHeading>

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Preamp</span>
                <span className="font-mono-tabular">{tuning.preampDb.toFixed(1)} dB</span>
              </div>
              <FieldSlider
                min={-15}
                max={0}
                step={0.5}
                value={tuning.preampDb}
                onChange={setEqPreamp}
                ariaLabel="Preamp gain"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Volume boost</span>
                <span className="font-mono-tabular">+{tuning.boostDb.toFixed(1)} dB</span>
              </div>
              <FieldSlider
                min={0}
                max={12}
                step={0.5}
                value={tuning.boostDb}
                onChange={setEqBoost}
                ariaLabel="Volume boost"
              />
              {tuning.boostDb > 6 && (
                <div className="flex items-start gap-2 text-xs text-[var(--earshot-warn-ink)] bg-[var(--earshot-warn-bg)] p-2 rounded-[var(--earshot-radius-sm)]">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Above +6 dB boost can raise listening levels quickly — watch your volume.</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-dashed border-[var(--earshot-hairline)]">
              <div>
                <div className="text-sm font-medium">Output limiter</div>
                <div className="text-xs text-[var(--earshot-muted)]">Prevents digital clipping on heavy boosts</div>
              </div>
              <FieldSwitch checked={tuning.limiterEnabled} onChange={setEqLimiter} label="Output limiter" />
            </div>
          </EarshotCard>

          {/* Headset's Own 3-Band EQ */}
          {isConnected && headphone.capabilities.hasHeadphoneEq && headphone.eq && (
            <EarshotCard className="p-4 md:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <LegendHeading className="text-xl">Headset EQ</LegendHeading>
                <span className="text-xs font-mono-tabular text-[var(--earshot-muted)]">On-chip</span>
              </div>
              {(
                [
                  { key: 'bass', label: 'Bass', val: headphone.eq.bass },
                  { key: 'mid', label: 'Mid', val: headphone.eq.mid },
                  { key: 'treble', label: 'Treble', val: headphone.eq.treble },
                ] as const
              ).map((band) => (
                <div key={band.key} className="space-y-0.5">
                  <div className="flex justify-between text-sm">
                    <span>{band.label}</span>
                    <span className="font-mono-tabular">{band.val > 0 ? `+${band.val}` : band.val}</span>
                  </div>
                  <FieldSlider
                    min={-10}
                    max={10}
                    value={band.val}
                    onChange={(v) => {
                      const eq = headphone.eq!;
                      setHeadphoneEq(
                        band.key === 'bass' ? v : eq.bass,
                        band.key === 'mid' ? v : eq.mid,
                        band.key === 'treble' ? v : eq.treble,
                      );
                    }}
                    ariaLabel={`Headset ${band.label}`}
                  />
                </div>
              ))}
            </EarshotCard>
          )}
        </div>
      </div>

      {/* Save Custom Preset Modal */}
      {saveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <EarshotCard className="w-full max-w-md p-5 space-y-4">
            <LegendHeading className="text-xl">Save preset</LegendHeading>
            <input
              type="text"
              placeholder="e.g. Late Night Jazz"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface-low)]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSaveModalOpen(false)}
                className="px-4 py-2 text-xs font-medium rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!saveName.trim()) return;
                  saveCustomPreset(saveName);
                  setSaveName('');
                  setSaveModalOpen(false);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-accent)] text-[var(--earshot-on-accent)] cursor-pointer"
              >
                Save
              </button>
            </div>
          </EarshotCard>
        </div>
      )}

      {/* AutoEq Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <EarshotCard className="w-full max-w-lg p-5 space-y-3">
            <LegendHeading className="text-xl">Import AutoEq ParametricEQ.txt</LegendHeading>
            <input
              type="text"
              placeholder="Preset name (e.g. Sony XM5 Harman)"
              value={importName}
              onChange={(e) => setImportName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface-low)]"
            />
            <textarea
              rows={7}
              placeholder={`Preamp: -4.2 dB\nFilter 1: ON LSC Fc 105 Hz Gain 3.0 dB Q 0.70\nFilter 2: ON PK Fc 3200 Hz Gain -2.5 dB Q 1.80`}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono-tabular rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface-low)]"
            />
            {importError && <p className="text-xs text-[var(--earshot-error)]">{importError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="px-4 py-2 text-xs font-medium rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    importAutoEqPreset(importName, importText);
                    setImportName('');
                    setImportText('');
                    setImportModalOpen(false);
                  } catch (err) {
                    setImportError(err instanceof Error ? err.message : 'Invalid AutoEq text');
                  }
                }}
                className="px-4 py-2 text-xs font-semibold rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-accent)] text-[var(--earshot-on-accent)] cursor-pointer"
              >
                Import
              </button>
            </div>
          </EarshotCard>
        </div>
      )}
    </div>
  );
};
