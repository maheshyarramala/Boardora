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
  STANDARD_MONEY_BOARD_CONFIG,
  type MoneyBoardConfig,
  type MoneyDecisionCard,
  type MoneyEventCard,
} from './moneyBoardConfig';

export interface MoneyDeedOwnership {
  ownerIndex: number;
  upgradeLevel: number; // 0..3
}

export interface MoneyPlayerState {
  id: number;
  label: string;
  color: 'crimson' | 'sapphire' | 'emerald' | 'amber';
  isAi: boolean;
  position: number;
  cash: number;
  savings: number;
  paydayBonus: number;
  insured: boolean;
  lapsCompleted: number;
  insolvent: boolean;
}

export interface MoneyAuctionState {
  tileIndex: number;
  highestBid: number;
  highestBidderIndex: number | null;
  currentBidderIndex: number;
  passedIndices: number[];
}

export type MoneyGamePhase =
  | 'roll'
  | 'buy_or_auction'
  | 'auction'
  | 'upgrade_prompt'
  | 'savings_prompt'
  | 'decision_prompt';

export type MoneyGameAction =
  | { type: 'ROLL' }
  | { type: 'BUY_PROPERTY' }
  | { type: 'START_AUCTION' }
  | { type: 'AUCTION_BID'; increment: 20 | 50 }
  | { type: 'AUCTION_PASS' }
  | { type: 'UPGRADE_PROPERTY'; accept: boolean }
  | { type: 'SAVINGS_ACTION'; delta: number }
  | { type: 'CHOOSE_DECISION'; choice: 'a' | 'b' };

export interface MoneyGameState {
  version: number;
  mode: GameMode;
  difficulty: AIDifficulty;
  variant: 'standard' | 'sprint';
  rngState: PrngState;
  boardConfig: MoneyBoardConfig;
  players: MoneyPlayerState[];
  deeds: Record<number, MoneyDeedOwnership>;
  currentPlayerIndex: number;
  phase: MoneyGamePhase;
  lastDice: [number, number] | null;
  consecutiveDoubles: number;
  bonusRollPending: boolean;
  auction: MoneyAuctionState | null;
  activeDecisionCard: MoneyDecisionCard | null;
  lastEventCard: MoneyEventCard | null;
  roundNumber: number;
  history: string[];
  moveCount: number;
  winnerIndex: number | null;
}

const PLAYER_META: readonly {
  label: string;
  color: MoneyPlayerState['color'];
}[] = [
  { label: 'Tycoon 1', color: 'crimson' },
  { label: 'Tycoon 2', color: 'sapphire' },
  { label: 'Tycoon 3', color: 'emerald' },
  { label: 'Tycoon 4', color: 'amber' },
];

function resolveMoneyBoardConfig(raw?: unknown): MoneyBoardConfig {
  if (
    raw &&
    typeof raw === 'object' &&
    'tiles' in raw &&
    Array.isArray((raw as MoneyBoardConfig).tiles)
  ) {
    return raw as MoneyBoardConfig;
  }
  return STANDARD_MONEY_BOARD_CONFIG;
}

export function calculateNetWorth(
  state: Pick<MoneyGameState, 'players' | 'deeds' | 'boardConfig'>,
  playerIndex: number
): number {
  const player = state.players[playerIndex];
  if (!player || player.insolvent) return 0;

  let equity = player.cash + player.savings;
  for (const [tileStr, deed] of Object.entries(state.deeds)) {
    if (deed.ownerIndex !== playerIndex) continue;
    const tile = state.boardConfig.tiles[Number(tileStr)];
    if (!tile) continue;
    equity += (tile.price ?? 0) + deed.upgradeLevel * (tile.upgradeCost ?? 0);
  }
  return equity;
}

export function ownsColorGroup(
  boardConfig: MoneyBoardConfig,
  deeds: Record<number, MoneyDeedOwnership>,
  ownerIndex: number,
  group: string | undefined
): boolean {
  if (!group) return false;
  const groupTiles = boardConfig.tiles.filter(
    (t) => t.kind === 'property' && t.group === group
  );
  if (groupTiles.length === 0) return false;
  return groupTiles.every((t) => deeds[t.index]?.ownerIndex === ownerIndex);
}

