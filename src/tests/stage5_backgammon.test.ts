import { describe, expect, it } from 'vitest';
import { findBestBackgammonAction } from '../engines/backgammon/backgammonAi';
import {
  backgammonEngine,
  getLegalBackgammonMoves,
  getPipCount,
  type BackgammonState,
} from '../engines/backgammon/backgammonEngine';

function createEmptyBackgammon(base: BackgammonState): BackgammonState {
  return {
    ...base,
    points: Array(24).fill(0) as number[],
    bar: { w: 0, b: 0 },
    off: { w: 0, b: 0 },
    phase: 'move',
    remainingDice: [],
    turnUndoStack: [],
  };
}

describe('Stage 5 — Backgammon Engine', () => {
  it('initializes standard 24-point setup (15 checkers each), handles deterministic rolls and doubles', () => {
    const state = backgammonEngine.createInitialState({
      gameId: 'backgammon',
      mode: 'ai',
      difficulty: 'medium',
      playerCount: 2,
      seed: 42,
    });

    const whiteTotal = state.points
      .filter((v) => v > 0)
      .reduce((acc, v) => acc + v, 0);
    const blackTotal = state.points
      .filter((v) => v < 0)
      .reduce((acc, v) => acc + -v, 0);

    expect(whiteTotal).toBe(15);
    expect(blackTotal).toBe(15);
    expect(getPipCount(state.points, state.bar, 'w')).toBe(167);
    expect(getPipCount(state.points, state.bar, 'b')).toBe(167);

    // Deterministic roll from seed
    const rolled = backgammonEngine.applyAction(state, { type: 'ROLL' }).state;
    expect(rolled.lastDice).not.toBeNull();
    if (rolled.lastDice![0] === rolled.lastDice![1]) {
      expect(rolled.remainingDice.length).toBe(4);
    } else {
      expect(rolled.remainingDice.length).toBe(2);
    }
  });

  it('enforces blocked points, hitting blots to bar, and mandatory bar re-entry', () => {
    const base = backgammonEngine.createInitialState({
      gameId: 'backgammon',
      mode: 'local',
      difficulty: 'medium',
      playerCount: 2,
      seed: 100,
    });

    const custom = createEmptyBackgammon(base);
    custom.points[10] = 2; // White checkers
    custom.points[7] = -2; // Blocked for White (2 Black checkers)
    custom.points[6] = -1; // Black blot!
    custom.turn = 'w';
    custom.remainingDice = [3, 4];

    // Moving 10 -> 7 with die 3 is illegal because point 8 (idx 7) is blocked
    expect(
      backgammonEngine.validateAction(custom, {
        type: 'MOVE',
        from: 10,
        to: 7,
        die: 3,
      }).valid
    ).toBe(false);

    // Moving 10 -> 6 with die 4 hits Black blot onto bar
    const afterHit = backgammonEngine.applyAction(custom, {
      type: 'MOVE',
      from: 10,
      to: 6,
      die: 4,
    }).state;
    expect(afterHit.bar.b).toBe(1);
    expect(afterHit.points[6]).toBe(1);

    // Step Undo restores before hit without changing remainingDice
    const undone = backgammonEngine.applyAction(afterHit, { type: 'UNDO' }).state;
    expect(undone.bar.b).toBe(0);
    expect(undone.points[6]).toBe(-1);
    expect(undone.remainingDice).toEqual([3, 4]);

    // Mandatory Bar Entry check for Black
    const barState = createEmptyBackgammon(base);
    barState.bar.b = 1;
    barState.points[10] = -2; // Board checker Black wants to move instead
    barState.points[3] = 2; // Blocks Black bar entry on die 4 (idx 3)
    barState.turn = 'b';
    barState.remainingDice = [2, 4];

    // Moving board checker while on bar is rejected
    expect(
      backgammonEngine.validateAction(barState, {
        type: 'MOVE',
        from: 10,
        to: 12,
        die: 2,
      }).valid
    ).toBe(false);

    // Entering bar onto blocked idx 3 (die 4) is rejected; entering idx 1 (die 2) is legal
    expect(
      backgammonEngine.validateAction(barState, {
        type: 'MOVE',
        from: 'bar',
        to: 3,
        die: 4,
      }).valid
    ).toBe(false);
    expect(
      backgammonEngine.validateAction(barState, {
        type: 'MOVE',
        from: 'bar',
        to: 1,
        die: 2,
      }).valid
    ).toBe(true);
  });

  it('enforces maximum dice usage and higher-die preference on complex dice combinations', () => {
    const base = backgammonEngine.createInitialState({
      gameId: 'backgammon',
      mode: 'local',
      difficulty: 'medium',
      playerCount: 2,
      seed: 1,
    });

    // Scenario A: White at idx 10, roll [2, 5].
    // idx 8 (10-2) is OPEN, idx 5 (10-5) is BLOCKED, idx 3 (8-5) is BLOCKED, idx 6 (8-2) - wait:
    // Let's make idx 8 OPEN and idx 3 OPEN (so 10 -> 8 -> 3 uses BOTH dice [2, 5]),
    // while idx 5 is BLOCKED, OR let's test TWO checkers where playing die 2 blocks the other!
    // Simpler exact test: single White checker at idx 9, roll [3, 4].
    // idx 6 (9-3) is OPEN, idx 2 (6-4) is OPEN => 9 -> 6 -> 2 uses BOTH dice (2 moves).
    // idx 5 (9-4) is OPEN, idx 2 (5-3) is... wait idx 2 is same!
    // Make idx 5 OPEN and idx 6 BLOCKED? Wait if idx 6 is blocked, 3 isn't playable first.
    // To force 2-vs-1 choice: single checker at idx 10, roll [2, 4].
    // idx 8 (10-2) OPEN, idx 4 (8-4) OPEN => 2 then 4 uses BOTH dice!
    // idx 6 (10-4) OPEN, idx 4 (6-2) ... same endpoint!
    // Instead: two options: single checker at idx 10, idx 6 OPEN, idx 8 OPEN, wait intermediate points differ!
    // Block idx 8 with 2 Black checkers? No, put White at idx 10 AND idx 7, or put Black block at idx 6 and OPEN at idx 8:
    // Actually: single White checker at idx 9, roll [2, 4]:
    // idx 7 (9-2) is OPEN, idx 3 (7-4) is OPEN -> [2,4] plays BOTH dice!
    // idx 5 (9-4) is OPEN? What if idx 5 is BLOCKED? Then [4] isn't playable first.
    // What if there are TWO checkers: White at idx 9 and White at idx 4; roll [2, 4]:
    // Wait: single checker at idx 12, Black blocks idx 10 and idx 8? Wait:
    // Classic max-dice puzzle:
    // Checker at idx 7, checker at idx 3? Let's make idx 5 BLOCKED, idx 3 OPEN, idx 0 OPEN; roll [2, 4]:
    // Wait: checker at idx 8 (rolls [2, 5]):
    // idx 6 (8-2) BLOCKED, idx 3 (8-5) OPEN, idx 1 (3-2) OPEN -> 5 then 2 works!
    // Now add a second checker at idx 4? If idx 4 moves by 2 -> idx 2 (fine).
    // If single checker at idx 8 and ANOTHER checker cannot move:
    // Let's test single checker at idx 9 with roll [2, 5]:
    // Suppose idx 7 (9-2) is OPEN, idx 2 (7-5) is BLOCKED (-2), while idx 4 (9-5) is OPEN and idx 2 is BLOCKED... wait both end on 2!
    // Two checkers! Checker A at idx 10, Checker B at idx 5. Roll [3, 5].
    // idx 7 (10-3) is OPEN, idx 2 (7-5) is OPEN!
    // idx 5 (10-5) is BLOCKED? No, B is at idx 5. Make idx 0 (5-5) BLOCKED, idx 2 (5-3) BLOCKED! Wait if idx 2 is blocked then 7-5 is blocked.
    // How about: B is at idx 3, idx 0 (3-3) is BLOCKED. A is at idx 10, idx 7 (10-3) is OPEN, idx 5 (10-5) is OPEN, idx 2 (7-5) is OPEN, idx 2 (5-3) is OPEN... wait:
    // In Backgammon, moving ONE checker by a+b vs b+a hits DIFFERENT intermediate points (unless both intermediate points are blocked or open).
    // What if Checker A is at idx 8, B is at idx 5. All other home points idx 0,1,2,3 are BLOCKED except idx 2!
    // A at 8 moves 5->3? No, idx 3 blocked.
    // Checker A at idx 12, Checker B at idx 10. All low points idx 4,5,6 BLOCKED except idx 7!
    // Roll [3, 5]:
    // If B(10) moves 3 -> 7, then A(12) can move 5 -> 7! (Both dice used = 2!)
    // If A(12) moves 3 -> 9 (open), then 5 from 9 -> 4 (BLOCKED) or 5 from 10 -> 5 (BLOCKED)!
    // YES!! Look how crystal clear that is:
    // - A at 12, B at 10. Points 4, 5, 6, 8 all BLOCKED (-2). Point 7 and Point 9 OPEN. Roll [3, 5].
    //   - Move B(10 -> 7 with 3) enables A(12 -> 7 with 5) => 2 dice used!
    //   - Move A(12 -> 9 with 3) leaves 5 unplayable (9-5=4 blocked, 10-5=5 blocked) => only 1 die used!
    // Therefore A(12 -> 9 with 3) MUST BE ILLEGAL!
    const maxDiceState = createEmptyBackgammon(base);
    maxDiceState.points[12] = 1;
    maxDiceState.points[10] = 1;
    maxDiceState.points[4] = -2;
    maxDiceState.points[5] = -2;
    maxDiceState.points[6] = -2;
    maxDiceState.points[8] = -2;
    maxDiceState.turn = 'w';
    maxDiceState.remainingDice = [3, 5];

    // Dead-end move 12 -> 9 (die 3) leaves 5 unplayable and MUST be rejected
    expect(
      backgammonEngine.validateAction(maxDiceState, {
        type: 'MOVE',
        from: 12,
        to: 9,
        die: 3,
      }).valid
    ).toBe(false);

    const legalMax = getLegalBackgammonMoves(maxDiceState);
    expect(legalMax).toEqual([
      { type: 'MOVE', from: 10, to: 7, die: 3 },
      { type: 'MOVE', from: 12, to: 7, die: 5 },
    ]);

    // Higher-die preference when maxDice === 1:
    // Single White checker at idx 8, roll [2, 5].
    // idx 6 (8-2) OPEN, idx 1 (6-5) BLOCKED; idx 3 (8-5) OPEN, idx 1 (3-2) BLOCKED.
    // Neither sequence uses 2 dice; both 2 and 5 can be played singly -> MUST play higher die (5)!
    const highDieState = createEmptyBackgammon(base);
    highDieState.points[8] = 1;
    highDieState.points[1] = -2;
    highDieState.turn = 'w';
    highDieState.remainingDice = [2, 5];

    const legalHigh = getLegalBackgammonMoves(highDieState);
    expect(legalHigh).toEqual([{ type: 'MOVE', from: 8, to: 3, die: 5 }]);
  });

  it('enforces exact and over-roll bearing off rules, win tiers, and AI actions', () => {
    const base = backgammonEngine.createInitialState({
      gameId: 'backgammon',
      mode: 'ai',
      difficulty: 'hard',
      playerCount: 2,
      seed: 17,
    });

    // Cannot bear off while a checker is still outside home board (idx 8)
    const notHome = createEmptyBackgammon(base);
    notHome.points[2] = 1;
    notHome.points[8] = 1;
    notHome.off.w = 13;
    notHome.turn = 'w';
    notHome.remainingDice = [3, 6];
    expect(
      backgammonEngine.validateAction(notHome, {
        type: 'MOVE',
        from: 2,
        to: 'off',
        die: 3,
      }).valid
    ).toBe(false);

    // Home board bearing off with over-roll:
    // Checkers on idx 3 (point 4) and idx 1 (point 2). Roll [6, 2].
    // With die 6: idx 3 can bear off ONLY because no checkers sit on idx 4 or idx 5!
    const homeState = createEmptyBackgammon(base);
    homeState.points[3] = 1;
    homeState.points[1] = 1;
    homeState.off.w = 13;
    homeState.off.b = 0; // Opponent has 0 off and sits on idx 18 -> Gammon (2x)
    homeState.points[18] = -15;
    homeState.turn = 'w';
    homeState.remainingDice = [6, 2];

    const afterBear1 = backgammonEngine.applyAction(homeState, {
      type: 'MOVE',
      from: 3,
      to: 'off',
      die: 6,
    }).state;
    const afterBear2 = backgammonEngine.applyAction(afterBear1, {
      type: 'MOVE',
      from: 1,
      to: 'off',
      die: 2,
    }).state;

    const outcome = backgammonEngine.evaluateOutcome(afterBear2);
    expect(outcome?.finished).toBe(true);
    expect(outcome?.winnerIndex).toBe(0);
    expect(outcome?.reason).toContain('Gammon');
    expect(outcome?.score).toBe(200);

    // AI action check on rolled opening board
    const rolled = backgammonEngine.applyAction(base, { type: 'ROLL' }).state;
    const aiAction = findBestBackgammonAction(rolled, 'hard');
    expect(aiAction).not.toBeNull();
    expect(backgammonEngine.validateAction(rolled, aiAction!).valid).toBe(true);
  });
});
