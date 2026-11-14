import type {
  ActionValidationResult,
  EngineTransition,
  GameEngine,
  GameOutcome,
  MatchSetupConfig,
} from '../../core/engine';

export type PegLayoutId = 'english' | 'european' | 'diamond';
export type PegCell = 'invalid' | 'empty' | 'peg';

export interface PegCoord {
  r: number;
  c: number;
}

export interface PegJumpAction {
  type: 'JUMP';
  from: PegCoord;
  to: PegCoord;
}

export type PegSolitaireAction =
  | PegJumpAction
  | { type: 'UNDO' }
  | { type: 'RESET_LAYOUT'; layoutId: PegLayoutId };

export interface PegUndoSnapshot {
  board: PegCell[][];
  moveCount: number;
  pegsRemaining: number;
}

export interface PegSolitaireState {
  version: number;
  layoutId: PegLayoutId;
  board: PegCell[][];
  initialPegs: number;
  pegsRemaining: number;
  moveCount: number;
  history: string[];
  undoStack: PegUndoSnapshot[];
}

export const PEG_LAYOUT_META: Record<
  PegLayoutId,
  { name: string; holes: number; description: string }
> = {
  english: {
    name: 'English Cross',
    holes: 33,
    description: 'Traditional 33-hole cross board with center cavity.',
  },
  european: {
    name: 'European Octagon',
    holes: 37,
    description: 'Expanded 37-hole French board with four extra corner pockets.',
  },
  diamond: {
    name: 'Diamond 25',
    holes: 25,
    description: 'Crisp 25-hole diamond layout for quick tactical runs.',
  },
};

function isHoleValidForLayout(layoutId: PegLayoutId, r: number, c: number): boolean {
  if (r < 0 || r >= 7 || c < 0 || c >= 7) return false;
  if (layoutId === 'english') {
    const inRowArm = r >= 2 && r <= 4;
    const inColArm = c >= 2 && c <= 4;
    return inRowArm || inColArm;
  }
  if (layoutId === 'european') {
    const inRowArm = r >= 2 && r <= 4;
    const inColArm = c >= 2 && c <= 4;
    const isCornerPocket =
      (r === 1 || r === 5) && (c === 1 || c === 5);
    return inRowArm || inColArm || isCornerPocket;
  }
  // diamond
  return Math.abs(r - 3) + Math.abs(c - 3) <= 3;
}

export function buildPegBoard(layoutId: PegLayoutId): {
  board: PegCell[][];
  initialPegs: number;
} {
  let initialPegs = 0;
  const board: PegCell[][] = Array.from({ length: 7 }, (_, r) =>
    Array.from({ length: 7 }, (_, c) => {
      if (!isHoleValidForLayout(layoutId, r, c)) return 'invalid';
      if (r === 3 && c === 3) return 'empty';
      initialPegs++;
      return 'peg';
    })
  );
  return { board, initialPegs };
}

function cloneBoard(board: PegCell[][]): PegCell[][] {
  return board.map((row) => [...row]);
}

function formatCoord(p: PegCoord): string {
  return `${String.fromCharCode(65 + p.c)}${7 - p.r}`;
}

export function getLegalPegJumps(board: PegCell[][]): PegJumpAction[] {
  const jumps: PegJumpAction[] = [];
  const dirs = [
    [-2, 0],
    [2, 0],
    [0, -2],
    [0, 2],
  ] as const;

  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      if (board[r][c] !== 'peg') continue;
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= 7 || nc < 0 || nc >= 7) continue;
        const mr = r + dr / 2;
        const mc = c + dc / 2;
        if (board[mr][mc] === 'peg' && board[nr][nc] === 'empty') {
          jumps.push({
            type: 'JUMP',
            from: { r, c },
            to: { r: nr, c: nc },
          });
        }
      }
    }
  }
  return jumps;
}

export function computePegScore(state: PegSolitaireState): number {
  const cleared = Math.max(0, state.initialPegs - state.pegsRemaining);
  let score = cleared * 100;
  if (state.pegsRemaining === 1) {
    score += state.board[3][3] === 'peg' ? 1000 : 500;
  }
  return score;
}

function resolveLayoutId(variant?: string): PegLayoutId {
  if (variant === 'european' || variant === 'diamond') return variant;
  return 'english';
}

