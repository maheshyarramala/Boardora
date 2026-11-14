import { Calendar, CheckCircle2, Sparkles } from 'lucide-react';
import { getCatalogEntry, type GameCatalogEntry } from '../../core/catalog';
import { audioEngine } from '../../platform/audio';
import { useAppState } from '../../state/AppStateContext';
import { GameBoardArtwork } from '../brand/GameBoardArtwork';

interface DailyChallengeViewProps {
  onSelectGame: (game: GameCatalogEntry) => void;
}

export function DailyChallengeView({ onSelectGame }: DailyChallengeViewProps) {
  const { dailyChallenge, t } = useAppState();

  if (!dailyChallenge) {
    return (
      <div className="rounded-2xl border border-[var(--cp-border)] bg-[var(--cp-bg-elevated)] p-8 text-center text-sm text-[var(--cp-text-muted)]">
        Loading daily tabletop challenge...
      </div>
    );
  }

  const game = getCatalogEntry(dailyChallenge.gameId);

  const objectiveCopy =
    dailyChallenge.objectiveType === 'complete_match'
      ? `Complete a full match of ${game.title}.`
      : dailyChallenge.objectiveType === 'win_under_moves'
      ? `Win a match of ${game.title} in ${dailyChallenge.targetValue} moves or fewer.`
      : `Win a match of ${game.title}.`;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--cp-text)]">
          {t('daily.title')}
        </h1>
        <p className="mt-1.5 text-sm text-[var(--cp-text-muted)]">
          Seeded deterministically for UTC date {dailyChallenge.dateKey}.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--cp-border-strong)] bg-[var(--cp-bg-elevated)] p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        <div className="rounded-xl overflow-hidden border border-[var(--cp-border)]">
          <GameBoardArtwork gameId={game.id} className="w-full h-full min-h-[190px]" />
        </div>

        <div className="flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--cp-gold)]">
              <Calendar className="w-4 h-4" />
              <span>{dailyChallenge.dateKey}</span>
              <span aria-hidden="true">·</span>
              <span>
                {dailyChallenge.completed ? t('daily.completed') : t('daily.active')}
              </span>
            </div>

            <h2 className="mt-2 font-display text-2xl font-bold text-[var(--cp-text)]">
              {game.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--cp-text-muted)]">
              {objectiveCopy}
            </p>
          </div>

          <div className="pt-4 border-t border-[var(--cp-border)] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm">
              {dailyChallenge.completed ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <Sparkles className="w-5 h-5 text-[var(--cp-gold)]" />
              )}
              <span className="font-mono-tabular font-semibold text-[var(--cp-text)]">
                +{dailyChallenge.xpReward} {t('daily.reward')}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                audioEngine.play('ui-click');
                onSelectGame(game);
              }}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[var(--cp-gold)] text-[#08172F] text-sm font-semibold hover:bg-[var(--cp-gold-bright)] transition-colors cursor-pointer whitespace-nowrap"
            >
              Inspect Table
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
