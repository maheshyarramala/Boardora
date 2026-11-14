import { describe, expect, it } from 'vitest';
import { findBestCheckersMove } from '../engines/checkers/checkersAi';
import { checkersEngine } from '../engines/checkers/checkersEngine';
import { findBestChessMove } from '../engines/chess/chessAi';
import { chessEngine } from '../engines/chess/chessEngine';

describe('Chess Engine (chess.js + Alpha-Beta AI)', () => {
  it('validates legal moves, rejects illegal moves, supports castling, en passant, promotion, and checkmate', () => {
    let state = chessEngine.createInitialState({
      gameId: 'chess',
      mode: 'local',
      difficulty: 'medium',
      playerCount: 2,
      seed: 1,
    });

    // Reject illegal pawn jump
    expect(
      chessEngine.validateAction(state, {
        type: 'MOVE',
        from: 'e2',
        to: 'e5',
      }).valid
    ).toBe(false);

    // Fool's Mate sequence -> Checkmate
    const moves = [
      { from: 'f2', to: 'f3' },
      { from: 'e7', to: 'e5' },
      { from: 'g2', to: 'g4' },
      { from: 'd8', to: 'h4' },
    ] as const;

    for (const m of moves) {
      state = chessEngine.applyAction(state, { type: 'MOVE', ...m }).state;
    }

    const outcome = chessEngine.evaluateOutcome(state);
    expect(outcome?.finished).toBe(true);
    expect(outcome?.winnerIndex).toBe(1);
    expect(outcome?.reason).toContain('Checkmate');
  });

  it('handles en passant, castling, promotion, stalemate, undo, and AI move generation', () => {
    // En passant test position
    const epState = {
      ...chessEngine.createInitialState({
        gameId: 'chess',
        mode: 'local',
        difficulty: 'easy',
        playerCount: 2,
        seed: 2,
      }),
      initialFen: 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3',
      fen: 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3',
    };
    expect(
      chessEngine.validateAction(epState, {
        type: 'MOVE',
        from: 'e5',
        to: 'd6',
      }).valid
    ).toBe(true);

    // Castling test position
    const castleState = {
      ...epState,
      initialFen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',
      fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',
    };
    const afterCastle = chessEngine.applyAction(castleState, {
      type: 'MOVE',
      from: 'e1',
      to: 'g1',
    }).state;
    expect(afterCastle.history[0].san).toBe('O-O');

    // Undo restores previous FEN cleanly
    const afterUndo = chessEngine.applyAction(afterCastle, { type: 'UNDO' }).state;
    expect(afterUndo.fen).toBe(castleState.fen);

    // Pawn promotion to knight
    const promoState = {
      ...epState,
      initialFen: '4k3/P7/8/8/8/8/8/4K3 w - - 0 1',
      fen: '4k3/P7/8/8/8/8/8/4K3 w - - 0 1',
    };
    const afterPromo = chessEngine.applyAction(promoState, {
      type: 'MOVE',
      from: 'a7',
      to: 'a8',
      promotion: 'n',
    }).state;
    expect(afterPromo.history[0].san).toContain('=N');

    // Stalemate detection
    const staleState = {
      ...epState,
      initialFen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1',
      fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1',
    };
    const staleOutcome = chessEngine.evaluateOutcome(staleState);
    expect(staleOutcome?.finished).toBe(true);
    expect(staleOutcome?.humanOutcome).toBe('draw');
    expect(staleOutcome?.reason).toContain('stalemate');

    // AI computes legal move from starting FEN
    const aiChoice = findBestChessMove(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'medium'
    );
    expect(aiChoice).not.toBeNull();
  });
});

describe('Checkers Engine', () => {
  it('enforces mandatory captures, multi-jump chains, king promotion, undo, and AI moves', () => {
    const base = checkersEngine.createInitialState({
      gameId: 'checkers',
      mode: 'local',
      difficulty: 'medium',
      playerCount: 2,
      seed: 10,
    });

    // Reject illegal move on white square
    expect(
      checkersEngine.validateAction(base, {
        type: 'MOVE',
        from: { r: 5, c: 0 },
        to: { r: 4, c: 0 },
      }).valid
    ).toBe(false);

    // Build custom board with a Red double-jump available: Red at (5,2), Black at (4,3) and (2,5)
    const emptyBoard = Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, () => null as { color: 'r' | 'b'; king: boolean } | null)
    );
    emptyBoard[5][2] = { color: 'r', king: false };
    emptyBoard[5][0] = { color: 'r', king: false };
    emptyBoard[4][3] = { color: 'b', king: false };
    emptyBoard[2][5] = { color: 'b', king: false };

    const jumpState = {
      ...base,
      board: emptyBoard,
      turn: 'r' as const,
      mandatoryCapture: true,
    };

    // Non-capture move from (5,0) to (4,1) must be rejected when capture exists
    expect(
      checkersEngine.validateAction(jumpState, {
        type: 'MOVE',
        from: { r: 5, c: 0 },
        to: { r: 4, c: 1 },
      }).valid
    ).toBe(false);

    // First jump (5,2) -> (3,4) keeps turn on 'r' with forcedPiece at (3,4)
    const afterJump1 = checkersEngine.applyAction(jumpState, {
      type: 'MOVE',
      from: { r: 5, c: 2 },
      to: { r: 3, c: 4 },
    }).state;
    expect(afterJump1.turn).toBe('r');
    expect(afterJump1.forcedPiece).toEqual({ r: 3, c: 4 });
    expect(afterJump1.board[4][3]).toBeNull();

    // Second jump (3,4) -> (1,6) captures remaining Black piece and wins!
    const afterJump2 = checkersEngine.applyAction(afterJump1, {
      type: 'MOVE',
      from: { r: 3, c: 4 },
      to: { r: 1, c: 6 },
    }).state;
    expect(afterJump2.capturedByRed).toBe(2);
    const outcome = checkersEngine.evaluateOutcome(afterJump2);
    expect(outcome?.finished).toBe(true);
    expect(outcome?.winnerIndex).toBe(0);

    // King promotion check: Red moves from (1,0) to (0,1)
    const promoBoard = Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, () => null as { color: 'r' | 'b'; king: boolean } | null)
    );
    promoBoard[1][0] = { color: 'r', king: false };
    promoBoard[5][6] = { color: 'b', king: false };
    const promoState = { ...base, board: promoBoard, turn: 'r' as const };
    const crowned = checkersEngine.applyAction(promoState, {
      type: 'MOVE',
      from: { r: 1, c: 0 },
      to: { r: 0, c: 1 },
    }).state;
    expect(crowned.board[0][1]?.king).toBe(true);

    // Undo restores state
    const undone = checkersEngine.applyAction(crowned, { type: 'UNDO' }).state;
    expect(undone.board[1][0]?.king).toBe(false);

    // AI produces legal move from initial board
    const aiMove = findBestCheckersMove(base, 'medium');
    expect(aiMove).not.toBeNull();
    expect(checkersEngine.validateAction(base, aiMove!).valid).toBe(true);

    // Serialization round-trip
    const restored = checkersEngine.deserialize(checkersEngine.serialize(base));
    expect(restored.turn).toBe('r');
  });
});
