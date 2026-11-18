import React from 'react';
import { AudioLines, Headphones, Moon, MoreHorizontal, Wrench } from 'lucide-react';
import { EarshotProvider, useEarshot } from './context/EarshotContext';
import { DeviceSwitcherModal, HomeScreen } from './screens/HomeScreen';
import { SoundScreen } from './screens/SoundScreen';
import { AlarmRingingOverlay, SleepScreen } from './screens/SleepScreen';
import { ToolsScreen } from './screens/ToolsScreen';
import { MoreScreen } from './screens/MoreScreen';
import { TabId } from './types/earshot';

const NAV_TABS: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'home', label: 'Home', icon: Headphones },
  { id: 'sound', label: 'Sound', icon: AudioLines },
  { id: 'sleep', label: 'Sleep', icon: Moon },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'more', label: 'More', icon: MoreHorizontal },
];

const EarshotShell: React.FC = () => {
  const {
    activeTab,
    navigateTab,
    appearance,
    headphone,
    setDeviceSwitcherOpen,
    toastMessage,
  } = useEarshot();

  const isField = appearance === 'field';

  return (
    <div
      className={`min-h-screen flex flex-col ${
        isField ? 'earshot-backdrop-dots' : 'earshot-backdrop-aurora'
      }`}
    >
      {/* Desktop Top Bar (3-zone contract: Brand — 5 concise nav links — 1 primary action) */}
      <header className="hidden md:flex items-center justify-between gap-8 px-6 lg:px-10 py-3.5 border-b border-[var(--earshot-hairline)] bg-[var(--earshot-nav-bg)] backdrop-blur-md sticky top-0 z-30">
        <button
          type="button"
          onClick={() => navigateTab('home')}
          className="font-display font-bold text-2xl tracking-wider uppercase text-[var(--earshot-ink)] whitespace-nowrap shrink-0 cursor-pointer"
        >
          Earshot
        </button>

        <nav className="flex items-center gap-6" aria-label="Primary">
          {NAV_TABS.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => navigateTab(t.id)}
                className={`py-1.5 text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors border-b-2 ${
                  active
                    ? 'border-[var(--earshot-accent)] text-[var(--earshot-ink)] font-semibold'
                    : 'border-transparent text-[var(--earshot-muted)] hover:text-[var(--earshot-ink)]'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={() => setDeviceSwitcherOpen(true)}
            className="px-4 py-2 text-xs font-semibold rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-control)] text-[var(--earshot-on-control)] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
          >
            {headphone.info.customName}
          </button>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-8 pt-4 md:pt-6 pb-24 md:pb-10">
        {activeTab === 'home' && <HomeScreen />}
        {activeTab === 'sound' && <SoundScreen />}
        {activeTab === 'sleep' && <SleepScreen />}
        {activeTab === 'tools' && <ToolsScreen />}
        {activeTab === 'more' && <MoreScreen />}
      </main>

      {/* Mobile Bottom Navigation Bar (<= 15% viewport height, 44px+ touch targets) */}
      <nav
        aria-label="Bottom navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--earshot-hairline)] bg-[var(--earshot-nav-bg)] backdrop-blur-md"
      >
        <div className="grid grid-cols-5 items-center h-16 px-1">
          {NAV_TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => navigateTab(t.id)}
                className="flex flex-col items-center justify-center min-h-[44px] gap-1 cursor-pointer"
              >
                <span
                  className={`px-4 py-1 rounded-[var(--earshot-radius-sm)] transition-colors ${
                    active
                      ? 'bg-[var(--earshot-nav-indicator)] text-[var(--earshot-on-nav-indicator)]'
                      : 'text-[var(--earshot-muted)]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </span>
                <span
                  className={`text-[10px] font-mono-tabular uppercase tracking-wider leading-none ${
                    active ? 'text-[var(--earshot-ink)] font-semibold' : 'text-[var(--earshot-muted)]'
                  }`}
                >
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modals & Overlays */}
      <DeviceSwitcherModal />
      <AlarmRingingOverlay />

      {/* Toast / Snackbar */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-[var(--earshot-radius-sm)] bg-[var(--earshot-ink)] text-[var(--earshot-bg)] text-xs font-medium shadow-lg whitespace-nowrap"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export const App: React.FC = () => (
  <EarshotProvider>
    <EarshotShell />
  </EarshotProvider>
);

export default App;
