import { useEffect, useState } from 'react';
import {
  BarChart3,
  Calendar,
  LayoutGrid,
  Settings,
  Trophy,
  User,
} from 'lucide-react';
import { getCatalogEntry, type GameCatalogEntry } from './core/catalog';
import type { ActiveSession } from './core/types';
import { registerBuiltEngines } from './engines/registerBuiltEngines';
import { audioEngine } from './platform/audio';
import { initializeBoardoraAds } from './monetization/ads';

registerBuiltEngines();
import {
  initializeCapacitorNativeShell,
  subscribeAndroidBackButton,
} from './platform/capacitorBridge';
import { AppStateProvider, useAppState } from './state/AppStateContext';
import { AvatarCrest } from './components/brand/AvatarCrest';
import { BoardoraLogo } from './components/brand/BoardoraLogo';
import { AchievementsView } from './components/shell/AchievementsView';
import { DailyChallengeView } from './components/shell/DailyChallengeView';
import { GameHub } from './components/shell/GameHub';
import { GameSetupScreen } from './components/shell/GameSetupScreen';
import { ProfileView } from './components/shell/ProfileView';
import { SettingsView } from './components/shell/SettingsView';
import { SplashScreen } from './components/shell/SplashScreen';
import { StatisticsView } from './components/shell/StatisticsView';
import { TitleScreen } from './components/shell/TitleScreen';

type ShellTab = 'games' | 'daily' | 'stats' | 'achievements' | 'profile' | 'settings';

