import type { AIDifficulty, GameId, GameMode, MatchOutcome } from './types';

export interface MatchSetupConfig {
  gameId: GameId;
  mode: GameMode;
  difficulty: AIDifficulty;
  playerCount: number;
  seed: number;
  variant?: string;
  boardConfig?: unknown;
}

export interface ActionValidationResult {
  valid: boolean;
  reason?: string;
}

export interface GameEvent {
  type:
    | 'move'
    | 'capture'
    | 'roll'
    | 'promote'
    | 'card'
    | 'mill'
    | 'hazard'
    | 'win'
    | 'draw';
  label: string;
  actorIndex: number;
}

export interface GameOutcome {
  finished: boolean;
  winnerIndex: number | null;
  humanOutcome: MatchOutcome;
  reason: string;
  score?: number;
}

export interface EngineTransition<TState> {
  state: TState;
  events: GameEvent[];
}

export interface GameEngine<TState, TAction> {
  readonly id: GameId;
  readonly version: number;
  createInitialState(config: MatchSetupConfig): TState;
  getLegalActions(state: TState): TAction[];
  validateAction(state: TState, action: TAction): ActionValidationResult;
  applyAction(state: TState, action: TAction): EngineTransition<TState>;
  evaluateOutcome(state: TState): GameOutcome | null;
  serialize(state: TState): string;
  deserialize(raw: string): TState;
  computeBotMove?(state: TState, difficulty: AIDifficulty): TAction | null;
}
