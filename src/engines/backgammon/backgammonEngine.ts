import type {
  ActionValidationResult,
  EngineTransition,
  GameEngine,
  GameEvent,
  GameOutcome,
  MatchSetupConfig,
} from '../../core/engine';
import {
  createPrngState,
  rollDie,
  type PrngState,
} from '../../core/prng';
import type { AIDifficulty, GameMode } from '../../core/types';

export type BackgammonColor = 'w' | 'b';
export type BackgammonPointSource = number | 'bar';
export type BackgammonPointTarget = number | 'off';

export interface BackgammonMoveAction {
  type: 'MOVE';
  from: BackgammonPointSource;
  to: BackgammonPointTarget;
  die: number;
}

export type BackgammonAction =
  | { type: 'ROLL' }
  | BackgammonMoveAction
  | { type: 'UNDO' }
  | { type: 'RESIGN'; color: BackgammonColor };

export interface BackgammonMoveSnapshot {
  points: number[];
  bar: { w: number; b: number };
  off: { w: number; b: number };
  remainingDice: number[];
  moveCount: number;
}

export interface BackgammonState {
  version: number;
  mode: GameMode;
  difficulty: AIDifficulty;
  rngState: PrngState;
  /**
   * 24 points indexed 0..23 (Point 1..24).
   * Positive integers = 'w' checkers (moving 23 -> 0 -> off).
   * Negative integers = 'b' checkers (moving 0 -> 23 -> off).
   */
  points: number[];
  bar: { w: number; b: number };
  off: { w: number; b: number };
  turn: BackgammonColor;
  phase: 'roll' | 'move';
  lastDice: [number, number] | null;
  remainingDice: number[];
  turnUndoStack: BackgammonMoveSnapshot[];
  history: string[];
  moveCount: number;
  resignedBy: BackgammonColor | null;
}

export function createStandardBackgammonPoints(): number[] {
  const pts = Array(24).fill(0) as number[];
  // White ('w'): moves 23 -> 0 -> off (Home board: 0..5)
  pts[23] = 2;
  pts[12] = 5;
  pts[7] = 3;
  pts[5] = 5;
  // Black ('b'): moves 0 -> 23 -> off (Home board: 18..23)
  pts[0] = -2;
  pts[11] = -5;
  pts[16] = -3;
  pts[18] = -5;
  return pts;
}

export function isPointOpenFor(
  points: readonly number[],
  idx: number,
  color: BackgammonColor
): boolean {
  if (idx < 0 || idx > 23) return false;
  return color === 'w' ? points[idx] >= -1 : points[idx] <= 1;
}

export function canBearOff(
  points: readonly number[],
  bar: { w: number; b: number },
  color: BackgammonColor
): boolean {
  if (bar[color] > 0) return false;
  if (color === 'w') {
    for (let i = 6; i < 24; i++) {
      if (points[i] > 0) return false;
    }
    return true;
  } else {
    for (let i = 0; i < 18; i++) {
      if (points[i] < 0) return false;
    }
    return true;
  }
}

export function getPipCount(
  points: readonly number[],
  bar: { w: number; b: number },
  color: BackgammonColor
): number {
  let pips = bar[color] * 25;
  for (let i = 0; i < 24; i++) {
    const val = points[i];
    if (color === 'w' && val > 0) {
      pips += val * (i + 1);
    } else if (color === 'b' && val < 0) {
      pips += -val * (24 - i);
    }
  }
  return pips;
}

function generateSingleStepMovesForDie(
  points: readonly number[],
  bar: { w: number; b: number },
  color: BackgammonColor,
  die: number
): BackgammonMoveAction[] {
  const moves: BackgammonMoveAction[] = [];

  if (bar[color] > 0) {
    const entryIdx = color === 'w' ? 24 - die : die - 1;
    if (isPointOpenFor(points, entryIdx, color)) {
      moves.push({ type: 'MOVE', from: 'bar', to: entryIdx, die });
    }
    return moves;
  }

  const bearingOffAllowed = canBearOff(points, bar, color);

  if (color === 'w') {
    for (let i = 23; i >= 0; i--) {
      if (points[i] <= 0) continue;
      const target = i - die;
      if (target >= 0) {
        if (isPointOpenFor(points, target, 'w')) {
          moves.push({ type: 'MOVE', from: i, to: target, die });
        }
      } else if (bearingOffAllowed) {
        if (target === -1) {
          moves.push({ type: 'MOVE', from: i, to: 'off', die });
        } else {
          // Higher die allowed only if no white checker exists on a higher home point
          let hasHigher = false;
          for (let h = i + 1; h <= 5; h++) {
            if (points[h] > 0) {
              hasHigher = true;
              break;
            }
          }
          if (!hasHigher) {
            moves.push({ type: 'MOVE', from: i, to: 'off', die });
          }
        }
      }
    }
  } else {
    for (let i = 0; i < 24; i++) {
      if (points[i] >= 0) continue;
      const target = i + die;
      if (target <= 23) {
        if (isPointOpenFor(points, target, 'b')) {
          moves.push({ type: 'MOVE', from: i, to: target, die });
        }
      } else if (bearingOffAllowed) {
        if (target === 24) {
          moves.push({ type: 'MOVE', from: i, to: 'off', die });
        } else {
          let hasHigher = false;
          for (let h = i - 1; h >= 18; h--) {
            if (points[h] < 0) {
              hasHigher = true;
              break;
            }
          }
          if (!hasHigher) {
            moves.push({ type: 'MOVE', from: i, to: 'off', die });
          }
        }
      }
    }
  }

  return moves;
}

