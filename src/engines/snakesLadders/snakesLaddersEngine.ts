import type {
  ActionValidationResult,
  EngineTransition,
  GameEngine,
  GameEvent,
  GameOutcome,
  MatchSetupConfig,
} from '../../core/engine';
import { createPrngState, rollDie, type PrngState } from '../../core/prng';
import type { AIDifficulty, GameMode } from '../../core/types';

export type SnakesFinishRule = 'exact' | 'bounce';

export interface SnakesPlayer {
  seatIndex: number;
  label: string;
  color: 'crimson' | 'emerald' | 'sapphire' | 'amber';
  isAi: boolean;
  position: number; // 0 = off-board start, 1..100 = board squares
}

export interface SnakesLaddersState {
  version: number;
  mode: GameMode;
  difficulty: AIDifficulty;
  finishRule: SnakesFinishRule;
  players: SnakesPlayer[];
  currentPlayerIndex: number;
  lastRoll: number | null;
  lastPath: number[]; // Step-by-step cell positions for smooth UI hop animation
  consecutiveSixes: number;
  winnerIndex: number | null;
  moveCount: number;
  prng: PrngState;
  history: string[];
}

export type SnakesLaddersAction = { type: 'ROLL_DICE' };

export const LADDERS_MAP: Readonly<Record<number, number>> = {
  4: 25,
  13: 46,
  33: 49,
  42: 63,
  50: 69,
  62: 81,
  74: 92,
};

export const SNAKES_MAP: Readonly<Record<number, number>> = {
  27: 5,
  40: 3,
  43: 18,
  54: 31,
  66: 45,
  76: 58,
  89: 53,
  99: 41,
};

const PLAYER_COLORS: readonly SnakesPlayer['color'][] = [
  'crimson',
  'emerald',
  'sapphire',
  'amber',
];

const PLAYER_NAMES = ['Crimson', 'Emerald', 'Sapphire', 'Amber'] as const;

