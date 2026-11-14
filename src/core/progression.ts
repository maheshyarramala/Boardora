import { GAME_CATALOG } from './catalog';
import type {
  AIDifficulty,
  AggregateStats,
  GameId,
  GameMode,
  GameStats,
  MatchOutcome,
  MatchRecord,
} from './types';

export function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  // Smooth quadratic progression: L2 = 150, L3 = 350, L4 = 600, L5 = 900...
  return 50 * (level - 1) * (level + 2);
}

export function calculateLevelFromXp(xp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressRatio: number;
} {
  const safeXp = Math.max(0, Math.floor(xp));
  let level = 1;
  while (xpRequiredForLevel(level + 1) <= safeXp) {
    level++;
  }
  const floorXp = xpRequiredForLevel(level);
  const ceilXp = xpRequiredForLevel(level + 1);
  const span = Math.max(1, ceilXp - floorXp);
  return {
    level,
    currentLevelXp: safeXp - floorXp,
    nextLevelXp: span,
    progressRatio: Math.min(1, Math.max(0, (safeXp - floorXp) / span)),
  };
}

export function calculateMatchXp(params: {
  outcome: MatchOutcome;
  mode: GameMode;
  difficulty?: AIDifficulty;
  movesCount: number;
}): number {
  const base = params.outcome === 'win' ? 120 : params.outcome === 'draw' ? 65 : 30;
  const modeMultiplier =
    params.mode === 'online'
      ? 1.35
      : params.mode === 'ai'
      ? params.difficulty === 'hard'
        ? 1.3
        : params.difficulty === 'medium'
        ? 1.15
        : 1.0
      : params.mode === 'local'
      ? 1.0
      : 0.6; // practice mode
  const effortBonus = Math.min(40, Math.floor(params.movesCount / 3));
  return Math.round(base * modeMultiplier + effortBonus);
}

function createEmptyGameStats(gameId: GameId): GameStats {
  return {
    gameId,
    played: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winRate: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalDurationMs: 0,
    bestScore: null,
  };
}

export function computeAggregateStats(matches: readonly MatchRecord[]): AggregateStats {
  const sorted = [...matches].sort((a, b) => a.completedAt - b.completedAt);
  const byGame = {} as Record<GameId, GameStats>;
  for (const entry of GAME_CATALOG) {
    byGame[entry.id] = createEmptyGameStats(entry.id);
  }

  let totalPlayed = 0;
  let totalWins = 0;
  let totalLosses = 0;
  let totalDraws = 0;
  let totalDurationMs = 0;

  for (const match of sorted) {
    const stat = byGame[match.gameId] ?? createEmptyGameStats(match.gameId);
    byGame[match.gameId] = stat;

    stat.played += 1;
    stat.totalDurationMs += Math.max(0, match.durationMs);
    totalPlayed += 1;
    totalDurationMs += Math.max(0, match.durationMs);

    if (match.outcome === 'win') {
      stat.wins += 1;
      stat.currentStreak += 1;
      if (stat.currentStreak > stat.bestStreak) {
        stat.bestStreak = stat.currentStreak;
      }
      totalWins += 1;
    } else if (match.outcome === 'loss') {
      stat.losses += 1;
      stat.currentStreak = 0;
      totalLosses += 1;
    } else {
      stat.draws += 1;
      totalDraws += 1;
    }

    if (typeof match.score === 'number') {
      stat.bestScore =
        stat.bestScore === null ? match.score : Math.max(stat.bestScore, match.score);
    }

    stat.winRate = stat.played > 0 ? Math.round((stat.wins / stat.played) * 100) : 0;
  }

  return {
    totalPlayed,
    totalWins,
    totalLosses,
    totalDraws,
    overallWinRate: totalPlayed > 0 ? Math.round((totalWins / totalPlayed) * 100) : 0,
    totalDurationMs,
    byGame,
  };
}
