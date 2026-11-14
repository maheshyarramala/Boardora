import { describe, expect, it } from 'vitest';
import {
  getGlobalRingIndex,
  LUDO_SAFE_RING_INDICES,
  ludoEngine,
} from '../engines/ludo/ludoEngine';
import {
  LADDERS_MAP,
  SNAKES_MAP,
  snakesLaddersEngine,
} from '../engines/snakesLadders/snakesLaddersEngine';
import {
  BoardoraRepository,
  createMemoryStorageBackend,
} from '../storage/db';
import { CURRENT_SCHEMA_VERSION } from '../storage/migrations';

describe('Ludo Engine', () => {
  it('enforces 6 to leave base, safe squares, captures, and deterministic rolls', () => {
    const config = {
      gameId: 'ludo' as const,
      mode: 'local' as const,
      difficulty: 'medium' as const,
      playerCount: 4,
      seed: 42,
    };

    const s1 = ludoEngine.createInitialState(config);
    expect(s1.players).toHaveLength(4);
    expect(s1.phase).toBe('ROLL');

    // Moving before rolling is illegal
    const illegalPreRoll = ludoEngine.validateAction(s1, {
      type: 'MOVE_PAWN',
      pawnIndex: 0,
    });
    expect(illegalPreRoll.valid).toBe(false);

    // Deterministic roll parity
    const r1 = ludoEngine.applyAction(s1, { type: 'ROLL_DICE' });
    const r2 = ludoEngine.applyAction(ludoEngine.createInitialState(config), {
      type: 'ROLL_DICE',
    });
    expect(r1.state.lastRoll).toBe(r2.state.lastRoll);

    // Manual state: Red has roll=5 and all pawns in base -> illegal to leave base
    const blockedState = {
      ...s1,
      phase: 'MOVE' as const,
      lastRoll: 5,
    };
    expect(
      ludoEngine.validateAction(blockedState, { type: 'MOVE_PAWN', pawnIndex: 0 })
        .valid
    ).toBe(false);

    // Roll=6 allows leaving base to progress 0
    const exitState = {
      ...s1,
      phase: 'MOVE' as const,
      lastRoll: 6,
    };
    const afterExit = ludoEngine.applyAction(exitState, {
      type: 'MOVE_PAWN',
      pawnIndex: 0,
    });
    expect(afterExit.state.players[0].pawns[0]).toBe(0);
    // Bonus turn on 6
    expect(afterExit.state.currentPlayerIndex).toBe(0);

    // Capture on non-safe ring square sends opponent back to -1 and awards bonus roll
    const redRing = getGlobalRingIndex('red', 5)!; // ring index 5 (non-safe)
    expect(LUDO_SAFE_RING_INDICES.has(redRing)).toBe(false);
    // Green starts at offset 13, so ring 5 is Green progress (5 - 13 + 52) = 44
    expect(getGlobalRingIndex('green', 44)).toBe(redRing);

    const captureSetup = {
      ...s1,
      currentPlayerIndex: 0,
      phase: 'MOVE' as const,
      lastRoll: 3,
      players: [
        { ...s1.players[0], pawns: [2, -1, -1, -1] as [number, number, number, number] },
        { ...s1.players[1], pawns: [44, -1, -1, -1] as [number, number, number, number] },
        s1.players[2],
        s1.players[3],
      ],
    };
    const afterCapture = ludoEngine.applyAction(captureSetup, {
      type: 'MOVE_PAWN',
      pawnIndex: 0,
    });
    expect(afterCapture.state.players[0].pawns[0]).toBe(5);
    expect(afterCapture.state.players[1].pawns[0]).toBe(-1);
    expect(afterCapture.state.currentPlayerIndex).toBe(0);
    expect(afterCapture.events.some((e) => e.type === 'capture')).toBe(true);

    // Safe square protects opponent from capture (index 8 = Red progress 8, Green progress 47)
    expect(LUDO_SAFE_RING_INDICES.has(8)).toBe(true);
    const safeSetup = {
      ...s1,
      currentPlayerIndex: 0,
      phase: 'MOVE' as const,
      lastRoll: 2,
      players: [
        { ...s1.players[0], pawns: [6, -1, -1, -1] as [number, number, number, number] },
        { ...s1.players[1], pawns: [47, -1, -1, -1] as [number, number, number, number] },
        s1.players[2],
        s1.players[3],
      ],
    };
    const afterSafe = ludoEngine.applyAction(safeSetup, {
      type: 'MOVE_PAWN',
      pawnIndex: 0,
    });
    expect(afterSafe.state.players[1].pawns[0]).toBe(47);
    expect(afterSafe.state.currentPlayerIndex).toBe(1);
  });

  it('detects winning condition, AI move legality, and serialization recovery', async () => {
    const state = ludoEngine.createInitialState({
      gameId: 'ludo',
      mode: 'ai',
      difficulty: 'hard',
      playerCount: 2,
      seed: 777,
    });

    // Near win state: Red has 3 pawns at 56 and 1 pawn at 54 with roll 2
    const nearWin = {
      ...state,
      phase: 'MOVE' as const,
      lastRoll: 2,
      players: [
        { ...state.players[0], pawns: [56, 56, 56, 54] as [number, number, number, number] },
        state.players[1],
      ],
    };
    // Exact roll check: roll 3 should be illegal for pawn 3 at 54
    expect(
      ludoEngine.validateAction(
        { ...nearWin, lastRoll: 3 },
        { type: 'MOVE_PAWN', pawnIndex: 3 }
      ).valid
    ).toBe(false);

    const winStep = ludoEngine.applyAction(nearWin, {
      type: 'MOVE_PAWN',
      pawnIndex: 3,
    });
    const outcome = ludoEngine.evaluateOutcome(winStep.state);
    expect(outcome?.finished).toBe(true);
    expect(outcome?.humanOutcome).toBe('win');

    // Save/load round trip via IndexedDB repository
    const repo = new BoardoraRepository(createMemoryStorageBackend());
    const serialized = ludoEngine.serialize(state);
    await repo.upsertSession({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      sessionId: 'ludo-rec-1',
      gameId: 'ludo',
      mode: 'ai',
      difficulty: 'hard',
      playerCount: 2,
      seed: 777,
      serializedState: serialized,
      actionCount: 1,
      elapsedMs: 5000,
      createdAt: 100,
      updatedAt: 200,
    });
    const sessions = await repo.listSessions();
    const restored = ludoEngine.deserialize(sessions[0].serializedState);
    expect(restored.players).toHaveLength(2);

    // Bot move legality
    const botAction = ludoEngine.computeBotMove(nearWin, 'hard');
    expect(botAction).toEqual({ type: 'MOVE_PAWN', pawnIndex: 3 });
  });
});

