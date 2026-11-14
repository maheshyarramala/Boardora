import { createHmac, randomInt } from 'node:crypto';
import { Chess } from 'chess.js';
import type { ActionValidationResult, GameEngine, GameEvent, GameOutcome, MatchSetupConfig } from '../core/engine';
import type { AIDifficulty, AvatarId, GameId, MatchOutcome } from '../core/types';
import { backgammonEngine } from '../engines/backgammon/backgammonEngine';
import { checkersEngine, type CheckersState } from '../engines/checkers/checkersEngine';
import { chessEngine, type ChessState } from '../engines/chess/chessEngine';
import { driveYourCarEngine, type DriveYourCarState } from '../engines/driveYourCar/driveYourCarEngine';
import { ludoEngine, type LudoState } from '../engines/ludo/ludoEngine';
import { moneyGameEngine, type MoneyGameState } from '../engines/moneyGame/moneyGameEngine';
import { nineMensMorrisEngine, type NineMensMorrisState } from '../engines/nineMensMorris/nineMensMorrisEngine';
import { pegSolitaireEngine } from '../engines/pegSolitaire/pegSolitaireEngine';
import { snakesLaddersEngine, type SnakesLaddersState } from '../engines/snakesLadders/snakesLaddersEngine';
import { travelGameEngine, type TravelGameState } from '../engines/travelGame/travelGameEngine';

export type RoomStatus = 'waiting' | 'active' | 'finished';

export interface RoomSeat {
  seatIndex: number;
  uid: string;
  displayName: string;
  avatarId: AvatarId;
  ready: boolean;
  connected: boolean;
}

export interface RoomRecord {
  roomCode: string;
  hostUid: string;
  gameId: GameId;
  difficulty: AIDifficulty;
  maxPlayers: number;
  variant?: string;
  seed: number;
  status: RoomStatus;
  seats: RoomSeat[];
  version: number;
  engineState: unknown;
  lastEvents: GameEvent[];
  winnerUid: string | null;
  winnerSeatIndex: number | null;
  outcomeReason: string | null;
  outcomeScore?: number;
  authoritativeReceipt: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ClientRoomSnapshot {
  roomCode: string;
  hostUid: string;
  gameId: GameId;
  difficulty: AIDifficulty;
  maxPlayers: number;
  variant?: string;
  seed: number;
  status: RoomStatus;
  seats: RoomSeat[];
  version: number;
  activeSeatIndex: number | null;
  serializedState: string | null;
  lastEvents: GameEvent[];
  winnerUid: string | null;
  winnerSeatIndex: number | null;
  outcomeForViewer: MatchOutcome | null;
  outcomeReason: string | null;
  outcomeScore?: number;
  authoritativeReceipt: string | null;
  updatedAt: number;
}

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function getServerEngine(gameId: GameId): GameEngine<unknown, unknown> {
  switch (gameId) {
    case 'ludo':
      return ludoEngine as unknown as GameEngine<unknown, unknown>;
    case 'snakes_ladders':
      return snakesLaddersEngine as unknown as GameEngine<unknown, unknown>;
    case 'chess':
      return chessEngine as unknown as GameEngine<unknown, unknown>;
    case 'checkers':
      return checkersEngine as unknown as GameEngine<unknown, unknown>;
    case 'peg_solitaire':
      return pegSolitaireEngine as unknown as GameEngine<unknown, unknown>;
    case 'nine_mens_morris':
      return nineMensMorrisEngine as unknown as GameEngine<unknown, unknown>;
    case 'backgammon':
      return backgammonEngine as unknown as GameEngine<unknown, unknown>;
    case 'travel_game':
      return travelGameEngine as unknown as GameEngine<unknown, unknown>;
    case 'drive_your_car':
      return driveYourCarEngine as unknown as GameEngine<unknown, unknown>;
    case 'money_game':
      return moneyGameEngine as unknown as GameEngine<unknown, unknown>;
  }
}

export function resolveActiveSeatIndex(gameId: GameId, state: unknown): number {
  if (!state) return 0;
  switch (gameId) {
    case 'ludo':
      return (state as LudoState).currentPlayerIndex;
    case 'snakes_ladders':
      return (state as SnakesLaddersState).currentPlayerIndex;
    case 'travel_game':
      return (state as TravelGameState).currentPlayerIndex;
    case 'drive_your_car':
      return (state as DriveYourCarState).currentPlayerIndex;
    case 'money_game': {
      const m = state as MoneyGameState;
      if (m.phase === 'auction' && m.auction) {
        return m.auction.currentBidderIndex;
      }
      return m.currentPlayerIndex;
    }
    case 'chess':
      return new Chess((state as ChessState).fen).turn() === 'w' ? 0 : 1;
    case 'checkers':
      return (state as CheckersState).turn === 'r' ? 0 : 1;
    case 'nine_mens_morris':
      return (state as NineMensMorrisState).turn === 'w' ? 0 : 1;
    case 'backgammon':
      return (state as { turn: 'w' | 'b' }).turn === 'w' ? 0 : 1;
    case 'peg_solitaire':
      return 0;
  }
}

export class AuthoritativeRoomManager {
  private readonly rooms = new Map<string, RoomRecord>();
  private readonly signingSecret: string;

