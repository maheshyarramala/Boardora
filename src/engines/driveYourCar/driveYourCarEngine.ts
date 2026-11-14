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
  STANDARD_DRIVE_TRACK_CONFIG,
  VEHICLE_ROSTER,
  type DriveEventCard,
  type DriveFeatureKind,
  type DriveTrackConfig,
  type VehicleId,
} from './driveTrackConfig';

export interface DrivePlayerState {
  id: number;
  label: string;
  isAi: boolean;
  vehicleId: VehicleId;
  segment: number;
  lane: 0 | 1 | 2;
  fuel: number;
  maxFuel: number;
  nitro: number;
  maxNitro: number;
  oilPenaltyNext: boolean;
  checkpointsPassed: number[];
  finished: boolean;
}

export type DriveYourCarAction =
  | { type: 'SWITCH_LANE'; lane: 0 | 1 | 2 }
  | { type: 'TOGGLE_NITRO' }
  | { type: 'ROLL_DRIVE' };

export interface DriveYourCarState {
  version: number;
  mode: GameMode;
  difficulty: AIDifficulty;
  rngState: PrngState;
  trackConfig: DriveTrackConfig;
  players: DrivePlayerState[];
  currentPlayerIndex: number;
  switchedLaneThisTurn: boolean;
  nitroArmed: boolean;
  lastRoll: number | null;
  lastEventCard: DriveEventCard | null;
  history: string[];
  moveCount: number;
  winnerIndex: number | null;
}

const DEFAULT_VEHICLES: readonly VehicleId[] = [
  'sedan',
  'rally',
  'roadster',
  'electric',
];

function resolveTrackConfig(raw?: unknown): DriveTrackConfig {
  if (
    raw &&
    typeof raw === 'object' &&
    'totalSegments' in raw &&
    Array.isArray((raw as DriveTrackConfig).features)
  ) {
    return raw as DriveTrackConfig;
  }
  return STANDARD_DRIVE_TRACK_CONFIG;
}

export function getFeatureAt(
  track: DriveTrackConfig,
  segment: number,
  lane: 0 | 1 | 2
): DriveFeatureKind | null {
  const found = track.features.find(
    (f) => f.segment === segment && f.lane === lane
  );
  return found ? found.kind : null;
}

