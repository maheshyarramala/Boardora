import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Cpu,
  Eye,
  Play,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { GameCatalogEntry } from '../../core/catalog';
import type { GameOutcome, MatchSetupConfig } from '../../core/engine';
import type { ActiveSession, AIDifficulty, GameMode, GameStats } from '../../core/types';
import { ActionButton, SurfaceCard } from '../../design-system/primitives';
import { isEngineRegistered } from '../../engines/registry';
import { audioEngine } from '../../platform/audio';
import { hapticsBridge } from '../../platform/haptics';
import { useAppState } from '../../state/AppStateContext';
import { GameBoardArtwork } from '../brand/GameBoardArtwork';
import { ActiveMatchRunner } from '../games/ActiveMatchRunner';
import {
  BoardPerspectiveStage,
  ChessPiece3D,
  Dice3D,
  LudoPawn3D,
} from '../tabletop/TactilePieces';
import { GameArenaShell } from './GameArenaShell';
import { MatchOutcomeScreen } from './MatchOutcomeScreen';

interface GameSetupScreenProps {
  game: GameCatalogEntry;
  stats: GameStats;
  initialResumeSession?: ActiveSession | null;
  onBack: () => void;
}

const MODE_LABELS: Record<GameMode, string> = {
  ai: 'Human vs AI',
  local: 'Pass & Play',
  practice: 'Practice Mode',
  online: 'Online Match',
};

