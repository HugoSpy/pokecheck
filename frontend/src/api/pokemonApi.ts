import { apiFetch } from './client';
import type { PokemonInfo, UserInfo, UserPokemonInstance, RollCardData } from './types';

export async function draw(force_shiny?: boolean): Promise<{ pokemon: PokemonInfo }> {
  return apiFetch<{ pokemon: PokemonInfo }>('/draw', {
    method: 'POST',
    body: JSON.stringify({ ...(force_shiny ? { force_shiny: true } : {}) }),
  });
}

export async function getRandomPokemons(count: number): Promise<{ pokemons: RollCardData[] }> {
  return apiFetch<{ pokemons: RollCardData[] }>(`/pokedex/random-weighted?count=${count}`);
}

export async function getMyPokedex(): Promise<{ user: UserInfo; pokemons: UserPokemonInstance[]; totalPokemon: number }> {
  return apiFetch<{ user: UserInfo; pokemons: UserPokemonInstance[]; totalPokemon: number }>('/pokedex/me');
}

export async function getPublicPokedex(userId: string): Promise<{ user: UserInfo; pokemons: UserPokemonInstance[] }> {
  return apiFetch<{ user: UserInfo; pokemons: UserPokemonInstance[] }>(`/pokedex/${userId}`);
}
