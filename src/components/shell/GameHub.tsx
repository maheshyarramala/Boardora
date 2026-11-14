import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Calendar,
  History,
  Play,
  Search,
  Trash2,
  Trophy,
} from 'lucide-react';
import { ACHIEVEMENT_DEFINITIONS } from '../../core/achievements';
import {
  GAME_CATALOG,
  getCatalogEntry,
  type GameCatalogEntry,
  type GameCategory,
} from '../../core/catalog';
import { ActionButton, SurfaceCard } from '../../design-system/primitives';
import { audioEngine } from '../../platform/audio';
import { hapticsBridge } from '../../platform/haptics';
import { useAppState } from '../../state/AppStateContext';
import { GameBoardArtwork } from '../brand/GameBoardArtwork';
import {
  BoardPerspectiveStage,
  ChessPiece3D,
  Dice3D,
  LudoPawn3D,
} from '../tabletop/TactilePieces';

import type { ActiveSession } from '../../core/types';

interface GameHubProps {
  onSelectGame: (game: GameCatalogEntry) => void;
  onResumeSession: (session: ActiveSession) => void;
  onOpenDaily: () => void;
  onOpenProfile: () => void;
  onOpenStats: () => void;
  onOpenAchievements: () => void;
}

type CategoryFilter = 'all' | GameCategory;

