import { computeAggregateStats } from './progression';
import type {
  AchievementDefinition,
  MatchRecord,
  UnlockedAchievement,
} from './types';

export const ACHIEVEMENT_DEFINITIONS: readonly AchievementDefinition[] = [
  {
    id: 'first_match',
    titleKey: 'ach.first_match.title',
    descriptionKey: 'ach.first_match.desc',
    xpReward: 50,
    category: 'milestone',
  },
  {
    id: 'first_victory',
    titleKey: 'ach.first_victory.title',
    descriptionKey: 'ach.first_victory.desc',
    xpReward: 100,
    category: 'milestone',
  },
  {
    id: 'five_wins',
    titleKey: 'ach.five_wins.title',
    descriptionKey: 'ach.five_wins.desc',
    xpReward: 200,
    category: 'milestone',
  },
  {
    id: 'three_game_explorer',
    titleKey: 'ach.three_game_explorer.title',
    descriptionKey: 'ach.three_game_explorer.desc',
    xpReward: 150,
    category: 'explorer',
  },
  {
    id: 'all_ten_explorer',
    titleKey: 'ach.all_ten_explorer.title',
    descriptionKey: 'ach.all_ten_explorer.desc',
    xpReward: 500,
    category: 'explorer',
  },
  {
    id: 'hard_ai_victor',
    titleKey: 'ach.hard_ai_victor.title',
    descriptionKey: 'ach.hard_ai_victor.desc',
    xpReward: 250,
    category: 'mastery',
  },
  {
    id: 'hot_streak_3',
    titleKey: 'ach.hot_streak_3.title',
    descriptionKey: 'ach.hot_streak_3.desc',
    xpReward: 180,
    category: 'streak',
  },
  {
    id: 'swift_tactician',
    titleKey: 'ach.swift_tactician.title',
    descriptionKey: 'ach.swift_tactician.desc',
    xpReward: 150,
    category: 'mastery',
  },
];

export function evaluateNewlyUnlockedAchievements(
  matches: readonly MatchRecord[],
  alreadyUnlocked: readonly UnlockedAchievement[],
  now: number
): UnlockedAchievement[] {
  const unlockedIds = new Set(alreadyUnlocked.map((a) => a.id));
  const stats = computeAggregateStats(matches);
  const distinctGamesPlayed = new Set(matches.map((m) => m.gameId)).size;
  const hasHardWin = matches.some(
    (m) => m.outcome === 'win' && m.mode === 'ai' && m.difficulty === 'hard'
  );
  const hasSwiftWin = matches.some(
    (m) => m.outcome === 'win' && m.movesCount > 0 && m.movesCount <= 20
  );
  const maxStreak = Object.values(stats.byGame).reduce(
    (acc, g) => Math.max(acc, g.bestStreak),
    0
  );

  const checks: Record<string, boolean> = {
    first_match: stats.totalPlayed >= 1,
    first_victory: stats.totalWins >= 1,
    five_wins: stats.totalWins >= 5,
    three_game_explorer: distinctGamesPlayed >= 3,
    all_ten_explorer: distinctGamesPlayed >= 10,
    hard_ai_victor: hasHardWin,
    hot_streak_3: maxStreak >= 3,
    swift_tactician: hasSwiftWin,
  };

  const newlyUnlocked: UnlockedAchievement[] = [];
  for (const def of ACHIEVEMENT_DEFINITIONS) {
    if (!unlockedIds.has(def.id) && checks[def.id]) {
      newlyUnlocked.push({
        schemaVersion: 1,
        id: def.id,
        unlockedAt: now,
      });
    }
  }
  return newlyUnlocked;
}
