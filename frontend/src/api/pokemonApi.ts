import { apiFetch } from './client';
import type { PokemonInfo, UserInfo, UserPokemonInstance, RollCardData, DrawDuplicateInfo, Rarity } from './types';

// A global Pokémon species (from the Pokemon table, not a user's instance).
export interface PokemonSpecies {
  id: number;
  name: string;
  rarity: Rarity;
  points: number;
  types: string[];
  generation: number;
  sprite_url: string;
}

export interface PokemonOwner {
  userId: string;
  displayName: string;
  count: number;
}

export async function searchPokemonSpecies(params: {
  name?: string;
  type?: string | null;
  rarity?: string | null;
  limit?: number;
}): Promise<{ pokemons: PokemonSpecies[] }> {
  const qs = new URLSearchParams();
  if (params.name) qs.set('name', params.name);
  if (params.type) qs.set('type', params.type);
  if (params.rarity) qs.set('rarity', params.rarity);
  if (params.limit) qs.set('limit', String(params.limit));
  return apiFetch<{ pokemons: PokemonSpecies[] }>(`/pokemon/search?${qs.toString()}`);
}

export async function getPokemonOwners(pokemonId: number): Promise<{ owners: PokemonOwner[] }> {
  return apiFetch<{ owners: PokemonOwner[] }>(`/pokemon/${pokemonId}/owners`);
}

// HIDDEN FEATURE — force_ditto param added
export async function draw(force_shiny?: boolean, force_ditto?: boolean): Promise<{ pokemon: PokemonInfo } & DrawDuplicateInfo> {
  return apiFetch<{ pokemon: PokemonInfo } & DrawDuplicateInfo>('/draw', {
    method: 'POST',
    body: JSON.stringify({
      ...(force_shiny ? { force_shiny: true } : {}),
      ...(force_ditto ? { force_ditto: true } : {}),
    }),
  });
}
// END HIDDEN FEATURE

export async function getRandomPokemons(count: number): Promise<{ pokemons: RollCardData[] }> {
  return apiFetch<{ pokemons: RollCardData[] }>(`/pokedex/random-weighted?count=${count}`);
}

export async function getMyPokedex(): Promise<{ user: UserInfo; pokemons: UserPokemonInstance[]; totalPokemon: number }> {
  return apiFetch<{ user: UserInfo; pokemons: UserPokemonInstance[]; totalPokemon: number }>('/pokedex/me');
}

export async function getPublicPokedex(
  userId: string,
  opts?: { forTrade?: boolean },
): Promise<{ user: UserInfo; pokemons: UserPokemonInstance[] }> {
  // forTrade excludes Pokémon locked in a pending trade so they can't be picked
  // as a trade target. The public profile view omits it (shows everything).
  const qs = opts?.forTrade ? '?for_trade=1' : '';
  return apiFetch<{ user: UserInfo; pokemons: UserPokemonInstance[] }>(`/pokedex/${userId}${qs}`);
}
