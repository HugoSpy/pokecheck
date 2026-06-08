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
