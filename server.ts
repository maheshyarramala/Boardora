import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { WebSocketServer, type WebSocket } from 'ws';

dotenv.config();

// Enable Node 22+ native TS execution to resolve extensionless relative imports cleanly
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith('./') || specifier.startsWith('../')) &&
      !path.extname(specifier) &&
      context.parentURL
    ) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const candidateTs = path.resolve(parentDir, `${specifier}.ts`);
      if (existsSync(candidateTs)) {
        return nextResolve(pathToFileURL(candidateTs).href, context);
      }
      const candidateIndexTs = path.resolve(parentDir, specifier, 'index.ts');
      if (existsSync(candidateIndexTs)) {
        return nextResolve(pathToFileURL(candidateIndexTs).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const firebaseConfigModule = await import('./firebase-applet-config.json', {
  with: { type: 'json' },
});
const firebaseConfig = firebaseConfigModule.default as { projectId: string };

const adminApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({ projectId: firebaseConfig.projectId });
const adminAuth = getAuth(adminApp);

const { AuthoritativeRoomManager } = await import('./src/server/roomManager.ts');
const roomManager = new AuthoritativeRoomManager();

interface VerifiedUser {
  uid: string;
  name: string;
  emailVerified: boolean;
}

interface AuthedRequest extends Request {
  verifiedUser?: VerifiedUser;
}

async function verifyBearerToken(rawHeader?: string): Promise<VerifiedUser | null> {
  if (!rawHeader || !rawHeader.startsWith('Bearer ')) return null;
  const token = rawHeader.slice('Bearer '.length).trim();
  if (!token) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return {
      uid: decoded.uid,
      name:
        typeof decoded.name === 'string' && decoded.name.trim().length > 0
          ? decoded.name.trim()
          : 'Player',
      emailVerified: Boolean(decoded.email_verified),
    };
  } catch {
    return null;
  }
}

async function requireFirebaseAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const user = await verifyBearerToken(req.headers.authorization);
  if (!user) {
    res.status(401).json({ error: 'Valid Firebase Authentication token required.' });
    return;
  }
  req.verifiedUser = user;
  next();
}

const app = express();
app.use(express.json({ limit: '256kb' }));

// WebSocket room subscriber tracking
interface SocketSession {
  ws: WebSocket;
  uid: string;
  roomCode: string;
}
const roomSockets = new Map<string, Set<SocketSession>>();

function broadcastRoom(roomCode: string) {
  const room = roomManager.getRoom(roomCode);
  if (!room) return;
  const peers = roomSockets.get(room.roomCode);
  if (!peers) return;

  for (const peer of peers) {
    if (peer.ws.readyState === peer.ws.OPEN) {
      const snapshot = roomManager.toClientSnapshot(room, peer.uid);
      peer.ws.send(JSON.stringify({ type: 'ROOM_STATE', room: snapshot }));
    }
  }
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'classicplay-authoritative-server',
    projectId: firebaseConfig.projectId,
  });
});

app.post('/api/rooms', requireFirebaseAuth, (req: AuthedRequest, res) => {
  try {
    const user = req.verifiedUser!;
    const { gameId, difficulty, maxPlayers, variant, displayName, avatarId } =
      req.body as {
        gameId?: string;
        difficulty?: 'easy' | 'medium' | 'hard';
        maxPlayers?: number;
        variant?: string;
        displayName?: string;
        avatarId?: string;
      };
    if (!gameId) {
      res.status(400).json({ error: 'gameId is required.' });
      return;
    }
    const room = roomManager.createRoom({
      hostUid: user.uid,
      hostName: (displayName ?? user.name).slice(0, 32),
      hostAvatarId: avatarId as never,
      gameId: gameId as never,
      difficulty: difficulty ?? 'medium',
      maxPlayers: Number(maxPlayers ?? 2),
      variant,
    });
    res.status(201).json({ room: roomManager.toClientSnapshot(room, user.uid) });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Unable to create room.',
    });
  }
});

app.get('/api/rooms/:code', requireFirebaseAuth, (req: AuthedRequest, res) => {
  const user = req.verifiedUser!;
  const code = String(req.params.code ?? '').toUpperCase();
  const room = roomManager.getRoom(code);
  if (!room) {
    res.status(404).json({ error: 'Room not found.' });
    return;
  }
  const seated = room.seats.some((s) => s.uid === user.uid);
  if (room.status !== 'waiting' && !seated) {
    res.status(403).json({ error: 'Only seated players can inspect an active room.' });
    return;
  }
  res.json({ room: roomManager.toClientSnapshot(room, user.uid) });
});

app.post('/api/rooms/:code/join', requireFirebaseAuth, (req: AuthedRequest, res) => {
  try {
    const user = req.verifiedUser!;
    const code = String(req.params.code ?? '').toUpperCase();
    const { displayName, avatarId } = (req.body ?? {}) as {
      displayName?: string;
      avatarId?: string;
    };
    const room = roomManager.joinRoom({
      roomCode: code,
      uid: user.uid,
      displayName: (displayName ?? user.name).slice(0, 32),
      avatarId: avatarId as never,
    });
    broadcastRoom(room.roomCode);
    res.json({ room: roomManager.toClientSnapshot(room, user.uid) });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Unable to join room.',
    });
  }
});

