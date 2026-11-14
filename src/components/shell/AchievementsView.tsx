import { useState } from 'react';
import { Award, Lock, Trophy } from 'lucide-react';
import { ACHIEVEMENT_DEFINITIONS } from '../../core/achievements';
import { SectionHeading, SurfaceCard } from '../../design-system/primitives';
import { audioEngine } from '../../platform/audio';
import { useAppState } from '../../state/AppStateContext';

type AchievementFilter = 'all' | 'unlocked' | 'locked';

export function AchievementsView() {
  const { achievements, t } = useAppState();
  const [filter, setFilter] = useState<AchievementFilter>('all');

  const unlockedMap = new Map(achievements.map((a) => [a.id, a.unlockedAt]));
  const totalCount = ACHIEVEMENT_DEFINITIONS.length;
  const unlockedCount = achievements.length;
  const completionPct = Math.round((unlockedCount / Math.max(1, totalCount)) * 100);

  const visible = ACHIEVEMENT_DEFINITIONS.filter((def) => {
    const isUnlocked = unlockedMap.has(def.id);
    if (filter === 'unlocked') return isUnlocked;
    if (filter === 'locked') return !isUnlocked;
    return true;
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <SectionHeading
        title="Achievements"
        subtitle="Milestones earned automatically from verified match completions."
      />

      <SurfaceCard highlighted className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[var(--cp-surface)] border border-[var(--cp-border-strong)] flex items-center justify-center">
              <Trophy className="w-6 h-6 text-[var(--cp-gold)]" />
            </div>
            <div>
              <div className="font-display text-xl font-bold font-mono-tabular">
                {unlockedCount} / {totalCount} Unlocked
              </div>
              <div className="text-xs text-[var(--cp-text-muted)]">
                Parlor Mastery Progress · {completionPct}%
              </div>
            </div>
          </div>

          <div className="inline-flex p-1 rounded-xl bg-[var(--cp-surface)] gap-1">
            {(['all', 'unlocked', 'locked'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  audioEngine.play('ui-click');
                  setFilter(tab);
                }}
                className={`min-h-[40px] px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium capitalize transition-colors cursor-pointer whitespace-nowrap ${
                  filter === tab
                    ? 'bg-[var(--cp-gold)] text-[#08172F] font-semibold'
                    : 'text-[var(--cp-text-muted)] hover:text-[var(--cp-text)]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 h-2 w-full rounded-full bg-[var(--cp-surface)] overflow-hidden">
          <div
            className="h-full bg-[var(--cp-gold)] transition-all duration-200"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </SurfaceCard>

      {visible.length === 0 ? (
        <SurfaceCard className="p-8 text-center text-sm text-[var(--cp-text-muted)]">
          No achievements in this filter yet.
        </SurfaceCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {visible.map((ach) => {
            const unlockedAt = unlockedMap.get(ach.id);
            return (
              <SurfaceCard
                key={ach.id}
                highlighted={Boolean(unlockedAt)}
                className={`p-5 flex flex-col justify-between ${
                  unlockedAt ? '' : 'opacity-80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="capitalize font-semibold text-[var(--cp-gold)]">
                      {ach.category} · +{ach.xpReward} XP
                    </span>
                    {unlockedAt ? (
                      <Award className="w-4 h-4 text-[var(--cp-gold)] shrink-0" />
                    ) : (
                      <Lock className="w-4 h-4 text-[var(--cp-text-muted)] shrink-0" />
                    )}
                  </div>
                  <h3 className="mt-2.5 font-display text-base font-bold text-[var(--cp-text)]">
                    {t(ach.titleKey as never)}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--cp-text-muted)]">
                    {t(ach.descriptionKey as never)}
                  </p>
                </div>

                <p className="mt-4 pt-3 border-t border-[var(--cp-border)] text-xs font-mono-tabular text-[var(--cp-text-muted)]">
                  {unlockedAt
                    ? `Unlocked ${new Date(unlockedAt).toLocaleDateString()}`
                    : 'Not yet earned'}
                </p>
              </SurfaceCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
