import { describe, expect, it } from 'vitest';
import {
  STANDARD_DRIVE_TRACK_CONFIG,
  type DriveTrackConfig,
} from '../engines/driveYourCar/driveTrackConfig';
import { driveYourCarEngine } from '../engines/driveYourCar/driveYourCarEngine';
import {
  STANDARD_MONEY_BOARD_CONFIG,
  type MoneyBoardConfig,
} from '../engines/moneyGame/moneyBoardConfig';
import {
  calculateNetWorth,
  moneyGameEngine,
} from '../engines/moneyGame/moneyGameEngine';
import {
  STANDARD_TRAVEL_BOARD_CONFIG,
  type TravelBoardConfig,
} from '../engines/travelGame/travelBoardConfig';
import { travelGameEngine } from '../engines/travelGame/travelGameEngine';

describe('Stage 6 — Travel Game Engine', () => {
  it('collects continental stamps, enforces ticket availability for shortcuts, supports custom board config, and detects finish', () => {
    const customConfig: TravelBoardConfig = {
      ...STANDARD_TRAVEL_BOARD_CONFIG,
      id: 'mini-tour-8',
      requiredStamps: ['americas'],
      tiles: [
        { index: 0, name: 'Start HQ', region: 'Hub', kind: 'terminal', x: 50, y: 50 },
        { index: 1, name: 'Sky Hub', region: 'Air', kind: 'hub', hubMode: 'air', shortcutTo: 4, x: 100, y: 50 },
        { index: 2, name: 'Stop 2', region: 'A', kind: 'station', x: 150, y: 50 },
        { index: 3, name: 'Stop 3', region: 'A', kind: 'station', x: 200, y: 50 },
        { index: 4, name: 'Americas Gate', region: 'Americas', kind: 'checkpoint', checkpointId: 'americas', x: 250, y: 50 },
        { index: 5, name: 'Return Leg', region: 'Sea', kind: 'station', x: 200, y: 120 },
      ],
    };

    const state = travelGameEngine.createInitialState({
      gameId: 'travel_game',
      mode: 'local',
      difficulty: 'medium',
      playerCount: 2,
      seed: 12,
      boardConfig: customConfig,
    });
    expect(state.boardConfig.id).toBe('mini-tour-8');

    // Place P0 on Sky Hub with 0 air tickets -> shortcut must be rejected
    const noTicketState = {
      ...state,
      phase: 'choose_route' as const,
      pendingSteps: 2,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, position: 1, tickets: { air: 0, rail: 1, sea: 1 } } : p
      ),
    };
    expect(
      travelGameEngine.validateAction(noTicketState, {
        type: 'CHOOSE_ROUTE',
        useShortcut: true,
      }).valid
    ).toBe(false);

    // With 1 air ticket -> shortcut jumps to 4 (earns 'americas' stamp) + remaining 1 step -> tile 5
    const withTicket = {
      ...noTicketState,
      players: noTicketState.players.map((p, i) =>
        i === 0 ? { ...p, tickets: { air: 1, rail: 1, sea: 1 } } : p
      ),
    };
    const afterShortcut = travelGameEngine.applyAction(withTicket, {
      type: 'CHOOSE_ROUTE',
      useShortcut: true,
    }).state;
    expect(afterShortcut.players[0].stamps).toContain('americas');
    expect(afterShortcut.players[0].tickets.air).toBe(0);

    // Reaching tile 0 with all required stamps wins!
    const nearFinish = {
      ...afterShortcut,
      currentPlayerIndex: 0,
      phase: 'choose_route' as const,
      pendingSteps: 2,
      players: afterShortcut.players.map((p, i) =>
        i === 0 ? { ...p, position: 5, stamps: ['americas'] } : p
      ),
    };
    const wonState = travelGameEngine.applyAction(nearFinish, {
      type: 'CHOOSE_ROUTE',
      useShortcut: false,
    }).state;
    const outcome = travelGameEngine.evaluateOutcome(wonState);
    expect(outcome?.finished).toBe(true);
    expect(outcome?.winnerIndex).toBe(0);
  });
});

