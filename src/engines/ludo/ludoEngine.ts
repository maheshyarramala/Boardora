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

export type LudoColor = 'red' | 'green' | 'yellow' | 'blue';

export interface LudoPlayer {
  seatIndex: number;
  color: LudoColor;
  label: string;
  isAi: boolean;
  /** Progress per pawn: -1 = in base, 0..50 = outer track, 51..55 = home stretch, 56 = finished */
  pawns: [number, number, number, number];
}

export type LudoPhase = 'ROLL' | 'MOVE' | 'FINISHED';

export interface LudoState {
  version: number;
  mode: GameMode;
  difficulty: AIDifficulty;
  players: LudoPlayer[];
  currentPlayerIndex: number;
  phase: LudoPhase;
  lastRoll: number | null;
  consecutiveSixes: number;
  winnerIndex: number | null;
  moveCount: number;
  prng: PrngState;
  history: string[];
}

export type LudoAction =
  | { type: 'ROLL_DICE' }
  | { type: 'MOVE_PAWN'; pawnIndex: 0 | 1 | 2 | 3 };

/** Start square indices on the 52-cell outer ring for Red, Green, Yellow, Blue */
export const LUDO_START_OFFSETS: Record<LudoColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

/** Safe star & start squares on the 52-cell outer ring */
export const LUDO_SAFE_RING_INDICES: ReadonlySet<number> = new Set([
  0, 8, 13, 21, 26, 34, 39, 47,
]);

export function getGlobalRingIndex(color: LudoColor, progress: number): number | null {
  if (progress < 0 || progress > 50) return null;
  return (LUDO_START_OFFSETS[color] + progress) % 52;
}

export function canPawnMove(progress: number, roll: number): boolean {
  if (progress === 56) return false;
  if (progress === -1) return roll === 6;
  return progress + roll <= 56;
}

function getSeatColors(playerCount: number): LudoColor[] {
  if (playerCount <= 2) return ['red', 'yellow'];
  if (playerCount === 3) return ['red', 'green', 'yellow'];
  return ['red', 'green', 'yellow', 'blue'];
}

function colorTitle(color: LudoColor): string {
  return color.charAt(0).toUpperCase() + color.slice(1);
}

function nextPlayerIdx(state: LudoState): number {
  return (state.currentPlayerIndex + 1) % state.players.length;
}

export class LudoEngine implements GameEngine<LudoState, LudoAction> {
  readonly id = 'ludo' as const;
  readonly version = 1;

  createInitialState(config: MatchSetupConfig): LudoState {
    const count = Math.min(4, Math.max(2, config.playerCount || 2));
    const colors = getSeatColors(count);
    const players: LudoPlayer[] = colors.map((color, idx) => {
      const isAi = config.mode === 'ai' && idx > 0;
      return {
        seatIndex: idx,
        color,
        label: isAi ? `${colorTitle(color)} AI` : `${colorTitle(color)}`,
        isAi,
        pawns: [-1, -1, -1, -1],
      };
    });

    return {
      version: this.version,
      mode: config.mode,
      difficulty: config.difficulty,
      players,
      currentPlayerIndex: 0,
      phase: 'ROLL',
      lastRoll: null,
      consecutiveSixes: 0,
      winnerIndex: null,
      moveCount: 0,
      prng: createPrngState(config.seed),
      history: [],
    };
  }

  getLegalActions(state: LudoState): LudoAction[] {
    if (state.phase === 'FINISHED' || state.winnerIndex !== null) {
      return [];
    }
    if (state.phase === 'ROLL') {
      return [{ type: 'ROLL_DICE' }];
    }
    if (state.phase === 'MOVE' && state.lastRoll !== null) {
      const player = state.players[state.currentPlayerIndex];
      const actions: LudoAction[] = [];
      for (let i = 0; i < 4; i++) {
        if (canPawnMove(player.pawns[i], state.lastRoll)) {
          actions.push({ type: 'MOVE_PAWN', pawnIndex: i as 0 | 1 | 2 | 3 });
        }
      }
      return actions;
    }
    return [];
  }

