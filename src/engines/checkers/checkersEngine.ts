import type {
  ActionValidationResult,
  EngineTransition,
  GameEngine,
  GameEvent,
  GameOutcome,
  MatchSetupConfig,
} from '../../core/engine';
import type { AIDifficulty, GameMode } from '../../core/types';

export type CheckerColor = 'r' | 'b';

export interface CheckerPiece {
  color: CheckerColor;
  king: boolean;
}

export interface SquareCoord {
  r: number;
  c: number;
}

export interface CheckersMoveAction {
  type: 'MOVE';
  from: SquareCoord;
  to: SquareCoord;
}

export type CheckersAction =
  | CheckersMoveAction
  | { type: 'UNDO' }
  | { type: 'RESIGN'; color: CheckerColor };

export interface CheckersSnapshot {
  board: (CheckerPiece | null)[][];
  turn: CheckerColor;
  forcedPiece: SquareCoord | null;
  pliesSinceProgress: number;
  moveCount: number;
  capturedByRed: number;
  capturedByBlack: number;
}

export interface CheckersState {
  version: number;
  mode: GameMode;
  difficulty: AIDifficulty;
  mandatoryCapture: boolean;
  board: (CheckerPiece | null)[][];
  turn: CheckerColor;
  forcedPiece: SquareCoord | null;
  pliesSinceProgress: number;
  positionCounts: Record<string, number>;
  history: string[];
  undoStack: CheckersSnapshot[];
  moveCount: number;
  capturedByRed: number;
  capturedByBlack: number;
  resignedBy: CheckerColor | null;
}

export function coordToAlgebraic(pos: SquareCoord): string {
  const file = String.fromCharCode(97 + pos.c);
  const rank = String(8 - pos.r);
  return `${file}${rank}`;
}

export function serializeBoardKey(
  board: (CheckerPiece | null)[][],
  turn: CheckerColor
): string {
  let key = turn + ':';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) key += '.';
      else key += p.color === 'r' ? (p.king ? 'R' : 'r') : p.king ? 'B' : 'b';
    }
  }
  return key;
}

function cloneBoard(
  board: (CheckerPiece | null)[][]
): (CheckerPiece | null)[][] {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function getDirections(piece: CheckerPiece): readonly [number, number][] {
  if (piece.king) {
    return [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];
  }
  return piece.color === 'r'
    ? [
        [-1, -1],
        [-1, 1],
      ]
    : [
        [1, -1],
        [1, 1],
      ];
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

export function getCapturesFromSquare(
  board: (CheckerPiece | null)[][],
  r: number,
  c: number
): CheckersMoveAction[] {
  const piece = board[r][c];
  if (!piece) return [];

  const jumps: CheckersMoveAction[] = [];
  for (const [dr, dc] of getDirections(piece)) {
    const midR = r + dr;
    const midC = c + dc;
    const landR = r + dr * 2;
    const landC = c + dc * 2;
    if (!inBounds(landR, landC)) continue;
    const midPiece = board[midR][midC];
    if (midPiece && midPiece.color !== piece.color && !board[landR][landC]) {
      jumps.push({
        type: 'MOVE',
        from: { r, c },
        to: { r: landR, c: landC },
      });
    }
  }
  return jumps;
}

function getSimpleMovesFromSquare(
  board: (CheckerPiece | null)[][],
  r: number,
  c: number
): CheckersMoveAction[] {
  const piece = board[r][c];
  if (!piece) return [];

  const moves: CheckersMoveAction[] = [];
  for (const [dr, dc] of getDirections(piece)) {
    const nr = r + dr;
    const nc = c + dc;
    if (inBounds(nr, nc) && !board[nr][nc]) {
      moves.push({
        type: 'MOVE',
        from: { r, c },
        to: { r: nr, c: nc },
      });
    }
  }
  return moves;
}

export function getLegalCheckersMoves(state: CheckersState): CheckersMoveAction[] {
  if (state.forcedPiece) {
    return getCapturesFromSquare(
      state.board,
      state.forcedPiece.r,
      state.forcedPiece.c
    );
  }

  const allCaptures: CheckersMoveAction[] = [];
  const allSimple: CheckersMoveAction[] = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p || p.color !== state.turn) continue;
      allCaptures.push(...getCapturesFromSquare(state.board, r, c));
      allSimple.push(...getSimpleMovesFromSquare(state.board, r, c));
    }
  }

  if (state.mandatoryCapture && allCaptures.length > 0) {
    return allCaptures;
  }
  return [...allCaptures, ...allSimple];
}

