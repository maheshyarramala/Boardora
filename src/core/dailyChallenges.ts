import { GAME_CATALOG } from './catalog';
import { createPrngState, hashStringToSeed, nextInt } from './prng';
import type { DailyChallenge, GameMode, MatchRecord } from './types';

export function getUtcDateKey(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function generateDailyChallenge(dateKey: string): DailyChallenge {
  const seed = hashStringToSeed(`boardora-daily-${dateKey}`);
  const prng0 = createPrngState(seed);
  const gamePick = nextInt(prng0, 0, GAME_CATALOG.length - 1);
  const entry = GAME_CATALOG[gamePick.value];

  const availableModes = entry.supportedModes.filter((m) => m !== 'online');
  const modePick = nextInt(gamePick.nextState, 0, availableModes.length - 1);
  const targetMode: GameMode = availableModes[modePick.value] ?? 'practice';

  const objectiveRoll = nextInt(modePick.nextState, 0, 2);
  let objectiveType: DailyChallenge['objectiveType'] = 'win_match';
  let targetValue = 1;
  let xpReward = 200;

  if (entry.id === 'peg_solitaire') {
    objectiveType = 'win_match';
    xpReward = 240;
  } else if (objectiveRoll.value === 1) {
    objectiveType = 'complete_match';
    xpReward = 150;
  } else if (objectiveRoll.value === 2 && entry.category === 'strategy') {
    objectiveType = 'win_under_moves';
    targetValue = 35;
    xpReward = 260;
  }

  return {
    schemaVersion: 1,
    dateKey,
    gameId: entry.id,
    targetMode,
    objectiveType,
    targetValue,
    xpReward,
    completed: false,
    completedAt: null,
  };
}

export function doesMatchCompleteDailyChallenge(
  challenge: DailyChallenge,
  match: MatchRecord
): boolean {
  if (challenge.completed) return false;
  if (match.gameId !== challenge.gameId) return false;

  switch (challenge.objectiveType) {
    case 'complete_match':
      return true;
    case 'win_match':
      return match.outcome === 'win';
    case 'win_under_moves':
      return match.outcome === 'win' && match.movesCount <= challenge.targetValue;
  }
}