  validateAction(state: LudoState, action: LudoAction): ActionValidationResult {
    if (state.phase === 'FINISHED' || state.winnerIndex !== null) {
      return { valid: false, reason: 'Match has already ended.' };
    }
    if (action.type === 'ROLL_DICE') {
      if (state.phase !== 'ROLL') {
        return { valid: false, reason: 'Select a pawn to move before rolling again.' };
      }
      return { valid: true };
    }
    if (action.type === 'MOVE_PAWN') {
      if (state.phase !== 'MOVE' || state.lastRoll === null) {
        return { valid: false, reason: 'Roll the dice before moving a pawn.' };
      }
      if (action.pawnIndex < 0 || action.pawnIndex > 3) {
        return { valid: false, reason: 'Invalid pawn index.' };
      }
      const player = state.players[state.currentPlayerIndex];
      const progress = player.pawns[action.pawnIndex];
      if (!canPawnMove(progress, state.lastRoll)) {
        if (progress === -1 && state.lastRoll !== 6) {
          return { valid: false, reason: 'A roll of 6 is required to leave the base.' };
        }
        return { valid: false, reason: 'Roll exceeds exact home crown distance.' };
      }
      return { valid: true };
    }
    return { valid: false, reason: 'Unknown Ludo action.' };
  }

  applyAction(state: LudoState, action: LudoAction): EngineTransition<LudoState> {
    const check = this.validateAction(state, action);
    if (!check.valid) {
      throw new Error(check.reason ?? 'Illegal Ludo action.');
    }

    const activePlayer = state.players[state.currentPlayerIndex];
    const events: GameEvent[] = [];

    if (action.type === 'ROLL_DICE') {
      const { roll, nextState: nextPrng } = rollDie(state.prng, 6);
      const nextSixes = roll === 6 ? state.consecutiveSixes + 1 : 0;
      events.push({
        type: 'roll',
        label: `${activePlayer.label} rolled ${roll}`,
        actorIndex: state.currentPlayerIndex,
      });

      // Three consecutive 6s forfeit the turn
      if (nextSixes >= 3) {
        const note = `${activePlayer.label} rolled 6 three times — turn forfeited.`;
        return {
          state: {
            ...state,
            prng: nextPrng,
            lastRoll: roll,
            consecutiveSixes: 0,
            phase: 'ROLL',
            currentPlayerIndex: nextPlayerIdx(state),
            moveCount: state.moveCount + 1,
            history: [note, ...state.history].slice(0, 40),
          },
          events,
        };
      }

      const hasMove = activePlayer.pawns.some((p) => canPawnMove(p, roll));
      if (!hasMove) {
        const note = `${activePlayer.label} rolled ${roll} (no legal moves).`;
        return {
          state: {
            ...state,
            prng: nextPrng,
            lastRoll: roll,
            consecutiveSixes: 0,
            phase: 'ROLL',
            currentPlayerIndex: nextPlayerIdx(state),
            moveCount: state.moveCount + 1,
            history: [note, ...state.history].slice(0, 40),
          },
          events,
        };
      }

      return {
        state: {
          ...state,
          prng: nextPrng,
          lastRoll: roll,
          consecutiveSixes: nextSixes,
          phase: 'MOVE',
          history: [`${activePlayer.label} rolled ${roll}.`, ...state.history].slice(0, 40),
        },
        events,
      };
    }

    // MOVE_PAWN
    const roll = state.lastRoll!;
    const currentProg = activePlayer.pawns[action.pawnIndex];
    const nextProg = currentProg === -1 ? 0 : currentProg + roll;

    const updatedPlayers = state.players.map((p) => ({
      ...p,
      pawns: [...p.pawns] as [number, number, number, number],
    }));
    const movingPlayer = updatedPlayers[state.currentPlayerIndex];
    movingPlayer.pawns[action.pawnIndex] = nextProg;

    let capturedOpponent = false;
    const landingRing = getGlobalRingIndex(movingPlayer.color, nextProg);

    if (landingRing !== null && !LUDO_SAFE_RING_INDICES.has(landingRing)) {
      for (let pi = 0; pi < updatedPlayers.length; pi++) {
        if (pi === state.currentPlayerIndex) continue;
        const opp = updatedPlayers[pi];
        for (let k = 0; k < 4; k++) {
          const oppRing = getGlobalRingIndex(opp.color, opp.pawns[k]);
          if (oppRing === landingRing) {
            opp.pawns[k] = -1;
            capturedOpponent = true;
            events.push({
              type: 'capture',
              label: `${movingPlayer.label} captured ${opp.label}!`,
              actorIndex: state.currentPlayerIndex,
            });
          }
        }
      }
    }

    const reachedCrown = nextProg === 56;
    events.push({
      type: reachedCrown ? 'promote' : 'move',
      label: reachedCrown
        ? `${movingPlayer.label} pawn #${action.pawnIndex + 1} reached Home!`
        : `${movingPlayer.label} moved pawn #${action.pawnIndex + 1} (${roll}).`,
      actorIndex: state.currentPlayerIndex,
    });

    const won = movingPlayer.pawns.every((p) => p === 56);
    if (won) {
      events.push({
        type: 'win',
        label: `${movingPlayer.label} wins the match!`,
        actorIndex: state.currentPlayerIndex,
      });
      return {
        state: {
          ...state,
          players: updatedPlayers,
          phase: 'FINISHED',
          winnerIndex: state.currentPlayerIndex,
          moveCount: state.moveCount + 1,
          history: [
            `${movingPlayer.label} brought all 4 pawns home!`,
            ...state.history,
          ].slice(0, 40),
        },
        events,
      };
    }

    // Bonus roll on 6, capture, or reaching home crown
    const bonusTurn = roll === 6 || capturedOpponent || reachedCrown;
    const nextIdx = bonusTurn ? state.currentPlayerIndex : nextPlayerIdx(state);
    const nextSixes = bonusTurn && roll === 6 ? state.consecutiveSixes : 0;

    return {
      state: {
        ...state,
        players: updatedPlayers,
        phase: 'ROLL',
        lastRoll: null,
        currentPlayerIndex: nextIdx,
        consecutiveSixes: nextSixes,
        moveCount: state.moveCount + 1,
        history: [
          capturedOpponent
            ? `${movingPlayer.label} captured an opponent and earned a bonus roll!`
            : reachedCrown
            ? `${movingPlayer.label} crowned a pawn and earned a bonus roll!`
            : `${movingPlayer.label} moved pawn #${action.pawnIndex + 1} by ${roll}.`,
          ...state.history,
        ].slice(0, 40),
      },
      events,
    };
  }