export function createStandardCheckersBoard(): (CheckerPiece | null)[][] {
  const board: (CheckerPiece | null)[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => null)
  );
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 !== 1) continue;
      if (r < 3) board[r][c] = { color: 'b', king: false };
      else if (r > 4) board[r][c] = { color: 'r', king: false };
    }
  }
  return board;
}

export class CheckersEngine implements GameEngine<CheckersState, CheckersAction> {
  readonly id = 'checkers' as const;
  readonly version = 1;

  createInitialState(config: MatchSetupConfig): CheckersState {
    const board = createStandardCheckersBoard();
    const key = serializeBoardKey(board, 'r');
    return {
      version: this.version,
      mode: config.mode,
      difficulty: config.difficulty,
      mandatoryCapture: config.variant !== 'casual',
      board,
      turn: 'r',
      forcedPiece: null,
      pliesSinceProgress: 0,
      positionCounts: { [key]: 1 },
      history: [],
      undoStack: [],
      moveCount: 0,
      capturedByRed: 0,
      capturedByBlack: 0,
      resignedBy: null,
    };
  }

  getLegalActions(state: CheckersState): CheckersAction[] {
    if (this.evaluateOutcome(state)?.finished) return [];
    return getLegalCheckersMoves(state);
  }

  validateAction(state: CheckersState, action: CheckersAction): ActionValidationResult {
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
    if (action.type === 'MOVE') {
      const legal = getLegalCheckersMoves(state);
      const match = legal.some(
        (m) =>
          m.from.r === action.from.r &&
          m.from.c === action.from.c &&
          m.to.r === action.to.r &&
          m.to.c === action.to.c
      );
      if (!match) {
        if (state.forcedPiece) {
          return {
            valid: false,
            reason: 'You must complete the multi-jump capture chain with the active piece.',
          };
        }
        if (
          state.mandatoryCapture &&
          legal.some((m) => Math.abs(m.to.r - m.from.r) === 2)
        ) {
          return {
            valid: false,
            reason: 'A capture jump is mandatory under tournament rules.',
          };
        }
        return { valid: false, reason: 'Illegal diagonal checkers move.' };
      }
      return { valid: true };
    }
    return { valid: false, reason: 'Unknown checkers action.' };
  }

