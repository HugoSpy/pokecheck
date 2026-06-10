import { randomUUID } from 'crypto';

export interface BattlePlayer {
  userId: string;
  displayName: string;
  socketId: string;
  ready: boolean;
  isHost: boolean;
  joinedAt: number;
}

// Phase 2 - a single Pokémon as it travels through the battle pipeline. Mirrors
// the shape returned by the event-draw route (id/name/sprite/rarity/points/shiny),
// minus persistence: battle draws are NOT written to any Pokédex (decided later).
export interface BattlePokemon {
  id: number;
  name: string;
  sprite_url: string;
  rarity: string;
  points: number;
  is_shiny: boolean;
}

// Phase 2 - the resolved outcome of a battle, computed once when every player is
// ready. `strips` drives each player's CSGO-style roll animation; `results` is
// the winning card (the 22nd element of each strip) used for score comparison.
export interface BattleResult {
  strips: Record<string, BattlePokemon[]>;
  results: Record<string, BattlePokemon>;
}

export interface BattleRoom {
  id: string;
  gen: number;
  packName: string;
  packModelUrl: string | null;
  packImageUrl: string | null;
  maxPlayers: number;
  status: 'waiting' | 'in_progress';
  players: BattlePlayer[];
  // Phase 2 - populated by startBattle() when the room fills and all players
  // ready. `starting` guards against the ready-handler launching twice;
  // `persisted` ensures the BattleRecord is written only once across N acks.
  // `rosterSnapshot` freezes who was in the battle at launch so the record stays
  // complete even if a player disconnects mid-animation.
  result?: BattleResult;
  startAt?: number;
  starting?: boolean;
  persisted?: boolean;
  rosterSnapshot?: { userId: string; displayName: string }[];
  // Phase 2.1 - synchronized loading screen. After battle:animation_start each
  // client preloads its sprites and emits battle:client_ready; `readyClients`
  // counts them (deduped via `readyClientIds`). When every client is ready (or
  // `beginTimeout` fires after 15s) the server emits battle:begin and the rolls
  // start in lockstep. `begun` makes the begin emission idempotent.
  readyClients?: number;
  readyClientIds?: Set<string>;
  beginTimeout?: ReturnType<typeof setTimeout> | null;
  begun?: boolean;
}

export interface Lobby {
  id: string;
  gen: number;
  packName: string;
  packModelUrl: string | null;
  packImageUrl: string | null;
  maxPlayers: number;
  status: 'waiting' | 'in_progress';
  players: { userId: string; displayName: string; ready: boolean; isHost: boolean }[];
}

export interface BattleListItem {
  id: string;
  hostName: string;
  packName: string;
  packModelUrl: string | null;
  packImageUrl: string | null;
  maxPlayers: number;
  playerCount: number;
  status: 'waiting' | 'in_progress';
}

export interface CreateRoomOpts {
  gen: number;
  packName: string;
  packModelUrl: string | null;
  packImageUrl: string | null;
  maxPlayers: number;
  host: { userId: string; displayName: string; socketId: string };
}

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;

const rooms = new Map<string, BattleRoom>();

function clampMaxPlayers(n: number): number {
  if (!Number.isFinite(n)) return MIN_PLAYERS;
  return Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Math.trunc(n)));
}

function toLobby(room: BattleRoom): Lobby {
  return {
    id: room.id,
    gen: room.gen,
    packName: room.packName,
    packModelUrl: room.packModelUrl,
    packImageUrl: room.packImageUrl,
    maxPlayers: room.maxPlayers,
    status: room.status,
    players: room.players.map(p => ({
      userId: p.userId,
      displayName: p.displayName,
      ready: p.ready,
      isHost: p.isHost,
    })),
  };
}

function toListItem(room: BattleRoom): BattleListItem {
  const host = room.players.find(p => p.isHost) ?? room.players[0];
  return {
    id: room.id,
    hostName: host?.displayName ?? '',
    packName: room.packName,
    packModelUrl: room.packModelUrl,
    packImageUrl: room.packImageUrl,
    maxPlayers: room.maxPlayers,
    playerCount: room.players.length,
    status: room.status,
  };
}

function reassignHost(room: BattleRoom): void {
  room.players.forEach(p => { p.isHost = false; });
  const oldest = [...room.players].sort((a, b) => a.joinedAt - b.joinedAt)[0];
  if (oldest) oldest.isHost = true;
}

