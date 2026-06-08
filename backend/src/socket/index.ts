import type { Server as HttpServer } from 'http';
import { Server, Socket, DefaultEventsMap } from 'socket.io';
import * as cookie from 'cookie';
import jwt from 'jsonwebtoken';
import { Prisma, PrismaClient } from '@prisma/client';
import type { AuthPayload } from '../middleware/authMiddleware';
import { loadEventPools, buildStrip, hasUniqueWinner } from '../services/battleDrawService';
import { spendCoins } from '../services/coinService';
import {
  createRoom,
  joinRoom,
  setReady,
  removePlayer,
  removeBySocketId,
  getRoom,
  listOpenRooms,
  toLobbyView,
  type BattleRoom,
  type BattlePokemon,
} from './battleManager';

const prisma = new PrismaClient();

// Phase 2 — flat entry cost charged to every player when a battle launches.
// No per-battle price exists in the data model, so we use a fixed 100 coins.
const BATTLE_COST = 100;

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

// Phase 2 — aborts a battle that can't launch (missing pack / insufficient
// coins / DB error): resets the room to a fresh waiting lobby and tells every
// client to drop back out of the arena.
function failBattle(io: BattleServer, room: BattleRoom, message: string): void {
  room.status = 'waiting';
  room.players.forEach(p => { p.ready = false; });
  room.result = undefined;
  room.startAt = undefined;
  room.starting = false;
  room.persisted = false;
  io.to(room.id).emit('battle:error', { roomId: room.id, message });
  emitLobby(io, room);
  emitList(io);
}

// Phase 2 — runs once when a room fills and everyone is ready. Charges all
// players atomically, rolls every player's strip in one pass, stores the result
// on the room and broadcasts a single shared `startAt` so all clients animate in
// lockstep. Any failure rolls the coin transaction back and aborts the battle.
async function startBattle(io: BattleServer, room: BattleRoom): Promise<void> {
  try {
    const ep = await loadEventPools(prisma, room.eventPackId);
    if (!ep) {
      failBattle(io, room, "Le pack d'événement est introuvable ou vide.");
      return;
    }

    // Deduct the entry cost for every player in a single Serializable
    // transaction — spendCoins is an atomic compare-and-swap, so if any player
    // is short the whole transaction rolls back and nobody is charged.
    try {
      await prisma.$transaction(async (tx) => {
        for (const p of room.players) {
          await spendCoins(tx, p.userId, BATTLE_COST, 'battle');
        }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (err) {
      const status = (err as { status?: number }).status;
      failBattle(io, room, status === 402
        ? `Un joueur n'a pas assez de coins (${BATTLE_COST} requis).`
        : 'Impossible de lancer la battle, réessaie.');
      return;
    }

    // Roll every player's strip. If the top score is tied, the whole battle is
    // re-rolled (NO extra coins charged) and a battle:tie is broadcast so clients
    // can show an "Égalité" overlay before the new draw. Capped at 10 attempts so
    // a pathological repeated tie can never loop forever — after that we just take
    // the result and let the deterministic max-points tiebreak in persistBattle
    // pick a winner.
    let strips: Record<string, BattlePokemon[]> = {};
    let results: Record<string, BattlePokemon> = {};
    let attempt = 0;
    do {
      strips = {};
      results = {};
      for (const p of room.players) {
        const { strip, winner } = buildStrip(ep);
        strips[p.userId] = strip;
        results[p.userId] = winner;
      }
      attempt++;
      if (attempt > 1) {
        io.to(room.id).emit('battle:tie', { attempt });
        await new Promise(r => setTimeout(r, 1200)); // let clients show the tie overlay
      }
    } while (!hasUniqueWinner(results) && attempt < 10);

    room.result = { strips, results };
    // Freeze the roster at launch so the BattleRecord stays complete even if a
    // player disconnects during the animation (removePlayer keeps this intact).
    room.rosterSnapshot = room.players.map(p => ({ userId: p.userId, displayName: p.displayName }));
    room.startAt = Date.now() + 500; // +500ms network buffer so all clients arm before T0

    io.to(room.id).emit('battle:animation_start', {
      roomId: room.id,
      strips,
      results,
      startAt: room.startAt,
    });
  } catch {
    failBattle(io, room, 'Impossible de lancer la battle, réessaie.');
  }
}

// Phase 2 — persists the finished battle exactly once. Two layers guard against
// duplicates: the in-process `persisted` flag (set synchronously before any
// await, so concurrent acks in this single-threaded process can't both pass)
// AND a UNIQUE constraint on BattleRecord.room_id (DB-enforced, so a duplicate
// insert surfaces as P2002 and is treated as success). Winner = highest points.
// Built from `rosterSnapshot` so a mid-animation disconnect can't drop a player.
async function persistBattle(room: BattleRoom): Promise<void> {
  if (!room.result || room.persisted) return;
  room.persisted = true;

  const { results } = room.result;
  const roster = room.rosterSnapshot ?? room.players.map(p => ({ userId: p.userId, displayName: p.displayName }));
  let winnerId = '';
  let best = -Infinity;
  const players = roster.map(p => {
    const poke = results[p.userId];
    if (poke && poke.points > best) {
      best = poke.points;
      winnerId = p.userId;
    }
    return {
      userId: p.userId,
      displayName: p.displayName,
      pokemonId: poke?.id ?? null,
      name: poke?.name ?? null,
      points: poke?.points ?? 0,
      rarity: poke?.rarity ?? null,
      is_shiny: poke?.is_shiny ?? false,
    };
  });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.battleRecord.create({
        data: { room_id: room.id, winner_id: winnerId, pack_id: room.eventPackId, players },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (err) {
    // P2002 = the room_id UNIQUE constraint fired: another ack already wrote the
    // record, so this is a success, not a failure — keep `persisted` true.
    if ((err as { code?: string }).code === 'P2002') return;
    // Any other error: allow a later ack to retry the write.
    room.persisted = false;
  }
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

    socket.on('battle:ready', async (payload: { roomId: string; ready: boolean }) => {
      const room = setReady(payload.roomId, user.userId, payload.ready);
      if (!room) return;

      emitLobby(io, room);
      emitList(io);

      // Phase 2 — full + everyone ready: launch the battle once. `starting`
      // guards re-entrancy if two ready events land back-to-back.
      if (room.status === 'in_progress' && !room.starting && !room.result) {
        room.starting = true;
        await startBattle(io, room);
      }
    });

    socket.on('battle:result_ack', async (payload: { roomId: string }) => {
      const room = getRoom(payload.roomId);
      if (!room) return;
      await persistBattle(room);
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
