import React from 'react';
import { ArrowLeft, Info, Zap } from 'lucide-react';
import { useEarshot } from '../context/EarshotContext';
import { SupportTier } from '../types/earshot';

export const EarshotCard: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  const { appearance } = useEarshot();
  return (
    <div
      className={`border border-[var(--earshot-hairline)] bg-[var(--earshot-surface)] rounded-[var(--earshot-radius-md)] ${
        appearance === 'aurora' ? 'backdrop-blur-md' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};

export const LegendHeading: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  const { appearance } = useEarshot();
  return (
    <h2
      className={`font-display font-bold tracking-[0.04em] ${
        appearance === 'field' ? 'uppercase' : ''
      } ${className}`}
    >
      {children}
    </h2>
  );
};

export const FieldSwitch: React.FC<{
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
}> = ({ checked, onChange, disabled = false, label }) => {
  const { appearance } = useEarshot();
  const isField = appearance === 'field';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex shrink-0 items-center transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--earshot-accent)] ${
        isField ? 'h-8 w-[54px] rounded-[6px] border' : 'h-7 w-12 rounded-full'
      } ${
        checked
          ? 'bg-[var(--earshot-accent)] border-[var(--earshot-ink)]'
          : 'bg-[var(--earshot-track)] border-transparent'
      } ${disabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block transition-transform duration-150 ${
          isField ? 'h-[22px] w-[22px] rounded-[4px]' : 'h-5 w-5 rounded-full'
        } ${
          checked
            ? isField
              ? 'translate-x-[27px] bg-[var(--earshot-on-accent)]'
              : 'translate-x-[24px] bg-[var(--earshot-on-accent)]'
            : isField
              ? 'translate-x-[4px] bg-[var(--earshot-muted)]'
              : 'translate-x-[4px] bg-white dark:bg-[var(--earshot-muted)]'
        }`}
      />
    </button>
  );
};

export const FieldSlider: React.FC<{
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (val: number) => void;
  ariaLabel?: string;
}> = ({ value, min, max, step = 1, disabled = false, onChange, ariaLabel }) => {
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
  return (
    <div className={`relative w-full flex items-center py-2 ${disabled ? 'opacity-45' : ''}`}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="earshot-slider w-full"
        style={{
          background: `linear-gradient(to right, var(--earshot-fill) 0%, var(--earshot-fill) ${pct}%, var(--earshot-track) ${pct}%, var(--earshot-track) 100%)`,
          height: '6px',
          borderRadius: '3px',
        }}
      />
    </div>
  );
};

export const BatteryDial: React.FC<{
  percent: number | null;
  charging?: boolean;
  size?: number;
}> = ({ percent, charging = false, size = 84 }) => {
  const { appearance } = useEarshot();
  const isField = appearance === 'field';
  const pct = percent !== null ? Math.max(0, Math.min(100, percent)) : 0;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.36;
  const circumference = 2 * Math.PI * radius;
  const sweepDeg = 270;
  const arcLen = (circumference * sweepDeg) / 360;
  const fillLen = (arcLen * pct) / 100;
  const ticks = 28;
  const tickRadiusOuter = size * 0.46;
  const tickRadiusInner = size * 0.41;
  const isLow = percent !== null && percent <= 20;
  const activeColor = isLow ? 'var(--earshot-error)' : 'var(--earshot-dial)';

  return (
    <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {isField &&
          Array.from({ length: ticks }).map((_, idx) => {
            const angleDeg = 135 + (idx / (ticks - 1)) * 270;
            const rad = (angleDeg * Math.PI) / 180;
            const x1 = cx + tickRadiusInner * Math.cos(rad);
            const y1 = cy + tickRadiusInner * Math.sin(rad);
            const x2 = cx + tickRadiusOuter * Math.cos(rad);
            const y2 = cy + tickRadiusOuter * Math.sin(rad);
            return (
              <line
                key={idx}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="var(--earshot-muted)"
                strokeOpacity={0.55}
                strokeWidth={1.6}
              />
            );
          })}

        {/* Track arc */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--earshot-track)"
          strokeWidth={isField ? 7 : 6}
          strokeDasharray={`${arcLen} ${circumference}`}
          strokeLinecap={isField ? 'butt' : 'round'}
          transform={`rotate(135 ${cx} ${cy})`}
        />

        {/* Active arc */}
        {percent !== null && (
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={activeColor}
            strokeWidth={isField ? 7 : 6}
            strokeDasharray={`${fillLen} ${circumference}`}
            strokeLinecap={isField ? 'butt' : 'round'}
            transform={`rotate(135 ${cx} ${cy})`}
            style={{ transition: 'stroke-dasharray 240ms cubic-bezier(0.16, 1, 0.3, 1)' }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono-tabular text-lg font-semibold leading-none text-[var(--earshot-ink)]">
          {percent !== null ? percent : '--'}
        </span>
        {charging && <Zap className="w-3 h-3 text-[var(--earshot-accent)] mt-0.5" />}
      </div>
    </div>
  );
};

export const SupportTierBadge: React.FC<{ tier: SupportTier }> = ({ tier }) => {
  const labels: Record<SupportTier, string> = {
    TESTED: 'Tested',
    EXPERIMENTAL: 'Experimental',
    BATTERY_ONLY: 'Battery only',
    ANY_HEADSET: 'Any headset',
  };
  const tone =
    tier === 'TESTED'
      ? 'text-[var(--earshot-ok)] border-[var(--earshot-ok)]/40'
      : tier === 'EXPERIMENTAL'
        ? 'text-[var(--earshot-warn-ink)] bg-[var(--earshot-warn-bg)] border-transparent'
        : 'text-[var(--earshot-muted)] border-[var(--earshot-hairline)]';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-mono-tabular font-medium uppercase tracking-wider rounded-[var(--earshot-radius-sm)] border ${tone}`}
    >
      {labels[tier]}
    </span>
  );
};

export const SubScreenHeader: React.FC<{
  title: string;
  subtitle?: string;
  onBack: () => void;
  action?: React.ReactNode;
}> = ({ title, subtitle, onBack, action }) => {
  return (
    <div className="flex items-center justify-between gap-4 pb-3 border-b border-[var(--earshot-hairline)] mb-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-[var(--earshot-radius-sm)] border border-[var(--earshot-hairline)] bg-[var(--earshot-surface)] hover:bg-[var(--earshot-surface-high)] transition-colors cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <LegendHeading className="text-2xl leading-tight truncate">{title}</LegendHeading>
          {subtitle && <p className="text-xs text-[var(--earshot-muted)] truncate">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

export const InfoBanner: React.FC<{
  children: React.ReactNode;
  tone?: 'warn' | 'neutral';
  action?: React.ReactNode;
}> = ({ children, tone = 'warn', action }) => (
  <div
    className={`flex items-start gap-3 p-3.5 rounded-[var(--earshot-radius-md)] text-sm ${
      tone === 'warn'
        ? 'bg-[var(--earshot-warn-bg)] text-[var(--earshot-warn-ink)]'
        : 'bg-[var(--earshot-surface-high)] text-[var(--earshot-ink)] border border-[var(--earshot-hairline)]'
    }`}
  >
    <Info className="w-4 h-4 shrink-0 mt-0.5" />
    <div className="flex-1 min-w-0 leading-snug">{children}</div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);