function settleCashDeficit(params: {
  player: MoneyPlayerState;
  deeds: Record<number, MoneyDeedOwnership>;
  boardConfig: MoneyBoardConfig;
  events: GameEvent[];
  playerIdx: number;
}): { player: MoneyPlayerState; deeds: Record<number, MoneyDeedOwnership> } {
  const { boardConfig, events, playerIdx } = params;
  const p = { ...params.player };
  const nextDeeds = { ...params.deeds };

  if (p.cash < 0 && p.savings > 0) {
    const needed = Math.min(p.savings, -p.cash);
    p.savings -= needed;
    p.cash += needed;
    events.push({
      type: 'move',
      label: `${p.label} drew ¢${needed} from Savings to cover expenses.`,
      actorIndex: playerIdx,
    });
  }

  // Liquidate deeds at 50% value if still negative
  if (p.cash < 0) {
    for (const [tileStr, ownership] of Object.entries(nextDeeds)) {
      if (p.cash >= 0) break;
      if (ownership.ownerIndex !== playerIdx) continue;
      const tileIdx = Number(tileStr);
      const tile = boardConfig.tiles[tileIdx];
      const refund = Math.floor(
        ((tile?.price ?? 0) + ownership.upgradeLevel * (tile?.upgradeCost ?? 0)) * 0.5
      );
      p.cash += refund;
      delete nextDeeds[tileIdx];
      events.push({
        type: 'hazard',
        label: `${p.label} liquidated ${tile?.name ?? 'Deed'} for ¢${refund}.`,
        actorIndex: playerIdx,
      });
    }
  }

  if (p.cash < 0) {
    p.insolvent = true;
    p.cash = 0;
    p.savings = 0;
    events.push({
      type: 'hazard',
      label: `${p.label} is insolvent!`,
      actorIndex: playerIdx,
    });
  }

  return { player: p, deeds: nextDeeds };
}

function findNextSolventIndex(
  players: readonly MoneyPlayerState[],
  currentIdx: number
): { nextIdx: number; wrappedRound: boolean } {
  let idx = currentIdx;
  let wrapped = false;
  for (let i = 0; i < players.length; i++) {
    const candidate = (idx + 1) % players.length;
    if (candidate <= idx) wrapped = true;
    idx = candidate;
    if (!players[idx].insolvent) {
      return { nextIdx: idx, wrappedRound: wrapped };
    }
  }
  return { nextIdx: currentIdx, wrappedRound: false };
}

function finalizeTurnOrBonus(
  state: MoneyGameState,
  events: GameEvent[]
): MoneyGameState {
  // Check target net worth or single survivor first
  const solvent = state.players.filter((p) => !p.insolvent);
  if (solvent.length === 1) {
    const winIdx = solvent[0].id;
    events.push({
      type: 'win',
      label: `${solvent[0].label} is the last solvent tycoon!`,
      actorIndex: winIdx,
    });
    return {
      ...state,
      winnerIndex: winIdx,
      phase: 'roll',
      bonusRollPending: false,
      activeDecisionCard: null,
    };
  }

  if (state.variant === 'standard') {
    for (const p of solvent) {
      const nw = calculateNetWorth(state, p.id);
      if (nw >= state.boardConfig.targetNetWorth) {
        events.push({
          type: 'win',
          label: `${p.label} reached ¢${nw} Net Worth and won!`,
          actorIndex: p.id,
        });
        return {
          ...state,
          winnerIndex: p.id,
          phase: 'roll',
          bonusRollPending: false,
          activeDecisionCard: null,
        };
      }
    }
  }

  if (state.bonusRollPending && !state.players[state.currentPlayerIndex].insolvent) {
    return {
      ...state,
      phase: 'roll',
      bonusRollPending: false,
      activeDecisionCard: null,
    };
  }

  const { nextIdx, wrappedRound } = findNextSolventIndex(
    state.players,
    state.currentPlayerIndex
  );
  const nextRound = wrappedRound ? state.roundNumber + 1 : state.roundNumber;

  if (
    state.variant === 'sprint' &&
    wrappedRound &&
    nextRound > state.boardConfig.sprintMaxRounds
  ) {
    let bestIdx = solvent[0].id;
    let bestNw = -Infinity;
    for (const p of solvent) {
      const nw = calculateNetWorth(state, p.id);
      if (nw > bestNw) {
        bestNw = nw;
        bestIdx = p.id;
      }
    }
    events.push({
      type: 'win',
      label: `Sprint complete! ${state.players[bestIdx].label} wins with ¢${bestNw} Net Worth.`,
      actorIndex: bestIdx,
    });
    return {
      ...state,
      winnerIndex: bestIdx,
      phase: 'roll',
      roundNumber: state.boardConfig.sprintMaxRounds,
      bonusRollPending: false,
      activeDecisionCard: null,
    };
  }

  return {
    ...state,
    currentPlayerIndex: nextIdx,
    roundNumber: nextRound,
    phase: 'roll',
    consecutiveDoubles: 0,
    bonusRollPending: false,
    activeDecisionCard: null,
  };
}