export class PegSolitaireEngine
  implements GameEngine<PegSolitaireState, PegSolitaireAction>
{
  readonly id = 'peg_solitaire' as const;
  readonly version = 1;

  createInitialState(config: MatchSetupConfig): PegSolitaireState {
    const layoutId = resolveLayoutId(config.variant);
    const { board, initialPegs } = buildPegBoard(layoutId);
    return {
      version: this.version,
      layoutId,
      board,
      initialPegs,
      pegsRemaining: initialPegs,
      moveCount: 0,
      history: [],
      undoStack: [],
    };
  }

  getLegalActions(state: PegSolitaireState): PegSolitaireAction[] {
    if (this.evaluateOutcome(state)?.finished) return [];
    return getLegalPegJumps(state.board);
  }

  validateAction(
    state: PegSolitaireState,
    action: PegSolitaireAction
  ): ActionValidationResult {
    if (action.type === 'RESET_LAYOUT') {
      return { valid: true };
    }
    if (action.type === 'UNDO') {
      if (state.undoStack.length === 0) {
        return { valid: false, reason: 'No jumps to undo.' };
      }
      return { valid: true };
    }
    if (this.evaluateOutcome(state)?.finished) {
      return { valid: false, reason: 'Puzzle has already ended.' };
    }
    if (action.type === 'JUMP') {
      const { from, to } = action;
      if (
        from.r < 0 ||
        from.r >= 7 ||
        from.c < 0 ||
        from.c >= 7 ||
        to.r < 0 ||
        to.r >= 7 ||
        to.c < 0 ||
        to.c >= 7
      ) {
        return { valid: false, reason: 'Coordinates are out of bounds.' };
      }
      if (state.board[from.r][from.c] !== 'peg') {
        return { valid: false, reason: 'Select an occupied peg to jump.' };
      }
      if (state.board[to.r][to.c] !== 'empty') {
        return { valid: false, reason: 'Destination hole must be empty.' };
      }
      const dr = to.r - from.r;
      const dc = to.c - from.c;
      const isOrthogonalJump =
        (Math.abs(dr) === 2 && dc === 0) || (dr === 0 && Math.abs(dc) === 2);
      if (!isOrthogonalJump) {
        return {
          valid: false,
          reason: 'Jumps must travel exactly 2 holes horizontally or vertically.',
        };
      }
      const midR = from.r + dr / 2;
      const midC = from.c + dc / 2;
      if (state.board[midR][midC] !== 'peg') {
        return { valid: false, reason: 'You must jump over an adjacent peg.' };
      }
      return { valid: true };
    }
    return { valid: false, reason: 'Unknown peg solitaire action.' };
  }

  applyAction(
    state: PegSolitaireState,
    action: PegSolitaireAction
  ): EngineTransition<PegSolitaireState> {
    const check = this.validateAction(state, action);
    if (!check.valid) {
      throw new Error(check.reason ?? 'Illegal peg solitaire move.');
    }

    if (action.type === 'RESET_LAYOUT') {
      const { board, initialPegs } = buildPegBoard(action.layoutId);
      return {
        state: {
          version: this.version,
          layoutId: action.layoutId,
          board,
          initialPegs,
          pegsRemaining: initialPegs,
          moveCount: 0,
          history: [],
          undoStack: [],
        },
        events: [
          {
            type: 'move',
            label: `Reset board to ${PEG_LAYOUT_META[action.layoutId].name}.`,
            actorIndex: 0,
          },
        ],
      };
    }

    if (action.type === 'UNDO') {
      const prev = state.undoStack[state.undoStack.length - 1];
      return {
        state: {
          ...state,
          board: cloneBoard(prev.board),
          moveCount: prev.moveCount,
          pegsRemaining: prev.pegsRemaining,
          undoStack: state.undoStack.slice(0, -1),
          history: state.history.slice(1),
        },
        events: [{ type: 'move', label: 'Undid last jump.', actorIndex: 0 }],
      };
    }

    const snapshot: PegUndoSnapshot = {
      board: cloneBoard(state.board),
      moveCount: state.moveCount,
      pegsRemaining: state.pegsRemaining,
    };

    const nextBoard = cloneBoard(state.board);
    const midR = (action.from.r + action.to.r) / 2;
    const midC = (action.from.c + action.to.c) / 2;

    nextBoard[action.from.r][action.from.c] = 'empty';
    nextBoard[midR][midC] = 'empty';
    nextBoard[action.to.r][action.to.c] = 'peg';

    const notation = `${formatCoord(action.from)} → ${formatCoord(action.to)}`;
    const nextState: PegSolitaireState = {
      ...state,
      board: nextBoard,
      pegsRemaining: state.pegsRemaining - 1,
      moveCount: state.moveCount + 1,
      history: [notation, ...state.history].slice(0, 60),
      undoStack: [...state.undoStack, snapshot],
    };

    const events: EngineTransition<PegSolitaireState>['events'] = [
      {
        type: 'capture',
        label: `Jumped ${notation} (${nextState.pegsRemaining} left)`,
        actorIndex: 0,
      },
    ];

    const outcome = this.evaluateOutcome(nextState);
    if (outcome?.finished) {
      events.push({
        type: outcome.humanOutcome === 'win' ? 'win' : 'draw',
        label: outcome.reason,
        actorIndex: 0,
      });
    }

    return { state: nextState, events };
  }

  evaluateOutcome(state: PegSolitaireState): GameOutcome | null {
    if (state.pegsRemaining === 1) {
      const inCenter = state.board[3][3] === 'peg';
      return {
        finished: true,
        winnerIndex: 0,
        humanOutcome: 'win',
        score: computePegScore(state),
        reason: inCenter
          ? 'Grand Solitaire! 1 peg remaining in the center cavity.'
          : 'Solitaire Victory! Only 1 peg remains on the board.',
      };
    }

    if (getLegalPegJumps(state.board).length === 0) {
      return {
        finished: true,
        winnerIndex: null,
        humanOutcome: 'loss',
        score: computePegScore(state),
        reason: `No more legal jumps — ${state.pegsRemaining} pegs remaining.`,
      };
    }

    return null;
  }

  serialize(state: PegSolitaireState): string {
    return JSON.stringify(state);
  }

  deserialize(raw: string): PegSolitaireState {
    return JSON.parse(raw) as PegSolitaireState;
  }
}

export const pegSolitaireEngine = new PegSolitaireEngine();
