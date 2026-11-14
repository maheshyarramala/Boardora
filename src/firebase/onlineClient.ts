import type { GameEvent } from '../core/engine';
import type { AIDifficulty, AvatarId, GameId, MatchOutcome } from '../core/types';
import { getFirebaseIdToken } from './client';

export interface OnlineRoomSeat {
  seatIndex: number;
  uid: string;
  displayName: string;
  avatarId: AvatarId;
  ready: boolean;
  connected: boolean;
}

export interface OnlineRoomSnapshot {
  roomCode: string;
  hostUid: string;
  gameId: GameId;
  difficulty: AIDifficulty;
  maxPlayers: number;
  variant?: string;
  seed: number;
  status: 'waiting' | 'active' | 'finished';
  seats: OnlineRoomSeat[];
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

async function authedFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const token = await getFirebaseIdToken();
  if (!token) {
    throw new Error('Sign in with Google first to play Online Multiplayer.');
  }
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed (${res.status}).`);
  }
  return body;
}

export async function createOnlineRoom(params: {
  gameId: GameId;
  difficulty: AIDifficulty;
  maxPlayers: number;
  variant?: string;
  displayName: string;
  avatarId: AvatarId;
}): Promise<OnlineRoomSnapshot> {
  const data = await authedFetch<{ room: OnlineRoomSnapshot }>('/api/rooms', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return data.room;
}

export async function getOnlineRoom(roomCode: string): Promise<OnlineRoomSnapshot> {
  const data = await authedFetch<{ room: OnlineRoomSnapshot }>(
    `/api/rooms/${encodeURIComponent(roomCode.trim().toUpperCase())}`
  );
  return data.room;
}

export async function joinOnlineRoom(params: {
  roomCode: string;
  displayName: string;
  avatarId: AvatarId;
}): Promise<OnlineRoomSnapshot> {
  const code = params.roomCode.trim().toUpperCase();
  const data = await authedFetch<{ room: OnlineRoomSnapshot }>(
    `/api/rooms/${encodeURIComponent(code)}/join`,
    {
      method: 'POST',
      body: JSON.stringify({
        displayName: params.displayName,
        avatarId: params.avatarId,
      }),
    }
  );
  return data.room;
}

export type SocketConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export class OnlineRoomSocket {
  private ws: WebSocket | null = null;
  private closedByClient = false;
  private reconnectAttempt = 0;
  private reconnectTimer: number | null = null;
  private readonly roomCode: string;
  private onSnapshot: (room: OnlineRoomSnapshot) => void;
  private onRejected: (message: string) => void;
  private onConnection: (state: SocketConnectionState) => void;

  constructor(params: {
    roomCode: string;
    onSnapshot: (room: OnlineRoomSnapshot) => void;
    onRejected: (message: string) => void;
    onConnection: (state: SocketConnectionState) => void;
  }) {
    this.roomCode = params.roomCode.toUpperCase();
    this.onSnapshot = params.onSnapshot;
    this.onRejected = params.onRejected;
    this.onConnection = params.onConnection;
    void this.connect(false);
  }

  updateHandlers(handlers: {
    onSnapshot?: (room: OnlineRoomSnapshot) => void;
    onRejected?: (message: string) => void;
    onConnection?: (state: SocketConnectionState) => void;
  }) {
    if (handlers.onSnapshot) this.onSnapshot = handlers.onSnapshot;
    if (handlers.onRejected) this.onRejected = handlers.onRejected;
    if (handlers.onConnection) this.onConnection = handlers.onConnection;
  }

  private async connect(isReconnect: boolean) {
    if (this.closedByClient || typeof window === 'undefined') return;
    this.onConnection(isReconnect ? 'reconnecting' : 'connecting');

    const token = await getFirebaseIdToken(isReconnect);
    if (!token || this.closedByClient) {
      this.onConnection('disconnected');
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);
    this.ws = socket;

    socket.addEventListener('open', () => {
      if (this.closedByClient) {
        socket.close();
        return;
      }
      this.reconnectAttempt = 0;
      socket.send(
        JSON.stringify({
          type: 'AUTH',
          token,
          roomCode: this.roomCode,
        })
      );
      this.onConnection('connected');
    });

    socket.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as {
          type: string;
          room?: OnlineRoomSnapshot;
          error?: string;
        };
        if (msg.type === 'ROOM_STATE' && msg.room) {
          this.onSnapshot(msg.room);
        } else if (
          (msg.type === 'ACTION_REJECTED' || msg.type === 'ERROR') &&
          msg.error
        ) {
          this.onRejected(msg.error);
        }
      } catch {
        // Ignore malformed messages
      }
    });

    socket.addEventListener('close', () => {
      if (this.closedByClient) {
        this.onConnection('disconnected');
        return;
      }
      this.scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    });
  }

  private scheduleReconnect() {
    if (this.closedByClient || typeof window === 'undefined') return;
    this.onConnection('reconnecting');
    const delayMs = Math.min(5000, 1000 * Math.pow(2, this.reconnectAttempt));
    this.reconnectAttempt += 1;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
    }
    this.reconnectTimer = window.setTimeout(() => {
      void this.connect(true);
    }, delayMs);
  }

  sendReady(ready: boolean) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'READY', ready }));
    }
  }

  sendStart() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'START' }));
    }
  }

  sendAction(expectedVersion: number, action: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'ACTION', expectedVersion, action }));
    } else {
      this.onRejected('Reconnecting to game server—please retry your move.');
    }
  }

  close() {
    this.closedByClient = true;
    if (this.reconnectTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
