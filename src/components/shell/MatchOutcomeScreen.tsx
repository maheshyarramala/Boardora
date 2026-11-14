import { RotateCcw, ShieldAlert, Trophy, Scale } from 'lucide-react';
import type { GameOutcome } from '../../core/engine';
import { ActionButton } from '../../design-system/primitives';
import { useAppState } from '../../state/AppStateContext';
import { formatDurationClock } from './GameArenaShell';

interface MatchOutcomeScreenProps {
  gameTitle: string;
  outcome: GameOutcome;
  moveCount: number;
  elapsedSeconds: number;
  xpEarned?: number;
  isPreview?: boolean;
  onPlayAgain: () => void;
  onReturnToParlor: () => void;
}

const CELEBRATION_SPARKS = [
  { left: '12%', delay: '0ms', color: '#D6AD55', size: 8 },
  { left: '22%', delay: '120ms', color: '#2865C7', size: 7 },
  { left: '34%', delay: '60ms', color: '#269C68', size: 9 },
  { left: '46%', delay: '190ms', color: '#F4EBDD', size: 8 },
  { left: '58%', delay: '40ms', color: '#D94343', size: 7 },
  { left: '70%', delay: '150ms', color: '#D6AD55', size: 9 },
  { left: '82%', delay: '80ms', color: '#2865C7', size: 8 },
  { left: '90%', delay: '210ms', color: '#269C68', size: 7 },
];

/**
 * Reusable Victory, Defeat, and Draw screen shared across all 10 games.
 * Includes a lightweight CSS celebration effect that honors Reduced Motion.
 */
export function MatchOutcomeScreen({
  gameTitle,
  outcome,
  moveCount,
  elapsedSeconds,
  xpEarned = 0,
  isPreview = false,
  onPlayAgain,
  onReturnToParlor,
}: MatchOutcomeScreenProps) {
  const { profile } = useAppState();
  const reducedMotion = profile?.preferences.accessibility.reducedMotion ?? false;
  const isWin = outcome.humanOutcome === 'win';
  const isDraw = outcome.humanOutcome === 'draw';

  const heading = isWin
    ? 'Victory at the Table'
    : isDraw
    ? 'Honourable Draw'
    : 'Defeat at the Table';

  const eyebrow = isWin
    ? 'MATCH WON'
    : isDraw
    ? 'STALEMATE / DRAW'
    : 'MATCH LOST';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="outcome-heading"
    >
      {isWin && !reducedMotion && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          {CELEBRATION_SPARKS.map((spark, idx) => (
            <span
              key={idx}
              style={{
                left: spark.left,
                width: `${spark.size}px`,
                height: `${spark.size}px`,
                backgroundColor: spark.color,
                animationDelay: spark.delay,
              }}
              className="absolute top-6 rounded-sm animate-bounce opacity-85 shadow-md"
            />
          ))}
        </div>
      )}

      <div className="relative w-full max-w-md rounded-2xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border-strong)] p-6 sm:p-7 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${
              isWin
                ? 'bg-[var(--cp-gold)]/15 border-[var(--cp-gold)] text-[var(--cp-gold)]'
                : isDraw
                ? 'bg-sky-500/15 border-sky-400/50 text-sky-300'
                : 'bg-red-500/15 border-red-400/50 text-red-300'
            }`}
          >
            {isWin ? (
              <Trophy className="w-7 h-7" />
            ) : isDraw ? (
              <Scale className="w-7 h-7" />
            ) : (
              <ShieldAlert className="w-7 h-7" />
            )}
          </div>

          <p className="mt-4 text-xs font-semibold tracking-widest text-[var(--cp-gold-text)]">
            {gameTitle} · {eyebrow}
          </p>
          <h2
            id="outcome-heading"
            className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[var(--cp-text)]"
          >
            {heading}
          </h2>
          <p className="mt-2 text-sm text-[var(--cp-text-muted)] leading-relaxed">
            {outcome.reason}
          </p>
          {isPreview && (
            <p className="mt-2 text-xs text-[var(--cp-gold-text)]">
              UI Screen Preview · No match statistics were recorded.
            </p>
          )}
        </div>

        <div
          className={`mt-6 grid gap-3 rounded-xl bg-[var(--cp-surface)] p-4 text-center border border-[var(--cp-border)] ${
            typeof outcome.score === 'number' ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'
          }`}
        >
          <div>
            <div className="text-xs text-[var(--cp-text-muted)]">Moves</div>
            <div className="mt-0.5 text-lg font-bold font-mono-tabular">
              {moveCount}
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--cp-text-muted)]">Duration</div>
            <div className="mt-0.5 text-lg font-bold font-mono-tabular">
              {formatDurationClock(elapsedSeconds)}
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--cp-text-muted)]">XP</div>
            <div className="mt-0.5 text-lg font-bold font-mono-tabular text-[var(--cp-gold-text)]">
              +{xpEarned}
            </div>
          </div>
          {typeof outcome.score === 'number' && (
            <div>
              <div className="text-xs text-[var(--cp-text-muted)]">Score</div>
              <div className="mt-0.5 text-lg font-bold font-mono-tabular text-[#269C68]">
                {outcome.score}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <ActionButton variant="primary" fullWidth onClick={onPlayAgain}>
            <RotateCcw className="w-4 h-4" />
            {isPreview ? 'Close Preview' : 'Play Again'}
          </ActionButton>
          <ActionButton variant="secondary" fullWidth onClick={onReturnToParlor}>
            Return to Parlor
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