export class SnakesLaddersEngine
  implements GameEngine<SnakesLaddersState, SnakesLaddersAction>
{
  readonly id = 'snakes_ladders' as const;
  readonly version = 1;

  createInitialState(config: MatchSetupConfig): SnakesLaddersState {
    const count = Math.min(4, Math.max(2, config.playerCount || 2));
    const finishRule: SnakesFinishRule =
      config.variant === 'bounce' ? 'bounce' : 'exact';

    const players: SnakesPlayer[] = Array.from({ length: count }, (_, idx) => {
      const isAi = config.mode === 'ai' && idx > 0;
      return {
        seatIndex: idx,
        color: PLAYER_COLORS[idx],
        label: isAi ? `${PLAYER_NAMES[idx]} AI` : PLAYER_NAMES[idx],
        isAi,
        position: 0,
      };
    });

    return {
      version: this.version,
      mode: config.mode,
      difficulty: config.difficulty,
      finishRule,
      players,
      currentPlayerIndex: 0,
      lastRoll: null,
      lastPath: [],
      consecutiveSixes: 0,
      winnerIndex: null,
      moveCount: 0,
      prng: createPrngState(config.seed),
      history: [],
    };
  }

  getLegalActions(state: SnakesLaddersState): SnakesLaddersAction[] {
    if (state.winnerIndex !== null) return [];
    return [{ type: 'ROLL_DICE' }];
  }

  validateAction(
    state: SnakesLaddersState,
    action: SnakesLaddersAction
  ): ActionValidationResult {
    if (state.winnerIndex !== null) {
      return { valid: false, reason: 'Match has already finished.' };
    }
    if (action.type !== 'ROLL_DICE') {
      return { valid: false, reason: 'Invalid action type for Snakes & Ladders.' };
    }
    return { valid: true };
  }

  applyAction(
    state: SnakesLaddersState,
    action: SnakesLaddersAction
  ): EngineTransition<SnakesLaddersState> {
    const validation = this.validateAction(state, action);
    if (!validation.valid) {
      throw new Error(validation.reason ?? 'Illegal action.');
    }

    const { roll, nextState: nextPrng } = rollDie(state.prng, 6);
    const active = state.players[state.currentPlayerIndex];
    const events: GameEvent[] = [
      {
        type: 'roll',
        label: `${active.label} rolled ${roll}`,
        actorIndex: state.currentPlayerIndex,
      },
    ];

    let target = active.position + roll;
    const path: number[] = [];

    if (target > 100) {
      if (state.finishRule === 'exact') {
        target = active.position;
      } else {
        // Bounce back from 100
        for (let s = active.position + 1; s <= 100; s++) path.push(s);
        const overflow = active.position + roll - 100;
        for (let s = 99; s >= 100 - overflow; s--) path.push(s);
        target = 100 - overflow;
      }
    } else {
      for (let s = active.position + 1; s <= target; s++) {
        path.push(s);
      }
    }

    let note =
      target === active.position
        ? `${active.label} rolled ${roll} — needs exact ${100 - active.position} to finish.`
        : `${active.label} rolled ${roll} → square ${target}.`;

    if (LADDERS_MAP[target]) {
      const top = LADDERS_MAP[target];
      path.push(top);
      note = `${active.label} rolled ${roll}, climbed ladder ${target} → ${top}!`;
      target = top;
      events.push({
        type: 'promote',
        label: note,
        actorIndex: state.currentPlayerIndex,
      });
    } else if (SNAKES_MAP[target]) {
      const tail = SNAKES_MAP[target];
      path.push(tail);
      note = `${active.label} rolled ${roll}, slid down snake ${target} → ${tail}!`;
      target = tail;
      events.push({
        type: 'hazard',
        label: note,
        actorIndex: state.currentPlayerIndex,
      });
    } else if (target !== active.position) {
      events.push({
        type: 'move',
        label: note,
        actorIndex: state.currentPlayerIndex,
      });
    }

    const updatedPlayers = state.players.map((p, idx) =>
      idx === state.currentPlayerIndex ? { ...p, position: target } : p
    );

    const won = target === 100;
    if (won) {
      events.push({
        type: 'win',
        label: `${active.label} reached square 100!`,
        actorIndex: state.currentPlayerIndex,
      });
    }

    const bonusRoll = !won && roll === 6 && state.consecutiveSixes < 2;
    const nextIdx = won
      ? state.currentPlayerIndex
      : bonusRoll
      ? state.currentPlayerIndex
      : (state.currentPlayerIndex + 1) % state.players.length;

    return {
      state: {
        ...state,
        players: updatedPlayers,
        prng: nextPrng,
        lastRoll: roll,
        lastPath: path,
        consecutiveSixes: bonusRoll ? state.consecutiveSixes + 1 : 0,
        winnerIndex: won ? state.currentPlayerIndex : null,
        currentPlayerIndex: nextIdx,
        moveCount: state.moveCount + 1,
        history: [note, ...state.history].slice(0, 40),
      },
      events,
    };
  }

  evaluateOutcome(state: SnakesLaddersState): GameOutcome | null {
    if (state.winnerIndex === null) return null;
    const winner = state.players[state.winnerIndex];
    const humanOutcome =
      state.mode === 'ai'
        ? state.winnerIndex === 0
          ? 'win'
          : 'loss'
        : 'win';
    return {
      finished: true,
      winnerIndex: state.winnerIndex,
      humanOutcome,
      reason: `${winner.label} reached square 100 first.`,
    };
  }

  serialize(state: SnakesLaddersState): string {
    return JSON.stringify(state);
  }

  deserialize(raw: string): SnakesLaddersState {
    return JSON.parse(raw) as SnakesLaddersState;
  }

  computeBotMove(
    state: SnakesLaddersState,
    _difficulty: AIDifficulty
  ): SnakesLaddersAction | null {
    const legal = this.getLegalActions(state);
    return legal[0] ?? null;
  }
}

export const snakesLaddersEngine = new SnakesLaddersEngine();
