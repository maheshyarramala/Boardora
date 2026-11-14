import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeAggregateStats } from '../core/progression';
import type { ActiveSession, MatchRecord } from '../core/types';
import { checkersEngine } from '../engines/checkers/checkersEngine';
import { driveYourCarEngine } from '../engines/driveYourCar/driveYourCarEngine';
import { ludoEngine } from '../engines/ludo/ludoEngine';
import { moneyGameEngine } from '../engines/moneyGame/moneyGameEngine';
import { travelGameEngine } from '../engines/travelGame/travelGameEngine';
import {
  fromFirestoreSafeValue,
  mergeCloudAndLocalData,
  toFirestoreSafeValue,
} from '../firebase/cloudSync';
import {
  BoardoraRepository,
  createMemoryStorageBackend,
} from '../storage/db';
import {
  CURRENT_SCHEMA_VERSION,
  createDefaultGuestProfile,
  migrateProfile,
} from '../storage/migrations';

describe('Stage 7: Strategic AI Difficulty Differentiation', () => {
  it('Ludo Easy vs Hard selects different moves when safety/capture differs', () => {
    const base = ludoEngine.createInitialState({
      gameId: 'ludo',
      mode: 'ai',
      difficulty: 'hard',
      playerCount: 2,
      seed: 101,
    });
    // Set Bot (player 1, color blue -> offset 26) to have pawn 0 near capture & pawn 1 safe
    const crafted = {
      ...base,
      currentPlayerIndex: 1,
      phase: 'MOVE' as const,
      lastRoll: 3,
      players: [
        { ...base.players[0], pawns: [32, -1, -1, -1] as [number, number, number, number] }, // Red ring 32
        { ...base.players[1], pawns: [0, 3, -1, -1] as [number, number, number, number] }, // Blue prog 0 -> ring 26, prog 3 -> ring 29 + 3 = 32 (captures!)
      ],
    };
    const easyMove = ludoEngine.computeBotMove(crafted, 'easy');
    const hardMove = ludoEngine.computeBotMove(crafted, 'hard');
    expect(easyMove).toEqual({ type: 'MOVE_PAWN', pawnIndex: 0 });
    expect(hardMove).toEqual({ type: 'MOVE_PAWN', pawnIndex: 1 });
  });

  it('Drive Your Car Easy drives straight while Hard dodges roadblocks ahead', () => {
    const base = driveYourCarEngine.createInitialState({
      gameId: 'drive_your_car',
      mode: 'ai',
      difficulty: 'hard',
      playerCount: 2,
      seed: 42,
    });
    const roadblockLoc = base.trackConfig.features.find(
      (f) => f.kind === 'roadblock' && f.segment > 2
    )!;
    const crafted = {
      ...base,
      currentPlayerIndex: 1,
      players: base.players.map((p, i) =>
        i === 1
          ? { ...p, segment: roadblockLoc.segment - 1, lane: roadblockLoc.lane, fuel: 8 }
          : p
      ),
    };
    const easyMove = driveYourCarEngine.computeBotMove(crafted, 'easy');
    const hardMove = driveYourCarEngine.computeBotMove(crafted, 'hard');
    expect(easyMove).toEqual({ type: 'ROLL_DRIVE' });
    expect(hardMove?.type).toBe('SWITCH_LANE');
  });

  it('Money Game Hard bids higher for color-group monopoly synergy than Easy', () => {
    const base = moneyGameEngine.createInitialState({
      gameId: 'money_game',
      mode: 'ai',
      difficulty: 'hard',
      playerCount: 2,
      seed: 77,
    });
    // Find two properties in the same color group
    const groupedTiles = base.boardConfig.tiles.filter(
      (t) => t.kind === 'property' && t.group
    );
    const group = groupedTiles[0].group!;
    const pair = groupedTiles.filter((t) => t.group === group);
    const ownedTile = pair[0];
    const auctionTile = pair[1] ?? pair[0];

    const crafted = {
      ...base,
      phase: 'auction' as const,
      deeds: {
        [ownedTile.index]: { ownerIndex: 1, upgradeLevel: 0 },
      },
      auction: {
        tileIndex: auctionTile.index,
        highestBid: Math.floor((auctionTile.price ?? 150) * 0.7),
        highestBidderIndex: 0,
        currentBidderIndex: 1,
        passedIndices: [],
      },
    };

    const easyBid = moneyGameEngine.computeBotMove(crafted, 'easy');
    const hardBid = moneyGameEngine.computeBotMove(crafted, 'hard');
    expect(easyBid).toEqual({ type: 'AUCTION_PASS' });
    expect(hardBid?.type).toBe('AUCTION_BID');
  });

  it('Travel Game Hard targets shortcuts leading to missing passport stamps', () => {
    const base = travelGameEngine.createInitialState({
      gameId: 'travel_game',
      mode: 'ai',
      difficulty: 'hard',
      playerCount: 2,
      seed: 88,
    });
    const hub = base.boardConfig.tiles.find(
      (t) => t.kind === 'hub' && typeof t.shortcutTo === 'number'
    )!;
    const crafted = {
      ...base,
      currentPlayerIndex: 1,
      phase: 'choose_route' as const,
      pendingSteps: 4,
      moveCount: 1, // Easy uses moveCount % 2 === 0 -> false
      players: base.players.map((p, i) =>
        i === 1 ? { ...p, position: hub.index } : p
      ),
    };
    const easyChoice = travelGameEngine.computeBotMove(crafted, 'easy');
    const hardChoice = travelGameEngine.computeBotMove(crafted, 'hard');
    expect(easyChoice).toEqual({ type: 'CHOOSE_ROUTE', useShortcut: false });
    expect(hardChoice).toEqual({ type: 'CHOOSE_ROUTE', useShortcut: true });
  });
});

