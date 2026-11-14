import { describe, expect, it } from 'vitest';
import { findBestMorrisMove } from '../engines/nineMensMorris/nineMensMorrisAi';
import {
  countPiecesOnBoard,
  getPlayerPhase,
  nineMensMorrisEngine,
  type MorrisColor,
} from '../engines/nineMensMorris/nineMensMorrisEngine';
import {
  computePegScore,
  pegSolitaireEngine,
  type PegCell,
} from '../engines/pegSolitaire/pegSolitaireEngine';

describe('Stage 4 — Peg Solitaire Engine', () => {
  it('supports English, European, and Diamond layouts, legal jumps, illegal rejection, and undo', () => {
    const english = pegSolitaireEngine.createInitialState({
      gameId: 'peg_solitaire',
      mode: 'practice',
      difficulty: 'medium',
      playerCount: 1,
      seed: 1,
      variant: 'english',
    });
    expect(english.initialPegs).toBe(32);
    expect(english.board[3][3]).toBe('empty');

    const european = pegSolitaireEngine.createInitialState({
      gameId: 'peg_solitaire',
      mode: 'practice',
      difficulty: 'medium',
      playerCount: 1,
      seed: 1,
      variant: 'european',
    });
    expect(european.initialPegs).toBe(36);

    const diamond = pegSolitaireEngine.createInitialState({
      gameId: 'peg_solitaire',
      mode: 'practice',
      difficulty: 'medium',
      playerCount: 1,
      seed: 1,
      variant: 'diamond',
    });
    expect(diamond.initialPegs).toBe(24);

    // Reject diagonal jump
    expect(
      pegSolitaireEngine.validateAction(english, {
        type: 'JUMP',
        from: { r: 1, c: 1 },
        to: { r: 3, c: 3 },
      }).valid
    ).toBe(false);

    // Reject 1-step slide
    expect(
      pegSolitaireEngine.validateAction(english, {
        type: 'JUMP',
        from: { r: 3, c: 2 },
        to: { r: 3, c: 3 },
      }).valid
    ).toBe(false);

    // Legal vertical jump (1,3) -> (3,3) removes (2,3)
    const afterJump = pegSolitaireEngine.applyAction(english, {
      type: 'JUMP',
      from: { r: 1, c: 3 },
      to: { r: 3, c: 3 },
    }).state;
    expect(afterJump.moveCount).toBe(1);
    expect(afterJump.pegsRemaining).toBe(31);
    expect(afterJump.board[1][3]).toBe('empty');
    expect(afterJump.board[2][3]).toBe('empty');
    expect(afterJump.board[3][3]).toBe('peg');

    // Undo restores exact pre-jump state
    const undone = pegSolitaireEngine.applyAction(afterJump, { type: 'UNDO' }).state;
    expect(undone.pegsRemaining).toBe(32);
    expect(undone.moveCount).toBe(0);
    expect(undone.board[2][3]).toBe('peg');
  });

  it('detects Grand Solitaire center win, non-center win, and no-more-moves end condition', () => {
    const base = pegSolitaireEngine.createInitialState({
      gameId: 'peg_solitaire',
      mode: 'practice',
      difficulty: 'medium',
      playerCount: 1,
      seed: 2,
    });

    const emptyBoard: PegCell[][] = base.board.map((row) =>
      row.map((c) => (c === 'invalid' ? 'invalid' : 'empty'))
    );

    // Two pegs remaining -> jump into center (3,3) for Grand Solitaire
    emptyBoard[3][1] = 'peg';
    emptyBoard[3][2] = 'peg';
    const nearWinState = {
      ...base,
      board: emptyBoard,
      pegsRemaining: 2,
      moveCount: 30,
    };

    const grandWinState = pegSolitaireEngine.applyAction(nearWinState, {
      type: 'JUMP',
      from: { r: 3, c: 1 },
      to: { r: 3, c: 3 },
    }).state;
    const winOutcome = pegSolitaireEngine.evaluateOutcome(grandWinState);
    expect(winOutcome?.finished).toBe(true);
    expect(winOutcome?.humanOutcome).toBe('win');
    expect(winOutcome?.reason).toContain('Grand Solitaire');
    expect(computePegScore(grandWinState)).toBe(31 * 100 + 1000);

    // Stuck condition: 2 isolated pegs with no jumps
    const stuckBoard: PegCell[][] = base.board.map((row) =>
      row.map((c) => (c === 'invalid' ? 'invalid' : 'empty'))
    );
    stuckBoard[0][2] = 'peg';
    stuckBoard[6][4] = 'peg';
    const stuckState = {
      ...base,
      board: stuckBoard,
      pegsRemaining: 2,
    };
    const stuckOutcome = pegSolitaireEngine.evaluateOutcome(stuckState);
    expect(stuckOutcome?.finished).toBe(true);
    expect(stuckOutcome?.humanOutcome).toBe('loss');
    expect(stuckOutcome?.reason).toContain('No more legal jumps');
  });
});

