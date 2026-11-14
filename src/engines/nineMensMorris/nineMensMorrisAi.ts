import type { AIDifficulty } from '../../core/types';
import {
  MORRIS_ADJACENCY,
  MORRIS_MILLS,
  countPiecesOnBoard,
  getLegalMorrisActions,
  isNodeInMill,
  nineMensMorrisEngine,
  type MorrisAction,
  type MorrisColor,
  type NineMensMorrisState,
} from './nineMensMorrisEngine';

function evaluateMorrisPosition(
  state: NineMensMorrisState,
  perspective: MorrisColor
): number {
  const outcome = nineMensMorrisEngine.evaluateOutcome(state);
  if (outcome?.finished) {
    if (outcome.winnerIndex === null) return 0;
    const winnerColor: MorrisColor = outcome.winnerIndex === 0 ? 'w' : 'b';
    return winnerColor === perspective ? 100_000 : -100_000;
  }

  const opp: MorrisColor = perspective === 'w' ? 'b' : 'w';
  const myCount = countPiecesOnBoard(state.board, perspective) + state.inHand[perspective];
  const oppCount = countPiecesOnBoard(state.board, opp) + state.inHand[opp];

  let score = (myCount - oppCount) * 140;

  let myMills = 0;
  let oppMills = 0;
  let myTwoInRow = 0;
  let oppTwoInRow = 0;

  for (const [a, b, c] of MORRIS_MILLS) {
    const ba = state.board[a];
    const bb = state.board[b];
    const bc = state.board[c];
    const myInLine =
      (ba === perspective ? 1 : 0) +
      (bb === perspective ? 1 : 0) +
      (bc === perspective ? 1 : 0);
    const oppInLine =
      (ba === opp ? 1 : 0) + (bb === opp ? 1 : 0) + (bc === opp ? 1 : 0);

    if (myInLine === 3) myMills++;
    else if (myInLine === 2 && oppInLine === 0) myTwoInRow++;

    if (oppInLine === 3) oppMills++;
    else if (oppInLine === 2 && myInLine === 0) oppTwoInRow++;
  }

  score += (myMills - oppMills) * 65;
  score += (myTwoInRow - oppTwoInRow) * 28;

  // Mobility & middle-ring spoke hubs (9, 11, 13, 15)
  let mobilityScore = 0;
  for (let i = 0; i < 24; i++) {
    const p = state.board[i];
    if (!p) continue;
    const hubBonus = i === 9 || i === 11 || i === 13 || i === 15 ? 12 : 0;
    let emptyNeighbors = 0;
    for (const n of MORRIS_ADJACENCY[i]) {
      if (state.board[n] === null) emptyNeighbors++;
    }
    const val = emptyNeighbors * 6 + hubBonus;
    mobilityScore += p === perspective ? val : -val;
  }
  score += mobilityScore;

  if (state.pendingCapture) {
    score += state.turn === perspective ? 120 : -120;
  }

  return score;
}

function orderMorrisActions(
  state: NineMensMorrisState,
  actions: MorrisAction[]
): MorrisAction[] {
  if (actions.length <= 1) return actions;
  return [...actions].sort((a, b) => {
    const scoreAction = (act: MorrisAction): number => {
      if (act.type === 'CAPTURE') {
        let adjOpp = 0;
        for (const n of MORRIS_ADJACENCY[act.target]) {
          if (state.board[n] === state.board[act.target]) adjOpp++;
        }
        return 50 + adjOpp * 5;
      }
      if (act.type === 'PLACE' || act.type === 'MOVE') {
        const testBoard = [...state.board];
        if (act.type === 'MOVE') testBoard[act.from] = null;
        testBoard[act.to] = state.turn;
        if (isNodeInMill(testBoard, act.to, state.turn)) return 100;
        if (act.to === 9 || act.to === 11 || act.to === 13 || act.to === 15) {
          return 20;
        }
      }
      return 0;
    };
    return scoreAction(b) - scoreAction(a);
  });
}

function alphabeta(
  state: NineMensMorrisState,
  depth: number,
  alpha: number,
  beta: number,
  perspective: MorrisColor
): number {
  const outcome = nineMensMorrisEngine.evaluateOutcome(state);
  if (depth <= 0 || outcome?.finished) {
    return evaluateMorrisPosition(state, perspective);
  }

  const legal = orderMorrisActions(state, getLegalMorrisActions(state));
  if (legal.length === 0) {
    return evaluateMorrisPosition(state, perspective);
  }

  const maximizing = state.turn === perspective;
  if (maximizing) {
    let best = -Infinity;
    for (const act of legal) {
      const next = nineMensMorrisEngine.applyAction(state, act).state;
      // Preserve depth credit when executing immediate follow-up mill capture
      const nextDepth = state.pendingCapture ? depth : depth - 1;
      const val = alphabeta(next, nextDepth, alpha, beta, perspective);
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const act of legal) {
      const next = nineMensMorrisEngine.applyAction(state, act).state;
      const nextDepth = state.pendingCapture ? depth : depth - 1;
      const val = alphabeta(next, nextDepth, alpha, beta, perspective);
      if (val < best) best = val;
      if (best < beta) beta = best;
      if (alpha >= beta) break;
    }
    return best;
  }
}

export function findBestMorrisMove(
  state: NineMensMorrisState,
  difficulty: AIDifficulty
): MorrisAction | null {
  const legal = orderMorrisActions(state, getLegalMorrisActions(state));
  if (legal.length === 0) return null;

  if (difficulty === 'easy') {
    // Easy picks from top half or mild heuristic
    const pool = legal.slice(0, Math.max(1, Math.ceil(legal.length * 0.45)));
    return pool[(state.moveCount + pool.length) % pool.length] ?? legal[0];
  }

  const depth = difficulty === 'hard' ? 3 : 2;
  const perspective = state.turn;
  let bestAction = legal[0];
  let bestVal = -Infinity;

  for (const act of legal) {
    const next = nineMensMorrisEngine.applyAction(state, act).state;
    const val = alphabeta(
      next,
      state.pendingCapture ? depth : depth - 1,
      -Infinity,
      Infinity,
      perspective
    );
    if (val > bestVal) {
      bestVal = val;
      bestAction = act;
    }
  }
  return bestAction;
}
