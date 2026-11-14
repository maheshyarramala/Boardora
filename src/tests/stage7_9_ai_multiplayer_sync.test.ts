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
import { AuthoritativeRoomManager } from '../server/roomManager';
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

describe('Stage 8: Authoritative Online Multiplayer RoomManager', () => {
  it('enforces room codes, ready checks, turn ownership, move validation, reconnects, and signed completion', () => {
    const manager = new AuthoritativeRoomManager('test-hmac-secret');

    expect(() =>
      manager.createRoom({
        hostUid: 'uid-alice',
        hostName: 'Alice',
        gameId: 'peg_solitaire',
        difficulty: 'medium',
        maxPlayers: 1,
      })
    ).toThrow();

    const room = manager.createRoom({
      hostUid: 'uid-alice',
      hostName: 'Alice',
      gameId: 'chess',
      difficulty: 'medium',
      maxPlayers: 2,
    });
    expect(room.roomCode).toHaveLength(6);

    // Host cannot start alone
    expect(() =>
      manager.startMatch({ roomCode: room.roomCode, uid: 'uid-alice' })
    ).toThrow();

    // Bob joins
    manager.joinRoom({
      roomCode: room.roomCode,
      uid: 'uid-bob',
      displayName: 'Bob',
    });

    // Cannot start before Bob marks ready
    expect(() =>
      manager.startMatch({ roomCode: room.roomCode, uid: 'uid-alice' })
    ).toThrow();

    // Non-host cannot start
    manager.setReady({ roomCode: room.roomCode, uid: 'uid-bob', ready: true });
    expect(() =>
      manager.startMatch({ roomCode: room.roomCode, uid: 'uid-bob' })
    ).toThrow();

    // Third outsider cannot join a full 2-player Chess room
    expect(() =>
      manager.joinRoom({
        roomCode: room.roomCode,
        uid: 'uid-charlie',
        displayName: 'Charlie',
      })
    ).toThrow();

    // Host starts match cleanly
    const started = manager.startMatch({
      roomCode: room.roomCode,
      uid: 'uid-alice',
    });
    expect(started.status).toBe('active');
    expect(started.version).toBe(1);

    // Bob cannot move on White's turn (out of turn)
    const outOfTurn = manager.submitAction({
      roomCode: room.roomCode,
      actorUid: 'uid-bob',
      expectedVersion: 1,
      action: { type: 'MOVE', from: 'e7', to: 'e5' },
    });
    expect(outOfTurn.accepted).toBe(false);

    // Outsider Charlie is rejected
    const forgedActor = manager.submitAction({
      roomCode: room.roomCode,
      actorUid: 'uid-charlie',
      expectedVersion: 1,
      action: { type: 'MOVE', from: 'e2', to: 'e4' },
    });
    expect(forgedActor.accepted).toBe(false);

    // Illegal chess move is rejected server-side
    const illegalMove = manager.submitAction({
      roomCode: room.roomCode,
      actorUid: 'uid-alice',
      expectedVersion: 1,
      action: { type: 'MOVE', from: 'e2', to: 'e5' },
    });
    expect(illegalMove.accepted).toBe(false);

    // Play Scholar's Mate authoritatively: 1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#
    const sequence = [
      { uid: 'uid-alice', action: { type: 'MOVE', from: 'e2', to: 'e4' } },
      { uid: 'uid-bob', action: { type: 'MOVE', from: 'e7', to: 'e5' } },
      { uid: 'uid-alice', action: { type: 'MOVE', from: 'd1', to: 'h5' } },
      { uid: 'uid-bob', action: { type: 'MOVE', from: 'b8', to: 'c6' } },
      { uid: 'uid:alice-bad-version', action: null },
      { uid: 'uid-alice', action: { type: 'MOVE', from: 'f1', to: 'c4' } },
      { uid: 'uid-bob', action: { type: 'MOVE', from: 'g8', to: 'f6' } },
      { uid: 'uid-alice', action: { type: 'MOVE', from: 'h5', to: 'f7' } },
    ];

    let version = 1;
    for (const step of sequence) {
      if (step.action === null) {
        // Stale expectedVersion check fails atomically
        const stale = manager.submitAction({
          roomCode: room.roomCode,
          actorUid: 'uid-alice',
          expectedVersion: version - 1,
          action: { type: 'MOVE', from: 'f1', to: 'c4' },
        });
        expect(stale.accepted).toBe(false);
        continue;
      }
      // Simulate Bob disconnecting & reconnecting cleanly mid-match
      if (step.uid === 'uid-bob' && version === 4) {
        manager.setPresence(room.roomCode, 'uid-bob', false);
        expect(manager.getRoom(room.roomCode)?.seats[1].connected).toBe(false);
        manager.joinRoom({
          roomCode: room.roomCode,
          uid: 'uid-bob',
          displayName: 'Bob',
        });
        expect(manager.getRoom(room.roomCode)?.seats[1].connected).toBe(true);
      }

      const res = manager.submitAction({
        roomCode: room.roomCode,
        actorUid: step.uid,
        expectedVersion: version,
        action: step.action,
      });
      expect(res.accepted).toBe(true);
      version += 1;
    }

    const finished = manager.getRoom(room.roomCode)!;
    expect(finished.status).toBe('finished');
    expect(finished.winnerUid).toBe('uid-alice');
    expect(finished.authoritativeReceipt).toBeTruthy();

    expect(
      manager.verifyOutcomeReceipt({
        roomCode: finished.roomCode,
        gameId: finished.gameId,
        version: finished.version,
        winnerUid: finished.winnerUid,
        reason: finished.outcomeReason!,
        receipt: finished.authoritativeReceipt!,
      })
    ).toBe(true);

    // Tampering with winnerUid fails HMAC receipt verification
    expect(
      manager.verifyOutcomeReceipt({
        roomCode: finished.roomCode,
        gameId: finished.gameId,
        version: finished.version,
        winnerUid: 'uid-bob',
        reason: finished.outcomeReason!,
        receipt: finished.authoritativeReceipt!,
      })
    ).toBe(false);

    // Terminal lock: no further actions allowed after finish
    const postFinish = manager.submitAction({
      roomCode: room.roomCode,
      actorUid: 'uid-bob',
      expectedVersion: finished.version,
      action: { type: 'MOVE', from: 'a7', to: 'a6' },
    });
    expect(postFinish.accepted).toBe(false);

    // Viewer perspective outcomes differ cleanly per seat
    const aliceView = manager.toClientSnapshot(finished, 'uid-alice');
    const bobView = manager.toClientSnapshot(finished, 'uid-bob');
    expect(aliceView.outcomeForViewer).toBe('win');
    expect(bobView.outcomeForViewer).toBe('loss');
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
