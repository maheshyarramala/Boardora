import { GAME_CATALOG, getCatalogEntry } from '../../core/catalog';
import { SectionHeading, StatTile, SurfaceCard } from '../../design-system/primitives';
import { useAppState } from '../../state/AppStateContext';

function formatHoursMinutes(totalMs: number): string {
  const mins = Math.floor(Math.max(0, totalMs) / 60000);
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours === 0) return `${remMins}m`;
  return `${hours}h ${remMins}m`;
}

export function StatisticsView() {
  const { stats, matches, t } = useAppState();

  return (
    <div className="space-y-8 max-w-6xl">
      <SectionHeading
        title="Tabletop Statistics"
        subtitle="Computed directly from your completed matches in IndexedDB."
      />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label={t('profile.matches')} value={String(stats.totalPlayed)} />
        <StatTile
          label="Wins · Losses · Draws"
          value={`${stats.totalWins} · ${stats.totalLosses} · ${stats.totalDraws}`}
        />
        <StatTile label={t('profile.winRate')} value={`${stats.overallWinRate}%`} />
        <StatTile
          label="Tabletop Time"
          value={formatHoursMinutes(stats.totalDurationMs)}
        />
      </section>

      <SurfaceCard className="overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--cp-border)]">
          <h3 className="font-display text-lg font-bold">Ten-Game Performance Ledger</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--cp-border)] text-xs text-[var(--cp-text-muted)]">
              <tr>
                <th className="py-3 px-5 font-medium">Game</th>
                <th className="py-3 px-4 font-medium text-right">Played</th>
                <th className="py-3 px-4 font-medium text-right">Wins</th>
                <th className="py-3 px-4 font-medium text-right">Losses</th>
                <th className="py-3 px-4 font-medium text-right">Draws</th>
                <th className="py-3 px-4 font-medium text-right">Win %</th>
                <th className="py-3 px-5 font-medium text-right">Best Streak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--cp-border)]">
              {GAME_CATALOG.map((entry) => {
                const s = stats.byGame[entry.id];
                return (
                  <tr key={entry.id} className="hover:bg-[var(--cp-surface)]/45">
                    <td className="py-3 px-5 font-medium whitespace-nowrap">
                      {String(entry.number).padStart(2, '0')}. {entry.title}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular">{s.played}</td>
                    <td className="py-3 px-4 text-right font-mono-tabular">{s.wins}</td>
                    <td className="py-3 px-4 text-right font-mono-tabular">{s.losses}</td>
                    <td className="py-3 px-4 text-right font-mono-tabular">{s.draws}</td>
                    <td className="py-3 px-4 text-right font-mono-tabular">{s.winRate}%</td>
                    <td className="py-3 px-5 text-right font-mono-tabular">{s.bestStreak}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SurfaceCard>

      <SurfaceCard className="p-5 sm:p-6">
        <h3 className="font-display text-lg font-bold">Recent Match Log</h3>
        {matches.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--cp-text-muted)]">
            {t('profile.historyEmpty')}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--cp-border)]">
            {matches.slice(0, 25).map((m) => {
              const entry = getCatalogEntry(m.gameId);
              return (
                <li
                  key={m.matchId}
                  className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm"
                >
                  <div>
                    <span className="font-semibold">{entry.title}</span>
                    <span className="mx-2 text-[var(--cp-text-muted)]">·</span>
                    <span className="text-[var(--cp-text-muted)]">
                      vs {m.opponentLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-mono-tabular text-xs">
                    <span className="uppercase font-semibold text-[var(--cp-gold)]">
                      {m.outcome}
                    </span>
                    <span className="text-[var(--cp-text-muted)]">
                      {m.movesCount} moves
                    </span>
                    <span className="text-[var(--cp-text-muted)]">
                      +{m.xpAwarded} XP
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SurfaceCard>
    </div>
  );
}
