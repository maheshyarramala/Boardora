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
import {
  STANDARD_TRAVEL_BOARD_CONFIG,
  type TravelBoardConfig,
  type TravelEventCard,
  type TravelTicketKind,
} from './travelBoardConfig';

export interface TravelPlayerState {
  id: number;
  label: string;
  color: 'crimson' | 'sapphire' | 'emerald' | 'amber';
  isAi: boolean;
  position: number;
  stamps: string[];
  tickets: Record<TravelTicketKind, number>;
  skipNextTurn: boolean;
  halfNextRoll: boolean;
  finished: boolean;
}

export type TravelGameAction =
  | { type: 'ROLL' }
  | { type: 'CHOOSE_ROUTE'; useShortcut: boolean };

export interface TravelGameState {
  version: number;
  mode: GameMode;
  difficulty: AIDifficulty;
  rngState: PrngState;
  boardConfig: TravelBoardConfig;
  players: TravelPlayerState[];
  currentPlayerIndex: number;
  phase: 'roll' | 'choose_route';
  lastRoll: number | null;
  pendingSteps: number;
  consecutiveBonusRolls: number;
  lastEventCard: TravelEventCard | null;
  history: string[];
  moveCount: number;
  winnerIndex: number | null;
}

const TRAVEL_PLAYER_META: readonly {
  label: string;
  color: TravelPlayerState['color'];
}[] = [
  { label: 'Explorer 1', color: 'crimson' },
  { label: 'Explorer 2', color: 'sapphire' },
  { label: 'Explorer 3', color: 'emerald' },
  { label: 'Explorer 4', color: 'amber' },
];

function resolveTravelBoardConfig(raw?: unknown): TravelBoardConfig {
  if (
    raw &&
    typeof raw === 'object' &&
    'tiles' in raw &&
    Array.isArray((raw as TravelBoardConfig).tiles) &&
    (raw as TravelBoardConfig).tiles.length >= 6
  ) {
    return raw as TravelBoardConfig;
  }
  return STANDARD_TRAVEL_BOARD_CONFIG;
}

function advanceAlongLoop(
  boardConfig: TravelBoardConfig,
  player: TravelPlayerState,
  steps: number
): {
  nextPos: number;
  stampsEarned: string[];
  reachedFinish: boolean;
} {
  const total = boardConfig.tiles.length;
  let pos = player.position;
  const stampsSet = new Set(player.stamps);
  const newlyEarned: string[] = [];

  const requiredCount = boardConfig.requiredStamps.length;
  let reachedFinish = false;

  for (let s = 0; s < steps; s++) {
    pos = (pos + 1) % total;
    const tile = boardConfig.tiles[pos];
    if (
      tile.kind === 'checkpoint' &&
      tile.checkpointId &&
      !stampsSet.has(tile.checkpointId)
    ) {
      stampsSet.add(tile.checkpointId);
      newlyEarned.push(tile.checkpointId);
    }
    if (pos === 0 && stampsSet.size >= requiredCount) {
      reachedFinish = true;
      break;
    }
  }

  return {
    nextPos: pos,
    stampsEarned: newlyEarned,
    reachedFinish,
  };
}

function nextActiveTurnIndex(
  players: TravelPlayerState[],
  currentIdx: number
): { nextIdx: number; skippedNotes: string[] } {
  const skippedNotes: string[] = [];
  let idx = (currentIdx + 1) % players.length;

  for (let guard = 0; guard < players.length; guard++) {
    if (players[idx].skipNextTurn) {
      players[idx] = { ...players[idx], skipNextTurn: false };
      skippedNotes.push(`${players[idx].label} cleared Customs Delay.`);
      idx = (idx + 1) % players.length;
    } else {
      break;
    }
  }
  return { nextIdx: idx, skippedNotes };
}