export function createRoom(opts: CreateRoomOpts): BattleRoom {
  const room: BattleRoom = {
    id: randomUUID(),
    gen: opts.gen,
    packName: opts.packName,
    packModelUrl: opts.packModelUrl,
    packImageUrl: opts.packImageUrl,
    maxPlayers: clampMaxPlayers(opts.maxPlayers),
    status: 'waiting',
    players: [{
      userId: opts.host.userId,
      displayName: opts.host.displayName,
      socketId: opts.host.socketId,
      ready: false,
      isHost: true,
      joinedAt: Date.now(),
    }],
  };
  rooms.set(room.id, room);
  return room;
}

export function getRoom(roomId: string): BattleRoom | undefined {
  return rooms.get(roomId);
}

export function findRoomBySocketId(socketId: string): BattleRoom | undefined {
  for (const room of rooms.values()) {
    if (room.players.some(p => p.socketId === socketId)) return room;
  }
  return undefined;
}

export function joinRoom(
  roomId: string,
  user: { userId: string; displayName: string; socketId: string },
): { ok: true; room: BattleRoom } | { ok: false; error: string } {
  const room = rooms.get(roomId);
  if (!room) return { ok: false, error: 'Cette partie n\'existe plus.' };
  if (room.status !== 'waiting') return { ok: false, error: 'Cette partie a déjà commencé.' };

  const existing = room.players.find(p => p.userId === user.userId);
  if (existing) {
    existing.socketId = user.socketId;
    return { ok: true, room };
  }

  if (room.players.length >= room.maxPlayers) {
    return { ok: false, error: 'Cette partie est complète.' };
  }

  room.players.push({
    userId: user.userId,
    displayName: user.displayName,
    socketId: user.socketId,
    ready: false,
    isHost: false,
    joinedAt: Date.now(),
  });

  return { ok: true, room };
}

export function setReady(roomId: string, userId: string, ready: boolean): BattleRoom | undefined {
  const room = rooms.get(roomId);
  if (!room) return undefined;
  const player = room.players.find(p => p.userId === userId);
  if (!player) return undefined;

  player.ready = ready;

  if (room.players.length === room.maxPlayers && room.players.every(p => p.ready)) {
    room.status = 'in_progress';
  }

  return room;
}

export function removePlayer(roomId: string, userId: string): { room: BattleRoom | undefined; deleted: boolean } {
  const room = rooms.get(roomId);
  if (!room) return { room: undefined, deleted: false };

  // Once a battle is in progress the outcome is locked in. A player leaving
  // (e.g. closing their tab mid-animation) must NOT wipe the strips/result or
  // reset the room - that would cancel a BattleRecord the others are still about
  // to ack. Just drop them from the live roster; `rosterSnapshot` keeps the
  // record complete. The room is only torn down once everyone has left.
  if (room.status === 'in_progress') {
    room.players = room.players.filter(p => p.userId !== userId);
    if (room.players.length === 0) {
      rooms.delete(roomId);
      return { room: undefined, deleted: true };
    }
    // A player leaving while everyone is still on the synchronized loading screen
    // invalidates the ready count - reset it so a stale tally can't trigger
    // battle:begin early. The 15s safety timeout still guarantees the battle
    // begins for the remaining players.
    if (!room.begun) {
      room.readyClients = 0;
      room.readyClientIds?.clear();
    }
    return { room, deleted: false };
  }

  room.players = room.players.filter(p => p.userId !== userId);

  if (room.players.length === 0) {
    rooms.delete(roomId);
    return { room: undefined, deleted: true };
  }

  reassignHost(room);
  room.players.forEach(p => { p.ready = false; });
  room.status = 'waiting';
  // Drop any half-started battle state so the next ready-up re-rolls fresh.
  room.result = undefined;
  room.startAt = undefined;
  room.starting = false;
  room.persisted = false;
  room.rosterSnapshot = undefined;
  room.readyClients = 0;
  room.readyClientIds = undefined;
  room.begun = false;
  if (room.beginTimeout) { clearTimeout(room.beginTimeout); room.beginTimeout = null; }

  return { room, deleted: false };
}

export function removeBySocketId(socketId: string): { room: BattleRoom | undefined; deleted: boolean; userId: string } | undefined {
  const room = findRoomBySocketId(socketId);
  if (!room) return undefined;
  const player = room.players.find(p => p.socketId === socketId);
  if (!player) return undefined;
  const result = removePlayer(room.id, player.userId);
  return { ...result, userId: player.userId };
}

export function listOpenRooms(): BattleListItem[] {
  return [...rooms.values()]
    .filter(r => r.status === 'waiting' && r.players.length < r.maxPlayers)
    .map(toListItem);
}

export function toLobbyView(room: BattleRoom): Lobby {
  return toLobby(room);
}
