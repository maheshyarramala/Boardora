import type {
  ActionValidationResult,
  EngineTransition,
  GameEngine,
  GameEvent,
  GameOutcome,
  MatchSetupConfig,
} from '../../core/engine';
import type { AIDifficulty, GameMode } from '../../core/types';

export type MorrisColor = 'w' | 'b';
export type MorrisPhase = 'placement' | 'movement' | 'flying';

export type MorrisAction =
  | { type: 'PLACE'; to: number }
  | { type: 'MOVE'; from: number; to: number }
  | { type: 'CAPTURE'; target: number }
  | { type: 'UNDO' }
  | { type: 'RESIGN'; color: MorrisColor };

export interface MorrisSnapshot {
  board: (MorrisColor | null)[];
  turn: MorrisColor;
  inHand: { w: number; b: number };
  pendingCapture: boolean;
  pliesSinceCapture: number;
  moveCount: number;
  capturedByW: number;
  capturedByB: number;
}

export interface NineMensMorrisState {
  version: number;
  mode: GameMode;
  difficulty: AIDifficulty;
  board: (MorrisColor | null)[];
  turn: MorrisColor;
  inHand: { w: number; b: number };
  pendingCapture: boolean;
  pliesSinceCapture: number;
  positionCounts: Record<string, number>;
  history: string[];
  undoStack: MorrisSnapshot[];
  moveCount: number;
  capturedByW: number;
  capturedByB: number;
  resignedBy: MorrisColor | null;
}

export const MORRIS_ADJACENCY: readonly (readonly number[])[] = [
  [1, 7], // 0
  [0, 2, 9], // 1
  [1, 3], // 2
  [2, 4, 11], // 3
  [3, 5], // 4
  [4, 6, 13], // 5
  [5, 7], // 6
  [6, 0, 15], // 7
  [9, 15], // 8
  [8, 10, 1, 17], // 9
  [9, 11], // 10
  [10, 12, 3, 19], // 11
  [11, 13], // 12
  [12, 14, 5, 21], // 13
  [13, 15], // 14
  [14, 8, 7, 23], // 15
  [17, 23], // 16
  [16, 18, 9], // 17
  [17, 19], // 18
  [18, 20, 11], // 19
  [19, 21], // 20
  [20, 22, 13], // 21
  [21, 23], // 22
  [22, 16, 15], // 23
];

export const MORRIS_MILLS: readonly [number, number, number][] = [
  // Outer square
  [0, 1, 2],
  [2, 3, 4],
  [4, 5, 6],
  [6, 7, 0],
  // Middle square
  [8, 9, 10],
  [10, 11, 12],
  [12, 13, 14],
  [14, 15, 8],
  // Inner square
  [16, 17, 18],
  [18, 19, 20],
  [20, 21, 22],
  [22, 23, 16],
  // Radial spokes
  [1, 9, 17],
  [3, 11, 19],
  [5, 13, 21],
  [7, 15, 23],
];

const NODE_LABELS: readonly string[] = [
  'A7', 'D7', 'G7', 'G4', 'G1', 'D1', 'A1', 'A4',
  'B6', 'D6', 'F6', 'F4', 'F2', 'D2', 'B2', 'B4',
  'C5', 'D5', 'E5', 'E4', 'E3', 'D3', 'C3', 'C4',
];

export function countPiecesOnBoard(
  board: readonly (MorrisColor | null)[],
  color: MorrisColor
): number {
  let count = 0;
  for (let i = 0; i < 24; i++) {
    if (board[i] === color) count++;
  }
  return count;
}

export function getPlayerPhase(
  state: Pick<NineMensMorrisState, 'board' | 'inHand'>,
  color: MorrisColor
): MorrisPhase {
  if (state.inHand[color] > 0) return 'placement';
  const onBoard = countPiecesOnBoard(state.board, color);
  return onBoard === 3 ? 'flying' : 'movement';
}

export function isNodeInMill(
  board: readonly (MorrisColor | null)[],
  node: number,
  color: MorrisColor
): boolean {
  if (board[node] !== color) return false;
  for (const [a, b, c] of MORRIS_MILLS) {
    if (a !== node && b !== node && c !== node) continue;
    if (board[a] === color && board[b] === color && board[c] === color) {
      return true;
    }
  }
  return false;
}

export function getCapturableTargets(
  board: readonly (MorrisColor | null)[],
  attacker: MorrisColor
): number[] {
  const defender: MorrisColor = attacker === 'w' ? 'b' : 'w';
  const nonMill: number[] = [];
  const allDefender: number[] = [];

  for (let i = 0; i < 24; i++) {
    if (board[i] !== defender) continue;
    allDefender.push(i);
    if (!isNodeInMill(board, i, defender)) {
      nonMill.push(i);
    }
  }
  return nonMill.length > 0 ? nonMill : allDefender;
}