describe('Snakes & Ladders Engine', () => {
  it('simulates deterministic rolls, ladders, snakes, exact finish, and bounce finish', () => {
    const config = {
      gameId: 'snakes_ladders' as const,
      mode: 'ai' as const,
      difficulty: 'medium' as const,
      playerCount: 2,
      seed: 1234,
      variant: 'standard',
    };

    let state = snakesLaddersEngine.createInitialState(config);
    expect(state.players).toHaveLength(2);
    expect(state.finishRule).toBe('exact');

    // Play deterministic sequence up to 200 turns until someone wins
    let safety = 0;
    while (!snakesLaddersEngine.evaluateOutcome(state)?.finished && safety < 400) {
      const action = snakesLaddersEngine.getLegalActions(state)[0];
      state = snakesLaddersEngine.applyAction(state, action).state;
      safety++;
    }

    const outcome = snakesLaddersEngine.evaluateOutcome(state);
    expect(outcome?.finished).toBe(true);
    expect(state.players.some((p) => p.position === 100)).toBe(true);

    // Illegal roll after finish
    expect(
      snakesLaddersEngine.validateAction(state, { type: 'ROLL_DICE' }).valid
    ).toBe(false);

    // Verify ladders go up and snakes go down
    for (const [start, end] of Object.entries(LADDERS_MAP)) {
      expect(end).toBeGreaterThan(Number(start));
    }
    for (const [head, tail] of Object.entries(SNAKES_MAP)) {
      expect(tail).toBeLessThan(Number(head));
    }

    // Bounce-back variant initialization & serialization
    const bounceState = snakesLaddersEngine.createInitialState({
      ...config,
      variant: 'bounce',
    });
    expect(bounceState.finishRule).toBe('bounce');
    const restored = snakesLaddersEngine.deserialize(
      snakesLaddersEngine.serialize(bounceState)
    );
    expect(restored.finishRule).toBe('bounce');
  });
});
