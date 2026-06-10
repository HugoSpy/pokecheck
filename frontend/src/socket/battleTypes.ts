import type { Rarity } from '../api/types';

// Phase 2 - one card in a battle roll. Compatible with RollCardData so it can be
// fed straight into the shared PackRoll animation component.
export interface BattlePokemon {
  id: number;
  name: string;
  sprite_url: string;
  rarity: Rarity;
  points: number;
  is_shiny: boolean;
}

// Phase 2 - broadcast to every player in the room the instant a battle starts.
// `startAt` is a shared epoch-ms timestamp: each client schedules its animation
// for that moment so all rolls run in lockstep regardless of network jitter.
export interface BattleAnimationPayload {
  roomId: string;
  strips: Record<string, BattlePokemon[]>;
  results: Record<string, BattlePokemon>;
  startAt: number;
}

export interface BattleErrorPayload {
  roomId: string;
  message: string;
}

// Phase 2.1 - the real "go" signal, emitted once every client has finished
// preloading its strip sprites (or after the server's 15s safety timeout).
// `startAt` supersedes BattleAnimationPayload.startAt as the lockstep epoch.
export interface BattleBeginPayload {
  roomId: string;
  startAt: number;
}

export interface LobbyPlayer {
  userId: string;
  displayName: string;
  ready: boolean;
  isHost: boolean;
}

export interface Lobby {
  id: string;
  eventPackId: string;
  packName: string;
  packModelUrl: string | null;
  packImageUrl: string | null;
  maxPlayers: number;
  status: 'waiting' | 'in_progress';
  players: LobbyPlayer[];
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

export interface CreateBattlePayload {
  eventPackId: string;
  packName: string;
  packModelUrl: string | null;
  packImageUrl: string | null;
  maxPlayers: number;
}

export type BattleAck =
  | { ok: true; room: Lobby }
  | { ok: false; error: string };