function serializePositionKey(state: {
  board: readonly (MorrisColor | null)[];
  turn: MorrisColor;
  inHand: { w: number; b: number };
  pendingCapture: boolean;
}): string {
  const b = state.board.map((c) => c ?? '.').join('');
  return `${state.turn}:${state.pendingCapture ? 1 : 0}:${state.inHand.w}-${state.inHand.b}:${b}`;
}

export function getLegalMorrisActions(state: NineMensMorrisState): MorrisAction[] {
  if (state.pendingCapture) {
    return getCapturableTargets(state.board, state.turn).map((target) => ({
      type: 'CAPTURE',
      target,
    }));
  }

  const phase = getPlayerPhase(state, state.turn);
  const actions: MorrisAction[] = [];

  if (phase === 'placement') {
    for (let i = 0; i < 24; i++) {
      if (state.board[i] === null) {
        actions.push({ type: 'PLACE', to: i });
      }
    }
    return actions;
  }

  if (phase === 'flying') {
    const emptyNodes: number[] = [];
    for (let i = 0; i < 24; i++) {
      if (state.board[i] === null) emptyNodes.push(i);
    }
    for (let from = 0; from < 24; from++) {
      if (state.board[from] !== state.turn) continue;
      for (const to of emptyNodes) {
        actions.push({ type: 'MOVE', from, to });
      }
    }
    return actions;
  }

  // Movement phase
  for (let from = 0; from < 24; from++) {
    if (state.board[from] !== state.turn) continue;
    for (const to of MORRIS_ADJACENCY[from]) {
      if (state.board[to] === null) {
        actions.push({ type: 'MOVE', from, to });
      }
    }
  }
  return actions;
}

