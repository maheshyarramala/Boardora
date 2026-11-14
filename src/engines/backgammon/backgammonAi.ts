import type { AIDifficulty } from '../../core/types';
import {
  applyRawStep,
  getLegalBackgammonMoves,
  getPipCount,
  type BackgammonAction,
  type BackgammonColor,
  type BackgammonMoveAction,
  type BackgammonState,
} from './backgammonEngine';

function evaluateBackgammonBoard(
  points: readonly number[],
  bar: { w: number; b: number },
  off: { w: number; b: number },
  perspective: BackgammonColor
): number {
  const opp: BackgammonColor = perspective === 'w' ? 'b' : 'w';
  if (off[perspective] >= 15) return 100_000;

  const myPips = getPipCount(points, bar, perspective);
  const oppPips = getPipCount(points, bar, opp);

  let score = (oppPips - myPips) * 2.4;
  score += off[perspective] * 38;
  score += bar[opp] * 48 - bar[perspective] * 45;

  // Evaluate made points, home primes, and exposed blots
  let consecutiveHome = 0;
  let maxPrime = 0;
  let curPrime = 0;

  for (let i = 0; i < 24; i++) {
    const val = points[i];
    const count = perspective === 'w' ? val : -val;
    if (count >= 2) {
      curPrime++;
      if (curPrime > maxPrime) maxPrime = curPrime;
      const inMyHome = perspective === 'w' ? i <= 5 : i >= 18;
      if (inMyHome) {
        consecutiveHome++;
        score += 18;
      } else {
        score += 10;
      }
      // Extra value for 6-point / 5-point / bar-point (idx 6 or 17)
      if (
        (perspective === 'w' && (i === 4 || i === 5 || i === 6)) ||
        (perspective === 'b' && (i === 17 || i === 18 || i === 19))
      ) {
        score += 8;
      }
    } else {
      curPrime = 0;
      if (count === 1) {
        // Check if opponent is ahead (behind in race direction) to threaten blot
        let oppThreat = bar[opp] > 0;
        if (!oppThreat) {
          if (perspective === 'w') {
            for (let k = i - 1; k >= 0; k--) {
              if (points[k] < 0) {
                oppThreat = true;
                break;
              }
            }
          } else {
            for (let k = i + 1; k < 24; k++) {
              if (points[k] > 0) {
                oppThreat = true;
                break;
              }
            }
          }
        }
        if (oppThreat) {
          const inHomePenalty =
            (perspective === 'w' && i <= 5) || (perspective === 'b' && i >= 18)
              ? 28
              : 18;
          score -= inHomePenalty;
        }
      }
    }
  }

  score += maxPrime * 9 + consecutiveHome * 4;
  return score;
}

interface TurnSequenceResult {
  firstMove: BackgammonMoveAction;
  points: number[];
  bar: { w: number; b: number };
  off: { w: number; b: number };
}

function enumerateTurnOutcomes(state: BackgammonState): TurnSequenceResult[] {
  const firstLegal = getLegalBackgammonMoves(state);
  if (firstLegal.length === 0) return [];

  const results: TurnSequenceResult[] = [];
  const visitedStates = new Set<string>();

  const dfs = (
    points: readonly number[],
    bar: { w: number; b: number },
    off: { w: number; b: number },
    remainingDice: readonly number[],
    firstMove: BackgammonMoveAction
  ) => {
    const stepState = {
      points: [...points],
      bar,
      off,
      turn: state.turn,
      phase: 'move' as const,
      remainingDice: [...remainingDice],
    };

    const nextMoves =
      remainingDice.length === 0 || off[state.turn] === 15
        ? []
        : getLegalBackgammonMoves(stepState);

    if (nextMoves.length === 0) {
      const key = `${points.join(',')}|${bar.w}-${bar.b}|${off.w}-${off.b}`;
      if (!visitedStates.has(key)) {
        visitedStates.add(key);
        results.push({
          firstMove,
          points: [...points],
          bar: { ...bar },
          off: { ...off },
        });
      }
      return;
    }

    // Cap branch expansion on doubles to guarantee fast <50ms response
    const capped = nextMoves.slice(0, 10);
    for (const mv of capped) {
      const idx = remainingDice.indexOf(mv.die);
      const nextDice = [
        ...remainingDice.slice(0, idx),
        ...remainingDice.slice(idx + 1),
      ];
      const next = applyRawStep(points, bar, off, state.turn, mv);
      dfs(next.points, next.bar, next.off, nextDice, firstMove);
    }
  };

  for (const mv of firstLegal) {
    const idx = state.remainingDice.indexOf(mv.die);
    const nextDice = [
      ...state.remainingDice.slice(0, idx),
      ...state.remainingDice.slice(idx + 1),
    ];
    const next = applyRawStep(
      state.points,
      state.bar,
      state.off,
      state.turn,
      mv
    );
    dfs(next.points, next.bar, next.off, nextDice, mv);
  }

  return results;
}

export function findBestBackgammonAction(
  state: BackgammonState,
  difficulty: AIDifficulty
): BackgammonAction | null {
  if (state.phase === 'roll') {
    return { type: 'ROLL' };
  }

  const outcomes = enumerateTurnOutcomes(state);
  if (outcomes.length === 0) return null;

  const scored = outcomes
    .map((o) => ({
      move: o.firstMove,
      score: evaluateBackgammonBoard(o.points, o.bar, o.off, state.turn),
    }))
    .sort((a, b) => b.score - a.score);

  if (difficulty === 'easy') {
    const idx = Math.min(scored.length - 1, Math.floor(scored.length * 0.45));
    return scored[idx].move;
  }

  if (difficulty === 'medium' && scored.length > 2) {
    const pool = scored.slice(0, 2);
    return pool[state.moveCount % pool.length].move;
  }

  return scored[0].move;
}