describe('Stage 9: Data Consistency, Conflict Resolution, Migrations & Rules Integrity', () => {
  it('never counts unfinished or abandoned sessions as wins or losses', async () => {
    const repo = new BoardoraRepository(createMemoryStorageBackend());
    const abandoned: ActiveSession = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      sessionId: 'sess-abandoned-1',
      gameId: 'chess',
      mode: 'ai',
      difficulty: 'hard',
      playerCount: 2,
      seed: 99,
      serializedState: '{}',
      actionCount: 14,
      elapsedMs: 45000,
      createdAt: 1000,
      updatedAt: 2000,
    };

    await repo.upsertSession(abandoned);
    await repo.deleteSession(abandoned.sessionId);

    const matches = await repo.listMatches();
    const stats = computeAggregateStats(matches);
    const profile = await repo.getOrCreateProfile();
    expect(matches).toHaveLength(0);
    expect(stats.totalPlayed).toBe(0);
    expect(stats.totalWins).toBe(0);
    expect(stats.totalLosses).toBe(0);
    expect(profile.xp).toBe(0);
    expect(await repo.listAchievements()).toHaveLength(0);
  });

  it('migrates v1 profiles cleanly to v2 with separate SFX & Music volume controls', () => {
    const v1 = {
      schemaVersion: 1,
      id: 'guest-local',
      displayName: 'Tabletop Pro',
      xp: 310,
      preferences: {
        soundEnabled: true,
        soundVolume: 0.6,
        hapticsEnabled: false,
        theme: 'emerald-felt',
        language: 'fr',
      },
    };
    const migrated = migrateProfile(v1);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.preferences.soundVolume).toBe(0.6);
    expect(migrated.preferences.sfxVolume).toBe(0.85);
    expect(migrated.preferences.musicEnabled).toBe(false);
    expect(migrated.preferences.musicVolume).toBe(0.35);
    expect(migrated.preferences.theme).toBe('emerald-felt');
  });

  it('round-trips 2D matrices via native Firestore-safe maps without nested arrays', () => {
    const checkersState = checkersEngine.createInitialState({
      gameId: 'checkers',
      mode: 'ai',
      difficulty: 'medium',
      playerCount: 2,
      seed: 12,
    });
    const safeMap = toFirestoreSafeValue(checkersState) as Record<string, unknown>;

    // Assert zero nested arrays remain anywhere in safeMap
    const containsNestedArray = (val: unknown): boolean => {
      if (Array.isArray(val)) {
        return val.some((el) => Array.isArray(el) || containsNestedArray(el));
      }
      if (val && typeof val === 'object') {
        return Object.values(val as Record<string, unknown>).some(containsNestedArray);
      }
      return false;
    };
    expect(containsNestedArray(safeMap)).toBe(false);

    const restored = fromFirestoreSafeValue(safeMap);
    expect(restored).toEqual(checkersState);
  });

  it('resolves offline & cloud sync conflicts deterministically without duplicate matches', () => {
    const localProfile = createDefaultGuestProfile(100);
    localProfile.xp = 420;
    localProfile.updatedAt = 5000;

    const cloudProfile = createDefaultGuestProfile(100);
    cloudProfile.xp = 300;
    cloudProfile.displayName = 'Cloud Name';
    cloudProfile.updatedAt = 2000;

    const sharedMatch: MatchRecord = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      matchId: 'match-shared',
      gameId: 'ludo',
      mode: 'ai',
      difficulty: 'medium',
      outcome: 'win',
      opponentLabel: 'AI (medium)',
      movesCount: 22,
      durationMs: 60000,
      xpAwarded: 140,
      completedAt: 1500,
    };
    const cloudOnlyMatch: MatchRecord = {
      ...sharedMatch,
      matchId: 'match-cloud-only',
      gameId: 'chess',
    };

    const merged = mergeCloudAndLocalData(
      {
        profile: localProfile,
        sessions: [],
        matches: [sharedMatch],
        achievements: [{ schemaVersion: 2, id: 'first_victory', unlockedAt: 1600 }],
        dailyChallenges: [],
      },
      {
        profile: cloudProfile,
        sessions: [],
        matches: [sharedMatch, cloudOnlyMatch],
        achievements: [{ schemaVersion: 2, id: 'first_victory', unlockedAt: 1400 }],
        dailyChallenges: [],
      },
      'firebase-uid-123'
    );

    expect(merged.profile.xp).toBe(420);
    expect(merged.profile.displayName).toBe('Guest Player'); // newer local updatedAt
    expect(merged.profile.cloudUid).toBe('firebase-uid-123');
    expect(merged.matches).toHaveLength(2); // deduplicated match-shared
    expect(merged.achievements[0].unlockedAt).toBe(1400); // earliest unlock preserved
  });

  it('ensures firestore.rules covers every blueprint collection with Zero-Trust guards', () => {
    const blueprintRaw = readFileSync(
      path.resolve(process.cwd(), 'firebase-blueprint.json'),
      'utf8'
    );
    const rulesRaw = readFileSync(
      path.resolve(process.cwd(), 'firestore.rules'),
      'utf8'
    );
    const blueprint = JSON.parse(blueprintRaw) as {
      firestore: Record<string, unknown>;
    };

    expect(rulesRaw).toContain("rules_version = '2';");
    expect(rulesRaw).toContain('match /{document=**}');
    expect(rulesRaw).toContain('allow read, write: if false;');
    expect(rulesRaw).toContain('request.auth.token.email_verified == true');
    expect(rulesRaw).toContain('incoming().createdAt == request.time');
    expect(rulesRaw).toContain('incoming().updatedAt == request.time');
    expect(rulesRaw).toContain("existing().status != 'finished'");

    // Every collection path in blueprint has a corresponding match block in firestore.rules
    for (const collectionPath of Object.keys(blueprint.firestore)) {
      const segments = collectionPath.split('/').filter(Boolean);
      const leafCollection = segments[segments.length - 2];
      expect(rulesRaw).toContain(`match /${leafCollection}/`);
    }
  });
});
