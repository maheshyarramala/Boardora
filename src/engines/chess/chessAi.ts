import { Chess, type Move, type PieceSymbol } from 'chess.js';
import type { AIDifficulty } from '../../core/types';

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Simplified midgame piece-square bonus tables (from White's perspective, rank 8 -> rank 1)
const PAWN_PST = [
  0, 0, 0, 0, 0, 0, 0, 0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5, 5, 10, 27, 27, 10, 5, 5,
  0, 0, 0, 24, 24, 0, 0, 0,
  5, -5, -10, 0, 0, -10, -5, 5,
  5, 10, 10, -22, -22, 10, 10, 5,
  0, 0, 0, 0, 0, 0, 0, 0,
];

const KNIGHT_PST = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20, 0, 0, 0, 0, -20, -40,
  -30, 0, 10, 15, 15, 10, 0, -30,
  -30, 5, 15, 20, 20, 15, 5, -30,
  -30, 0, 15, 20, 20, 15, 0, -30,
  -30, 5, 10, 15, 15, 10, 5, -30,
  -40, -20, 0, 5, 5, 0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50,
];

const CENTER_BONUS_PST = [
  -20, -10, -10, -5, -5, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 8, 12, 12, 8, 0, -10,
  -5, 5, 12, 16, 16, 12, 5, -5,
  0, 0, 12, 16, 16, 12, 0, -5,
  -10, 5, 8, 10, 10, 8, 5, -10,
  -10, 0, 5, 0, 0, 0, 0, -10,
  -20, -10, -10, -5, -5, -10, -10, -20,
];

function evaluateBoard(chess: Chess): number {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -99999 : 99999;
  }
  if (chess.isDraw()) return 0;

  const board = chess.board();
  let score = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = board[r][c];
      if (!sq) continue;
      const idx = sq.color === 'w' ? r * 8 + c : (7 - r) * 8 + c;
      let val = PIECE_VALUES[sq.type];
      if (sq.type === 'p') val += PAWN_PST[idx];
      else if (sq.type === 'n') val += KNIGHT_PST[idx];
      else if (sq.type === 'b' || sq.type === 'q') val += CENTER_BONUS_PST[idx];

      score += sq.color === 'w' ? val : -val;
    }
  }

  return score;
}

function orderMoves(moves: Move[]): Move[] {
  return moves.sort((a, b) => {
    const scoreA =
      (a.captured ? PIECE_VALUES[a.captured] * 10 - PIECE_VALUES[a.piece] : 0) +
      (a.promotion ? 800 : 0) +
      (a.san.includes('+') ? 40 : 0);
    const scoreB =
      (b.captured ? PIECE_VALUES[b.captured] * 10 - PIECE_VALUES[b.piece] : 0) +
      (b.promotion ? 800 : 0) +
      (b.san.includes('+') ? 40 : 0);
    return scoreB - scoreA;
  });
}

function quiescence(
  chess: Chess,
  alpha: number,
  beta: number,
  maximizing: boolean,
  depthLeft: number
): number {
  const standPat = evaluateBoard(chess);
  if (depthLeft <= 0) return standPat;

  if (maximizing) {
    if (standPat >= beta) return beta;
    if (alpha < standPat) alpha = standPat;
    const captures = orderMoves(
      (chess.moves({ verbose: true }) as Move[]).filter((m) => Boolean(m.captured))
    );
    for (const move of captures) {
      chess.move(move);
      const score = quiescence(chess, alpha, beta, false, depthLeft - 1);
      chess.undo();
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  } else {
    if (standPat <= alpha) return alpha;
    if (beta > standPat) beta = standPat;
    const captures = orderMoves(
      (chess.moves({ verbose: true }) as Move[]).filter((m) => Boolean(m.captured))
    );
    for (const move of captures) {
      chess.move(move);
      const score = quiescence(chess, alpha, beta, true, depthLeft - 1);
      chess.undo();
      if (score <= alpha) return alpha;
      if (score < beta) beta = score;
    }
    return beta;
  }
}

function alphaBeta(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean
): number {
  if (chess.isGameOver()) {
    return evaluateBoard(chess);
  }
  if (depth <= 0) {
    return quiescence(chess, alpha, beta, maximizing, 2);
  }

  const moves = orderMoves(chess.moves({ verbose: true }) as Move[]);

  if (maximizing) {
    let best = -Infinity;
    for (const move of moves) {
      chess.move(move);
      const score = alphaBeta(chess, depth - 1, alpha, beta, false);
      chess.undo();
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      chess.move(move);
      const score = alphaBeta(chess, depth - 1, alpha, beta, true);
      chess.undo();
      if (score < best) best = score;
      if (score < beta) beta = score;
      if (beta <= alpha) break;
    }
    return best;
  }
}

export interface ChessMoveChoice {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
  engineUsed: 'stockfish' | 'alpha-beta';
}

export function findBestChessMove(
  fen: string,
  difficulty: AIDifficulty
): ChessMoveChoice | null {
  const chess = new Chess(fen);
  const moves = orderMoves(chess.moves({ verbose: true }) as Move[]);
  if (moves.length === 0) return null;

  const maximizing = chess.turn() === 'w';
  const depth = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;

  let bestMove = moves[0];
  let bestScore = maximizing ? -Infinity : Infinity;

  for (const move of moves) {
    chess.move(move);
    const score = alphaBeta(
      chess,
      depth - 1,
      -Infinity,
      Infinity,
      !maximizing
    );
    chess.undo();

    if (maximizing ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return {
    from: bestMove.from,
    to: bestMove.to,
    ...(bestMove.promotion
      ? { promotion: bestMove.promotion as 'q' | 'r' | 'b' | 'n' }
      : {}),
    engineUsed: 'alpha-beta',
  };
}