export class MoneyGameEngine
  implements GameEngine<MoneyGameState, MoneyGameAction>
{
  readonly id = 'money_game' as const;
  readonly version = 1;

  createInitialState(config: MatchSetupConfig): MoneyGameState {
    const boardConfig = resolveMoneyBoardConfig(config.boardConfig);
    const count =
      config.mode === 'practice'
        ? 2
        : Math.min(4, Math.max(2, config.playerCount));

    const players: MoneyPlayerState[] = Array.from({ length: count }, (_, idx) => {
      const meta = PLAYER_META[idx];
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
        cash: boardConfig.startingCash,
        savings: 0,
        paydayBonus: 0,
        insured: false,
        lapsCompleted: 0,
        insolvent: false,
      };
    });

    return {
      version: this.version,
      mode: config.mode,
      difficulty: config.difficulty,
      variant: config.variant === 'sprint' ? 'sprint' : 'standard',
      rngState: createPrngState(config.seed),
      boardConfig,
      players,
      deeds: {},
      currentPlayerIndex: 0,
      phase: 'roll',
      lastDice: null,
      consecutiveDoubles: 0,
      bonusRollPending: false,
      auction: null,
      activeDecisionCard: null,
      lastEventCard: null,
      roundNumber: 1,
      history: [],
      moveCount: 0,
      winnerIndex: null,
    };
  }

  getLegalActions(state: MoneyGameState): MoneyGameAction[] {
    if (state.winnerIndex !== null) return [];
    const active = state.players[state.currentPlayerIndex];

    if (state.phase === 'roll') return [{ type: 'ROLL' }];

    if (state.phase === 'buy_or_auction') {
      const tile = state.boardConfig.tiles[active.position];
      const actions: MoneyGameAction[] = [{ type: 'START_AUCTION' }];
      if (active.cash >= (tile.price ?? 0)) {
        actions.unshift({ type: 'BUY_PROPERTY' });
      }
      return actions;
    }

    if (state.phase === 'auction' && state.auction) {
      const bidder = state.players[state.auction.currentBidderIndex];
      const actions: MoneyGameAction[] = [{ type: 'AUCTION_PASS' }];
      if (bidder.cash >= state.auction.highestBid + 20) {
        actions.push({ type: 'AUCTION_BID', increment: 20 });
      }
      if (bidder.cash >= state.auction.highestBid + 50) {
        actions.push({ type: 'AUCTION_BID', increment: 50 });
      }
      return actions;
    }

    if (state.phase === 'upgrade_prompt') {
      const tile = state.boardConfig.tiles[active.position];
      const actions: MoneyGameAction[] = [{ type: 'UPGRADE_PROPERTY', accept: false }];
      if (active.cash >= (tile.upgradeCost ?? 0)) {
        actions.unshift({ type: 'UPGRADE_PROPERTY', accept: true });
      }
      return actions;
    }

    if (state.phase === 'savings_prompt') {
      const actions: MoneyGameAction[] = [{ type: 'SAVINGS_ACTION', delta: 0 }];
      if (active.cash >= 100) actions.push({ type: 'SAVINGS_ACTION', delta: 100 });
      if (active.cash >= 250) actions.push({ type: 'SAVINGS_ACTION', delta: 250 });
      if (active.savings >= 100) actions.push({ type: 'SAVINGS_ACTION', delta: -100 });
      return actions;
    }

    if (state.phase === 'decision_prompt' && state.activeDecisionCard) {
      const card = state.activeDecisionCard;
      const actions: MoneyGameAction[] = [{ type: 'CHOOSE_DECISION', choice: 'b' }];
      if (active.cash + card.optionA.cashDelta >= 0) {
        actions.unshift({ type: 'CHOOSE_DECISION', choice: 'a' });
      }
      return actions;
    }

    return [];
  }

  validateAction(
    state: MoneyGameState,
    action: MoneyGameAction
  ): ActionValidationResult {
    if (state.winnerIndex !== null) {
      return { valid: false, reason: 'Match has already ended.' };
    }
    const active = state.players[state.currentPlayerIndex];

    if (action.type === 'ROLL') {
      return state.phase === 'roll'
        ? { valid: true }
        : { valid: false, reason: 'Resolve current tile prompt before rolling.' };
    }

    if (action.type === 'BUY_PROPERTY') {
      if (state.phase !== 'buy_or_auction') {
        return { valid: false, reason: 'No unowned property offered.' };
      }
      const tile = state.boardConfig.tiles[active.position];
      if (active.cash < (tile.price ?? 0)) {
        return { valid: false, reason: 'Insufficient Cash Credits—start a Bank Auction instead.' };
      }
      return { valid: true };
    }

    if (action.type === 'START_AUCTION') {
      return state.phase === 'buy_or_auction'
        ? { valid: true }
        : { valid: false, reason: 'No property auction available.' };
    }

    if (action.type === 'AUCTION_BID' || action.type === 'AUCTION_PASS') {
      if (state.phase !== 'auction' || !state.auction) {
        return { valid: false, reason: 'No active auction.' };
      }
      if (action.type === 'AUCTION_BID') {
        const bidder = state.players[state.auction.currentBidderIndex];
        if (bidder.cash < state.auction.highestBid + action.increment) {
          return { valid: false, reason: 'Insufficient Cash Credits for that bid.' };
        }
      }
      return { valid: true };
    }

    if (action.type === 'UPGRADE_PROPERTY') {
      if (state.phase !== 'upgrade_prompt') {
        return { valid: false, reason: 'No upgrade prompt active.' };
      }
      if (action.accept) {
        const tile = state.boardConfig.tiles[active.position];
        if (active.cash < (tile.upgradeCost ?? 0)) {
          return { valid: false, reason: 'Not enough Cash Credits to upgrade.' };
        }
      }
      return { valid: true };
    }

    if (action.type === 'SAVINGS_ACTION') {
      if (state.phase !== 'savings_prompt') {
        return { valid: false, reason: 'Not on a Savings Vault tile.' };
      }
      if (action.delta > 0 && active.cash < action.delta) {
        return { valid: false, reason: 'Insufficient Cash Credits to deposit.' };
      }
      if (action.delta < 0 && active.savings < -action.delta) {
        return { valid: false, reason: 'Insufficient Savings balance to withdraw.' };
      }
      return { valid: true };
    }

    if (action.type === 'CHOOSE_DECISION') {
      if (state.phase !== 'decision_prompt' || !state.activeDecisionCard) {
        return { valid: false, reason: 'No decision card active.' };
      }
      if (
        action.choice === 'a' &&
        active.cash + state.activeDecisionCard.optionA.cashDelta < 0
      ) {
        return { valid: false, reason: 'Insufficient Cash Credits for Option A.' };
      }
      return { valid: true };
    }

    return { valid: false, reason: 'Unknown Money Game action.' };
  }

  applyAction(
    state: MoneyGameState,
    action: MoneyGameAction
  ): EngineTransition<MoneyGameState> {
    const check = this.validateAction(state, action);
    if (!check.valid) {
      throw new Error(check.reason ?? 'Illegal Money Game action.');
    }

    const config = state.boardConfig;
    const totalTiles = config.tiles.length;
    const idx = state.currentPlayerIndex;
    let players = state.players.map((p) => ({ ...p }));
    let deeds = { ...state.deeds };
    let actor = players[idx];
    const events: GameEvent[] = [];

    if (action.type === 'ROLL') {
      const r1 = rollDie(state.rngState, 6);
      const r2 = rollDie(r1.nextState, 6);
      let rng = r2.nextState;
      const d1 = r1.roll;
      const d2 = r2.roll;
      const isDoubles = d1 === d2;
      const steps = d1 + d2;

      events.push({
        type: 'roll',
        label: `${actor.label} rolled ${d1} + ${d2} = ${steps}`,
        actorIndex: idx,
      });

      const nextDoubles = isDoubles ? state.consecutiveDoubles + 1 : 0;
      if (nextDoubles >= 3) {
        events.push({
          type: 'hazard',
          label: `${actor.label} rolled 3 consecutive doubles — Audit Cooling-Off ends turn!`,
          actorIndex: idx,
        });
        const nextState = finalizeTurnOrBonus(
          {
            ...state,
            rngState: rng,
            players,
            lastDice: [d1, d2],
            consecutiveDoubles: 0,
            bonusRollPending: false,
            moveCount: state.moveCount + 1,
            history: [
              `${actor.label}: 3× Doubles Audit — turn ended`,
              ...state.history,
            ].slice(0, 60),
          },
          events
        );
        return { state: nextState, events };
      }

      const prevPos = actor.position;
      const rawNext = prevPos + steps;
      const crossedPayday = rawNext >= totalTiles;
      const nextPos = rawNext % totalTiles;
      actor.position = nextPos;

      if (crossedPayday) {
        actor.lapsCompleted++;
        const salary = config.paydaySalary + actor.paydayBonus;
        const interest =
          Math.round(
            (actor.savings * config.savingsInterestRate) / 5
          ) * 5;
        actor.cash += salary;
        actor.savings += interest;
        events.push({
          type: 'promote',
          label: `${actor.label} passed Payday: +¢${salary} Salary & +¢${interest} Savings Interest!`,
          actorIndex: idx,
        });
      }

      const tile = config.tiles[nextPos];
      let nextPhase: MoneyGamePhase = 'roll';
      let drawnDecision: MoneyDecisionCard | null = null;
      let drawnEvent: MoneyEventCard | null = state.lastEventCard;
      let bonusPending = isDoubles;
      let note = `${actor.label}: rolled ${steps} → ${tile.name}`;

      if (tile.kind === 'property') {
        const ownership = deeds[tile.index];
        if (!ownership) {
          nextPhase = 'buy_or_auction';
        } else if (ownership.ownerIndex === idx) {
          if (
            ownsColorGroup(config, deeds, idx, tile.group) &&
            ownership.upgradeLevel < 3
          ) {
            nextPhase = 'upgrade_prompt';
          }
        } else {
          // Pay rent to rival
          const ownerIdx = ownership.ownerIndex;
          const monopoly = ownsColorGroup(config, deeds, ownerIdx, tile.group);
          const rent =
            (tile.baseRent ?? 40) * (monopoly ? 2 : 1) +
            ownership.upgradeLevel * (tile.upgradeRentBonus ?? 50);
          const paid = Math.min(rent, actor.cash + actor.savings);
          actor.cash -= rent;
          players[ownerIdx] = {
            ...players[ownerIdx],
            cash: players[ownerIdx].cash + Math.max(0, paid),
          };
          events.push({
            type: 'hazard',
            label: `${actor.label} paid ¢${rent} rent to ${players[ownerIdx].label} at ${tile.name}`,
            actorIndex: idx,
          });
          note += ` (-¢${rent} rent)`;
        }
      } else if (tile.kind === 'earning') {
        const amt = tile.amount ?? 150;
        actor.cash += amt;
        events.push({
          type: 'promote',
          label: `${actor.label} earned +¢${amt} at ${tile.name}`,
          actorIndex: idx,
        });
        note += ` (+¢${amt})`;
      } else if (tile.kind === 'expense') {
        const amt = tile.amount ?? 100;
        actor.cash -= amt;
        events.push({
          type: 'hazard',
          label: `${actor.label} paid -¢${amt} for ${tile.name}`,
          actorIndex: idx,
        });
        note += ` (-¢${amt})`;
      } else if (tile.kind === 'savings') {
        nextPhase = 'savings_prompt';
      } else if (tile.kind === 'decision') {
        const pick = rollDie(rng, config.decisionCards.length);
        rng = pick.nextState;
        drawnDecision = config.decisionCards[pick.roll - 1];
        nextPhase = 'decision_prompt';
      } else if (tile.kind === 'event') {
        const pick = rollDie(rng, config.eventCards.length);
        rng = pick.nextState;
        drawnEvent = config.eventCards[pick.roll - 1];
        if (drawnEvent.preventableByInsurance && actor.insured) {
          actor.insured = false;
          events.push({
            type: 'card',
            label: `${actor.label}'s Safety Shield blocked ${drawnEvent.title}!`,
            actorIndex: idx,
          });
          note += ` (Shielded ${drawnEvent.title})`;
        } else {
          actor.cash += drawnEvent.cashDelta;
          events.push({
            type: 'card',
            label: `${actor.label}: ${drawnEvent.title} (${
              drawnEvent.cashDelta >= 0 ? `+¢${drawnEvent.cashDelta}` : `-¢${-drawnEvent.cashDelta}`
            })`,
            actorIndex: idx,
          });
          note += ` (${drawnEvent.title})`;
        }
      }

      const settled = settleCashDeficit({
        player: actor,
        deeds,
        boardConfig: config,
        events,
        playerIdx: idx,
      });
      players[idx] = settled.player;
      deeds = settled.deeds;

      if (players[idx].insolvent) {
        nextPhase = 'roll';
        bonusPending = false;
      }

      const midState: MoneyGameState = {
        ...state,
        rngState: rng,
        players,
        deeds,
        phase: nextPhase,
        lastDice: [d1, d2],
        consecutiveDoubles: nextDoubles,
        bonusRollPending: bonusPending,
        activeDecisionCard: drawnDecision,
        lastEventCard: drawnEvent,
        moveCount: state.moveCount + 1,
        history: [note, ...state.history].slice(0, 60),
      };

      if (nextPhase === 'roll') {
        return { state: finalizeTurnOrBonus(midState, events), events };
      }
      return { state: midState, events };
    }

    if (action.type === 'BUY_PROPERTY') {
      const tile = config.tiles[actor.position];
      const price = tile.price ?? 0;
      actor.cash -= price;
      deeds[tile.index] = { ownerIndex: idx, upgradeLevel: 0 };
      players[idx] = actor;
      events.push({
        type: 'promote',
        label: `${actor.label} acquired ${tile.name} for ¢${price}!`,
        actorIndex: idx,
      });
      const next = finalizeTurnOrBonus(
        {
          ...state,
          players,
          deeds,
          moveCount: state.moveCount + 1,
          history: [
            `${actor.label}: bought ${tile.name} (¢${price})`,
            ...state.history,
          ].slice(0, 60),
        },
        events
      );
      return { state: next, events };
    }

    if (action.type === 'START_AUCTION') {
      const tile = config.tiles[actor.position];
      events.push({
        type: 'card',
        label: `Bank Auction opened for ${tile.name}!`,
        actorIndex: idx,
      });
      return {
        state: {
          ...state,
          phase: 'auction',
          auction: {
            tileIndex: tile.index,
            highestBid: 0,
            highestBidderIndex: null,
            currentBidderIndex: idx,
            passedIndices: [],
          },
          moveCount: state.moveCount + 1,
        },
        events,
      };
    }

    if (action.type === 'AUCTION_BID' || action.type === 'AUCTION_PASS') {
      const auc = { ...state.auction!, passedIndices: [...state.auction!.passedIndices] };
      const bidderIdx = auc.currentBidderIndex;
      const tile = config.tiles[auc.tileIndex];

      if (action.type === 'AUCTION_BID') {
        auc.highestBid += action.increment;
        auc.highestBidderIndex = bidderIdx;
        events.push({
          type: 'move',
          label: `${players[bidderIdx].label} bid ¢${auc.highestBid} on ${tile.name}`,
          actorIndex: bidderIdx,
        });
      } else {
        if (!auc.passedIndices.includes(bidderIdx)) {
          auc.passedIndices.push(bidderIdx);
        }
        events.push({
          type: 'move',
          label: `${players[bidderIdx].label} passed on ${tile.name}`,
          actorIndex: bidderIdx,
        });
      }

      const activeBidders = players.filter(
        (p) => !p.insolvent && !auc.passedIndices.includes(p.id)
      );

      // Auction ends when <= 1 non-passed player remains AND either everyone passed or highest bidder stands unopposed
      const auctionDone =
        activeBidders.length === 0 ||
        (activeBidders.length === 1 && auc.highestBidderIndex === activeBidders[0].id);

      if (auctionDone) {
        let logEntry = `Auction for ${tile.name}: Passed (Unowned)`;
        if (auc.highestBidderIndex !== null && auc.highestBid > 0) {
          const winner = players[auc.highestBidderIndex];
          winner.cash -= auc.highestBid;
          players[auc.highestBidderIndex] = winner;
          deeds[tile.index] = {
            ownerIndex: auc.highestBidderIndex,
            upgradeLevel: 0,
          };
          logEntry = `${winner.label} won ${tile.name} at auction for ¢${auc.highestBid}`;
          events.push({
            type: 'promote',
            label: logEntry,
            actorIndex: auc.highestBidderIndex,
          });
        }
        const next = finalizeTurnOrBonus(
          {
            ...state,
            players,
            deeds,
            auction: null,
            moveCount: state.moveCount + 1,
            history: [logEntry, ...state.history].slice(0, 60),
          },
          events
        );
        return { state: next, events };
      }

      // Advance to next active bidder in rotation
      let nextBidder = (bidderIdx + 1) % players.length;
      for (let g = 0; g < players.length; g++) {
        if (
          !players[nextBidder].insolvent &&
          !auc.passedIndices.includes(nextBidder)
        ) {
          break;
        }
        nextBidder = (nextBidder + 1) % players.length;
      }
      auc.currentBidderIndex = nextBidder;

      return {
        state: {
          ...state,
          auction: auc,
          moveCount: state.moveCount + 1,
        },
        events,
      };
    }

    if (action.type === 'UPGRADE_PROPERTY') {
      const tile = config.tiles[actor.position];
      let note = `${actor.label}: kept ${tile.name} at Tier ${deeds[tile.index].upgradeLevel}`;
      if (action.accept) {
        const cost = tile.upgradeCost ?? 100;
        actor.cash -= cost;
        players[idx] = actor;
        deeds[tile.index] = {
          ...deeds[tile.index],
          upgradeLevel: deeds[tile.index].upgradeLevel + 1,
        };
        note = `${actor.label}: upgraded ${tile.name} to Tier ${deeds[tile.index].upgradeLevel} (-¢${cost})`;
        events.push({
          type: 'promote',
          label: note,
          actorIndex: idx,
        });
      }
      const next = finalizeTurnOrBonus(
        {
          ...state,
          players,
          deeds,
          moveCount: state.moveCount + 1,
          history: [note, ...state.history].slice(0, 60),
        },
        events
      );
      return { state: next, events };
    }

    if (action.type === 'SAVINGS_ACTION') {
      actor.cash -= action.delta;
      actor.savings += action.delta;
      players[idx] = actor;
      const note =
        action.delta > 0
          ? `${actor.label}: deposited ¢${action.delta} into Savings`
          : action.delta < 0
          ? `${actor.label}: withdrew ¢${-action.delta} from Savings`
          : `${actor.label}: held Savings balance`;
      events.push({ type: 'move', label: note, actorIndex: idx });
      const next = finalizeTurnOrBonus(
        {
          ...state,
          players,
          moveCount: state.moveCount + 1,
          history: [note, ...state.history].slice(0, 60),
        },
        events
      );
      return { state: next, events };
    }

    // action.type === 'CHOOSE_DECISION'
    const card = state.activeDecisionCard!;
    const picked = action.choice === 'a' ? card.optionA : card.optionB;
    actor.cash += picked.cashDelta;
    actor.savings += picked.savingsDelta;
    actor.paydayBonus += picked.paydayBonusDelta;
    if (action.choice === 'a' && card.optionA.insured) {
      actor.insured = true;
    }
    players[idx] = actor;

    const note = `${actor.label}: ${card.title} → ${picked.label}`;
    events.push({ type: 'card', label: note, actorIndex: idx });
    const next = finalizeTurnOrBonus(
      {
        ...state,
        players,
        activeDecisionCard: null,
        moveCount: state.moveCount + 1,
        history: [note, ...state.history].slice(0, 60),
      },
      events
    );
    return { state: next, events };
  }

  evaluateOutcome(state: MoneyGameState): GameOutcome | null {
    if (state.winnerIndex === null) return null;
    const winner = state.players[state.winnerIndex];
    const nw = calculateNetWorth(state, state.winnerIndex);
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
      score: nw,
      reason: `${winner.label} wins with ¢${nw.toLocaleString()} Net Worth!`,
    };
  }

  computeBotMove(
    state: MoneyGameState,
    difficulty: AIDifficulty
  ): MoneyGameAction | null {
    if (state.winnerIndex !== null) return null;

    if (state.phase === 'roll') return { type: 'ROLL' };

    const active = state.players[state.currentPlayerIndex];
    const hasGroupDeed = (tileIndex: number, playerId: number): boolean => {
      const targetTile = state.boardConfig.tiles[tileIndex];
      if (!targetTile?.group) return false;
      return state.boardConfig.tiles.some(
        (t) =>
          t.index !== tileIndex &&
          t.group === targetTile.group &&
          state.deeds[t.index]?.ownerIndex === playerId
      );
    };

    const reserve =
      difficulty === 'easy' ? 240 : difficulty === 'medium' ? 140 : 90;

    if (state.phase === 'buy_or_auction') {
      const tile = state.boardConfig.tiles[active.position];
      const price = tile.price ?? 0;
      const synergy = difficulty === 'hard' && hasGroupDeed(active.position, active.id);
      const effectiveReserve = synergy ? 50 : reserve;
      if (active.cash - price >= effectiveReserve) {
        return { type: 'BUY_PROPERTY' };
      }
      return { type: 'START_AUCTION' };
    }

    if (state.phase === 'auction' && state.auction) {
      const bidder = state.players[state.auction.currentBidderIndex];
      const tile = state.boardConfig.tiles[state.auction.tileIndex];
      const synergy =
        difficulty === 'hard' && hasGroupDeed(state.auction.tileIndex, bidder.id);
      const mult =
        difficulty === 'easy'
          ? 0.6
          : difficulty === 'medium'
          ? 0.85
          : synergy
          ? 1.35
          : 1.05;
      const maxWilling = Math.floor((tile.price ?? 150) * mult);
      if (
        state.auction.highestBidderIndex !== bidder.id &&
        state.auction.highestBid + 20 <= maxWilling &&
        bidder.cash - (state.auction.highestBid + 20) >= (synergy ? 40 : 80)
      ) {
        return { type: 'AUCTION_BID', increment: 20 };
      }
      return { type: 'AUCTION_PASS' };
    }

    if (state.phase === 'upgrade_prompt') {
      const tile = state.boardConfig.tiles[active.position];
      const cost = tile.upgradeCost ?? 100;
      if (difficulty === 'easy') {
        return { type: 'UPGRADE_PROPERTY', accept: active.cash - cost >= 350 };
      }
      return {
        type: 'UPGRADE_PROPERTY',
        accept: active.cash - cost >= reserve,
      };
    }

    if (state.phase === 'savings_prompt') {
      if (difficulty === 'easy') {
        return { type: 'SAVINGS_ACTION', delta: 0 };
      }
      if (active.cash >= 450) return { type: 'SAVINGS_ACTION', delta: 250 };
      if (active.cash >= 260) return { type: 'SAVINGS_ACTION', delta: 100 };
      return { type: 'SAVINGS_ACTION', delta: 0 };
    }

    if (state.phase === 'decision_prompt' && state.activeDecisionCard) {
      const canAffordA =
        active.cash + state.activeDecisionCard.optionA.cashDelta >=
        (difficulty === 'easy' ? 160 : 70);
      return { type: 'CHOOSE_DECISION', choice: canAffordA ? 'a' : 'b' };
    }

    return null;
  }

  serialize(state: MoneyGameState): string {
    return JSON.stringify(state);
  }

  deserialize(raw: string): MoneyGameState {
    return JSON.parse(raw) as MoneyGameState;
  }
}

export const moneyGameEngine = new MoneyGameEngine();