describe('Stage 6 — Drive Your Car Engine', () => {
  it('supports configurable tracks, lane switching, nitro, emergency coast at 0 fuel, and finish line victory', () => {
    const customTrack: DriveTrackConfig = {
      ...STANDARD_DRIVE_TRACK_CONFIG,
      id: 'sprint-10',
      totalSegments: 10,
      checkpoints: [5],
      features: [
        { segment: 2, lane: 1, kind: 'roadblock' },
        { segment: 8, lane: 0, kind: 'pit' },
      ],
    };

    let state = driveYourCarEngine.createInitialState({
      gameId: 'drive_your_car',
      mode: 'local',
      difficulty: 'medium',
      playerCount: 2,
      seed: 8,
      boardConfig: customTrack,
    });
    expect(state.trackConfig.totalSegments).toBe(10);

    // Switch to Lane 0 and verify twice-per-turn lane shift is rejected
    state = driveYourCarEngine.applyAction(state, {
      type: 'SWITCH_LANE',
      lane: 0,
    }).state;
    expect(state.players[0].lane).toBe(0);
    expect(
      driveYourCarEngine.validateAction(state, {
        type: 'SWITCH_LANE',
        lane: 1,
      }).valid
    ).toBe(false);

    // Toggle nitro arms boost
    state = driveYourCarEngine.applyAction(state, { type: 'TOGGLE_NITRO' }).state;
    expect(state.nitroArmed).toBe(true);

    // Roll advances car and consumes fuel (2) + nitro (1)
    const afterRoll = driveYourCarEngine.applyAction(state, {
      type: 'ROLL_DRIVE',
    }).state;
    expect(afterRoll.players[0].segment).toBeGreaterThan(0);
    expect(afterRoll.players[0].nitro).toBe(1);
    expect(afterRoll.players[0].fuel).toBe(8);

    // Out of fuel emergency coast prevents permanent stall
    const dryState = {
      ...afterRoll,
      currentPlayerIndex: 0,
      players: afterRoll.players.map((p, i) =>
        i === 0 ? { ...p, segment: 6, fuel: 0 } : p
      ),
    };
    const afterCoast = driveYourCarEngine.applyAction(dryState, {
      type: 'ROLL_DRIVE',
    }).state;
    expect(afterCoast.players[0].segment).toBe(7);
    expect(afterCoast.players[0].fuel).toBe(3);

    // Crossing finish segment wins
    const preFinish = {
      ...afterCoast,
      currentPlayerIndex: 0,
      players: afterCoast.players.map((p, i) =>
        i === 0 ? { ...p, segment: 9, fuel: 5 } : p
      ),
    };
    const finishState = driveYourCarEngine.applyAction(preFinish, {
      type: 'ROLL_DRIVE',
    }).state;
    const outcome = driveYourCarEngine.evaluateOutcome(finishState);
    expect(outcome?.finished).toBe(true);
    expect(outcome?.winnerIndex).toBe(0);
  });
});

describe('Stage 6 — Money Game Engine (Fictional Credits Only)', () => {
  it('handles property deeds, open bank auctions, savings compounding, decision cards, net worth, and target victory', () => {
    const customEconomy: MoneyBoardConfig = {
      ...STANDARD_MONEY_BOARD_CONFIG,
      targetNetWorth: 2200,
    };

    const state = moneyGameEngine.createInitialState({
      gameId: 'money_game',
      mode: 'ai',
      difficulty: 'medium',
      playerCount: 2,
      seed: 21,
      boardConfig: customEconomy,
    });

    // Net Worth starts at startingCash (1500)
    expect(calculateNetWorth(state, 0)).toBe(1500);

    // Simulate landing on Deed tile 1 -> Buy Property
    const offerState = {
      ...state,
      phase: 'buy_or_auction' as const,
      players: state.players.map((p, i) => (i === 0 ? { ...p, position: 1 } : p)),
    };
    const bought = moneyGameEngine.applyAction(offerState, {
      type: 'BUY_PROPERTY',
    }).state;
    expect(bought.deeds[1]?.ownerIndex).toBe(0);
    // Cash decreased by 140, but Net Worth remains 1500 (Cash 1360 + Deed 140)
    expect(bought.players[0].cash).toBe(1360);
    expect(calculateNetWorth(bought, 0)).toBe(1500);

    // Bank Auction flow when declining to buy
    let auctionState = moneyGameEngine.applyAction(offerState, {
      type: 'START_AUCTION',
    }).state;
    expect(auctionState.phase).toBe('auction');
    auctionState = moneyGameEngine.applyAction(auctionState, {
      type: 'AUCTION_BID',
      increment: 50,
    }).state;
    auctionState = moneyGameEngine.applyAction(auctionState, {
      type: 'AUCTION_PASS',
    }).state;
    expect(auctionState.deeds[1]?.ownerIndex).toBe(0);
    expect(auctionState.players[0].cash).toBe(1450);

    // Savings Vault deposit + Net Worth preservation
    const savingsOffer = {
      ...state,
      phase: 'savings_prompt' as const,
      players: state.players.map((p, i) => (i === 0 ? { ...p, position: 4 } : p)),
    };
    const afterDeposit = moneyGameEngine.applyAction(savingsOffer, {
      type: 'SAVINGS_ACTION',
      delta: 250,
    }).state;
    expect(afterDeposit.players[0].savings).toBe(250);
    expect(calculateNetWorth(afterDeposit, 0)).toBe(1500);

    // Decision Card choice boosts paydayBonus & triggers target Net Worth win when threshold crossed
    const richState = {
      ...state,
      phase: 'decision_prompt' as const,
      activeDecisionCard: customEconomy.decisionCards[1], // +190 savings for -150 cash (+40 net gain)
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, cash: 2180, savings: 0 } : p
      ),
    };
    const afterDecision = moneyGameEngine.applyAction(richState, {
      type: 'CHOOSE_DECISION',
      choice: 'a',
    }).state;
    expect(calculateNetWorth(afterDecision, 0)).toBe(2220);
    const outcome = moneyGameEngine.evaluateOutcome(afterDecision);
    expect(outcome?.finished).toBe(true);
    expect(outcome?.winnerIndex).toBe(0);
    expect(outcome?.score).toBe(2220);
  });
});