function resolveLandingAndPassTurn(params: {
  state: TravelGameState;
  players: TravelPlayerState[];
  actorIndex: number;
  events: GameEvent[];
  notePrefix: string;
}): TravelGameState {
  const { state, players, actorIndex, events, notePrefix } = params;
  const config = state.boardConfig;
  let rng = state.rngState;
  let actor = players[actorIndex];
  let grantExtraRoll = false;
  let drawnCard: TravelEventCard | null = null;
  let extraNote = '';

  const landedTile = config.tiles[actor.position];
  if (landedTile.kind === 'event' && !actor.finished) {
    const pick = rollDie(rng, config.eventDeck.length);
    rng = pick.nextState;
    drawnCard = config.eventDeck[pick.roll - 1];
    events.push({
      type: 'card',
      label: `${actor.label} drew "${drawnCard.title}": ${drawnCard.description}`,
      actorIndex,
    });
    extraNote = ` · ${drawnCard.title}`;

    if (drawnCard.effect === 'advance_3') {
      const adv = advanceAlongLoop(config, actor, 3);
      actor = {
        ...actor,
        position: adv.nextPos,
        stamps: [...actor.stamps, ...adv.stampsEarned],
        finished: adv.reachedFinish,
      };
      if (adv.stampsEarned.length > 0) {
        events.push({
          type: 'promote',
          label: `${actor.label} earned ${adv.stampsEarned.join(', ')} stamp!`,
          actorIndex,
        });
      }
    } else if (drawnCard.effect === 'gain_air') {
      actor = {
        ...actor,
        tickets: { ...actor.tickets, air: actor.tickets.air + 1 },
      };
    } else if (drawnCard.effect === 'gain_rail') {
      actor = {
        ...actor,
        tickets: { ...actor.tickets, rail: actor.tickets.rail + 1 },
      };
    } else if (drawnCard.effect === 'customs_delay') {
      actor = { ...actor, skipNextTurn: true };
    } else if (drawnCard.effect === 'weather_delay') {
      actor = { ...actor, halfNextRoll: true };
    } else if (drawnCard.effect === 'vip_roll') {
      if (state.consecutiveBonusRolls < 2) {
        grantExtraRoll = true;
      }
    } else if (drawnCard.effect === 'lost_luggage') {
      const total = config.tiles.length;
      const backPos = (actor.position - 2 + total) % total;
      actor = { ...actor, position: backPos };
    }

    players[actorIndex] = actor;
  }

  if (actor.finished) {
    events.push({
      type: 'win',
      label: `${actor.label} collected all stamps and arrived at Grand Terminal!`,
      actorIndex,
    });
    return {
      ...state,
      rngState: rng,
      players,
      phase: 'roll',
      pendingSteps: 0,
      lastEventCard: drawnCard,
      winnerIndex: actorIndex,
      moveCount: state.moveCount + 1,
      history: [`${notePrefix}${extraNote} (WIN!)`, ...state.history].slice(0, 60),
    };
  }

  if (grantExtraRoll) {
    return {
      ...state,
      rngState: rng,
      players,
      phase: 'roll',
      pendingSteps: 0,
      consecutiveBonusRolls: state.consecutiveBonusRolls + 1,
      lastEventCard: drawnCard,
      moveCount: state.moveCount + 1,
      history: [`${notePrefix}${extraNote} +VIP Roll`, ...state.history].slice(0, 60),
    };
  }

  const { nextIdx, skippedNotes } = nextActiveTurnIndex(players, actorIndex);
  const fullNotes = [
    `${notePrefix}${extraNote}`,
    ...skippedNotes,
    ...state.history,
  ].slice(0, 60);

  return {
    ...state,
    rngState: rng,
    players,
    currentPlayerIndex: nextIdx,
    phase: 'roll',
    pendingSteps: 0,
    consecutiveBonusRolls: 0,
    lastEventCard: drawnCard,
    moveCount: state.moveCount + 1,
    history: fullNotes,
  };
}

export function computeTravelProgress(
  state: TravelGameState,
  player: TravelPlayerState
): number {
  const total = state.boardConfig.tiles.length;
  const reqCount = Math.max(1, state.boardConfig.requiredStamps.length);
  if (player.finished) return 100;
  const stampWeight = (player.stamps.length / reqCount) * 70;
  const loopRatio = (player.position / total) * 30;
  return Math.min(99, Math.round(stampWeight + loopRatio));
}