export function GameHub({
  onSelectGame,
  onResumeSession,
  onOpenDaily,
  onOpenProfile,
  onOpenStats,
  onOpenAchievements,
}: GameHubProps) {
  const {
    t,
    profile,
    levelInfo,
    stats,
    sessions,
    matches,
    achievements,
    dailyChallenge,
    deleteSession,
  } = useAppState();
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [heroDie, setHeroDie] = useState(5);

  const filteredGames = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return GAME_CATALOG.filter((game) => {
      const matchesCat = filter === 'all' || game.category === filter;
      const matchesSearch =
        query.length === 0 ||
        game.title.toLowerCase().includes(query) ||
        game.tagline.toLowerCase().includes(query);
      return matchesCat && matchesSearch;
    });
  }, [filter, searchQuery]);

  const categories: { id: CategoryFilter; label: string }[] = [
    { id: 'all', label: t('filter.all') },
    { id: 'strategy', label: t('filter.strategy') },
    { id: 'race', label: t('filter.race') },
    { id: 'puzzle', label: t('filter.puzzle') },
    { id: 'economy', label: t('filter.economy') },
  ];

  const dailyGame = dailyChallenge ? getCatalogEntry(dailyChallenge.gameId) : null;
  const recentMatches = matches.slice(0, 3);
  const featuredSession = sessions[0] ?? null;

  return (
    <div className="space-y-8 boardora-enter">
      {/* Hero Section: Premium Welcome + Continue Playing Card + 3D Board-Game Artwork */}
      <SurfaceCard highlighted className="p-5 sm:p-7 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
          <div className="lg:col-span-7 space-y-5">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.22em] text-[var(--cp-gold-text)] uppercase">
                ONE WORLD. TEN GAMES. ENDLESS FUN.
              </p>
              <h1
                className="mt-2 font-display text-2xl sm:text-4xl font-bold text-[var(--cp-text)]"
                style={{ textWrap: 'balance' }}
              >
                {profile ? `Welcome back, ${profile.displayName}` : t('hub.heading')}
              </h1>
              <p className="mt-2 text-sm sm:text-base text-[var(--cp-text-muted)] max-w-xl leading-relaxed">
                {t('hub.subheading')}
              </p>
            </div>

            {/* Integrated Continue Playing Card */}
            <div className="rounded-xl border border-[var(--cp-border-strong)] bg-[var(--cp-surface)]/85 p-4">
              <div className="flex items-center justify-between gap-2 text-xs font-semibold tracking-wider text-[var(--cp-gold-text)]">
                <span>CONTINUE PLAYING</span>
                <button
                  type="button"
                  onClick={onOpenProfile}
                  className="font-mono-tabular hover:underline cursor-pointer"
                >
                  Level {levelInfo.level} · {profile?.xp ?? 0} XP
                </button>
              </div>

              {featuredSession ? (
                <div className="mt-3 space-y-2.5">
                  {sessions.slice(0, 2).map((session) => {
                    const entry = getCatalogEntry(session.gameId);
                    return (
                      <div
                        key={session.sessionId}
                        className="flex items-center justify-between gap-3 rounded-xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border)] px-3.5 py-2.5"
                      >
                        <div className="min-w-0">
                          <div className="font-display text-sm sm:text-base font-bold truncate">
                            {entry.title}
                          </div>
                          <div className="text-xs text-[var(--cp-text-muted)] font-mono-tabular">
                            {session.actionCount} moves · {session.mode}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onResumeSession(session)}
                            className="min-h-[40px] px-3.5 rounded-lg bg-gradient-to-b from-[#E5C16C] to-[#D6AD55] text-[#08172F] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:from-[#F0D185] hover:to-[#DFB862]"
                          >
                            <Play className="w-3.5 h-3.5" />
                            Resume
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteSession(session.sessionId)}
                            aria-label={`Discard ${entry.title} session`}
                            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[var(--cp-text-muted)] hover:text-[#D94343] cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-sm text-[var(--cp-text-muted)] leading-snug">
                    No paused table in progress. Launch any classic board below—your seat saves automatically.
                  </p>
                  <ActionButton
                    variant="primary"
                    onClick={() => {
                      audioEngine.play('wood-clack');
                      hapticsBridge.trigger('light');
                      onSelectGame(GAME_CATALOG[1]); // Chess quick launch
                    }}
                  >
                    <Play className="w-4 h-4" />
                    Play Chess
                  </ActionButton>
                </div>
              )}
            </div>

            {/* Tactile 3D Piece Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
              <div className="flex items-center gap-2.5">
                <LudoPawn3D color="crimson" size={30} />
                <LudoPawn3D color="emerald" size={30} />
                <LudoPawn3D color="sapphire" size={30} />
                <LudoPawn3D color="gold" size={30} />
                <ChessPiece3D piece="knight" tone="gold" size={32} />
                <ChessPiece3D piece="king" tone="gold" size={32} />
              </div>
              <div className="flex items-center gap-2.5">
                <Dice3D
                  value={heroDie}
                  size={36}
                  variant="white"
                  interactive
                  onClick={() => {
                    audioEngine.play('dice-roll');
                    hapticsBridge.trigger('light');
                    setHeroDie((d) => (d % 6) + 1);
                  }}
                />
                <span className="text-xs text-[var(--cp-text-muted)]">
                  Tap 3D Die
                </span>
              </div>
            </div>
          </div>

          {/* 3D Board-Game Hero Illustration */}
          <div className="lg:col-span-5">
            <BoardPerspectiveStage>
              <div className="rounded-2xl overflow-hidden border border-[var(--cp-border-strong)] bg-[#08172F] p-2 shadow-xl">
                <img
                  src="/assets/game-art/hero-tabletop-3d.svg"
                  alt="BOARDORA 3D walnut chessboard with golden chess pieces, white dice, and four glossy Ludo pawns"
                  className="w-full h-auto rounded-xl block"
                />
              </div>
            </BoardPerspectiveStage>
          </div>
        </div>
      </SurfaceCard>

      {/* Additional Sections: Daily Challenge, Recently Played, Achievements, Player Statistics */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* 1. Daily Challenge */}
        <SurfaceCard className="p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-[var(--cp-gold-text)]">
              <span>DAILY CHALLENGE</span>
              <Calendar className="w-4 h-4" />
            </div>
            {dailyChallenge && dailyGame ? (
              <div className="mt-3">
                <div className="font-display text-base font-bold">
                  {dailyGame.title}
                </div>
                <p className="mt-1 text-xs text-[var(--cp-text-muted)] font-mono-tabular">
                  {dailyChallenge.dateKey} · +{dailyChallenge.xpReward} XP ·{' '}
                  {dailyChallenge.completed ? 'Completed' : 'Active'}
                </p>
              </div>
            ) : null}
          </div>
          <div className="mt-4">
            <ActionButton variant="secondary" fullWidth onClick={onOpenDaily}>
              View Challenge
              <ArrowRight className="w-4 h-4" />
            </ActionButton>
          </div>
        </SurfaceCard>

        {/* 2. Recently Played */}
        <SurfaceCard className="p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-[var(--cp-gold-text)]">
              <span>RECENTLY PLAYED</span>
              <History className="w-4 h-4" />
            </div>
            {recentMatches.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--cp-text-muted)] leading-relaxed">
                No completed matches yet. Finish any board to record your history here.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-xs">
                {recentMatches.map((m) => (
                  <li key={m.matchId} className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">
                      {getCatalogEntry(m.gameId).title}
                    </span>
                    <span className="font-mono-tabular uppercase font-semibold text-[var(--cp-gold-text)]">
                      {m.outcome}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-4">
            <ActionButton variant="secondary" fullWidth onClick={onOpenStats}>
              Recent Ledger
              <ArrowRight className="w-4 h-4" />
            </ActionButton>
          </div>
        </SurfaceCard>

        {/* 3. Achievements */}
        <SurfaceCard className="p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-[var(--cp-gold-text)]">
              <span>ACHIEVEMENTS</span>
              <Trophy className="w-4 h-4" />
            </div>
            <div className="mt-3 text-2xl font-bold font-mono-tabular">
              {achievements.length} / {ACHIEVEMENT_DEFINITIONS.length}
            </div>
            <p className="mt-1 text-xs text-[var(--cp-text-muted)]">
              Milestones unlocked across all ten classic boards
            </p>
          </div>
          <div className="mt-4">
            <ActionButton variant="secondary" fullWidth onClick={onOpenAchievements}>
              View Milestones
              <ArrowRight className="w-4 h-4" />
            </ActionButton>
          </div>
        </SurfaceCard>

        {/* 4. Player Statistics */}
        <SurfaceCard className="p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-[var(--cp-gold-text)]">
              <span>PLAYER STATISTICS</span>
              <BarChart3 className="w-4 h-4" />
            </div>
            <div className="mt-3 text-2xl font-bold font-mono-tabular">
              {stats.overallWinRate}% Win Rate
            </div>
            <p className="mt-1 text-xs font-mono-tabular text-[var(--cp-text-muted)]">
              {stats.totalPlayed} played · {stats.totalWins} wins · {stats.totalDraws} draws
            </p>
          </div>
          <div className="mt-4">
            <ActionButton variant="secondary" fullWidth onClick={onOpenStats}>
              Full Statistics
              <ArrowRight className="w-4 h-4" />
            </ActionButton>
          </div>
        </SurfaceCard>
      </section>

      {/* Collection Filter & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border)] overflow-x-auto max-w-full w-fit">
          {categories.map((cat) => {
            const active = filter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  audioEngine.play('ui-click');
                  setFilter(cat.id);
                }}
                className={`min-h-[40px] px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-gradient-to-b from-[#E5C16C] to-[#D6AD55] text-[#08172F] font-semibold'
                    : 'text-[var(--cp-text-muted)] hover:text-[var(--cp-text)]'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-72 shrink-0">
          <Search
            className="w-4 h-4 text-[var(--cp-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search 10 games..."
            aria-label="Search games"
            className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border)] text-sm text-[var(--cp-text)] placeholder:text-[var(--cp-text-muted)] focus:outline-none focus:border-[var(--cp-gold)]"
          />
        </div>
      </div>

      {/* Ten Game Selection Cards */}
      {filteredGames.length === 0 ? (
        <SurfaceCard className="p-10 text-center">
          <p className="text-sm text-[var(--cp-text-muted)]">
            No tabletop games match your current filter.
          </p>
        </SurfaceCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredGames.map((game) => {
            const gameStats = stats.byGame[game.id];
            const difficultyLabel = game.supportsDifficulty
              ? 'Easy · Med · Hard AI'
              : 'Standard Rules';
            const playerLabel =
              game.minPlayers === game.maxPlayers
                ? `${game.minPlayers} Player`
                : `${game.minPlayers}–${game.maxPlayers} Players`;

            return (
              <SurfaceCard
                key={game.id}
                className="p-4 flex flex-col justify-between hover:border-[var(--cp-border-strong)] hover:-translate-y-0.5 transition-all duration-150"
              >
                <div>
                  <h2 className="font-display text-base sm:text-[17px] font-bold text-[var(--cp-text)] leading-snug">
                    {String(game.number).padStart(2, '0')}. {game.title}
                  </h2>

                  <div className="mt-3 rounded-xl overflow-hidden border border-[var(--cp-border)] shadow-inner bg-[#08172F] aspect-[16/9]">
                    <GameBoardArtwork
                      gameId={game.id}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <p className="mt-3 text-sm leading-snug text-[var(--cp-text-muted)] line-clamp-2">
                    {game.tagline}
                  </p>

                  <p className="mt-2.5 text-xs text-[var(--cp-text-muted)] font-mono-tabular">
                    {playerLabel} · {difficultyLabel}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--cp-border)] flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs capitalize text-[var(--cp-text-muted)] truncate">
                      {game.category} · {game.estimatedMinutes}
                    </div>
                    <div className="text-[11px] font-mono-tabular text-[var(--cp-gold-text)] mt-0.5">
                      {gameStats.played} played
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      audioEngine.play('wood-clack');
                      hapticsBridge.trigger('light');
                      onSelectGame(game);
                    }}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-gradient-to-b from-[#E5C16C] to-[#D6AD55] text-[#08172F] text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 hover:from-[#F0D185] hover:to-[#DFB862] active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Play
                  </button>
                </div>
              </SurfaceCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
