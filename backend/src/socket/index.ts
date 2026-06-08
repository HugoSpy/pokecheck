import type { Server as HttpServer } from 'http';
import { Server, Socket, DefaultEventsMap } from 'socket.io';
import * as cookie from 'cookie';
import jwt from 'jsonwebtoken';
import type { AuthPayload } from '../middleware/authMiddleware';
import {
  createRoom,
  joinRoom,
  setReady,
  removePlayer,
  removeBySocketId,
  listOpenRooms,
  toLobbyView,
  type BattleRoom,
} from './battleManager';

interface SocketUser {
  userId: string;
  displayName: string;
}

interface BattleSocketData {
  user: SocketUser;
}

type BattleServer = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, BattleSocketData>;
type BattleSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, BattleSocketData>;

const BROWSING_ROOM = 'battle:browsing';

const allowedOrigins = new Set<string>(
  (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
);
const localhostPattern = /^http:\/\/localhost:\d+$/;
const vercelPreviewPattern = process.env.ALLOW_VERCEL_PREVIEWS === 'true'
  ? /^https:\/\/pokecheck-[a-z0-9]+-hugospyropoulos-2590s-projects\.vercel\.app$/
  : null;

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  if (localhostPattern.test(origin)) return true;
  if (vercelPreviewPattern?.test(origin)) return true;
  return false;
}

function emitList(io: BattleServer): void {
  io.to(BROWSING_ROOM).emit('battle:list', listOpenRooms());
}

function emitLobby(io: BattleServer, room: BattleRoom): void {
  io.to(room.id).emit('battle:lobby', toLobbyView(room));
}

export function initBattleSocket(httpServer: HttpServer): BattleServer {
  const io: BattleServer = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) return callback(null, true);
        callback(new Error(`CORS blocked: ${origin}`));
      },
      credentials: true,
    },
  });

  io.use((socket: BattleSocket, next) => {
    const cookieHeader = socket.handshake.headers.cookie;
    const cookieToken = cookieHeader ? cookie.parse(cookieHeader).session : undefined;
    // [DEV ONLY - NEVER MERGE] fall back to handshake.auth.token — the
    // per-tab JWT stored by the test-account backdoor login (localStorage,
    // see frontend battleSocket.ts) — when no session cookie is present.
    // Mirrors the cookie ?? Bearer fallback in authMiddleware.ts:25-26.
    const authToken = (socket.handshake.auth as { token?: string } | undefined)?.token;
    const token = cookieToken ?? authToken ?? undefined;

    if (!token) {
      next(new Error('Missing or invalid session'));
      return;
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
      socket.data.user = { userId: payload.userId, displayName: payload.display_name };
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: BattleSocket) => {
    const user = socket.data.user;

    socket.on('battle:browse', () => {
      socket.join(BROWSING_ROOM);
      socket.emit('battle:list', listOpenRooms());
    });

    socket.on('battle:unbrowse', () => {
      socket.leave(BROWSING_ROOM);
    });

    socket.on('battle:create', (
      payload: { eventPackId: string; packName: string; packModelUrl: string | null; packImageUrl: string | null; maxPlayers: number },
      ack?: (res: { ok: true; room: ReturnType<typeof toLobbyView> } | { ok: false; error: string }) => void,
    ) => {
      const room = createRoom({
        eventPackId: payload.eventPackId,
        packName: payload.packName,
        packModelUrl: payload.packModelUrl ?? null,
        packImageUrl: payload.packImageUrl ?? null,
        maxPlayers: payload.maxPlayers,
        host: { userId: user.userId, displayName: user.displayName, socketId: socket.id },
      });

      socket.join(room.id);
      ack?.({ ok: true, room: toLobbyView(room) });
      emitLobby(io, room);
      emitList(io);
    });

    socket.on('battle:join', (
      payload: { roomId: string },
      ack?: (res: { ok: true; room: ReturnType<typeof toLobbyView> } | { ok: false; error: string }) => void,
    ) => {
      const result = joinRoom(payload.roomId, { userId: user.userId, displayName: user.displayName, socketId: socket.id });

      if (!result.ok) {
        ack?.({ ok: false, error: result.error });
        return;
      }

      socket.join(result.room.id);
      ack?.({ ok: true, room: toLobbyView(result.room) });
      emitLobby(io, result.room);
      emitList(io);
    });

    socket.on('battle:ready', (payload: { roomId: string; ready: boolean }) => {
      const room = setReady(payload.roomId, user.userId, payload.ready);
      if (!room) return;

      emitLobby(io, room);

      if (room.status === 'in_progress') {
        io.to(room.id).emit('battle:start', { roomId: room.id });
      }

      emitList(io);
    });

    socket.on('battle:leave', (payload: { roomId: string }) => {
      const { room, deleted } = removePlayer(payload.roomId, user.userId);
      socket.leave(payload.roomId);

      if (!deleted && room) emitLobby(io, room);
      emitList(io);
    });

    socket.on('disconnect', () => {
      const result = removeBySocketId(socket.id);
      if (!result) return;

      if (!result.deleted && result.room) emitLobby(io, result.room);
      emitList(io);
    });
  });

  return io;
}