export function GameSetupScreen({
  game,
  stats,
  initialResumeSession = null,
  onBack,
}: GameSetupScreenProps) {
  const { sessions } = useAppState();
  const [selectedMode, setSelectedMode] = useState<GameMode>(
    game.supportedModes[0] ?? 'practice'
  );
  const [difficulty, setDifficulty] = useState<AIDifficulty>('medium');
  const [playerCount, setPlayerCount] = useState<number>(game.minPlayers);
  const [variant, setVariant] = useState<string>('standard');

  const [activeMatchConfig, setActiveMatchConfig] =
    useState<MatchSetupConfig | null>(null);
  const [resumingSession, setResumingSession] =
    useState<ActiveSession | null>(initialResumeSession);

  const [inspectArena, setInspectArena] = useState(false);
  const [previewDice, setPreviewDice] = useState(5);
  const [previewOutcome, setPreviewOutcome] = useState<GameOutcome | null>(null);

  const savedSessionForGame = sessions.find((s) => s.gameId === game.id) ?? null;

  useEffect(() => {
    setSelectedMode(game.supportedModes[0] ?? 'practice');
    setPlayerCount(game.minPlayers);
    setVariant('standard');
    setInspectArena(false);
    setPreviewOutcome(null);
    if (initialResumeSession && initialResumeSession.gameId === game.id) {
      setResumingSession(initialResumeSession);
      setActiveMatchConfig({
        gameId: game.id,
        mode: initialResumeSession.mode,
        difficulty: initialResumeSession.difficulty,
        playerCount: initialResumeSession.playerCount,
        seed: initialResumeSession.seed,
      });
    } else {
      setResumingSession(null);
      setActiveMatchConfig(null);
    }
  }, [game, initialResumeSession]);

  const engineAvailable = isEngineRegistered(game.id);
  const playerCountOptions: number[] = [];
  for (let p = game.minPlayers; p <= game.maxPlayers; p++) {
    playerCountOptions.push(p);
  }

  // Launch real playable engine match
  if (activeMatchConfig && engineAvailable) {
    return (
      <ActiveMatchRunner
        game={game}
        setupConfig={activeMatchConfig}
        resumeSession={resumingSession}
        onExit={() => {
          setActiveMatchConfig(null);
          setResumingSession(null);
        }}
      />
    );
  }

  // Reusable Layout & Outcome Screen Inspector for remaining future-stage titles
  if (inspectArena) {
    return (
      <>
        <GameArenaShell
          title={game.title}
          subtitle={`${MODE_LABELS[selectedMode]} · Tabletop Layout Preview`}
          turnLabel="Layout Frame"
          moveCount={0}
          elapsedSeconds={0}
          outcome={null}
          onRestart={() => setPreviewDice((d) => (d % 6) + 1)}
          onExit={() => {
            setPreviewOutcome(null);
            setInspectArena(false);
          }}
          footerControls={
            <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-[var(--cp-text-muted)]">
                Pure engine & AI rules for {game.title} arrive in an upcoming stage.
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ActionButton
                  variant="secondary"
                  onClick={() =>
                    setPreviewOutcome({
                      finished: true,
                      winnerIndex: 0,
                      humanOutcome: 'win',
                      reason: `Preview of the reusable Victory screen for ${game.title}.`,
                    })
                  }
                >
                  Preview Victory Screen
                </ActionButton>
                <ActionButton
                  variant="secondary"
                  onClick={() =>
                    setPreviewOutcome({
                      finished: true,
                      winnerIndex: 1,
                      humanOutcome: 'loss',
                      reason: `Preview of the reusable Defeat screen for ${game.title}.`,
                    })
                  }
                >
                  Preview Defeat Screen
                </ActionButton>
              </div>
            </div>
          }
        >
          <div className="w-full max-w-3xl flex flex-col items-center gap-6 py-4">
            <BoardPerspectiveStage className="max-w-xl">
              <div className="boardora-setup-art rounded-2xl overflow-hidden border-2 border-[var(--cp-border-strong)] bg-[var(--cp-wood)] p-3 sm:p-4">
                <GameBoardArtwork gameId={game.id} className="w-full h-auto" />
              </div>
            </BoardPerspectiveStage>

            <div className="flex flex-wrap items-center justify-center gap-6 pt-2">
              <Dice3D
                value={previewDice}
                size={52}
                variant="white"
                interactive
                onClick={() => {
                  audioEngine.play('dice-roll');
                  hapticsBridge.trigger('light');
                  setPreviewDice((d) => (d % 6) + 1);
                }}
              />
              <LudoPawn3D color="crimson" size={42} />
              <LudoPawn3D color="emerald" size={42} />
              <ChessPiece3D piece="knight" tone="gold" size={44} />
              <ChessPiece3D piece="king" tone="gold" size={44} />
            </div>
          </div>
        </GameArenaShell>

        {previewOutcome && (
          <MatchOutcomeScreen
            gameTitle={game.title}
            outcome={previewOutcome}
            moveCount={0}
            elapsedSeconds={0}
            xpEarned={0}
            isPreview
            onPlayAgain={() => setPreviewOutcome(null)}
            onReturnToParlor={() => {
              setPreviewOutcome(null);
              setInspectArena(false);
            }}
          />
        )}
      </>
    );
  }

  const handleStartMatch = () => {
    audioEngine.play('wood-clack');
    hapticsBridge.trigger('medium');
    setResumingSession(null);
    setActiveMatchConfig({
      gameId: game.id,
      mode: selectedMode,
      difficulty,
      playerCount,
      seed: Date.now() >>> 0,
      variant,
    });
  };

  const handleResumeSaved = () => {
    if (!savedSessionForGame) return;
    audioEngine.play('wood-clack');
    hapticsBridge.trigger('medium');
    setResumingSession(savedSessionForGame);
    setActiveMatchConfig({
      gameId: game.id,
      mode: savedSessionForGame.mode,
      difficulty: savedSessionForGame.difficulty,
      playerCount: savedSessionForGame.playerCount,
      seed: savedSessionForGame.seed,
    });
  };

  return (
    <div className="game-setup-shell max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => {
            audioEngine.play('ui-click');
            onBack();
          }}
          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border)] hover:border-[var(--cp-border-strong)] text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Parlor
        </button>

        <span className="text-xs font-mono-tabular text-[var(--cp-gold)]">
          Table {String(game.number).padStart(2, '0')} · {game.boardFinish}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 space-y-5">
          <SurfaceCard highlighted className="p-4 sm:p-5">
            <BoardPerspectiveStage>
              <div className="boardora-setup-art rounded-xl overflow-hidden border border-[var(--cp-border-strong)] bg-[var(--cp-wood)] p-2">
                <GameBoardArtwork gameId={game.id} className="w-full h-auto" />
              </div>
            </BoardPerspectiveStage>

            <div className="mt-5 pt-4 border-t border-[var(--cp-border)] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Dice3D
                  value={previewDice}
                  size={40}
                  variant="white"
                  interactive
                  onClick={() => {
                    audioEngine.play('dice-roll');
                    setPreviewDice((d) => (d % 6) + 1);
                  }}
                />
                <span className="text-xs text-[var(--cp-text-muted)]">
                  Tap 3D die to tumble
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <LudoPawn3D color="sapphire" size={30} />
                <ChessPiece3D piece="queen" tone="gold" size={32} />
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-5">
            <h3 className="text-xs font-semibold tracking-wider text-[var(--cp-gold)]">
              YOUR TABLE RECORD
            </h3>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-[var(--cp-text-muted)]">Played</div>
                <div className="text-xl font-bold font-mono-tabular">{stats.played}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--cp-text-muted)]">Win Rate</div>
                <div className="text-xl font-bold font-mono-tabular">{stats.winRate}%</div>
              </div>
              <div>
                <div className="text-xs text-[var(--cp-text-muted)]">Wins</div>
                <div className="text-base font-semibold font-mono-tabular">{stats.wins}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--cp-text-muted)]">Best Streak</div>
                <div className="text-base font-semibold font-mono-tabular">{stats.bestStreak}</div>
              </div>
              {stats.bestScore !== null && (
                <div>
                  <div className="text-xs text-[var(--cp-text-muted)]">Best Score</div>
                  <div className="text-base font-semibold font-mono-tabular text-[var(--cp-gold)]">
                    {stats.bestScore}
                  </div>
                </div>
              )}
            </div>
          </SurfaceCard>
        </div>

        <SurfaceCard className="lg:col-span-7 p-5 sm:p-6 space-y-6">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--cp-text)]">
              {game.title}
            </h1>
            <p className="mt-1.5 text-sm text-[var(--cp-text-muted)]">
              {game.tagline}
            </p>
            <p className="mt-2 text-xs font-mono-tabular text-[var(--cp-text-muted)]">
              {game.minPlayers === game.maxPlayers
                ? `${game.minPlayers} Player`
                : `${game.minPlayers}–${game.maxPlayers} Players`}{' '}
              · {game.estimatedMinutes} · {game.category}
            </p>
          </div>

          <div>
            <span className="block text-xs font-semibold tracking-wider text-[var(--cp-text-muted)] mb-2.5">
              GAME MODE
            </span>
            <div className="flex flex-wrap gap-2">
              {game.supportedModes.map((mode) => {
                const active = selectedMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      audioEngine.play('ui-click');
                      setSelectedMode(mode);
                    }}
                    className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[var(--cp-gold)] text-[#08172F] font-semibold'
                        : 'bg-[var(--cp-surface)] text-[var(--cp-text)] hover:bg-[var(--cp-surface-muted)]'
                    }`}
                  >
                    {mode === 'ai' && <Cpu className="w-4 h-4" />}
                    {mode === 'local' && <Users className="w-4 h-4" />}
                    {mode === 'practice' && <BookOpen className="w-4 h-4" />}
                    <span>{MODE_LABELS[mode]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {game.supportsDifficulty && selectedMode === 'ai' && (
            <div>
              <span className="block text-xs font-semibold tracking-wider text-[var(--cp-text-muted)] mb-2.5">
                AI DIFFICULTY
              </span>
              <div className="boardora-setup-control inline-flex p-1 rounded-xl bg-[var(--cp-surface)] gap-1">
                {(['easy', 'medium', 'hard'] as const).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => {
                      audioEngine.play('ui-click');
                      setDifficulty(tier);
                    }}
                    className={`min-h-[44px] px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium capitalize transition-colors cursor-pointer whitespace-nowrap ${
                      difficulty === tier
                        ? 'bg-[var(--cp-gold)] text-[#08172F] font-semibold'
                        : 'text-[var(--cp-text-muted)] hover:text-[var(--cp-text)]'
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>
          )}

          {playerCountOptions.length > 1 && selectedMode !== 'practice' && (
            <div>
              <span className="block text-xs font-semibold tracking-wider text-[var(--cp-text-muted)] mb-2.5">
                TABLE SEATS
              </span>
              <div className="boardora-setup-control inline-flex p-1 rounded-xl bg-[var(--cp-surface)] gap-1">
                {playerCountOptions.map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => {
                      audioEngine.play('ui-click');
                      setPlayerCount(count);
                    }}
                    className={`min-h-[44px] px-4 py-1.5 rounded-lg text-xs sm:text-sm font-mono-tabular font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      playerCount === count
                        ? 'bg-[var(--cp-gold)] text-[#08172F] font-semibold'
                        : 'text-[var(--cp-text-muted)] hover:text-[var(--cp-text)]'
                    }`}
                  >
                    {count} Players
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Game-specific Rule Variant Options */}
          {game.id === 'snakes_ladders' && (
            <div>
              <span className="block text-xs font-semibold tracking-wider text-[var(--cp-text-muted)] mb-2.5">
                SQUARE 100 FINISH RULE
              </span>
              <div className="boardora-setup-control inline-flex p-1 rounded-xl bg-[var(--cp-surface)] gap-1">
                {[
                  { id: 'standard', label: 'Exact Roll' },
                  { id: 'bounce', label: 'Bounce Back' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setVariant(opt.id)}
                    className={`min-h-[40px] px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium cursor-pointer whitespace-nowrap ${
                      variant === opt.id
                        ? 'bg-[var(--cp-gold)] text-[#08172F] font-semibold'
                        : 'text-[var(--cp-text-muted)] hover:text-[var(--cp-text)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {game.id === 'checkers' && (
            <div>
              <span className="block text-xs font-semibold tracking-wider text-[var(--cp-text-muted)] mb-2.5">
                CAPTURE RULESET
              </span>
              <div className="boardora-setup-control inline-flex p-1 rounded-xl bg-[var(--cp-surface)] gap-1">
                {[
                  { id: 'standard', label: 'Mandatory Captures' },
                  { id: 'casual', label: 'Casual Captures' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setVariant(opt.id)}
                    className={`min-h-[40px] px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium cursor-pointer whitespace-nowrap ${
                      variant === opt.id
                        ? 'bg-[var(--cp-gold)] text-[#08172F] font-semibold'
                        : 'text-[var(--cp-text-muted)] hover:text-[var(--cp-text)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {game.id === 'peg_solitaire' && (
            <div>
              <span className="block text-xs font-semibold tracking-wider text-[var(--cp-text-muted)] mb-2.5">
                BOARD LAYOUT
              </span>
              <div className="boardora-setup-control inline-flex flex-wrap p-1 rounded-xl bg-[var(--cp-surface)] gap-1">
                {[
                  { id: 'english', label: 'English Cross (33)' },
                  { id: 'european', label: 'European (37)' },
                  { id: 'diamond', label: 'Diamond (25)' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setVariant(opt.id)}
                    className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium cursor-pointer whitespace-nowrap ${
                      (variant === 'standard' ? 'english' : variant) === opt.id
                        ? 'bg-[var(--cp-gold)] text-[#08172F] font-semibold'
                        : 'text-[var(--cp-text-muted)] hover:text-[var(--cp-text)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {game.id === 'money_game' && (
            <div>
              <span className="block text-xs font-semibold tracking-wider text-[var(--cp-text-muted)] mb-2.5">
                ECONOMY WIN RULE
              </span>
              <div className="boardora-setup-control inline-flex flex-wrap p-1 rounded-xl bg-[var(--cp-surface)] gap-1">
                {[
                  { id: 'standard', label: '¢5,000 Net Worth Target' },
                  { id: 'sprint', label: '10-Round Sprint' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setVariant(opt.id)}
                    className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium cursor-pointer whitespace-nowrap ${
                      variant === opt.id
                        ? 'bg-[var(--cp-gold)] text-[#08172F] font-semibold'
                        : 'text-[var(--cp-text-muted)] hover:text-[var(--cp-text)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Official Rules */}
          <div className="rounded-xl border border-[var(--cp-border)] bg-[var(--cp-surface)] p-4">
            <h2 className="text-xs font-semibold tracking-wider text-[var(--cp-gold)]">
              OFFICIAL RULES DOCUMENTATION
            </h2>
            <ul className="mt-2.5 space-y-2 text-sm">
              {game.rulesSummary.map((rule, index) => (
                <li key={index} className="flex items-start gap-2.5">
                  <span className="font-mono-tabular text-xs text-[var(--cp-gold)] mt-0.5">
                    0{index + 1}.
                  </span>
                  <span className="leading-relaxed text-[var(--cp-text-muted)]">
                    {rule}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-4 border-t border-[var(--cp-border)] space-y-4">
            <>
                <div className="flex items-start gap-2.5 text-xs text-[var(--cp-text-muted)]">
                  <ShieldCheck className="w-4 h-4 text-[var(--cp-gold)] shrink-0 mt-0.5" />
                  <span>
                    {engineAvailable
                      ? 'Pure deterministic engine ready. Match state saves automatically to IndexedDB.'
                      : `Pure rules engine for ${game.title} is scheduled for an upcoming build stage.`}
                  </span>
                </div>

                <div className="flex flex-wrap gap-3">
                  {engineAvailable ? (
                    <>
                      <ActionButton variant="primary" onClick={handleStartMatch}>
                        <Play className="w-4 h-4" />
                        Start Match
                      </ActionButton>
                      {savedSessionForGame && (
                        <ActionButton variant="secondary" onClick={handleResumeSaved}>
                          Resume Saved ({savedSessionForGame.actionCount} moves)
                        </ActionButton>
                      )}
                    </>
                  ) : (
                    <ActionButton
                      variant="primary"
                      onClick={() => {
                        audioEngine.play('ui-click');
                        setInspectArena(true);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                      Inspect Tabletop Arena
                    </ActionButton>
                  )}
                </div>
            </>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