export function applyRawStep(
  points: readonly number[],
  bar: { w: number; b: number },
  off: { w: number; b: number },
  color: BackgammonColor,
  move: BackgammonMoveAction
): {
  points: number[];
  bar: { w: number; b: number };
  off: { w: number; b: number };
  hit: boolean;
} {
  const nextPoints = [...points];
  const nextBar = { ...bar };
  const nextOff = { ...off };
  let hit = false;

  if (move.from === 'bar') {
    nextBar[color]--;
  } else {
    nextPoints[move.from] += color === 'w' ? -1 : 1;
  }

  if (move.to === 'off') {
    nextOff[color]++;
  } else if (color === 'w') {
    if (nextPoints[move.to] === -1) {
      nextPoints[move.to] = 1;
      nextBar.b++;
      hit = true;
    } else {
      nextPoints[move.to]++;
    }
  } else {
    if (nextPoints[move.to] === 1) {
      nextPoints[move.to] = -1;
      nextBar.w++;
      hit = true;
    } else {
      nextPoints[move.to]--;
    }
  }

  return { points: nextPoints, bar: nextBar, off: nextOff, hit };
}

function maxDicePlayableDepth(
  points: readonly number[],
  bar: { w: number; b: number },
  off: { w: number; b: number },
  color: BackgammonColor,
  remainingDice: readonly number[]
): number {
  if (remainingDice.length === 0 || off[color] === 15) return 0;

  const uniqueDice = Array.from(new Set(remainingDice));
  let best = 0;

  for (const die of uniqueDice) {
    const steps = generateSingleStepMovesForDie(points, bar, color, die);
    if (steps.length === 0) continue;

    const idxToRemove = remainingDice.indexOf(die);
    const nextRemaining = [
      ...remainingDice.slice(0, idxToRemove),
      ...remainingDice.slice(idxToRemove + 1),
    ];

    for (const step of steps) {
      const res = applyRawStep(points, bar, off, color, step);
      const subDepth =
        1 +
        maxDicePlayableDepth(res.points, res.bar, res.off, color, nextRemaining);
      if (subDepth > best) best = subDepth;
      if (best === remainingDice.length) return best;
    }
  }

  return best;
}

/**
 * Computes strictly legal single-step Backgammon moves enforcing:
 * 1. Mandatory bar entry
 * 2. Open/blocked point rules
 * 3. Exact/over-roll bearing off rules
 * 4. Maximum dice usage & higher-die preference when only 1 of 2 dice is playable
 */
export function getLegalBackgammonMoves(
  state: Pick<
    BackgammonState,
    'points' | 'bar' | 'off' | 'turn' | 'phase' | 'remainingDice'
  >
): BackgammonMoveAction[] {
  if (state.phase !== 'move' || state.remainingDice.length === 0) return [];

  const uniqueDice = Array.from(new Set(state.remainingDice));
  const candidates: { move: BackgammonMoveAction; totalUsed: number }[] = [];
  let globalMax = 0;

  for (const die of uniqueDice) {
    const steps = generateSingleStepMovesForDie(
      state.points,
      state.bar,
      state.turn,
      die
    );
    if (steps.length === 0) continue;

    const idx = state.remainingDice.indexOf(die);
    const rest = [
      ...state.remainingDice.slice(0, idx),
      ...state.remainingDice.slice(idx + 1),
    ];

    for (const step of steps) {
      const res = applyRawStep(state.points, state.bar, state.off, state.turn, step);
      const totalUsed =
        1 + maxDicePlayableDepth(res.points, res.bar, res.off, state.turn, rest);
      if (totalUsed > globalMax) globalMax = totalUsed;
      candidates.push({ move: step, totalUsed });
    }
  }

  if (globalMax === 0) return [];

  let filtered = candidates
    .filter((c) => c.totalUsed === globalMax)
    .map((c) => c.move);

  // Standard Backgammon rule: if max usable dice === 1 and multiple dice values are playable,
  // the player MUST use the higher die value.
  if (globalMax === 1 && uniqueDice.length > 1) {
    const highestDie = Math.max(...filtered.map((m) => m.die));
    filtered = filtered.filter((m) => m.die === highestDie);
  }

  return filtered;
}

