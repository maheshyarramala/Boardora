import { Chess, type Move, type PieceSymbol } from 'chess.js';
import type {
  ActionValidationResult,
  EngineTransition,
  GameEngine,
  GameEvent,
  GameOutcome,
  MatchSetupConfig,
} from '../../core/engine';
import type { AIDifficulty, GameMode } from '../../core/types';

export interface ChessMoveRecord {
  from: string;
  to: string;
  san: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
  color: 'w' | 'b';
  captured?: PieceSymbol;
  fenAfter: string;
}

export interface ChessState {
  version: number;
  mode: GameMode;
  difficulty: AIDifficulty;
  initialFen: string;
  fen: string;
  history: ChessMoveRecord[];
  moveCount: number;
  resignedBy: 'w' | 'b' | null;
}

export type ChessAction =
  | { type: 'MOVE'; from: string; to: string; promotion?: 'q' | 'r' | 'b' | 'n' }
  | { type: 'UNDO' }
  | { type: 'RESIGN'; color: 'w' | 'b' };

export function reconstructChessInstance(state: ChessState): Chess {
  const chess = new Chess(state.initialFen);
  for (const m of state.history) {
    chess.move({
      from: m.from,
      to: m.to,
      promotion: m.promotion,
    });
  }
  return chess;
}

export function getCapturedPiecesFromHistory(history: readonly ChessMoveRecord[]): {
  capturedByWhite: PieceSymbol[];
  capturedByBlack: PieceSymbol[];
} {
  const capturedByWhite: PieceSymbol[] = [];
  const capturedByBlack: PieceSymbol[] = [];
  for (const m of history) {
    if (m.captured) {
      if (m.color === 'w') capturedByWhite.push(m.captured);
      else capturedByBlack.push(m.captured);
    }
  }
  return { capturedByWhite, capturedByBlack };
}

export class ChessEngine implements GameEngine<ChessState, ChessAction> {
  readonly id = 'chess' as const;
  readonly version = 1;

  createInitialState(config: MatchSetupConfig): ChessState {
    const chess = new Chess();
    return {
      version: this.version,
      mode: config.mode,
      difficulty: config.difficulty,
      initialFen: chess.fen(),
      fen: chess.fen(),
      history: [],
      moveCount: 0,
      resignedBy: null,
    };
  }

  getLegalActions(state: ChessState): ChessAction[] {
    if (this.evaluateOutcome(state)?.finished) return [];
    const chess = reconstructChessInstance(state);
    const verboseMoves = chess.moves({ verbose: true }) as Move[];
    return verboseMoves.map((m) => ({
      type: 'MOVE' as const,
      from: m.from,
      to: m.to,
      ...(m.promotion
        ? { promotion: m.promotion as 'q' | 'r' | 'b' | 'n' }
        : {}),
    }));
  }

  validateAction(state: ChessState, action: ChessAction): ActionValidationResult {
    if (this.evaluateOutcome(state)?.finished) {
      return { valid: false, reason: 'Match is already over.' };
    }

    if (action.type === 'RESIGN') {
      return { valid: true };
    }

    if (action.type === 'UNDO') {
      if (state.mode === 'online') {
        return { valid: false, reason: 'Undo is disabled in online matches.' };
      }
      if (state.history.length === 0) {
        return { valid: false, reason: 'No moves to undo.' };
      }
      if (state.mode === 'ai' && state.history.length < 2 && new Chess(state.fen).turn() === 'w') {
        return { valid: false, reason: 'No completed turn pair to undo.' };
      }
      return { valid: true };
    }

    if (action.type === 'MOVE') {
      const chess = reconstructChessInstance(state);
      const legal = chess.moves({ verbose: true }) as Move[];
      const matching = legal.find(
        (m) =>
          m.from === action.from &&
          m.to === action.to &&
          (m.promotion ? m.promotion === (action.promotion ?? 'q') : !action.promotion)
      );
      if (!matching) {
        return {
          valid: false,
          reason: `Illegal chess move from ${action.from} to ${action.to}.`,
        };
      }
      return { valid: true };
    }

    return { valid: false, reason: 'Unknown chess action.' };
  }