  evaluateOutcome(state: LudoState): GameOutcome | null {
    if (state.phase !== 'FINISHED' || state.winnerIndex === null) {
      return null;
    }
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
      reason: `${winner.label} safely brought all four pawns to the home crown.`,
    };
  }

  serialize(state: LudoState): string {
    return JSON.stringify(state);
  }

  deserialize(raw: string): LudoState {
    return JSON.parse(raw) as LudoState;
  }

  computeBotMove(state: LudoState, difficulty: AIDifficulty): LudoAction | null {
    const legal = this.getLegalActions(state);
    if (legal.length === 0) return null;
    if (legal[0].type === 'ROLL_DICE') return legal[0];
    if (legal.length === 1 || difficulty === 'easy') return legal[0];

    const roll = state.lastRoll ?? 1;
    const player = state.players[state.currentPlayerIndex];

    let bestAction = legal[0];
    let bestScore = -Infinity;

    for (const action of legal) {
      if (action.type !== 'MOVE_PAWN') continue;
      const prog = player.pawns[action.pawnIndex];
      const nextProg = prog === -1 ? 0 : prog + roll;
      let score = nextProg;

      if (nextProg === 56) score += 200; // Home crown priority
      if (prog === -1) score += 90; // Exit base on 6
      if (nextProg >= 51) score += 60; // Safe home stretch

      const ring = getGlobalRingIndex(player.color, nextProg);
      if (ring !== null) {
        if (LUDO_SAFE_RING_INDICES.has(ring)) {
          score += 55;
        } else {
          // Check capture opportunity
          let captures = false;
          for (let pi = 0; pi < state.players.length; pi++) {
            if (pi === state.currentPlayerIndex) continue;
            for (const oppProg of state.players[pi].pawns) {
              if (getGlobalRingIndex(state.players[pi].color, oppProg) === ring) {
                captures = true;
              }
            }
          }
          if (captures) score += 160;
        }

        // Hard difficulty checks danger behind current square
        if (difficulty === 'hard') {
          const currRing = getGlobalRingIndex(player.color, prog);
          if (currRing !== null && !LUDO_SAFE_RING_INDICES.has(currRing)) {
            for (let pi = 0; pi < state.players.length; pi++) {
              if (pi === state.currentPlayerIndex) continue;
              for (const oppProg of state.players[pi].pawns) {
                const oppRing = getGlobalRingIndex(state.players[pi].color, oppProg);
                if (oppRing !== null) {
                  const dist = (currRing - oppRing + 52) % 52;
                  if (dist >= 1 && dist <= 6) score += 45;
                }
              }
            }
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestAction = action;
      }
    }

    return bestAction;
  }
}

export const ludoEngine = new LudoEngine();
