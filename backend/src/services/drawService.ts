import { Prisma, PrismaClient } from '@prisma/client';
import { recalculateUserPokedexValue } from './pokedexValue';
import { getSellPrice } from './coinService';

type Tx = PrismaClient | Prisma.TransactionClient;

/** Draw rarity distribution - single source of truth for /draw and /attendance/open. */
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
  // HIDDEN FEATURE
  is_ditto_disguise?: boolean;
  original_legendary?: { id: number; name: string; sprite_url: string };
  // END HIDDEN FEATURE
}

export interface DrawAndCreateResult {
  userPokemonId: string;
  pokemon: DrawnPokemon;
  /** True when the owner already holds another instance of this exact variant
   *  (same pokemon_id + is_shiny) - i.e. selling it won't lower total_score. */
  isDuplicate: boolean;
  /** Coins the drawn Pokémon would yield if sold immediately. */
  sellPrice: number;
}

/**
 * Draws a Pokémon (same logic as POST /draw), creates the UserPokemon with the
 * given source, and recalculates the owner's pokedex value.
 * Must be called inside a Prisma transaction.
 */
export async function drawAndCreate(
  tx: Tx,
  userId: string,
  opts: { source: string; forceShiny?: boolean; forceDitto?: boolean; generation?: number }
): Promise<DrawAndCreateResult> {
  // HIDDEN FEATURE - forceDitto guarantees a LEGENDARY base draw so the secondary roll fires
  const rarity = opts.forceDitto === true ? 'LEGENDARY' : pickRarity();
  // END HIDDEN FEATURE

  // `generation` restricts the pool to a single gen (used by the daily shop packs).
  // Undefined = all generations, the normal /draw + /attendance behaviour.
  const where = opts.generation === undefined
    ? { rarity }
    : { rarity, generation: opts.generation };
  const pokemonsOfRarity = await tx.pokemon.findMany({ where });
  if (pokemonsOfRarity.length === 0) {
    throw Object.assign(new Error('No Pokémon found for rarity'), { status: 500 });
  }

  let pokemon = pokemonsOfRarity[Math.floor(Math.random() * pokemonsOfRarity.length)];

  const isShiny = opts.forceShiny === true || Math.random() < 1 / 4096;

  // HIDDEN FEATURE - Ditto substitution (LEGENDARY draws only)
  const DITTO_ID = 132;
  let originalLegendary: { id: number; name: string; sprite_url: string } | undefined;
  if (rarity === 'LEGENDARY') {
    const forceDitto = opts.forceDitto === true || process.env.FORCE_DITTO === 'true';
    if (forceDitto || Math.random() < 0.01) {
      const ditto = await tx.pokemon.findUnique({ where: { id: DITTO_ID } });
      if (ditto) {
        originalLegendary = { id: pokemon.id, name: pokemon.name, sprite_url: pokemon.sprite_url };
        pokemon = ditto;
      }
    }
  }
  // END HIDDEN FEATURE

  const spriteUrl = isShiny
    ? pokemon.sprite_url.replace('/normal/', '/shiny/')
    : pokemon.sprite_url;
  const finalPoints = isShiny ? pokemon.points * 40 : pokemon.points;

  const created = await tx.userPokemon.create({
    data: {
      user_id: userId,
      pokemon_id: pokemon.id,
      source: opts.source,
      tradeable_at: null,
      is_shiny: isShiny,
      original_owner_id: userId,
    },
  });

  await recalculateUserPokedexValue(tx, userId);

  // A "duplicate" is another instance of the same variant (species + shiny state).
  const duplicateCount = await tx.userPokemon.count({
    where: { user_id: userId, pokemon_id: pokemon.id, is_shiny: isShiny, id: { not: created.id } },
  });
  const sellPrice = getSellPrice({
    is_shiny: isShiny,
    pokemon: { id: pokemon.id, points: pokemon.points, rarity: pokemon.rarity },
  });

  return {
    userPokemonId: created.id,
    isDuplicate: duplicateCount > 0,
    sellPrice,
    pokemon: {
      id: pokemon.id,
      name: pokemon.name,
      sprite_url: spriteUrl,
      rarity: pokemon.rarity,
      points: finalPoints,
      types: pokemon.types,
      is_shiny: isShiny,
      // HIDDEN FEATURE
      ...(originalLegendary && { is_ditto_disguise: true, original_legendary: originalLegendary }),
      // END HIDDEN FEATURE
    },
  };
}
