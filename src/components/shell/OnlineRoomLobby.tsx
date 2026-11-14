import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Globe,
  LogIn,
  Play,
  RefreshCw,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { GameCatalogEntry } from '../../core/catalog';
import type { AIDifficulty } from '../../core/types';
import { ActionButton, SurfaceCard } from '../../design-system/primitives';
import {
  OnlineRoomSocket,
  createOnlineRoom,
  joinOnlineRoom,
  type OnlineRoomSnapshot,
  type SocketConnectionState,
} from '../../firebase/onlineClient';
import { audioEngine } from '../../platform/audio';
import { useAppState } from '../../state/AppStateContext';
import { AvatarCrest } from '../brand/AvatarCrest';

interface OnlineRoomLobbyProps {
  game: GameCatalogEntry;
  difficulty: AIDifficulty;
  maxPlayers: number;
  variant?: string;
  initialJoinCode?: string | null;
  onStartOnlineMatch: (
    room: OnlineRoomSnapshot,
    socket: OnlineRoomSocket
  ) => void;
}

export function OnlineRoomLobby({
  game,
  difficulty,
  maxPlayers,
  variant,
  initialJoinCode = null,
  onStartOnlineMatch,
}: OnlineRoomLobbyProps) {
  const { cloudUser, profile, signInWithGoogle } = useAppState();
  const [joinCodeInput, setJoinCodeInput] = useState(
    initialJoinCode ? initialJoinCode.toUpperCase() : ''
  );
  const [room, setRoom] = useState<OnlineRoomSnapshot | null>(null);
  const [socketRef, setSocketRef] = useState<OnlineRoomSocket | null>(null);
  const [connState, setConnState] =
    useState<SocketConnectionState>('disconnected');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Clean up socket if user leaves lobby before match launches
  useEffect(() => {
    return () => {
      if (socketRef && (!room || room.status === 'waiting')) {
        socketRef.close();
      }
    };
  }, [socketRef, room]);

  const attachSocket = (initialRoom: OnlineRoomSnapshot) => {
    socketRef?.close();
    const sock = new OnlineRoomSocket({
      roomCode: initialRoom.roomCode,
      onSnapshot: (updated) => {
        setRoom(updated);
        if (updated.status === 'active') {
          onStartOnlineMatch(updated, sock);
        }
      },
      onRejected: (msg) => {
        audioEngine.play('error');
        setErrorMsg(msg);
      },
      onConnection: (st) => {
        setConnState(st);
      },
    });
    setSocketRef(sock);
  };

  useEffect(() => {
    if (initialJoinCode && cloudUser && profile && !room && !busy) {
      void handleJoinRoom(initialJoinCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialJoinCode, cloudUser?.uid]);

  const handleCreateRoom = async () => {
    if (!cloudUser || !profile) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const created = await createOnlineRoom({
        gameId: game.id,
        difficulty,
        maxPlayers,
        variant,
        displayName: profile.displayName,
        avatarId: profile.avatarId,
      });
      setRoom(created);
      attachSocket(created);
      audioEngine.play('capture');
    } catch (err) {
      audioEngine.play('error');
      setErrorMsg(err instanceof Error ? err.message : 'Unable to create room.');
    } finally {
      setBusy(false);
    }
  };

  const handleJoinRoom = async (explicitCode?: string) => {
    if (!cloudUser || !profile) return;
    const code = (explicitCode ?? joinCodeInput).trim().toUpperCase();
    if (code.length < 4) {
      setErrorMsg('Enter a valid 6-character room code.');
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    try {
      const joined = await joinOnlineRoom({
        roomCode: code,
        displayName: profile.displayName,
        avatarId: profile.avatarId,
      });
      setRoom(joined);
      attachSocket(joined);
      if (joined.status === 'active' && socketRef) {
        onStartOnlineMatch(joined, socketRef);
      }
      audioEngine.play('wood-clack');
    } catch (err) {
      audioEngine.play('error');
      setErrorMsg(err instanceof Error ? err.message : 'Unable to join room.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!room) return;
    const url = `${window.location.origin}/?room=${room.roomCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedInvite(true);
      audioEngine.play('ui-click');
      window.setTimeout(() => setCopiedInvite(false), 2000);
    } catch {
      setErrorMsg(`Share code ${room.roomCode} or link: ${url}`);
    }
  };

  if (!cloudUser) {
    return (
      <SurfaceCard className="p-5 space-y-4 border-[var(--cp-border-strong)]">
        <div className="flex items-start gap-3">
          <Globe className="w-5 h-5 text-[var(--cp-gold)] shrink-0 mt-0.5" />
          <div>
            <h3 className="font-display text-base font-bold text-[var(--cp-text)]">
              Online Private Rooms
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--cp-text-muted)]">
              Sign in with Google to host or join private server-validated rooms with live reconnection and cloud sync.
            </p>
          </div>
        </div>
        <ActionButton
          variant="primary"
          onClick={() => {
            setErrorMsg(null);
            void signInWithGoogle().catch((err) => {
              setErrorMsg(
                err instanceof Error ? err.message : 'Google Sign-In cancelled.'
              );
            });
          }}
        >
          <LogIn className="w-4 h-4" />
          Sign in with Google to Play Online
        </ActionButton>
        {errorMsg && (
          <p className="text-xs text-red-300" role="alert">
            {errorMsg}
          </p>
        )}
      </SurfaceCard>
    );
  }

  if (!room) {
    return (
      <SurfaceCard className="p-5 space-y-4 border-[var(--cp-border-strong)]">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold text-[var(--cp-text)]">
            Private Room Lobby · {game.title}
          </h3>
          <span className="text-xs font-mono-tabular text-[var(--cp-gold)]">
            {maxPlayers} Seats max
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ActionButton
            variant="primary"
            disabled={busy}
            onClick={() => void handleCreateRoom()}
          >
            <Users className="w-4 h-4" />
            {busy ? 'Creating...' : 'Create Private Room'}
          </ActionButton>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleJoinRoom();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
              maxLength={10}
              placeholder="ROOM CODE"
              aria-label="Enter room code"
              className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-[var(--cp-surface)] border border-[var(--cp-border)] text-sm font-mono-tabular tracking-widest uppercase text-[var(--cp-text)] focus:outline-none focus:border-[var(--cp-gold)]"
            />
            <ActionButton type="submit" variant="secondary" disabled={busy}>
              Join
            </ActionButton>
          </form>
        </div>

        {errorMsg && (
          <p className="text-xs text-red-300" role="alert">
            {errorMsg}
          </p>
        )}
      </SurfaceCard>
    );
  }

  const mySeat = room.seats.find((s) => s.uid === cloudUser.uid);
  const isHost = room.hostUid === cloudUser.uid;
  const allReady = room.seats.length >= 2 && room.seats.every((s) => s.ready);

  return (
    <SurfaceCard className="p-5 space-y-4 border-[var(--cp-gold)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-semibold tracking-wider text-[var(--cp-gold)]">
            ROOM CODE
          </span>
          <div className="font-mono-tabular text-2xl font-bold tracking-[0.2em] text-[var(--cp-text)]">
            {room.roomCode}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border ${
              connState === 'connected'
                ? 'border-emerald-400/40 bg-emerald-950/50 text-emerald-200'
                : 'border-amber-400/40 bg-amber-950/50 text-amber-200'
            }`}
          >
            {connState === 'connected' ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : connState === 'reconnecting' ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            {connState === 'connected'
              ? 'Live'
              : connState === 'reconnecting'
              ? 'Reconnecting'
              : 'Connecting'}
          </span>

          <ActionButton
            variant="secondary"
            onClick={() => void handleCopyInvite()}
          >
            <Copy className="w-4 h-4" />
            {copiedInvite ? 'Copied Link' : 'Invite Friend'}
          </ActionButton>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold tracking-wider text-[var(--cp-text-muted)]">
          SEATED PLAYERS ({room.seats.length} / {room.maxPlayers})
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {room.seats.map((seat) => (
            <div
              key={seat.uid}
              className="flex items-center justify-between gap-3 rounded-xl bg-[var(--cp-surface)] border border-[var(--cp-border)] p-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <AvatarCrest avatarId={seat.avatarId} size={34} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {seat.displayName}
                    {seat.uid === room.hostUid ? ' (Host)' : ''}
                  </div>
                  <div className="text-[11px] text-[var(--cp-text-muted)]">
                    Seat {seat.seatIndex + 1} ·{' '}
                    {seat.connected ? 'Online' : 'Reconnecting...'}
                  </div>
                </div>
              </div>
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-md ${
                  seat.ready
                    ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/40'
                    : 'bg-[var(--cp-bg-elevated)] text-[var(--cp-text-muted)]'
                }`}
              >
                {seat.ready ? 'Ready' : 'Waiting'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {errorMsg && (
        <p className="text-xs text-red-300" role="alert">
          {errorMsg}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[var(--cp-border)]">
        {mySeat && (
          <ActionButton
            variant={mySeat.ready ? 'secondary' : 'primary'}
            onClick={() => {
              audioEngine.play('ui-click');
              socketRef?.sendReady(!mySeat.ready);
            }}
          >
            <CheckCircle2 className="w-4 h-4" />
            {mySeat.ready ? 'Cancel Ready' : 'Mark Ready'}
          </ActionButton>
        )}

        {isHost && (
          <ActionButton
            variant="primary"
            disabled={!allReady}
            onClick={() => {
              audioEngine.play('wood-clack');
              socketRef?.sendStart();
            }}
          >
            <Play className="w-4 h-4" />
            {room.seats.length < 2
              ? 'Waiting for Opponent...'
              : !allReady
              ? 'Waiting for Ready...'
              : 'Launch Online Match'}
          </ActionButton>
        )}

        <ActionButton
          variant="ghost"
          onClick={() => {
            socketRef?.close();
            setSocketRef(null);
            setRoom(null);
          }}
        >
          Leave Room
        </ActionButton>
      </div>
    </SurfaceCard>
  );
}