function BoardoraShell() {
  const { ready, profile, levelInfo, stats, t } = useAppState();
  const [splashDone, setSplashDone] = useState(false);
  const [inParlor, setInParlor] = useState(false);
  const [activeTab, setActiveTab] = useState<ShellTab>('games');
  const [setupGame, setSetupGame] = useState<GameCatalogEntry | null>(null);
  const [resumeSession, setResumeSession] = useState<ActiveSession | null>(null);
  useEffect(() => {
    if (ready) {
      void initializeCapacitorNativeShell();
      void initializeBoardoraAds();
    }
  }, [ready]);

  useEffect(() => {
    return subscribeAndroidBackButton(() => {
      const backEvent = new CustomEvent('boardora:android-back', {
        cancelable: true,
      });
      const notHandled = window.dispatchEvent(backEvent);
      if (!notHandled) {
        return true;
      }
      if (setupGame) {
        setSetupGame(null);
        setResumeSession(null);
        return true;
      }
      if (activeTab !== 'games') {
        setActiveTab('games');
        return true;
      }
      if (inParlor) {
        setInParlor(false);
        return true;
      }
      return false;
    });
  }, [setupGame, activeTab, inParlor]);

  if (!splashDone) {
    return (
      <SplashScreen ready={ready} onComplete={() => setSplashDone(true)} />
    );
  }

  if (!inParlor) {
    return <TitleScreen onEnterParlor={() => setInParlor(true)} />;
  }

  const desktopNavItems: { id: ShellTab; label: string }[] = [
    { id: 'games', label: t('nav.games') },
    { id: 'daily', label: t('nav.daily') },
    { id: 'stats', label: 'Stats' },
    { id: 'achievements', label: 'Awards' },
    { id: 'settings', label: t('nav.settings') },
  ];

  const mobileNavItems: {
    id: ShellTab;
    label: string;
    icon: typeof LayoutGrid;
  }[] = [
    { id: 'games', label: t('nav.games'), icon: LayoutGrid },
    { id: 'stats', label: 'Stats', icon: BarChart3 },
    { id: 'achievements', label: 'Awards', icon: Trophy },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'settings', label: t('nav.settings'), icon: Settings },
  ];

  const handleTabSwitch = (tab: ShellTab) => {
    audioEngine.play('ui-click');
    setSetupGame(null);
    setResumeSession(null);
    setActiveTab(tab);
  };

  const handleOpenGameSetup = (game: GameCatalogEntry) => {
    setResumeSession(null);
    setSetupGame(game);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResumeSession = (session: ActiveSession) => {
    audioEngine.play('wood-clack');
    setResumeSession(session);
    setSetupGame(getCatalogEntry(session.gameId));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isLightTheme = profile?.preferences.theme === 'marble-light';

  return (
    <div className="h-[100dvh] min-h-0 flex flex-col boardora-shell-bg text-[var(--cp-text)] overflow-hidden">
      {/* Three-Zone Header: Boardora Emblem & Wordmark | Navigation | Avatar, Level & Settings */}
      <header className="sticky top-0 z-30 pt-safe border-b border-[var(--cp-border)] bg-[var(--cp-bg-elevated)]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3 sm:gap-6">
          <button
            type="button"
            onClick={() => {
              setSetupGame(null);
              setResumeSession(null);
              setInParlor(false);
            }}
            className="text-left whitespace-nowrap shrink-0 cursor-pointer"
            aria-label="Return to BOARDORA Title Screen"
          >
            <BoardoraLogo
              variant={isLightTheme ? 'light' : 'horizontal'}
              showTagline={false}
              size="sm"
            />
          </button>

          <nav
            aria-label="Primary Boardora navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            {desktopNavItems.map((item) => {
              const active = !setupGame && activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabSwitch(item.id)}
                  className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'border-[var(--cp-gold)] text-[var(--cp-text)] font-semibold'
                      : 'border-transparent text-[var(--cp-text-muted)] hover:text-[var(--cp-text)]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleTabSwitch('daily')}
              aria-label="Daily Challenge"
              className="md:hidden min-h-[44px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-[var(--cp-surface)] transition-colors cursor-pointer"
            >
              <Calendar className="w-5 h-5 text-[var(--cp-gold)]" />
            </button>

            <button
              type="button"
              onClick={() => handleTabSwitch('settings')}
              aria-label="Settings"
              className="md:hidden min-h-[44px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-[var(--cp-surface)] transition-colors cursor-pointer"
            >
              <Settings className="w-5 h-5 text-[var(--cp-text-muted)]" />
            </button>

            {profile && (
              <button
                type="button"
                onClick={() => handleTabSwitch('profile')}
                className="flex items-center gap-2 min-h-[44px] px-2 py-1 rounded-xl hover:bg-[var(--cp-surface)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <AvatarCrest avatarId={profile.avatarId} size={32} />
                <div className="text-left leading-tight">
                  <div className="hidden sm:block text-xs font-semibold truncate max-w-[110px]">
                    {profile.displayName}
                  </div>
                  <div className="text-[11px] font-mono-tabular font-semibold text-[var(--cp-gold-deep)] dark:text-[var(--cp-gold)]">
                    Lv.{levelInfo.level}
                    <span className="hidden sm:inline"> · {profile.xp} XP</span>
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area (padded for mobile bottom tab bar + safe area) */}
      <main className={`flex-1 min-h-0 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 ${activeTab === 'games' && !setupGame ? 'pb-36 md:pb-36' : 'pb-24 md:pb-10'} overflow-y-auto boardora-scroll-region`}>
        {setupGame ? (
          <GameSetupScreen
            game={setupGame}
            stats={stats.byGame[setupGame.id]}
            initialResumeSession={resumeSession}
            onBack={() => {
              setSetupGame(null);
              setResumeSession(null);
            }}
          />
        ) : (
          <>
            {activeTab === 'games' && (
              <GameHub
                onSelectGame={handleOpenGameSetup}
                onResumeSession={handleResumeSession}
                onOpenDaily={() => handleTabSwitch('daily')}
                onOpenProfile={() => handleTabSwitch('profile')}
                onOpenStats={() => handleTabSwitch('stats')}
                onOpenAchievements={() => handleTabSwitch('achievements')}
              />
            )}
            {activeTab === 'daily' && (
              <DailyChallengeView onSelectGame={handleOpenGameSetup} />
            )}
            {activeTab === 'stats' && <StatisticsView />}
            {activeTab === 'achievements' && <AchievementsView />}
            {activeTab === 'profile' && (
              <ProfileView
                onOpenStats={() => handleTabSwitch('stats')}
                onOpenAchievements={() => handleTabSwitch('achievements')}
              />
            )}
            {activeTab === 'settings' && <SettingsView />}
          </>
        )}
      </main>

      {/* Mobile Bottom Thumb-Zone Navigation */}
      <nav
        aria-label="Mobile bottom navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 pb-safe border-t border-[var(--cp-border)] bg-[var(--cp-bg-elevated)]/95 backdrop-blur-md"
      >
        <div className="grid grid-cols-5 h-16">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const active = !setupGame && activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTabSwitch(item.id)}
                className={`flex flex-col items-center justify-center min-h-[44px] gap-1 transition-colors cursor-pointer ${
                  active
                    ? 'text-[var(--cp-gold)] font-semibold'
                    : 'text-[var(--cp-text-muted)]'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] leading-none whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AppStateProvider>
      <BoardoraShell />
    </AppStateProvider>
  );
}