export class DriveYourCarEngine
  implements GameEngine<DriveYourCarState, DriveYourCarAction>
{
  readonly id = 'drive_your_car' as const;
  readonly version = 1;

  createInitialState(config: MatchSetupConfig): DriveYourCarState {
    const trackConfig = resolveTrackConfig(config.boardConfig);
    const count =
      config.mode === 'practice'
        ? 2
        : Math.min(4, Math.max(2, config.playerCount));

    const players: DrivePlayerState[] = Array.from({ length: count }, (_, idx) => {
      const vehicleId = DEFAULT_VEHICLES[idx % DEFAULT_VEHICLES.length];
      const spec = VEHICLE_ROSTER[vehicleId];
      const isAi =
        config.mode === 'ai'
          ? idx > 0
          : config.mode === 'practice'
          ? idx > 0
          : false;
      return {
        id: idx,
        label: isAi ? `Rival ${idx} (${spec.name.split(' ')[1]})` : `Driver ${idx + 1}`,
        isAi,
        vehicleId,
        segment: 0,
        lane: 1,
        fuel: spec.maxFuel,
        maxFuel: spec.maxFuel,
        nitro: spec.maxNitro,
        maxNitro: spec.maxNitro,
        oilPenaltyNext: false,
        checkpointsPassed: [],
        finished: false,
      };
    });

    return {
      version: this.version,
      mode: config.mode,
      difficulty: config.difficulty,
      rngState: createPrngState(config.seed),
      trackConfig,
      players,
      currentPlayerIndex: 0,
      switchedLaneThisTurn: false,
      nitroArmed: false,
      lastRoll: null,
      lastEventCard: null,
      history: [],
      moveCount: 0,
      winnerIndex: null,
    };
  }

  getLegalActions(state: DriveYourCarState): DriveYourCarAction[] {
    if (state.winnerIndex !== null) return [];
    const active = state.players[state.currentPlayerIndex];
    const actions: DriveYourCarAction[] = [{ type: 'ROLL_DRIVE' }];

    if (!state.switchedLaneThisTurn && active.fuel > 0) {
      for (const lane of [0, 1, 2] as const) {
        if (Math.abs(lane - active.lane) === 1) {
          actions.push({ type: 'SWITCH_LANE', lane });
        }
      }
    }
    if (active.nitro > 0 && active.fuel >= 2) {
      actions.push({ type: 'TOGGLE_NITRO' });
    }
    return actions;
  }

  validateAction(
    state: DriveYourCarState,
    action: DriveYourCarAction
  ): ActionValidationResult {
    if (state.winnerIndex !== null) {
      return { valid: false, reason: 'Race has already finished.' };
    }
    const active = state.players[state.currentPlayerIndex];

    if (action.type === 'SWITCH_LANE') {
      if (active.fuel <= 0) {
        return {
          valid: false,
          reason: 'Out of fuel — perform Emergency Coast to refuel.',
        };
      }
      if (state.switchedLaneThisTurn) {
        return { valid: false, reason: 'You can only switch lanes once per turn.' };
      }
      if (Math.abs(action.lane - active.lane) !== 1) {
        return { valid: false, reason: 'Switch to an immediately adjacent lane only.' };
      }
      return { valid: true };
    }

    if (action.type === 'TOGGLE_NITRO') {
      if (active.nitro <= 0) {
        return { valid: false, reason: 'No Nitro charges remaining.' };
      }
      if (active.fuel < 2 && !state.nitroArmed) {
        return { valid: false, reason: 'Need at least 2 Fuel to engage Nitro.' };
      }
      return { valid: true };
    }

    if (action.type === 'ROLL_DRIVE') {
      return { valid: true };
    }

    return { valid: false, reason: 'Unknown racing action.' };
  }

  applyAction(
    state: DriveYourCarState,
    action: DriveYourCarAction
  ): EngineTransition<DriveYourCarState> {
    const check = this.validateAction(state, action);
    if (!check.valid) {
      throw new Error(check.reason ?? 'Illegal racing action.');
    }

    const idx = state.currentPlayerIndex;
    const players = state.players.map((p) => ({
      ...p,
      checkpointsPassed: [...p.checkpointsPassed],
    }));
    const actor = players[idx];

    if (action.type === 'SWITCH_LANE') {
      actor.lane = action.lane;
      players[idx] = actor;
      const laneName =
        action.lane === 0 ? 'Left' : action.lane === 1 ? 'Center' : 'Right';
      return {
        state: {
          ...state,
          players,
          switchedLaneThisTurn: true,
        },
        events: [
          {
            type: 'move',
            label: `${actor.label} shifted to ${laneName} lane.`,
            actorIndex: idx,
          },
        ],
      };
    }

    if (action.type === 'TOGGLE_NITRO') {
      const armed = !state.nitroArmed;
      return {
        state: { ...state, nitroArmed: armed },
        events: [
          {
            type: 'move',
            label: armed ? `${actor.label} armed Nitro Boost!` : 'Nitro disarmed.',
            actorIndex: idx,
          },
        ],
      };
    }

    // action.type === 'ROLL_DRIVE'
    const track = state.trackConfig;
    const events: GameEvent[] = [];
    let rng = state.rngState;
    let drawnCard: DriveEventCard | null = null;
    let rollVal: number | null = state.lastRoll;
    let logNote = '';

    // Out-of-fuel emergency coast prevents permanent deadlock
    if (actor.fuel <= 0) {
      const nextSeg = Math.min(track.totalSegments, actor.segment + 1);
      actor.segment = nextSeg;
      actor.fuel = Math.min(actor.maxFuel, 3);
      actor.oilPenaltyNext = false;
      if (nextSeg >= track.totalSegments) actor.finished = true;
      players[idx] = actor;
      logNote = `${actor.label}: Emergency Coast → Seg ${nextSeg} (+3 Fuel)`;
      events.push({
        type: 'hazard',
        label: `${actor.label} ran dry—Emergency Coast to Segment ${nextSeg} (+3 Fuel).`,
        actorIndex: idx,
      });
    } else {
      const rolled = rollDie(rng, 6);
      rng = rolled.nextState;
      rollVal = rolled.roll;

      const fuelCost = state.nitroArmed ? 2 : 1;
      actor.fuel = Math.max(0, actor.fuel - fuelCost);
      const nitroBonus = state.nitroArmed ? 3 : 0;
      if (state.nitroArmed) actor.nitro = Math.max(0, actor.nitro - 1);

      const oilTrim =
        actor.oilPenaltyNext && actor.vehicleId !== 'rally' ? 1 : 0;
      actor.oilPenaltyNext = false;

      const totalSteps = Math.max(1, rollVal + nitroBonus - oilTrim);
      events.push({
        type: 'roll',
        label: `${actor.label} rolled ${rollVal}${nitroBonus ? ' +3 Nitro' : ''}${
          oilTrim ? ' -1 Oil' : ''
        } (${totalSteps} segs)`,
        actorIndex: idx,
      });

      let laneChangedByAuto = state.switchedLaneThisTurn;
      let stoppedByBlock = false;

      for (let s = 0; s < totalSteps; s++) {
        if (actor.segment >= track.totalSegments) break;
        const candidateSeg = actor.segment + 1;
        const featAhead = getFeatureAt(track, candidateSeg, actor.lane);

        if (featAhead === 'roadblock') {
          // Try swerving to an open adjacent lane if not already switched this turn
          const openAdj = ([0, 1, 2] as const).find(
            (l) =>
              Math.abs(l - actor.lane) === 1 &&
              getFeatureAt(track, candidateSeg, l) !== 'roadblock'
          );
          if (!laneChangedByAuto && openAdj !== undefined) {
            actor.lane = openAdj;
            laneChangedByAuto = true;
            events.push({
              type: 'hazard',
              label: `${actor.label} swerved around Roadblock at Seg ${candidateSeg}!`,
              actorIndex: idx,
            });
          } else {
            stoppedByBlock = true;
            events.push({
              type: 'hazard',
              label: `${actor.label} braked before Roadblock at Seg ${candidateSeg}.`,
              actorIndex: idx,
            });
            break;
          }
        }

        actor.segment = candidateSeg;

        // Pass Pit Stop -> refuel!
        if (getFeatureAt(track, actor.segment, actor.lane) === 'pit') {
          actor.fuel = actor.maxFuel;
          events.push({
            type: 'promote',
            label: `${actor.label} refueled at Pit Lane!`,
            actorIndex: idx,
          });
        }

        // Checkpoints
        if (
          track.checkpoints.includes(actor.segment) &&
          !actor.checkpointsPassed.includes(actor.segment)
        ) {
          actor.checkpointsPassed.push(actor.segment);
          if (actor.vehicleId === 'electric') {
            actor.fuel = Math.min(actor.maxFuel, actor.fuel + 1);
          }
        }

        if (actor.segment >= track.totalSegments) {
          actor.finished = true;
          break;
        }
      }

      // Landing tile special effect
      if (!actor.finished && !stoppedByBlock) {
        const landedFeat = getFeatureAt(track, actor.segment, actor.lane);
        if (landedFeat === 'pit') {
          actor.nitro = Math.min(actor.maxNitro, actor.nitro + 1);
        } else if (landedFeat === 'boost') {
          const boostSteps = actor.vehicleId === 'roadster' ? 3 : 2;
          actor.segment = Math.min(track.totalSegments, actor.segment + boostSteps);
          if (actor.segment >= track.totalSegments) actor.finished = true;
          events.push({
            type: 'promote',
            label: `${actor.label} hit Turbo Boost (+${boostSteps} segs)!`,
            actorIndex: idx,
          });
        } else if (landedFeat === 'oil') {
          actor.lane = actor.lane === 1 ? 0 : 1;
          if (actor.vehicleId !== 'rally') {
            actor.oilPenaltyNext = true;
          }
          events.push({
            type: 'hazard',
            label: `${actor.label} spun on Oil Slick!`,
            actorIndex: idx,
          });
        } else if (landedFeat === 'event') {
          const cardRoll = rollDie(rng, track.eventDeck.length);
          rng = cardRoll.nextState;
          drawnCard = track.eventDeck[cardRoll.roll - 1];
          events.push({
            type: 'card',
            label: `${actor.label}: ${drawnCard.title}`,
            actorIndex: idx,
          });
          if (drawnCard.effect === 'clear_road_2') {
            actor.segment = Math.min(track.totalSegments, actor.segment + 2);
          } else if (drawnCard.effect === 'slipstream_1') {
            actor.segment = Math.min(track.totalSegments, actor.segment + 1);
          } else if (drawnCard.effect === 'headwind_fuel') {
            actor.fuel = Math.max(0, actor.fuel - 1);
          } else if (drawnCard.effect === 'pit_nitro') {
            actor.nitro = Math.min(actor.maxNitro, actor.nitro + 1);
          }
          if (actor.segment >= track.totalSegments) actor.finished = true;
        }
      }

      players[idx] = actor;
      logNote = `${actor.label}: rolled ${rollVal} → Seg ${actor.segment} (Fuel ${actor.fuel})`;
    }

    if (actor.finished) {
      events.push({
        type: 'win',
        label: `${actor.label} crossed the Checkered Finish!`,
        actorIndex: idx,
      });
      return {
        state: {
          ...state,
          rngState: rng,
          players,
          switchedLaneThisTurn: false,
          nitroArmed: false,
          lastRoll: rollVal,
          lastEventCard: drawnCard,
          winnerIndex: idx,
          moveCount: state.moveCount + 1,
          history: [`${logNote} 🏁`, ...state.history].slice(0, 60),
        },
        events,
      };
    }

    const nextIdx = (idx + 1) % players.length;
    return {
      state: {
        ...state,
        rngState: rng,
        players,
        currentPlayerIndex: nextIdx,
        switchedLaneThisTurn: false,
        nitroArmed: false,
        lastRoll: rollVal,
        lastEventCard: drawnCard,
        moveCount: state.moveCount + 1,
        history: [logNote, ...state.history].slice(0, 60),
      },
      events,
    };
  }

  evaluateOutcome(state: DriveYourCarState): GameOutcome | null {
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
      reason: `${winner.label} crossed Segment ${state.trackConfig.totalSegments} first to win the Grand Prix!`,
    };
  }

  computeBotMove(
    state: DriveYourCarState,
    difficulty: AIDifficulty
  ): DriveYourCarAction | null {
    if (state.winnerIndex !== null) return null;
    const active = state.players[state.currentPlayerIndex];

    // Easy AI drives straight without proactive lane dodging or Nitro planning
    if (difficulty === 'easy') {
      return { type: 'ROLL_DRIVE' };
    }

    if (!state.switchedLaneThisTurn && active.fuel > 0) {
      const lookDepth = difficulty === 'hard' ? 3 : 2;
      const hazardAhead = Array.from({ length: lookDepth }, (_, i) => i + 1).some(
        (d) => {
          const f = getFeatureAt(state.trackConfig, active.segment + d, active.lane);
          return f === 'roadblock' || (difficulty === 'hard' && f === 'oil');
        }
      );

      if (hazardAhead) {
        const clearLane = ([0, 1, 2] as const).find(
          (l) =>
            Math.abs(l - active.lane) === 1 &&
            getFeatureAt(state.trackConfig, active.segment + 1, l) !== 'roadblock' &&
            getFeatureAt(state.trackConfig, active.segment + 2, l) !== 'roadblock'
        );
        if (clearLane !== undefined) {
          return { type: 'SWITCH_LANE', lane: clearLane };
        }
      }

      const fuelThreshold = difficulty === 'hard' ? 5 : 3;
      if (active.fuel <= fuelThreshold) {
        const pitLane = ([0, 1, 2] as const).find(
          (l) =>
            Math.abs(l - active.lane) === 1 &&
            [1, 2, 3, 4].some(
              (d) => getFeatureAt(state.trackConfig, active.segment + d, l) === 'pit'
            )
        );
        if (pitLane !== undefined) {
          return { type: 'SWITCH_LANE', lane: pitLane };
        }
      }

      if (difficulty === 'hard') {
        const boostLane = ([0, 1, 2] as const).find(
          (l) =>
            Math.abs(l - active.lane) === 1 &&
            [1, 2, 3].some(
              (d) => getFeatureAt(state.trackConfig, active.segment + d, l) === 'boost'
            ) &&
            getFeatureAt(state.trackConfig, active.segment + 1, l) !== 'roadblock'
        );
        if (boostLane !== undefined) {
          return { type: 'SWITCH_LANE', lane: boostLane };
        }
      }
    }

    if (
      difficulty === 'hard' &&
      !state.nitroArmed &&
      active.nitro > 0 &&
      active.fuel >= 3
    ) {
      const roadblockClose = [1, 2, 3, 4].some(
        (d) => getFeatureAt(state.trackConfig, active.segment + d, active.lane) === 'roadblock'
      );
      if (
        !roadblockClose &&
        (active.segment >= state.trackConfig.totalSegments - 10 ||
          active.fuel >= active.maxFuel - 2)
      ) {
        return { type: 'TOGGLE_NITRO' };
      }
    }

    return { type: 'ROLL_DRIVE' };
  }

  serialize(state: DriveYourCarState): string {
    return JSON.stringify(state);
  }

  deserialize(raw: string): DriveYourCarState {
    return JSON.parse(raw) as DriveYourCarState;
  }
}

export const driveYourCarEngine = new DriveYourCarEngine();