app.post('/api/rooms/:code/ready', requireFirebaseAuth, (req: AuthedRequest, res) => {
  try {
    const user = req.verifiedUser!;
    const code = String(req.params.code ?? '').toUpperCase();
    const { ready } = (req.body ?? {}) as { ready?: boolean };
    const room = roomManager.setReady({
      roomCode: code,
      uid: user.uid,
      ready: Boolean(ready),
    });
    broadcastRoom(room.roomCode);
    res.json({ room: roomManager.toClientSnapshot(room, user.uid) });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Unable to update ready status.',
    });
  }
});

app.post('/api/rooms/:code/start', requireFirebaseAuth, (req: AuthedRequest, res) => {
  try {
    const user = req.verifiedUser!;
    const code = String(req.params.code ?? '').toUpperCase();
    const room = roomManager.startMatch({ roomCode: code, uid: user.uid });
    broadcastRoom(room.roomCode);
    res.json({ room: roomManager.toClientSnapshot(room, user.uid) });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Unable to start match.',
    });
  }
});

app.post('/api/rooms/:code/action', requireFirebaseAuth, (req: AuthedRequest, res) => {
  const user = req.verifiedUser!;
  const code = String(req.params.code ?? '').toUpperCase();
  const { expectedVersion, action } = (req.body ?? {}) as {
    expectedVersion?: number;
    action?: unknown;
  };
  const result = roomManager.submitAction({
    roomCode: code,
    actorUid: user.uid,
    expectedVersion: Number(expectedVersion ?? -1),
    action,
  });
  if (!result.accepted || !result.room) {
    res.status(409).json({ error: result.reason ?? 'Action rejected.' });
    return;
  }
  broadcastRoom(result.room.roomCode);
  res.json({ room: roomManager.toClientSnapshot(result.room, user.uid) });
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  let session: SocketSession | null = null;

  ws.on('message', async (raw) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(String(raw)) as Record<string, unknown>;
    } catch {
      ws.send(JSON.stringify({ type: 'ERROR', error: 'Invalid JSON frame.' }));
      return;
    }

    if (msg.type === 'AUTH') {
      const token = typeof msg.token === 'string' ? msg.token : '';
      const roomCode =
        typeof msg.roomCode === 'string' ? msg.roomCode.trim().toUpperCase() : '';
      const user = await verifyBearerToken(`Bearer ${token}`);
      if (!user || !roomCode) {
        ws.send(JSON.stringify({ type: 'ERROR', error: 'Authentication failed.' }));
        ws.close();
        return;
      }
      const room = roomManager.getRoom(roomCode);
      if (!room || !room.seats.some((s) => s.uid === user.uid)) {
        ws.send(JSON.stringify({ type: 'ERROR', error: 'You are not seated in this room.' }));
        ws.close();
        return;
      }

      session = { ws, uid: user.uid, roomCode: room.roomCode };
      let set = roomSockets.get(room.roomCode);
      if (!set) {
        set = new Set();
        roomSockets.set(room.roomCode, set);
      }
      set.add(session);
      roomManager.setPresence(room.roomCode, user.uid, true);
      broadcastRoom(room.roomCode);
      return;
    }

    if (!session) {
      ws.send(JSON.stringify({ type: 'ERROR', error: 'Send AUTH frame first.' }));
      return;
    }

    try {
      if (msg.type === 'READY') {
        roomManager.setReady({
          roomCode: session.roomCode,
          uid: session.uid,
          ready: Boolean(msg.ready),
        });
        broadcastRoom(session.roomCode);
      } else if (msg.type === 'START') {
        roomManager.startMatch({
          roomCode: session.roomCode,
          uid: session.uid,
        });
        broadcastRoom(session.roomCode);
      } else if (msg.type === 'ACTION') {
        const result = roomManager.submitAction({
          roomCode: session.roomCode,
          actorUid: session.uid,
          expectedVersion: Number(msg.expectedVersion ?? -1),
          action: msg.action,
        });
        if (!result.accepted) {
          ws.send(
            JSON.stringify({
              type: 'ACTION_REJECTED',
              error: result.reason ?? 'Action rejected.',
            })
          );
          // Resync authoritative state back to sender on conflict
          const current = roomManager.getRoom(session.roomCode);
          if (current) {
            ws.send(
              JSON.stringify({
                type: 'ROOM_STATE',
                room: roomManager.toClientSnapshot(current, session.uid),
              })
            );
          }
          return;
        }
        broadcastRoom(session.roomCode);
      }
    } catch (err) {
      ws.send(
        JSON.stringify({
          type: 'ERROR',
          error: err instanceof Error ? err.message : 'Server room error.',
        })
      );
    }
  });

  ws.on('close', () => {
    if (!session) return;
    const peers = roomSockets.get(session.roomCode);
    if (peers) {
      peers.delete(session);
      if (peers.size === 0) roomSockets.delete(session.roomCode);
    }
    roomManager.setPresence(session.roomCode, session.uid, false);
    broadcastRoom(session.roomCode);
  });
});

// Mount Vite dev middleware in dev, or serve static dist/ in production
const isProd = process.env.NODE_ENV === 'production';
if (!isProd) {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  const distDir = path.join(rootDir, 'dist');
  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

const PORT = Number(process.env.PORT ?? 3000);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`ClassicPlay server listening on http://0.0.0.0:${PORT}`);
});
