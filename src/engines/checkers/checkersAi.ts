import type { AIDifficulty } from '../../core/types';
import {
  checkersEngine,
  type CheckersMoveAction,
  type CheckersState,
} from './checkersEngine';

function evaluateCheckersState(state: CheckersState): number {
  const outcome = checkersEngine.evaluateOutcome(state);
  if (outcome?.finished) {
    if (outcome.winnerIndex === 0) return 10000;
    if (outcome.winnerIndex === 1) return -10000;
    return 0;
  }

  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p) continue;
      let val = p.king ? 185 : 100;
      // Center control bonus
      if (r >= 2 && r <= 5 && c >= 2 && c <= 5) val += 12;
      // Advancement bonus for non-kings
      if (!p.king) {
        val += p.color === 'r' ? (7 - r) * 5 : r * 5;
        // Back rank guard bonus
        if ((p.color === 'r' && r === 7) || (p.color === 'b' && r === 0)) {
          val += 14;
        }
      }
      score += p.color === 'r' ? val : -val;
    }
  }
  return score;
}

function alphaBetaCheckers(
  state: CheckersState,
  depth: number,
  alpha: number,
  beta: number
): number {
  const outcome = checkersEngine.evaluateOutcome(state);
  if (outcome?.finished || depth <= 0) {
    return evaluateCheckersState(state);
  }

  const legal = checkersEngine.getLegalActions(state) as CheckersMoveAction[];
  if (legal.length === 0) {
    return evaluateCheckersState(state);
  }

  // Order captures first
  legal.sort(
    (a, b) =>
      Math.abs(b.to.r - b.from.r) - Math.abs(a.to.r - a.from.r)
  );

  const maximizing = state.turn === 'r';
  if (maximizing) {
    let best = -Infinity;
    for (const move of legal) {
      const { state: next } = checkersEngine.applyAction(state, move);
      const score = alphaBetaCheckers(next, depth - 1, alpha, beta);
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of legal) {
      const { state: next } = checkersEngine.applyAction(state, move);
      const score = alphaBetaCheckers(next, depth - 1, alpha, beta);
      if (score < best) best = score;
      if (score < beta) beta = score;
      if (beta <= alpha) break;
    }
    return best;
  }
}

export function findBestCheckersMove(
  state: CheckersState,
  difficulty: AIDifficulty
): CheckersMoveAction | null {
  const legal = checkersEngine.getLegalActions(state) as CheckersMoveAction[];
  if (legal.length === 0) return null;
  if (legal.length === 1) return legal[0];

  const depth = difficulty === 'easy' ? 2 : difficulty === 'medium' ? 4 : 6;
  const maximizing = state.turn === 'r';

  let bestMove = legal[0];
  let bestScore = maximizing ? -Infinity : Infinity;

  for (const move of legal) {
    const { state: next } = checkersEngine.applyAction(state, move);
    const score = alphaBetaCheckers(next, depth - 1, -Infinity, Infinity);
    if (maximizing ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}
