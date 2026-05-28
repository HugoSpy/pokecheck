const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const SESSION_KEY = 'pokecheck_session';

export function getToken(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(SESSION_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(SESSION_KEY);
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
    const err = new Error(body.error ?? `HTTP ${res.status}`);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }

  return res.json() as Promise<T>;
}

/* ── Types ── */
export interface PokemonInfo {
  id: number;
  name: string;
  sprite_url: string;
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  points: number;
  types: string[];
  generation: number;
  bst: number;
  is_shiny?: boolean;
}

export interface UserPokemonInstance extends PokemonInfo {
  instanceId: string;
  obtainedAt: string;
  source: string;
  tradeable_at: string | null;
}

export interface UserInfo {
  id: string;
  display_name: string;
  total_score: number;
  trade_count: number;
}

export interface LeaderboardEntry {
  id: string;
  display_name: string;
  total_score: number;
  trade_count: number;
  pokemon_count: number;
  legendary_count: number;
}

export interface TradeOffer {
  id: string;
  from_user: { id: string; display_name: string };
  fromPokemon: { pokemon: PokemonInfo; id: string; tradeable_at: string | null } | null;
  toPokemon: { pokemon: PokemonInfo; id: string } | null;
  status: string;
  created_at: string;
}

/* ── Auth ── */
export async function consumeOneShotToken(token: string): Promise<{ sessionToken: string; user: UserInfo }> {
  const data = await apiFetch<{ sessionToken: string; user: UserInfo }>(`/auth/one-shot?token=${encodeURIComponent(token)}`);
  setToken(data.sessionToken);
  return data;
}

export async function consumeOneShotCode(code: string): Promise<{ sessionToken: string; user: UserInfo; force_shiny: boolean }> {
  const data = await apiFetch<{ sessionToken: string; user: UserInfo; force_shiny: boolean }>(`/auth/one-shot?code=${encodeURIComponent(code)}`);
  setToken(data.sessionToken);
  return data;
}

/* ── Admin ── */
export async function generateAdminPack(force_shiny: boolean): Promise<{ code: string }> {
  return apiFetch<{ code: string }>('/admin/generate-pack', {
    method: 'POST',
    body: JSON.stringify({ force_shiny }),
  });
}

/* ── Draw ── */
export async function draw(source?: 'draw' | 'bonus', force_shiny?: boolean): Promise<{ pokemon: PokemonInfo }> {
  return apiFetch<{ pokemon: PokemonInfo }>('/draw', {
    method: 'POST',
    body: JSON.stringify({ source: source ?? 'draw', ...(force_shiny ? { force_shiny: true } : {}) }),
  });
}

/* ── Pokédex ── */
export interface RollCardData {
  id: number;
  name: string;
  sprite_url: string;
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  points: number;
  is_shiny?: boolean;
}

export async function getRandomPokemons(count: number): Promise<{ pokemons: RollCardData[] }> {
  return apiFetch<{ pokemons: RollCardData[] }>(`/pokedex/random?count=${count}`);
}

export async function getMyPokedex(): Promise<{ user: UserInfo; pokemons: UserPokemonInstance[] }> {
  return apiFetch<{ user: UserInfo; pokemons: UserPokemonInstance[] }>('/pokedex/me');
}

export async function getPublicPokedex(userId: string): Promise<{ user: UserInfo; pokemons: UserPokemonInstance[] }> {
  return apiFetch<{ user: UserInfo; pokemons: UserPokemonInstance[] }>(`/pokedex/${userId}`);
}

/* ── Leaderboard ── */
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  return apiFetch<LeaderboardEntry[]>('/leaderboard');
}

/* ── Users ── */
export async function searchUsers(q: string): Promise<{ users: { id: string; display_name: string }[] }> {
  return apiFetch<{ users: { id: string; display_name: string }[] }>(`/users/search?q=${encodeURIComponent(q)}`);
}

/* ── Trades ── */
export async function getTradeOffers(): Promise<TradeOffer[]> {
  return apiFetch<TradeOffer[]>('/trade/offers');
}

export interface ProposeTradePayload {
  from_pokemon_id: string;
  to_user_id: string;
  to_pokemon_id: string;
}

export async function proposeTrade(payload: ProposeTradePayload): Promise<{ id: string }> {
  return apiFetch<{ id: string }>('/trade/propose', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function acceptTrade(id: string): Promise<{
  success: boolean;
  bonusDraws: string[];
  shiny_proc?: boolean;
  shiny_pokemon_name?: string;
}> {
  return apiFetch<{
    success: boolean;
    bonusDraws: string[];
    shiny_proc?: boolean;
    shiny_pokemon_name?: string;
  }>(`/trade/accept/${id}`, { method: 'POST' });
}

export async function declineTrade(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/trade/decline/${id}`, { method: 'POST' });
}
