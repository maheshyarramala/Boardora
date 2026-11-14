import React, { useEffect, useState } from 'react';
import { ArrowLeft, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import type { GameOutcome } from '../../core/engine';
import { useAppState } from '../../state/AppStateContext';

interface GameArenaShellProps {
  title: string;
  subtitle: string;
  turnLabel: string;
  moveCount: number;
  elapsedSeconds: number;
  outcome: GameOutcome | null;
  onExit: () => void;
  onRestart: () => void;
  footerControls?: React.ReactNode;
  children: React.ReactNode;
}

export function formatDurationClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Reusable full-viewport tabletop arena container for all 10 games.
 * Guarantees >=85% unobstructed board area, perimeter HUD, Pause modal, and Victory/Game Over modal.
 */
export function GameArenaShell({
  title,
  subtitle,
  turnLabel,
  moveCount,
  elapsedSeconds,
  outcome,
  onExit,
  onRestart,
  footerControls,
  children,
}: GameArenaShellProps) {
  const { profile, updatePreferences } = useAppState();
  const [paused, setPaused] = useState(false);

  const soundEnabled = profile?.preferences.soundEnabled ?? true;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !outcome?.finished) {
        setPaused((prev) => !prev);
      }
    };
    const onAndroidBack = (e: Event) => {
      e.preventDefault();
      if (outcome?.finished) {
        onExit();
      } else {
        setPaused((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('boardora:android-back', onAndroidBack);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('boardora:android-back', onAndroidBack);
    };
  }, [outcome, onExit]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col pt-safe pb-safe bg-[var(--cp-bg)] text-[var(--cp-text)]">
      {/* Compact Perimeter HUD Header */}
      <header className="flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-5 py-1.5 sm:py-2 border-b border-[var(--cp-border)] bg-[var(--cp-bg-elevated)] shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setPaused(true)}
            aria-label="Back or Pause"
            className="min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-xl bg-[var(--cp-surface)] hover:bg-[var(--cp-surface-muted)] transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="font-display text-sm sm:text-lg font-bold truncate leading-tight">
              {title}
            </h1>
            <p className="text-[11px] sm:text-xs text-[var(--cp-text-muted)] truncate">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm shrink-0">
          <div
            aria-live="polite"
            className="hidden sm:flex items-center gap-2 text-[var(--cp-text)] font-medium"
          >
            <span className="px-2.5 py-0.5 rounded-lg bg-[var(--cp-surface)] border border-[var(--cp-border)] transition-colors">
              {turnLabel}
            </span>
            <span aria-hidden="true" className="text-[var(--cp-text-muted)]">·</span>
            <span className="font-mono-tabular text-[var(--cp-text-muted)]">
              Moves {moveCount}
            </span>
            <span aria-hidden="true" className="text-[var(--cp-text-muted)]">·</span>
            <span className="font-mono-tabular text-[var(--cp-gold)]">
              {formatDurationClock(elapsedSeconds)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => void updatePreferences({ soundEnabled: !soundEnabled })}
            aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}
            className="min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-xl bg-[var(--cp-surface)] hover:bg-[var(--cp-surface-muted)] transition-colors cursor-pointer"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-[var(--cp-gold)]" />
            ) : (
              <VolumeX className="w-4 h-4 text-[var(--cp-text-muted)]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setPaused(true)}
            aria-label="Pause match"
            className="min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-xl bg-[var(--cp-surface)] hover:bg-[var(--cp-surface-muted)] transition-colors cursor-pointer"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mobile Turn & Clock Strip */}
      <div
        aria-live="polite"
        className="sm:hidden flex items-center justify-between px-3 py-1 border-b border-[var(--cp-border)] bg-[var(--cp-surface)] text-xs shrink-0"
      >
        <span className="font-medium text-[var(--cp-text)] truncate">{turnLabel}</span>
        <span className="font-mono-tabular text-[var(--cp-gold)] shrink-0">
          #{moveCount} · {formatDurationClock(elapsedSeconds)}
        </span>
      </div>

      {/* Main Unobstructed Playfield (my-auto prevents top clipping on overflow) */}
      <main className="flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden boardora-scroll-region px-2.5 py-2 sm:px-5 sm:py-3">
        <div className="my-auto w-full">
          {children}
        </div>
      </main>

      {/* Optional Bottom Contextual Action Bar */}
      {footerControls && (
        <footer className="px-4 sm:px-6 py-2.5 border-t border-[var(--cp-border)] bg-[var(--cp-bg-elevated)] shrink-0">
          {footerControls}
        </footer>
      )}

      {/* Pause Modal */}
      {paused && !outcome?.finished && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border-strong)] p-6 shadow-2xl">
            <h2 className="font-display text-2xl font-bold text-center">
              Match Paused
            </h2>
            <p className="mt-1 text-center text-sm text-[var(--cp-text-muted)]">
              Session state is automatically preserved offline.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setPaused(false)}
                className="min-h-[44px] w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--cp-gold)] text-[#08172F] font-semibold text-sm hover:bg-[var(--cp-gold-bright)] transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4" />
                Resume Match
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaused(false);
                  onRestart();
                }}
                className="min-h-[44px] w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--cp-surface)] text-[var(--cp-text)] font-medium text-sm hover:bg-[var(--cp-surface-muted)] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Restart Table
              </button>
              <button
                type="button"
                onClick={onExit}
                className="min-h-[44px] w-full flex items-center justify-center gap-2 rounded-xl border border-[var(--cp-border)] text-[var(--cp-text-muted)] font-medium text-sm hover:text-[var(--cp-text)] transition-colors cursor-pointer"
              >
                Save & Exit to Parlor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Victory / Game Over Modal */}
      {outcome?.finished && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border-strong)] p-6 shadow-2xl">
            <p className="text-xs font-medium tracking-wider text-[var(--cp-gold)] text-center">
              MATCH CONCLUDED
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-center">
              {outcome.humanOutcome === 'win'
                ? 'Victory at the Table'
                : outcome.humanOutcome === 'draw'
                ? 'Honourable Draw'
                : 'Match Complete'}
            </h2>
            <p className="mt-2 text-sm text-center text-[var(--cp-text-muted)]">
              {outcome.reason}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-[var(--cp-surface)] p-4 text-center">
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
            </div>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={onRestart}
                className="min-h-[44px] flex-1 rounded-xl bg-[var(--cp-gold)] text-[#08172F] font-semibold text-sm hover:bg-[var(--cp-gold-bright)] transition-colors cursor-pointer whitespace-nowrap"
              >
                Play Again
              </button>
              <button
                type="button"
                onClick={onExit}
                className="min-h-[44px] flex-1 rounded-xl bg-[var(--cp-surface)] text-[var(--cp-text)] font-medium text-sm hover:bg-[var(--cp-surface-muted)] transition-colors cursor-pointer whitespace-nowrap"
              >
                Return to Parlor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