  constructor(signingSecret = process.env.OUTCOME_SIGNING_SECRET ?? process.env.BOARDORA_SIGNING_SECRET ?? 'boardora-authoritative-secret-v1') {
    this.signingSecret = signingSecret;
  }

  private generateRoomCode(): string {
    for (let attempt = 0; attempt < 24; attempt++) {
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += ROOM_ALPHABET[randomInt(0, ROOM_ALPHABET.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    return `CP${Date.now().toString(36).toUpperCase().slice(-6)}`;
  }

  private signOutcomeReceipt(params: {
    roomCode: string;
    gameId: GameId;
    version: number;
    winnerUid: string | null;
    reason: string;
  }): string {
    const payload = `${params.roomCode}|${params.gameId}|${params.version}|${params.winnerUid ?? 'draw'}|${params.reason}`;
    return createHmac('sha256', this.signingSecret)
      .update(payload)
      .digest('hex')
      .slice(0, 48);
  }

  verifyOutcomeReceipt(params: {
    roomCode: string;
    gameId: GameId;
    version: number;
    winnerUid: string | null;
    reason: string;
    receipt: string;
  }): boolean {
    const expected = this.signOutcomeReceipt(params);
    return expected === params.receipt;
  }

  createRoom(params: {
    hostUid: string;
    hostName: string;
    hostAvatarId?: AvatarId;
    gameId: GameId;
    difficulty: AIDifficulty;
    maxPlayers: number;
    variant?: string;
    seed?: number;
  }): RoomRecord {
    if (params.gameId === 'peg_solitaire') {
      throw new Error('Peg Solitaire is a single-player puzzle and does not use online rooms.');
    }
    const maxPlayers =
      params.gameId === 'chess' ||
      params.gameId === 'checkers' ||
      params.gameId === 'nine_mens_morris' ||
      params.gameId === 'backgammon'
        ? 2
        : Math.min(4, Math.max(2, Math.floor(params.maxPlayers)));

    const now = Date.now();
    const roomCode = this.generateRoomCode();
    const record: RoomRecord = {
      roomCode,
      hostUid: params.hostUid,
      gameId: params.gameId,
      difficulty: params.difficulty,
      maxPlayers,
      variant: params.variant,
      seed: typeof params.seed === 'number' ? params.seed >>> 0 : (now >>> 0),
      status: 'waiting',
      seats: [
        {
          seatIndex: 0,
          uid: params.hostUid,
          displayName: params.hostName.trim().slice(0, 32) || 'Host Player',
          avatarId: params.hostAvatarId ?? 'royal-knight',
          ready: true,
          connected: true,
        },
      ],
      version: 0,
      engineState: null,
      lastEvents: [],
      winnerUid: null,
      winnerSeatIndex: null,
      outcomeReason: null,
      authoritativeReceipt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rooms.set(roomCode, record);
    return record;
  }

  getRoom(roomCode: string): RoomRecord | null {
    return this.rooms.get(roomCode.toUpperCase()) ?? null;
  }

  joinRoom(params: {
    roomCode: string;
    uid: string;
    displayName: string;
    avatarId?: AvatarId;
  }): RoomRecord {
    const code = params.roomCode.trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) {
      throw new Error(`Room ${code} was not found.`);
    }

    const existingSeat = room.seats.find((s) => s.uid === params.uid);
    if (existingSeat) {
      existingSeat.connected = true;
      existingSeat.displayName =
        params.displayName.trim().slice(0, 32) || existingSeat.displayName;
      if (params.avatarId) existingSeat.avatarId = params.avatarId;
      room.updatedAt = Date.now();
      return room;
    }

    if (room.status !== 'waiting') {
      throw new Error('This match is already underway and cannot accept new players.');
    }
    if (room.seats.length >= room.maxPlayers) {
      throw new Error('This table room is already full.');
    }

    room.seats.push({
      seatIndex: room.seats.length,
      uid: params.uid,
      displayName: params.displayName.trim().slice(0, 32) || `Player ${room.seats.length + 1}`,
      avatarId: params.avatarId ?? 'golden-crown',
      ready: false,
      connected: true,
    });
    room.updatedAt = Date.now();
    return room;
  }

  setReady(params: { roomCode: string; uid: string; ready: boolean }): RoomRecord {
    const room = this.getRoom(params.roomCode);
    if (!room) throw new Error('Room not found.');
    if (room.status !== 'waiting') {
      throw new Error('Ready status can only be changed while waiting in the lobby.');
    }
    const seat = room.seats.find((s) => s.uid === params.uid);
    if (!seat) throw new Error('You are not seated in this room.');

    seat.ready = params.ready;
    room.updatedAt = Date.now();
    return room;
  }

  setPresence(roomCode: string, uid: string, connected: boolean): RoomRecord | null {
    const room = this.getRoom(roomCode);
    if (!room) return null;
    const seat = room.seats.find((s) => s.uid === uid);
    if (!seat) return room;
    seat.connected = connected;
    room.updatedAt = Date.now();
    return room;
  }

  startMatch(params: { roomCode: string; uid: string }): RoomRecord {
    const room = this.getRoom(params.roomCode);
    if (!room) throw new Error('Room not found.');
    if (room.hostUid !== params.uid) {
      throw new Error('Only the room host can launch the match.');
    }
    if (room.status !== 'waiting') {
      throw new Error('Match has already started.');
    }
    if (room.seats.length < 2) {
      throw new Error('At least 2 players must join before starting.');
    }
    if (!room.seats.every((s) => s.ready)) {
      throw new Error('All seated players must mark Ready before launching.');
    }

    const engine = getServerEngine(room.gameId);
    const setup: MatchSetupConfig = {
      gameId: room.gameId,
      mode: 'online',
      difficulty: room.difficulty,
      playerCount: room.seats.length,
      seed: room.seed,
      variant: room.variant,
    };
    room.engineState = engine.createInitialState(setup);
    room.status = 'active';
    room.version += 1;
    room.lastEvents = [
      {
        type: 'move',
        label: 'Authoritative online match started.',
        actorIndex: 0,
      },
    ];
    room.updatedAt = Date.now();
    return room;
  }

  submitAction(params: {
    roomCode: string;
    actorUid: string;
    expectedVersion: number;
    action: unknown;
  }): {
    accepted: boolean;
    reason?: string;
    room?: RoomRecord;
    outcome?: GameOutcome | null;
  } {
    const room = this.getRoom(params.roomCode);
    if (!room) {
      return { accepted: false, reason: 'Room not found.' };
    }
    if (room.status === 'finished') {
      return { accepted: false, reason: 'Match is already concluded and locked.' };
    }
    if (room.status !== 'active' || !room.engineState) {
      return { accepted: false, reason: 'Match has not started yet.' };
    }
    if (params.expectedVersion !== room.version) {
      return {
        accepted: false,
        reason: `Version conflict: expected v${room.version}, got v${params.expectedVersion}.`,
      };
    }

    const seat = room.seats.find((s) => s.uid === params.actorUid);
    if (!seat) {
      return { accepted: false, reason: 'Unauthorized: actor is not seated in this room.' };
    }

    const activeSeatIndex = resolveActiveSeatIndex(room.gameId, room.engineState);
    if (seat.seatIndex !== activeSeatIndex) {
      return {
        accepted: false,
        reason: `Out of turn: waiting for ${room.seats[activeSeatIndex]?.displayName ?? 'opponent'}.`,
      };
    }

    const engine = getServerEngine(room.gameId);
    let validation: ActionValidationResult;
    try {
      validation = engine.validateAction(room.engineState, params.action);
    } catch {
      validation = { valid: false, reason: 'Malformed action payload.' };
    }

    if (!validation.valid) {
      return { accepted: false, reason: validation.reason ?? 'Illegal move.' };
    }

    const transition = engine.applyAction(room.engineState, params.action);
    const outcome = engine.evaluateOutcome(transition.state);

    room.engineState = transition.state;
    room.lastEvents = [...transition.events];
    room.version += 1;
    room.updatedAt = Date.now();

    if (outcome?.finished) {
      room.status = 'finished';
      room.winnerSeatIndex = outcome.winnerIndex;
      room.winnerUid =
        outcome.winnerIndex !== null
          ? room.seats[outcome.winnerIndex]?.uid ?? null
          : null;
      room.outcomeReason = outcome.reason;
      room.outcomeScore = outcome.score;
      room.authoritativeReceipt = this.signOutcomeReceipt({
        roomCode: room.roomCode,
        gameId: room.gameId,
        version: room.version,
        winnerUid: room.winnerUid,
        reason: outcome.reason,
      });
    }

    return { accepted: true, room, outcome };
  }

  toClientSnapshot(room: RoomRecord, viewerUid?: string | null): ClientRoomSnapshot {
    const engine = getServerEngine(room.gameId);
    let outcomeForViewer: MatchOutcome | null = null;
    if (room.status === 'finished') {
      if (room.winnerSeatIndex === null) {
        outcomeForViewer = 'draw';
      } else if (viewerUid && room.winnerUid) {
        outcomeForViewer = room.winnerUid === viewerUid ? 'win' : 'loss';
      } else {
        outcomeForViewer = 'win';
      }
    }

    return {
      roomCode: room.roomCode,
      hostUid: room.hostUid,
      gameId: room.gameId,
      difficulty: room.difficulty,
      maxPlayers: room.maxPlayers,
      variant: room.variant,
      seed: room.seed,
      status: room.status,
      seats: room.seats.map((s) => ({ ...s })),
      version: room.version,
      activeSeatIndex:
        room.status === 'active' && room.engineState
          ? resolveActiveSeatIndex(room.gameId, room.engineState)
          : null,
      serializedState: room.engineState ? engine.serialize(room.engineState) : null,
      lastEvents: [...room.lastEvents],
      winnerUid: room.winnerUid,
      winnerSeatIndex: room.winnerSeatIndex,
      outcomeForViewer,
      outcomeReason: room.outcomeReason,
      outcomeScore: room.outcomeScore,
      authoritativeReceipt: room.authoritativeReceipt,
      updatedAt: room.updatedAt,
    };
  }
}
