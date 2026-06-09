import { apiFetch } from './client';
import type { PokemonInfo, UserInfo, UserPokemonInstance, RollCardData, DrawDuplicateInfo } from './types';

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

export async function getPublicPokedex(userId: string): Promise<{ user: UserInfo; pokemons: UserPokemonInstance[] }> {
  return apiFetch<{ user: UserInfo; pokemons: UserPokemonInstance[] }>(`/pokedex/${userId}`);
}