  applyAction(state: ChessState, action: ChessAction): EngineTransition<ChessState> {
    const check = this.validateAction(state, action);
    if (!check.valid) {
      throw new Error(check.reason ?? 'Illegal chess action.');
    }

    if (action.type === 'RESIGN') {
      const actorIndex = action.color === 'w' ? 0 : 1;
      return {
        state: {
          ...state,
          resignedBy: action.color,
        },
        events: [
          {
            type: 'win',
            label: `${action.color === 'w' ? 'White' : 'Black'} resigned.`,
            actorIndex,
          },
        ],
      };
    }

    if (action.type === 'UNDO') {
      const stepsToUndo =
        state.mode === 'ai' && new Chess(state.fen).turn() === 'w' && state.history.length >= 2
          ? 2
          : 1;
      const nextHistory = state.history.slice(0, state.history.length - stepsToUndo);
      const nextChess = reconstructChessInstance({ ...state, history: nextHistory });
      return {
        state: {
          ...state,
          history: nextHistory,
          fen: nextChess.fen(),
          moveCount: nextHistory.length,
        },
        events: [
          {
            type: 'move',
            label: 'Undid last move.',
            actorIndex: nextChess.turn() === 'w' ? 0 : 1,
          },
        ],
      };
    }

    const chess = reconstructChessInstance(state);
    const moveObj = chess.move({
      from: action.from,
      to: action.to,
      promotion: action.promotion ?? 'q',
    });

    const actorIndex = moveObj.color === 'w' ? 0 : 1;
    const record: ChessMoveRecord = {
      from: moveObj.from,
      to: moveObj.to,
      san: moveObj.san,
      ...(moveObj.promotion
        ? { promotion: moveObj.promotion as 'q' | 'r' | 'b' | 'n' }
        : {}),
      color: moveObj.color,
      ...(moveObj.captured ? { captured: moveObj.captured } : {}),
      fenAfter: chess.fen(),
    };

    const nextState: ChessState = {
      ...state,
      fen: chess.fen(),
      history: [...state.history, record],
      moveCount: state.history.length + 1,
    };

    const events: GameEvent[] = [
      {
        type: moveObj.captured ? 'capture' : moveObj.promotion ? 'promote' : 'move',
        label: `${moveObj.color === 'w' ? 'White' : 'Black'} played ${moveObj.san}`,
        actorIndex,
      },
    ];

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

  evaluateOutcome(state: ChessState): GameOutcome | null {
    if (state.resignedBy) {
      const winnerColor = state.resignedBy === 'w' ? 'b' : 'w';
      const winnerIndex = winnerColor === 'w' ? 0 : 1;
      const humanOutcome =
        state.mode === 'ai' ? (winnerIndex === 0 ? 'win' : 'loss') : 'win';
      return {
        finished: true,
        winnerIndex,
        humanOutcome,
        reason: `${state.resignedBy === 'w' ? 'White' : 'Black'} resigned.`,
      };
    }

    const chess = reconstructChessInstance(state);
    if (!chess.isGameOver()) return null;

    if (chess.isCheckmate()) {
      const loserTurn = chess.turn();
      const winnerIndex = loserTurn === 'w' ? 1 : 0;
      const winnerLabel = winnerIndex === 0 ? 'White' : 'Black';
      const humanOutcome =
        state.mode === 'ai' ? (winnerIndex === 0 ? 'win' : 'loss') : 'win';
      return {
        finished: true,
        winnerIndex,
        humanOutcome,
        reason: `Checkmate! ${winnerLabel} wins.`,
      };
    }

    let drawReason = 'Draw by FIDE rules.';
    if (chess.isStalemate()) drawReason = 'Draw by stalemate.';
    else if (chess.isThreefoldRepetition()) drawReason = 'Draw by threefold repetition.';
    else if (chess.isInsufficientMaterial()) drawReason = 'Draw by insufficient material.';
    else if (chess.isDraw()) drawReason = 'Draw by 50-move rule.';

    return {
      finished: true,
      winnerIndex: null,
      humanOutcome: 'draw',
      reason: drawReason,
    };
  }

  serialize(state: ChessState): string {
    return JSON.stringify(state);
  }

  deserialize(raw: string): ChessState {
    return JSON.parse(raw) as ChessState;
  }
}

export const chessEngine = new ChessEngine();
