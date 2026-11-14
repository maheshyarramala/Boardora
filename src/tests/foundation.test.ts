import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENT_DEFINITIONS,
  evaluateNewlyUnlockedAchievements,
} from '../core/achievements';
import { GAME_CATALOG } from '../core/catalog';
import {
  doesMatchCompleteDailyChallenge,
  generateDailyChallenge,
} from '../core/dailyChallenges';
import {
  createPrngState,
  hashStringToSeed,
  rollDie,
  shuffleDeterministic,
} from '../core/prng';
import {
  calculateLevelFromXp,
  calculateMatchXp,
  computeAggregateStats,
  xpRequiredForLevel,
} from '../core/progression';
import type { ActiveSession, MatchRecord } from '../core/types';
import {
  BoardoraRepository,
  createMemoryStorageBackend,
} from '../storage/db';
import {
  CURRENT_SCHEMA_VERSION,
  migrateProfile,
  migrateSaveEnvelope,
} from '../storage/migrations';

describe('BOARDORA 10-in-1 Catalog', () => {
  it('registers all 10 unique board games', () => {
    expect(GAME_CATALOG).toHaveLength(10);
    const ids = new Set(GAME_CATALOG.map((g) => g.id));
    expect(ids.size).toBe(10);
    for (const entry of GAME_CATALOG) {
      expect(entry.rulesSummary.length).toBeGreaterThanOrEqual(3);
      expect(entry.minPlayers).toBeGreaterThanOrEqual(1);
      expect(entry.maxPlayers).toBeGreaterThanOrEqual(entry.minPlayers);
    }
  });
});

describe('Deterministic PRNG', () => {
  it('produces identical dice rolls and shuffles for identical seeds', () => {
    let a = createPrngState(hashStringToSeed('match-42'));
    let b = createPrngState(hashStringToSeed('match-42'));
    const rollsA: number[] = [];
    const rollsB: number[] = [];

    for (let i = 0; i < 12; i++) {
      const stepA = rollDie(a, 6);
      const stepB = rollDie(b, 6);
      rollsA.push(stepA.roll);
      rollsB.push(stepB.roll);
      a = stepA.nextState;
      b = stepB.nextState;
    }

    expect(rollsA).toEqual(rollsB);
    expect(rollsA.every((r) => r >= 1 && r <= 6)).toBe(true);

    const deck = [1, 2, 3, 4, 5, 6, 7, 8];
    const shufA = shuffleDeterministic(deck, createPrngState(999)).shuffled;
    const shufB = shuffleDeterministic(deck, createPrngState(999)).shuffled;
    expect(shufA).toEqual(shufB);
  });
});

describe('Progression, Stats & Achievements', () => {
  it('calculates XP levels monotonically', () => {
    expect(calculateLevelFromXp(0).level).toBe(1);
    const lv2Xp = xpRequiredForLevel(2);
    expect(calculateLevelFromXp(lv2Xp).level).toBe(2);
    expect(calculateLevelFromXp(lv2Xp - 1).level).toBe(1);
  });

  it('aggregates zero state and real match streaks accurately', () => {
    const empty = computeAggregateStats([]);
    expect(empty.totalPlayed).toBe(0);
    expect(empty.overallWinRate).toBe(0);

    const matches: MatchRecord[] = [
      {
        schemaVersion: 1,
        matchId: 'm1',
        gameId: 'chess',
        mode: 'ai',
        difficulty: 'hard',
        outcome: 'win',
        opponentLabel: 'AI (Hard)',
        movesCount: 18,
        durationMs: 120000,
        xpAwarded: calculateMatchXp({
          outcome: 'win',
          mode: 'ai',
          difficulty: 'hard',
          movesCount: 18,
        }),
        completedAt: 1000,
      },
      {
        schemaVersion: 1,
        matchId: 'm2',
        gameId: 'chess',
        mode: 'ai',
        difficulty: 'medium',
        outcome: 'win',
        opponentLabel: 'AI (Medium)',
        movesCount: 25,
        durationMs: 90000,
        xpAwarded: 140,
        completedAt: 2000,
      },
      {
        schemaVersion: 1,
        matchId: 'm3',
        gameId: 'chess',
        mode: 'ai',
        difficulty: 'hard',
        outcome: 'win',
        opponentLabel: 'AI (Hard)',
        movesCount: 30,
        durationMs: 80000,
        xpAwarded: 150,
        completedAt: 3000,
      },
    ];

    const stats = computeAggregateStats(matches);
    expect(stats.totalPlayed).toBe(3);
    expect(stats.totalWins).toBe(3);
    expect(stats.overallWinRate).toBe(100);
    expect(stats.byGame.chess.bestStreak).toBe(3);

    const unlocked = evaluateNewlyUnlockedAchievements(matches, [], 3000);
    const ids = unlocked.map((u) => u.id);
    expect(ids).toContain('first_match');
    expect(ids).toContain('first_victory');
    expect(ids).toContain('hard_ai_victor');
    expect(ids).toContain('hot_streak_3');
    expect(ids).toContain('swift_tactician');
    expect(ACHIEVEMENT_DEFINITIONS.length).toBeGreaterThanOrEqual(8);
  });
});