export class NineMensMorrisEngine
  implements GameEngine<NineMensMorrisState, MorrisAction>
{
  readonly id = 'nine_mens_morris' as const;
  readonly version = 1;

  createInitialState(config: MatchSetupConfig): NineMensMorrisState {
    const board: (MorrisColor | null)[] = Array(24).fill(null);
    return {
      version: this.version,
      mode: config.mode,
      difficulty: config.difficulty,
      board,
      turn: 'w',
      inHand: { w: 9, b: 9 },
      pendingCapture: false,
      pliesSinceCapture: 0,
      positionCounts: {},
      history: [],
      undoStack: [],
      moveCount: 0,
      capturedByW: 0,
      capturedByB: 0,
      resignedBy: null,
    };
  }

  getLegalActions(state: NineMensMorrisState): MorrisAction[] {
    if (this.evaluateOutcome(state)?.finished) return [];
    return getLegalMorrisActions(state);
  }

  validateAction(
    state: NineMensMorrisState,
    action: MorrisAction
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
      if (state.undoStack.length === 0) {
        return { valid: false, reason: 'No moves to undo.' };
      }
      return { valid: true };
    }

    if (state.pendingCapture) {
      if (action.type !== 'CAPTURE') {
        return {
          valid: false,
          reason: 'Mill formed! You must capture an opponent piece first.',
        };
      }
      const validTargets = getCapturableTargets(state.board, state.turn);
      if (!validTargets.includes(action.target)) {
        return {
          valid: false,
          reason:
            'Cannot capture a piece in an active mill while non-mill pieces exist.',
        };
      }
      return { valid: true };
    }

    const phase = getPlayerPhase(state, state.turn);
    if (action.type === 'PLACE') {
      if (phase !== 'placement') {
        return {
          valid: false,
          reason: 'All pieces have already been placed.',
        };
      }
      if (action.to < 0 || action.to >= 24 || state.board[action.to] !== null) {
        return { valid: false, reason: 'Target intersection is not empty.' };
      }
      return { valid: true };
    }

    if (action.type === 'MOVE') {
      if (phase === 'placement') {
        return {
          valid: false,
          reason: 'Place all 9 pieces before moving pieces along the board.',
        };
      }
      if (
        action.from < 0 ||
        action.from >= 24 ||
        action.to < 0 ||
        action.to >= 24
      ) {
        return { valid: false, reason: 'Intersection out of range.' };
      }
      if (state.board[action.from] !== state.turn) {
        return { valid: false, reason: 'Select one of your own pieces.' };
      }
      if (state.board[action.to] !== null) {
        return { valid: false, reason: 'Destination intersection is occupied.' };
      }
      if (
        phase === 'movement' &&
        !MORRIS_ADJACENCY[action.from].includes(action.to)
      ) {
        return {
          valid: false,
          reason: 'You may only slide to an adjacent intersection.',
        };
      }
      return { valid: true };
    }

    return { valid: false, reason: 'Illegal Nine Men’s Morris action.' };
  }

  applyAction(
    state: NineMensMorrisState,
    action: MorrisAction
  ): EngineTransition<NineMensMorrisState> {
    const check = this.validateAction(state, action);
    if (!check.valid) {
      throw new Error(check.reason ?? 'Illegal Nine Men’s Morris action.');
    }

    if (action.type === 'RESIGN') {
      const winnerLabel = action.color === 'w' ? 'Obsidian' : 'Ivory Gold';
      return {
        state: { ...state, resignedBy: action.color },
        events: [
          {
            type: 'win',
            label: `${action.color === 'w' ? 'Ivory Gold' : 'Obsidian'} resigned — ${winnerLabel} wins.`,
            actorIndex: action.color === 'w' ? 0 : 1,
          },
        ],
      };
    }

    if (action.type === 'UNDO') {
      let targetIdx = state.undoStack.length - 1;
      if (state.mode === 'ai') {
        while (targetIdx > 0 && state.undoStack[targetIdx].turn !== 'w') {
          targetIdx--;
        }
      }
      const snap = state.undoStack[targetIdx];
      return {
        state: {
          ...state,
          board: [...snap.board],
          turn: snap.turn,
          inHand: { ...snap.inHand },
          pendingCapture: snap.pendingCapture,
          pliesSinceCapture: snap.pliesSinceCapture,
          moveCount: snap.moveCount,
          capturedByW: snap.capturedByW,
          capturedByB: snap.capturedByB,
          undoStack: state.undoStack.slice(0, targetIdx),
          history: state.history.slice(state.undoStack.length - targetIdx),
        },
        events: [
          {
            type: 'move',
            label: 'Undid last move.',
            actorIndex: snap.turn === 'w' ? 0 : 1,
          },
        ],
      };
    }

    const snap: MorrisSnapshot = {
      board: [...state.board],
      turn: state.turn,
      inHand: { ...state.inHand },
      pendingCapture: state.pendingCapture,
      pliesSinceCapture: state.pliesSinceCapture,
      moveCount: state.moveCount,
      capturedByW: state.capturedByW,
      capturedByB: state.capturedByB,
    };

    const nextBoard = [...state.board];
    const nextInHand = { ...state.inHand };
    const nextTurnAfter: MorrisColor = state.turn === 'w' ? 'b' : 'w';
    const actorName = state.turn === 'w' ? 'Ivory Gold' : 'Obsidian';
    const actorIndex = state.turn === 'w' ? 0 : 1;

    let nextTurn = state.turn;
    let nextPendingCapture = false;
    let nextPliesSinceCapture = state.pliesSinceCapture;
    let nextCapturedByW = state.capturedByW;
    let nextCapturedByB = state.capturedByB;
    let notation = '';
    const events: GameEvent[] = [];

    if (action.type === 'CAPTURE') {
      nextBoard[action.target] = null;
      if (state.turn === 'w') nextCapturedByW++;
      else nextCapturedByB++;
      nextTurn = nextTurnAfter;
      nextPliesSinceCapture = 0;
      notation = `×${NODE_LABELS[action.target]}`;
      events.push({
        type: 'capture',
        label: `${actorName} captured ${NODE_LABELS[action.target]}`,
        actorIndex,
      });
    } else if (action.type === 'PLACE') {
      nextBoard[action.to] = state.turn;
      nextInHand[state.turn]--;
      const formedMill = isNodeInMill(nextBoard, action.to, state.turn);
      notation = `${NODE_LABELS[action.to]}${formedMill ? ' (Mill)' : ''}`;
      if (formedMill && getCapturableTargets(nextBoard, state.turn).length > 0) {
        nextPendingCapture = true;
        nextTurn = state.turn;
        events.push({
          type: 'mill',
          label: `${actorName} placed ${NODE_LABELS[action.to]} and formed a Mill!`,
          actorIndex,
        });
      } else {
        nextTurn = nextTurnAfter;
        events.push({
          type: 'move',
          label: `${actorName} placed at ${NODE_LABELS[action.to]}`,
          actorIndex,
        });
      }
    } else if (action.type === 'MOVE') {
      const phase = getPlayerPhase(state, state.turn);
      nextBoard[action.from] = null;
      nextBoard[action.to] = state.turn;
      const formedMill = isNodeInMill(nextBoard, action.to, state.turn);
      notation = `${NODE_LABELS[action.from]}${phase === 'flying' ? '✈' : '→'}${NODE_LABELS[action.to]}${formedMill ? ' (Mill)' : ''}`;
      if (formedMill && getCapturableTargets(nextBoard, state.turn).length > 0) {
        nextPendingCapture = true;
        nextTurn = state.turn;
        events.push({
          type: 'mill',
          label: `${actorName} moved to ${NODE_LABELS[action.to]} and formed a Mill!`,
          actorIndex,
        });
      } else {
        nextTurn = nextTurnAfter;
        if (nextInHand.w === 0 && nextInHand.b === 0) {
          nextPliesSinceCapture++;
        }
        events.push({
          type: 'move',
          label: `${actorName} moved ${NODE_LABELS[action.from]} → ${NODE_LABELS[action.to]}`,
          actorIndex,
        });
      }
    }

    const nextCounts = { ...state.positionCounts };
    if (nextInHand.w === 0 && nextInHand.b === 0 && !nextPendingCapture) {
      const posKey = serializePositionKey({
        board: nextBoard,
        turn: nextTurn,
        inHand: nextInHand,
        pendingCapture: nextPendingCapture,
      });
      nextCounts[posKey] = (nextCounts[posKey] ?? 0) + 1;
    }

    const nextState: NineMensMorrisState = {
      ...state,
      board: nextBoard,
      turn: nextTurn,
      inHand: nextInHand,
      pendingCapture: nextPendingCapture,
      pliesSinceCapture: nextPliesSinceCapture,
      positionCounts: nextCounts,
      history: [notation, ...state.history].slice(0, 60),
      undoStack: [...state.undoStack.slice(-29), snap],
      moveCount: state.moveCount + 1,
      capturedByW: nextCapturedByW,
      capturedByB: nextCapturedByB,
    };

    const outcome = this.evaluateOutcome(nextState);
    if (outcome?.finished) {
      events.push({
        type: outcome.humanOutcome === 'draw' ? 'draw' : 'win',
        label: outcome.reason,
        actorIndex,
      });
    }

    return { state: nextState, events };
  }

  evaluateOutcome(state: NineMensMorrisState): GameOutcome | null {
    if (state.resignedBy) {
      const winnerIndex = state.resignedBy === 'w' ? 1 : 0;
      return {
        finished: true,
        winnerIndex,
        humanOutcome:
          state.mode === 'ai' ? (winnerIndex === 0 ? 'win' : 'loss') : 'win',
        reason: `${state.resignedBy === 'w' ? 'Ivory Gold' : 'Obsidian'} resigned.`,
      };
    }

    if (state.pendingCapture) return null;

    // 2-piece reduction check (once placement completes for that color)
    if (state.inHand.b === 0 && countPiecesOnBoard(state.board, 'b') < 3) {
      return {
        finished: true,
        winnerIndex: 0,
        humanOutcome: 'win',
        reason: 'Ivory Gold reduced Obsidian below 3 pieces.',
      };
    }
    if (state.inHand.w === 0 && countPiecesOnBoard(state.board, 'w') < 3) {
      return {
        finished: true,
        winnerIndex: 1,
        humanOutcome: state.mode === 'ai' ? 'loss' : 'win',
        reason: 'Obsidian reduced Ivory Gold below 3 pieces.',
      };
    }

    // No legal moves check (blockade)
    const legal = getLegalMorrisActions(state);
    if (legal.length === 0) {
      const winnerIndex = state.turn === 'w' ? 1 : 0;
      const winnerName = winnerIndex === 0 ? 'Ivory Gold' : 'Obsidian';
      return {
        finished: true,
        winnerIndex,
        humanOutcome:
          state.mode === 'ai' ? (winnerIndex === 0 ? 'win' : 'loss') : 'win',
        reason: `${winnerName} wins — opponent is blocked with no legal moves.`,
      };
    }

    if (state.pliesSinceCapture >= 50) {
      return {
        finished: true,
        winnerIndex: null,
        humanOutcome: 'draw',
        reason: 'Draw by 50 movement plies without a capture.',
      };
    }

    if (state.inHand.w === 0 && state.inHand.b === 0) {
      const key = serializePositionKey(state);
      if ((state.positionCounts[key] ?? 0) >= 3) {
        return {
          finished: true,
          winnerIndex: null,
          humanOutcome: 'draw',
          reason: 'Draw by threefold position repetition.',
        };
      }
    }

    return null;
  }

  serialize(state: NineMensMorrisState): string {
    return JSON.stringify(state);
  }

  deserialize(raw: string): NineMensMorrisState {
    return JSON.parse(raw) as NineMensMorrisState;
  }
}

export const nineMensMorrisEngine = new NineMensMorrisEngine();