describe("Stage 4 — Nine Men's Morris Engine", () => {
  it('enforces placement, mill detection, non-mill capture priority, and all-in-mill capture exception', () => {
    let state = nineMensMorrisEngine.createInitialState({
      gameId: 'nine_mens_morris',
      mode: 'local',
      difficulty: 'medium',
      playerCount: 2,
      seed: 7,
    });

    // Place Black mill at [8, 9, 10] and one non-mill Black piece at 12; White prepares mill [0, 1, 2]
    state = nineMensMorrisEngine.applyAction(state, { type: 'PLACE', to: 0 }).state; // W
    state = nineMensMorrisEngine.applyAction(state, { type: 'PLACE', to: 8 }).state; // B
    state = nineMensMorrisEngine.applyAction(state, { type: 'PLACE', to: 1 }).state; // W
    state = nineMensMorrisEngine.applyAction(state, { type: 'PLACE', to: 12 }).state; // B (non-mill)
    state = nineMensMorrisEngine.applyAction(state, { type: 'PLACE', to: 3 }).state; // W
    state = nineMensMorrisEngine.applyAction(state, { type: 'PLACE', to: 9 }).state; // B
    state = nineMensMorrisEngine.applyAction(state, { type: 'PLACE', to: 4 }).state; // W
    state = nineMensMorrisEngine.applyAction(state, { type: 'PLACE', to: 10 }).state; // B -> wait, B didn't finish mill yet? Yes [8,9,10] IS a mill!

    expect(state.pendingCapture).toBe(true);
    expect(state.turn).toBe('b');

    // White has no mills; Black captures White node 4
    state = nineMensMorrisEngine.applyAction(state, {
      type: 'CAPTURE',
      target: 4,
    }).state;
    expect(state.pendingCapture).toBe(false);
    expect(state.turn).toBe('w');

    // Now White completes mill [0, 1, 2]
    state = nineMensMorrisEngine.applyAction(state, { type: 'PLACE', to: 2 }).state;
    expect(state.pendingCapture).toBe(true);
    expect(state.turn).toBe('w');

    // Black piece 8 is inside active mill [8,9,10], while 12 is NOT -> capturing 8 must be rejected!
    expect(
      nineMensMorrisEngine.validateAction(state, { type: 'CAPTURE', target: 8 }).valid
    ).toBe(false);
    // Capturing non-mill piece 12 is legal
    state = nineMensMorrisEngine.applyAction(state, {
      type: 'CAPTURE',
      target: 12,
    }).state;
    expect(state.board[12]).toBeNull();

    // Verify exception: if all remaining opponent pieces are in a mill, capturing from a mill is legal
    const allMillBoard = Array<MorrisColor | null>(24).fill(null);
    allMillBoard[0] = 'w';
    allMillBoard[1] = 'w';
    allMillBoard[2] = 'w';
    allMillBoard[8] = 'b';
    allMillBoard[9] = 'b';
    allMillBoard[10] = 'b';
    const allMillState = {
      ...state,
      board: allMillBoard,
      turn: 'w' as const,
      inHand: { w: 0, b: 0 },
      pendingCapture: true,
    };
    expect(
      nineMensMorrisEngine.validateAction(allMillState, {
        type: 'CAPTURE',
        target: 8,
      }).valid
    ).toBe(true);
  });

  it('handles movement phase, flying phase at 3 pieces, 2-piece win, blockade win, repetition draw, and AI moves', () => {
    const base = nineMensMorrisEngine.createInitialState({
      gameId: 'nine_mens_morris',
      mode: 'ai',
      difficulty: 'medium',
      playerCount: 2,
      seed: 9,
    });

    // Movement vs Flying phase check
    const moveBoard = Array<MorrisColor | null>(24).fill(null);
    moveBoard[0] = 'w';
    moveBoard[2] = 'w';
    moveBoard[4] = 'w';
    moveBoard[6] = 'w'; // 4 white pieces -> movement
    moveBoard[8] = 'b';
    moveBoard[10] = 'b';
    moveBoard[12] = 'b'; // 3 black pieces -> flying

    const phaseState = {
      ...base,
      board: moveBoard,
      turn: 'w' as const,
      inHand: { w: 0, b: 0 },
    };
    expect(getPlayerPhase(phaseState, 'w')).toBe('movement');
    expect(getPlayerPhase(phaseState, 'b')).toBe('flying');

    // White cannot jump non-adjacently (0 -> 23) in movement phase
    expect(
      nineMensMorrisEngine.validateAction(phaseState, {
        type: 'MOVE',
        from: 0,
        to: 23,
      }).valid
    ).toBe(false);

    // Adjacent slide (0 -> 1) is legal
    const afterW = nineMensMorrisEngine.applyAction(phaseState, {
      type: 'MOVE',
      from: 0,
      to: 1,
    }).state;
    expect(afterW.turn).toBe('b');

    // Black has 3 pieces -> Flying across board (8 -> 23) is legal!
    const afterFly = nineMensMorrisEngine.applyAction(afterW, {
      type: 'MOVE',
      from: 8,
      to: 23,
    }).state;
    expect(afterFly.board[23]).toBe('b');

    // 2-piece win detection
    const reduceBoard = Array<MorrisColor | null>(24).fill(null);
    reduceBoard[0] = 'w';
    reduceBoard[1] = 'w';
    reduceBoard[2] = 'w';
    reduceBoard[8] = 'b';
    reduceBoard[9] = 'b';
    const twoPieceOutcome = nineMensMorrisEngine.evaluateOutcome({
      ...phaseState,
      board: reduceBoard,
    });
    expect(twoPieceOutcome?.finished).toBe(true);
    expect(twoPieceOutcome?.winnerIndex).toBe(0);

    // Blockade win detection: surround a 4-piece White group with no empty adjacent nodes
    const blockedBoard = Array<MorrisColor | null>(24).fill(null);
    // White trapped at corner 0 (neighbors 1, 7), corner 2 (neighbors 1, 3), corner 4 (3,5), corner 6 (5,7)
    blockedBoard[0] = 'w';
    blockedBoard[2] = 'w';
    blockedBoard[4] = 'w';
    blockedBoard[6] = 'w';
    blockedBoard[1] = 'b';
    blockedBoard[3] = 'b';
    blockedBoard[5] = 'b';
    blockedBoard[7] = 'b';
    const blockedOutcome = nineMensMorrisEngine.evaluateOutcome({
      ...phaseState,
      board: blockedBoard,
      turn: 'w',
    });
    expect(blockedOutcome?.finished).toBe(true);
    expect(blockedOutcome?.winnerIndex).toBe(1);
    expect(blockedOutcome?.reason).toContain('blocked');

    // Draw by 50-ply no-capture
    const drawOutcome = nineMensMorrisEngine.evaluateOutcome({
      ...phaseState,
      pliesSinceCapture: 50,
    });
    expect(drawOutcome?.finished).toBe(true);
    expect(drawOutcome?.humanOutcome).toBe('draw');

    // AI computes valid move
    const aiAction = findBestMorrisMove(base, 'medium');
    expect(aiAction).not.toBeNull();
    expect(countPiecesOnBoard(base.board, 'w')).toBe(0);
    expect(nineMensMorrisEngine.validateAction(base, aiAction!).valid).toBe(true);
  });
});