function formatPointLabel(p: BackgammonPointSource | BackgammonPointTarget): string {
  if (p === 'bar') return 'Bar';
  if (p === 'off') return 'Off';
  return String(p + 1);
}

export class BackgammonEngine
  implements GameEngine<BackgammonState, BackgammonAction>
{
  readonly id = 'backgammon' as const;
  readonly version = 1;

  createInitialState(config: MatchSetupConfig): BackgammonState {
    return {
      version: this.version,
      mode: config.mode,
      difficulty: config.difficulty,
      rngState: createPrngState(config.seed),
      points: createStandardBackgammonPoints(),
      bar: { w: 0, b: 0 },
      off: { w: 0, b: 0 },
      turn: 'w',
      phase: 'roll',
      lastDice: null,
      remainingDice: [],
      turnUndoStack: [],
      history: [],
      moveCount: 0,
      resignedBy: null,
    };
  }

  getLegalActions(state: BackgammonState): BackgammonAction[] {
    if (this.evaluateOutcome(state)?.finished) return [];
    if (state.phase === 'roll') {
      return [{ type: 'ROLL' }];
    }
    return getLegalBackgammonMoves(state);
  }

  validateAction(
    state: BackgammonState,
    action: BackgammonAction
  ): ActionValidationResult {
    if (this.evaluateOutcome(state)?.finished) {
      return { valid: false, reason: 'Match has already ended.' };
    }
    if (action.type === 'RESIGN') {
      return { valid: true };
    }
    if (action.type === 'UNDO') {
      if (state.mode === 'online') {
        return { valid: false, reason: 'Undo is disabled in online matches.' };
      }
      if (state.phase !== 'move' || state.turnUndoStack.length === 0) {
        return { valid: false, reason: 'No checker steps to undo on this roll.' };
      }
      return { valid: true };
    }
    if (action.type === 'ROLL') {
      if (state.phase !== 'roll') {
        return { valid: false, reason: 'Play your remaining dice before rolling again.' };
      }
      return { valid: true };
    }
    if (action.type === 'MOVE') {
      if (state.phase !== 'move') {
        return { valid: false, reason: 'Roll the dice first.' };
      }
      const legal = getLegalBackgammonMoves(state);
      const found = legal.some(
        (m) => m.from === action.from && m.to === action.to && m.die === action.die
      );
      if (!found) {
        if (state.bar[state.turn] > 0 && action.from !== 'bar') {
          return {
            valid: false,
            reason: 'You must re-enter checkers from the bar first.',
          };
        }
        return {
          valid: false,
          reason: 'Illegal move — point blocked or maximum dice rule requires another move.',
        };
      }
      return { valid: true };
    }
    return { valid: false, reason: 'Unknown backgammon action.' };
  }

  applyAction(
    state: BackgammonState,
    action: BackgammonAction
  ): EngineTransition<BackgammonState> {
    const check = this.validateAction(state, action);
    if (!check.valid) {
      throw new Error(check.reason ?? 'Illegal backgammon action.');
    }

    const actorIndex = state.turn === 'w' ? 0 : 1;
    const actorName = state.turn === 'w' ? 'Ivory' : 'Crimson';

    if (action.type === 'RESIGN') {
      return {
        state: { ...state, resignedBy: action.color },
        events: [
          {
            type: 'win',
            label: `${action.color === 'w' ? 'Ivory' : 'Crimson'} resigned.`,
            actorIndex: action.color === 'w' ? 0 : 1,
          },
        ],
      };
    }

    if (action.type === 'UNDO') {
      const prev = state.turnUndoStack[state.turnUndoStack.length - 1];
      return {
        state: {
          ...state,
          points: [...prev.points],
          bar: { ...prev.bar },
          off: { ...prev.off },
          remainingDice: [...prev.remainingDice],
          moveCount: prev.moveCount,
          turnUndoStack: state.turnUndoStack.slice(0, -1),
          history: state.history.slice(1),
        },
        events: [
          {
            type: 'move',
            label: 'Undid checker placement.',
            actorIndex,
          },
        ],
      };
    }

    if (action.type === 'ROLL') {
      const r1 = rollDie(state.rngState, 6);
      const r2 = rollDie(r1.nextState, 6);
      const d1 = r1.roll;
      const d2 = r2.roll;
      const dicePool = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];

      const candidateState: BackgammonState = {
        ...state,
        rngState: r2.nextState,
        phase: 'move',
        lastDice: [d1, d2],
        remainingDice: dicePool,
        turnUndoStack: [],
        moveCount: state.moveCount + 1,
      };

      const legal = getLegalBackgammonMoves(candidateState);
      if (legal.length === 0) {
        const note = `${actorName} rolled ${d1}-${d2} (No legal moves)`;
        const nextTurn: BackgammonColor = state.turn === 'w' ? 'b' : 'w';
        return {
          state: {
            ...candidateState,
            turn: nextTurn,
            phase: 'roll',
            remainingDice: [],
            history: [note, ...state.history].slice(0, 60),
          },
          events: [
            {
              type: 'roll',
              label: `${actorName} rolled ${d1} & ${d2} — blocked, turn passes.`,
              actorIndex,
            },
          ],
        };
      }

      return {
        state: candidateState,
        events: [
          {
            type: 'roll',
            label: `${actorName} rolled ${d1} & ${d2}${d1 === d2 ? ' (Doubles!)' : ''}`,
            actorIndex,
          },
        ],
      };
    }

    // action.type === 'MOVE'
    const snapshot: BackgammonMoveSnapshot = {
      points: [...state.points],
      bar: { ...state.bar },
      off: { ...state.off },
      remainingDice: [...state.remainingDice],
      moveCount: state.moveCount,
    };

    const res = applyRawStep(
      state.points,
      state.bar,
      state.off,
      state.turn,
      action
    );
    const dieIdx = state.remainingDice.indexOf(action.die);
    const nextRemaining = [
      ...state.remainingDice.slice(0, dieIdx),
      ...state.remainingDice.slice(dieIdx + 1),
    ];

    const notation = `${actorName}: ${formatPointLabel(action.from)}→${formatPointLabel(
      action.to
    )}${res.hit ? '*' : ''}`;

    const events: GameEvent[] = [
      {
        type: res.hit ? 'capture' : 'move',
        label: res.hit
          ? `${actorName} hit a blot moving ${formatPointLabel(action.from)} → ${formatPointLabel(action.to)}!`
          : `${actorName} moved ${formatPointLabel(action.from)} → ${formatPointLabel(action.to)}`,
        actorIndex,
      },
    ];

    const midState: BackgammonState = {
      ...state,
      points: res.points,
      bar: res.bar,
      off: res.off,
      remainingDice: nextRemaining,
      turnUndoStack: [...state.turnUndoStack, snapshot],
      history: [notation, ...state.history].slice(0, 60),
      moveCount: state.moveCount + 1,
    };

    const outcome = this.evaluateOutcome(midState);
    if (outcome?.finished) {
      events.push({
        type: 'win',
        label: outcome.reason,
        actorIndex,
      });
      return {
        state: {
          ...midState,
          remainingDice: [],
          turnUndoStack: [],
        },
        events,
      };
    }

    const followUpMoves = getLegalBackgammonMoves(midState);
    if (nextRemaining.length === 0 || followUpMoves.length === 0) {
      return {
        state: {
          ...midState,
          turn: state.turn === 'w' ? 'b' : 'w',
          phase: 'roll',
          remainingDice: [],
          turnUndoStack: [],
        },
        events,
      };
    }

    return { state: midState, events };
  }

  evaluateOutcome(state: BackgammonState): GameOutcome | null {
    if (state.resignedBy) {
      const winnerIndex = state.resignedBy === 'w' ? 1 : 0;
      return {
        finished: true,
        winnerIndex,
        humanOutcome:
          state.mode === 'ai' ? (winnerIndex === 0 ? 'win' : 'loss') : 'win',
        reason: `${state.resignedBy === 'w' ? 'Ivory' : 'Crimson'} resigned.`,
      };
    }

    for (const color of ['w', 'b'] as const) {
      if (state.off[color] >= 15) {
        const opp: BackgammonColor = color === 'w' ? 'b' : 'w';
        const winnerIndex = color === 'w' ? 0 : 1;
        const winnerName = color === 'w' ? 'Ivory' : 'Crimson';

        let multiplier = 1;
        let tier = 'Single Win';
        if (state.off[opp] === 0) {
          const oppInWinnerHome =
            color === 'w'
              ? state.points.slice(0, 6).some((v) => v < 0)
              : state.points.slice(18, 24).some((v) => v > 0);
          if (state.bar[opp] > 0 || oppInWinnerHome) {
            multiplier = 3;
            tier = 'Backgammon (3×)';
          } else {
            multiplier = 2;
            tier = 'Gammon (2×)';
          }
        }

        return {
          finished: true,
          winnerIndex,
          humanOutcome:
            state.mode === 'ai' ? (winnerIndex === 0 ? 'win' : 'loss') : 'win',
          score: multiplier * 100,
          reason: `${winnerName} bore off all 15 checkers — ${tier}!`,
        };
      }
    }

    return null;
  }

  serialize(state: BackgammonState): string {
    return JSON.stringify(state);
  }

  deserialize(raw: string): BackgammonState {
    return JSON.parse(raw) as BackgammonState;
  }
}

export const backgammonEngine = new BackgammonEngine();