export class TravelGameEngine
  implements GameEngine<TravelGameState, TravelGameAction>
{
  readonly id = 'travel_game' as const;
  readonly version = 1;

  createInitialState(config: MatchSetupConfig): TravelGameState {
    const boardConfig = resolveTravelBoardConfig(config.boardConfig);
    const count =
      config.mode === 'practice'
        ? 2
        : Math.min(4, Math.max(2, config.playerCount));

    const players: TravelPlayerState[] = Array.from({ length: count }, (_, idx) => {
      const meta = TRAVEL_PLAYER_META[idx];
      const isAi =
        config.mode === 'ai'
          ? idx > 0
          : config.mode === 'practice'
          ? idx > 0
          : false;
      return {
        id: idx,
        label: isAi ? `Bot ${idx}` : meta.label,
        color: meta.color,
        isAi,
        position: 0,
        stamps: [],
        tickets: { ...boardConfig.startingTickets },
        skipNextTurn: false,
        halfNextRoll: false,
        finished: false,
      };
    });

    return {
      version: this.version,
      mode: config.mode,
      difficulty: config.difficulty,
      rngState: createPrngState(config.seed),
      boardConfig,
      players,
      currentPlayerIndex: 0,
      phase: 'roll',
      lastRoll: null,
      pendingSteps: 0,
      consecutiveBonusRolls: 0,
      lastEventCard: null,
      history: [],
      moveCount: 0,
      winnerIndex: null,
    };
  }

  getLegalActions(state: TravelGameState): TravelGameAction[] {
    if (state.winnerIndex !== null) return [];
    if (state.phase === 'roll') return [{ type: 'ROLL' }];
    const active = state.players[state.currentPlayerIndex];
    const tile = state.boardConfig.tiles[active.position];
    const actions: TravelGameAction[] = [
      { type: 'CHOOSE_ROUTE', useShortcut: false },
    ];
    if (
      tile?.kind === 'hub' &&
      tile.hubMode &&
      typeof tile.shortcutTo === 'number' &&
      active.tickets[tile.hubMode] > 0
    ) {
      actions.push({ type: 'CHOOSE_ROUTE', useShortcut: true });
    }
    return actions;
  }

  validateAction(
    state: TravelGameState,
    action: TravelGameAction
  ): ActionValidationResult {
    if (state.winnerIndex !== null) {
      return { valid: false, reason: 'Tour has already finished.' };
    }
    if (action.type === 'ROLL') {
      if (state.phase !== 'roll') {
        return { valid: false, reason: 'Choose Main Loop or Express Shortcut first.' };
      }
      return { valid: true };
    }
    if (action.type === 'CHOOSE_ROUTE') {
      if (state.phase !== 'choose_route') {
        return { valid: false, reason: 'Roll the travel die first.' };
      }
      if (action.useShortcut) {
        const active = state.players[state.currentPlayerIndex];
        const tile = state.boardConfig.tiles[active.position];
        if (
          tile.kind !== 'hub' ||
          !tile.hubMode ||
          typeof tile.shortcutTo !== 'number' ||
          active.tickets[tile.hubMode] <= 0
        ) {
          return {
            valid: false,
            reason: 'No matching ticket available for this hub shortcut.',
          };
        }
      }
      return { valid: true };
    }
    return { valid: false, reason: 'Unknown travel action.' };
  }

  applyAction(
    state: TravelGameState,
    action: TravelGameAction
  ): EngineTransition<TravelGameState> {
    const check = this.validateAction(state, action);
    if (!check.valid) {
      throw new Error(check.reason ?? 'Illegal travel action.');
    }

    const idx = state.currentPlayerIndex;
    const players = state.players.map((p) => ({
      ...p,
      stamps: [...p.stamps],
      tickets: { ...p.tickets },
    }));
    const actor = players[idx];
    const events: GameEvent[] = [];

    if (action.type === 'ROLL') {
      const rolled = rollDie(state.rngState, 6);
      const rawRoll = rolled.roll;
      const effectiveSteps = actor.halfNextRoll
        ? Math.max(1, Math.ceil(rawRoll / 2))
        : rawRoll;
      const hadWeather = actor.halfNextRoll;
      actor.halfNextRoll = false;
      players[idx] = actor;

      events.push({
        type: 'roll',
        label: hadWeather
          ? `${actor.label} rolled ${rawRoll} (Weather halved to ${effectiveSteps})`
          : `${actor.label} rolled ${rawRoll}`,
        actorIndex: idx,
      });

      const currentTile = state.boardConfig.tiles[actor.position];
      const canShortcut =
        currentTile.kind === 'hub' &&
        currentTile.hubMode &&
        typeof currentTile.shortcutTo === 'number' &&
        actor.tickets[currentTile.hubMode] > 0;

      if (canShortcut) {
        return {
          state: {
            ...state,
            rngState: rolled.nextState,
            players,
            phase: 'choose_route',
            lastRoll: rawRoll,
            pendingSteps: effectiveSteps,
          },
          events,
        };
      }

      const adv = advanceAlongLoop(state.boardConfig, actor, effectiveSteps);
      actor.position = adv.nextPos;
      actor.stamps = [...actor.stamps, ...adv.stampsEarned];
      actor.finished = adv.reachedFinish;
      players[idx] = actor;

      if (adv.stampsEarned.length > 0) {
        events.push({
          type: 'promote',
          label: `${actor.label} collected ${adv.stampsEarned.join(', ')}!`,
          actorIndex: idx,
        });
      }

      const destTile = state.boardConfig.tiles[actor.position];
      const nextState = resolveLandingAndPassTurn({
        state: {
          ...state,
          rngState: rolled.nextState,
          lastRoll: rawRoll,
        },
        players,
        actorIndex: idx,
        events,
        notePrefix: `${actor.label}: rolled ${effectiveSteps} → ${destTile.name}`,
      });
      return { state: nextState, events };
    }

    // action.type === 'CHOOSE_ROUTE'
    const currentTile = state.boardConfig.tiles[actor.position];
    const steps = state.pendingSteps;

    if (
      action.useShortcut &&
      currentTile.hubMode &&
      typeof currentTile.shortcutTo === 'number'
    ) {
      actor.tickets[currentTile.hubMode]--;
      actor.position = currentTile.shortcutTo;

      const shortcutDestTile = state.boardConfig.tiles[actor.position];
      if (
        shortcutDestTile.kind === 'checkpoint' &&
        shortcutDestTile.checkpointId &&
        !actor.stamps.includes(shortcutDestTile.checkpointId)
      ) {
        actor.stamps.push(shortcutDestTile.checkpointId);
      }

      const remaining = Math.max(0, steps - 1);
      if (remaining > 0) {
        const adv = advanceAlongLoop(state.boardConfig, actor, remaining);
        actor.position = adv.nextPos;
        actor.stamps = [...actor.stamps, ...adv.stampsEarned];
        actor.finished = adv.reachedFinish;
      }
      players[idx] = actor;

      const finalTile = state.boardConfig.tiles[actor.position];
      events.push({
        type: 'move',
        label: `${actor.label} took ${currentTile.hubMode.toUpperCase()} Express to ${finalTile.name}`,
        actorIndex: idx,
      });

      const nextState = resolveLandingAndPassTurn({
        state,
        players,
        actorIndex: idx,
        events,
        notePrefix: `${actor.label}: ${currentTile.hubMode.toUpperCase()} Express → ${finalTile.name}`,
      });
      return { state: nextState, events };
    }

    // Decline shortcut -> standard main loop
    const adv = advanceAlongLoop(state.boardConfig, actor, steps);
    actor.position = adv.nextPos;
    actor.stamps = [...actor.stamps, ...adv.stampsEarned];
    actor.finished = adv.reachedFinish;
    players[idx] = actor;

    const finalTile = state.boardConfig.tiles[actor.position];
    const nextState = resolveLandingAndPassTurn({
      state,
      players,
      actorIndex: idx,
      events,
      notePrefix: `${actor.label}: main loop ${steps} → ${finalTile.name}`,
    });
    return { state: nextState, events };
  }

  evaluateOutcome(state: TravelGameState): GameOutcome | null {
    if (state.winnerIndex === null) return null;
    const winner = state.players[state.winnerIndex];
    const humanWon = state.winnerIndex === 0;
    return {
      finished: true,
      winnerIndex: state.winnerIndex,
      humanOutcome:
        state.mode === 'ai' || state.mode === 'practice'
          ? humanWon
            ? 'win'
            : 'loss'
          : 'win',
      reason: `${winner.label} completed the World Tour with all ${state.boardConfig.requiredStamps.length} stamps!`,
    };
  }

  computeBotMove(
    state: TravelGameState,
    difficulty: AIDifficulty
  ): TravelGameAction | null {
    if (state.winnerIndex !== null) return null;
    if (state.phase === 'roll') return { type: 'ROLL' };

    const active = state.players[state.currentPlayerIndex];
    const tile = state.boardConfig.tiles[active.position];
    const hasShortcut =
      tile.kind === 'hub' &&
      tile.hubMode &&
      typeof tile.shortcutTo === 'number' &&
      active.tickets[tile.hubMode] > 0;

    if (!hasShortcut || tile.shortcutTo === undefined) {
      return { type: 'CHOOSE_ROUTE', useShortcut: false };
    }

    if (difficulty === 'easy') {
      return { type: 'CHOOSE_ROUTE', useShortcut: state.moveCount % 2 === 0 };
    }

    const target = tile.shortcutTo;
    if (difficulty === 'medium') {
      const jumpsForward = target > active.position || active.stamps.length >= 3;
      return { type: 'CHOOSE_ROUTE', useShortcut: jumpsForward };
    }

    // Hard: strategic lookahead for missing destination stamps or sprint to Terminal
    const allStampsCollected =
      active.stamps.length >= state.boardConfig.requiredStamps.length;
    if (allStampsCollected) {
      return {
        type: 'CHOOSE_ROUTE',
        useShortcut: target === 0 || target > active.position,
      };
    }

    const tiles = state.boardConfig.tiles;
    const lookaheadHitsMissingStamp = [0, 1, 2, 3, 4].some((offset) => {
      const candidate = tiles[(target + offset) % tiles.length];
      return Boolean(
        candidate.checkpointId && !active.stamps.includes(candidate.checkpointId)
      );
    });
    return {
      type: 'CHOOSE_ROUTE',
      useShortcut: lookaheadHitsMissingStamp || target > active.position + 3,
    };
  }

  serialize(state: TravelGameState): string {
    return JSON.stringify(state);
  }

  deserialize(raw: string): TravelGameState {
    return JSON.parse(raw) as TravelGameState;
  }
}

export const travelGameEngine = new TravelGameEngine();