describe('Daily Challenges', () => {
  it('generates deterministic daily challenges per UTC date and evaluates completion', () => {
    const c1 = generateDailyChallenge('2026-11-14');
    const c2 = generateDailyChallenge('2026-11-14');
    expect(c1).toEqual(c2);

    const match: MatchRecord = {
      schemaVersion: 1,
      matchId: 'dc-m1',
      gameId: c1.gameId,
      mode: c1.targetMode,
      outcome: 'win',
      opponentLabel: 'AI',
      movesCount: 15,
      durationMs: 45000,
      xpAwarded: 120,
      completedAt: Date.now(),
    };
    expect(doesMatchCompleteDailyChallenge(c1, match)).toBe(true);
  });
});

describe('Versioned Persistence, Migrations & Session Recovery', () => {
  it('migrates partial legacy profile objects safely and rejects future schemas', () => {
    const migrated = migrateProfile({ displayName: '  Ada  ', xp: 200 });
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.displayName).toBe('Ada');
    expect(migrated.level).toBe(2);
    expect(migrated.privacyConsent.analyticsEnabled).toBe(false);

    expect(() =>
      migrateSaveEnvelope({
        format: 'boardora-save',
        schemaVersion: CURRENT_SCHEMA_VERSION + 10,
      })
    ).toThrow();
  });

  it('persists sessions, records matches, updates XP, and round-trips export/import', async () => {
    const repo = new BoardoraRepository(createMemoryStorageBackend());
    const initialProfile = await repo.getOrCreateProfile();
    expect(initialProfile.level).toBe(1);
    expect(initialProfile.xp).toBe(0);

    const session: ActiveSession = {
      schemaVersion: 1,
      sessionId: 'sess-ludo-1',
      gameId: 'ludo',
      mode: 'ai',
      difficulty: 'medium',
      playerCount: 4,
      seed: 12345,
      serializedState: '{"turn":2}',
      actionCount: 7,
      elapsedMs: 14000,
      createdAt: 100,
      updatedAt: 200,
    };

    await repo.upsertSession(session);
    const savedSessions = await repo.listSessions();
    expect(savedSessions).toHaveLength(1);
    expect(savedSessions[0].gameId).toBe('ludo');

    const result = await repo.recordCompletedMatch(
      {
        schemaVersion: 1,
        matchId: 'match-1',
        gameId: 'ludo',
        mode: 'ai',
        difficulty: 'medium',
        outcome: 'win',
        opponentLabel: 'AI (Medium)',
        movesCount: 16,
        durationMs: 60000,
        xpAwarded: 140,
        completedAt: Date.now(),
      },
      session.sessionId
    );

    expect(result.profile.xp).toBeGreaterThanOrEqual(140);
    expect(result.newlyUnlockedAchievements.length).toBeGreaterThanOrEqual(2);
    expect(await repo.listSessions()).toHaveLength(0);

    const exported = JSON.stringify(await repo.exportSaveData());
    await repo.clearAllLocalData();
    expect((await repo.listMatches()).length).toBe(0);

    await repo.importSaveData(exported);
    expect((await repo.listMatches()).length).toBe(1);
    expect((await repo.getOrCreateProfile()).xp).toBe(result.profile.xp);
  });
});
