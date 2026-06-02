import { Prisma, PrismaClient } from '@prisma/client';
import { recalculateUserPokedexValue } from './pokedexValue';

type Tx = PrismaClient | Prisma.TransactionClient;

/** Draw rarity distribution — single source of truth for /draw and /attendance/open. */
export function pickRarity(): string {
  const roll = Math.random();
  if (roll < 0.798) return 'COMMON';   // 79.8%
  if (roll < 0.948) return 'RARE';     // 15%
  if (roll < 0.998) return 'EPIC';     // 5%
  return 'LEGENDARY';                  // 0.2%
}

export interface DrawnPokemon {
  id: number;
  name: string;
  sprite_url: string;
  rarity: string;
  points: number;
  types: string[];
  is_shiny: boolean;
}

export interface DrawAndCreateResult {
  userPokemonId: string;
  pokemon: DrawnPokemon;
}

/**
 * Draws a Pokémon (same logic as POST /draw), creates the UserPokemon with the
 * given source, and recalculates the owner's pokedex value.
 * Must be called inside a Prisma transaction.
 */
export async function drawAndCreate(
  tx: Tx,
  userId: string,
  opts: { source: string; forceShiny?: boolean }
): Promise<DrawAndCreateResult> {
  const rarity = pickRarity();

  const pokemonsOfRarity = await tx.pokemon.findMany({ where: { rarity } });
  if (pokemonsOfRarity.length === 0) {
    throw Object.assign(new Error('No Pokémon found for rarity'), { status: 500 });
  }

  const pokemon = pokemonsOfRarity[Math.floor(Math.random() * pokemonsOfRarity.length)];

  const isShiny = opts.forceShiny === true || Math.random() < 1 / 4096;
  const spriteUrl = isShiny
    ? pokemon.sprite_url.replace('/normal/', '/shiny/')
    : pokemon.sprite_url;
  const finalPoints = isShiny ? pokemon.points * 3 : pokemon.points;

  const created = await tx.userPokemon.create({
    data: {
      user_id: userId,
      pokemon_id: pokemon.id,
      source: opts.source,
      tradeable_at: null,
      is_shiny: isShiny,
    },
  });

  await recalculateUserPokedexValue(tx, userId);

  return {
    userPokemonId: created.id,
    pokemon: {
      id: pokemon.id,
      name: pokemon.name,
      sprite_url: spriteUrl,
      rarity: pokemon.rarity,
      points: finalPoints,
      types: pokemon.types,
      is_shiny: isShiny,
    },
  };
}