  applyAction(state: CheckersState, action: CheckersAction): EngineTransition<CheckersState> {
    const check = this.validateAction(state, action);
    if (!check.valid) {
      throw new Error(check.reason ?? 'Illegal checkers action.');
    }

    if (action.type === 'RESIGN') {
      return {
        state: { ...state, resignedBy: action.color },
        events: [
          {
            type: 'win',
            label: `${action.color === 'r' ? 'Crimson' : 'Walnut'} resigned.`,
            actorIndex: action.color === 'r' ? 0 : 1,
          },
        ],
      };
    }

    if (action.type === 'UNDO') {
      let targetIdx = state.undoStack.length - 1;
      if (state.mode === 'ai') {
        while (targetIdx > 0 && state.undoStack[targetIdx].turn !== 'r') {
          targetIdx--;
        }
      }
      const snap = state.undoStack[targetIdx];
      return {
        state: {
          ...state,
          board: cloneBoard(snap.board),
          turn: snap.turn,
          forcedPiece: snap.forcedPiece,
          pliesSinceProgress: snap.pliesSinceProgress,
          moveCount: snap.moveCount,
          capturedByRed: snap.capturedByRed,
          capturedByBlack: snap.capturedByBlack,
          undoStack: state.undoStack.slice(0, targetIdx),
          history: state.history.slice(state.undoStack.length - targetIdx),
        },
        events: [
          {
            type: 'move',
            label: 'Undid last move.',
            actorIndex: snap.turn === 'r' ? 0 : 1,
          },
        ],
      };
    }

    const snap: CheckersSnapshot = {
      board: cloneBoard(state.board),
      turn: state.turn,
      forcedPiece: state.forcedPiece ? { ...state.forcedPiece } : null,
      pliesSinceProgress: state.pliesSinceProgress,
      moveCount: state.moveCount,
      capturedByRed: state.capturedByRed,
      capturedByBlack: state.capturedByBlack,
    };

    const nextBoard = cloneBoard(state.board);
    const movingPiece = nextBoard[action.from.r][action.from.c]!;
    nextBoard[action.from.r][action.from.c] = null;

    const isCapture = Math.abs(action.to.r - action.from.r) === 2;
    if (isCapture) {
      const midR = (action.from.r + action.to.r) / 2;
      const midC = (action.from.c + action.to.c) / 2;
      nextBoard[midR][midC] = null;
    }

    const crownedNow =
      !movingPiece.king &&
      ((movingPiece.color === 'r' && action.to.r === 0) ||
        (movingPiece.color === 'b' && action.to.r === 7));

    nextBoard[action.to.r][action.to.c] = {
      color: movingPiece.color,
      king: movingPiece.king || crownedNow,
    };

    const nextCapturedByRed =
      state.capturedByRed + (isCapture && state.turn === 'r' ? 1 : 0);
    const nextCapturedByBlack =
      state.capturedByBlack + (isCapture && state.turn === 'b' ? 1 : 0);

    // Multi-jump continues only if capture occurred, piece didn't just crown, and further captures exist
    const followUpJumps =
      isCapture && !crownedNow
        ? getCapturesFromSquare(nextBoard, action.to.r, action.to.c)
        : [];
    const continueChain = followUpJumps.length > 0;
    const nextTurn: CheckerColor = continueChain
      ? state.turn
      : state.turn === 'r'
      ? 'b'
      : 'r';
    const nextForced = continueChain ? { ...action.to } : null;

    const resetProgress = isCapture || !movingPiece.king;
    const nextPlies = resetProgress ? 0 : state.pliesSinceProgress + 1;

    const posKey = serializeBoardKey(nextBoard, nextTurn);
    const nextPosCounts = {
      ...state.positionCounts,
      [posKey]: (state.positionCounts[posKey] ?? 0) + 1,
    };

    const notation = `${coordToAlgebraic(action.from)}${isCapture ? '×' : '-'}${coordToAlgebraic(
      action.to
    )}${crownedNow ? ' (K)' : ''}`;

    const actorIndex = state.turn === 'r' ? 0 : 1;
    const events: GameEvent[] = [
      {
        type: isCapture ? 'capture' : crownedNow ? 'promote' : 'move',
        label: `${state.turn === 'r' ? 'Crimson' : 'Walnut'} played ${notation}`,
        actorIndex,
      },
    ];

    const nextState: CheckersState = {
      ...state,
      board: nextBoard,
      turn: nextTurn,
      forcedPiece: nextForced,
      pliesSinceProgress: nextPlies,
      positionCounts: nextPosCounts,
      history: [notation, ...state.history].slice(0, 60),
      undoStack: [...state.undoStack.slice(-19), snap],
      moveCount: state.moveCount + 1,
      capturedByRed: nextCapturedByRed,
      capturedByBlack: nextCapturedByBlack,
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

  evaluateOutcome(state: CheckersState): GameOutcome | null {
    if (state.resignedBy) {
      const winnerIndex = state.resignedBy === 'r' ? 1 : 0;
      const humanOutcome =
        state.mode === 'ai' ? (winnerIndex === 0 ? 'win' : 'loss') : 'win';
      return {
        finished: true,
        winnerIndex,
        humanOutcome,
        reason: `${state.resignedBy === 'r' ? 'Crimson' : 'Walnut'} resigned.`,
      };
    }

    let redCount = 0;
    let blackCount = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = state.board[r][c];
        if (!p) continue;
        if (p.color === 'r') redCount++;
        else blackCount++;
      }
    }

    if (redCount === 0) {
      return {
        finished: true,
        winnerIndex: 1,
        humanOutcome: state.mode === 'ai' ? 'loss' : 'win',
        reason: 'Walnut captured all Crimson pieces.',
      };
    }
    if (blackCount === 0) {
      return {
        finished: true,
        winnerIndex: 0,
        humanOutcome: 'win',
        reason: 'Crimson captured all Walnut pieces.',
      };
    }

    const legal = getLegalCheckersMoves(state);
    if (legal.length === 0) {
      const winnerIndex = state.turn === 'r' ? 1 : 0;
      const winnerLabel = winnerIndex === 0 ? 'Crimson' : 'Walnut';
      return {
        finished: true,
        winnerIndex,
        humanOutcome:
          state.mode === 'ai' ? (winnerIndex === 0 ? 'win' : 'loss') : 'win',
        reason: `${winnerLabel} wins — opponent has no legal moves.`,
      };
    }

    if (state.pliesSinceProgress >= 40) {
      return {
        finished: true,
        winnerIndex: null,
        humanOutcome: 'draw',
        reason: 'Draw by 40-move rule without capture or pawn advance.',
      };
    }

    const currentKey = serializeBoardKey(state.board, state.turn);
    if ((state.positionCounts[currentKey] ?? 0) >= 3) {
      return {
        finished: true,
        winnerIndex: null,
        humanOutcome: 'draw',
        reason: 'Draw by threefold position repetition.',
      };
    }

    return null;
  }

  serialize(state: CheckersState): string {
    return JSON.stringify(state);
  }

  deserialize(raw: string): CheckersState {
    return JSON.parse(raw) as CheckersState;
  }
}

export const checkersEngine = new CheckersEngine();
