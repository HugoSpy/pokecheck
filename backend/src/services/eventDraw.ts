// Shared single-pack event draw — the exact probability logic used by
// POST /event/draw, extracted so the free daily Shiny pack can reuse it without
// duplicating the rarity weighting. Probabilities come from the event's
// rarity_multiplier (not hardcoded); `spendPrice` toggles the coin cost so the
// same function serves both the paid event pack and the free daily pack.
import { Prisma, PrismaClient } from '@prisma/client';
import { spendCoins, getSellPrice } from './coinService';
import { recalculateUserPokedexValue } from './pokedexValue';

const prisma = new PrismaClient();

const STRIP_SIZE = 29;
const BASE_SHINY_RATE = 1 / 4096;

// Base rarity weights, scaled per-event by rarity_multiplier. Same values as the
// original inline /event/draw implementation.
const BASE_RATES: Record<string, number> = { COMMON: 79.5, RARE: 15, EPIC: 5, LEGENDARY: 0.5 };

interface EventLike {
  id: string;
  price: number;
  pokemon_pool: number[];
  rarity_multiplier: unknown;
}

export interface EventDrawResult {
  pokemon: { id: number; name: string; sprite_url: string; rarity: string; points: number; types: string[]; is_shiny: boolean };
  user_pokemon_id: string;
  is_duplicate: boolean;
  sell_price: number;
  strip: Array<{ id: number; name: string; sprite_url: string; rarity: string; points: number; is_shiny: boolean }>;
  coins_remaining: number;
}

export async function drawFromEvent(
  userId: string,
  event: EventLike,
  opts: { spendPrice: boolean; source: string },
): Promise<EventDrawResult> {
  const multipliers = (event.rarity_multiplier as Record<string, number>) ?? {};

  const weightedRates: Record<string, number> = {};
  for (const [rarity, base] of Object.entries(BASE_RATES)) {
    weightedRates[rarity] = base * (multipliers[rarity] ?? 1.0);
  }
  const totalWeight = Object.values(weightedRates).reduce((s, w) => s + w, 0);

  function pickRarity(): string {
    let roll = Math.random() * totalWeight;
    for (const [rarity, weight] of Object.entries(weightedRates)) {
      roll -= weight;
      if (roll < 0) return rarity;
    }
    return 'COMMON';
  }
  function rollShiny(): boolean {
    return Math.random() < Math.min(BASE_SHINY_RATE * (multipliers.SHINY ?? 1.0), 1);
  }

  const select = { id: true, name: true, sprite_url: true, rarity: true, points: true, types: true } as const;
  const [commons, rares, epics, legendaries] = await Promise.all([
    prisma.pokemon.findMany({ where: { id: { in: event.pokemon_pool }, rarity: 'COMMON' }, select }),
    prisma.pokemon.findMany({ where: { id: { in: event.pokemon_pool }, rarity: 'RARE' }, select }),
    prisma.pokemon.findMany({ where: { id: { in: event.pokemon_pool }, rarity: 'EPIC' }, select }),
    prisma.pokemon.findMany({ where: { id: { in: event.pokemon_pool }, rarity: 'LEGENDARY' }, select }),
  ]);
  const pools: Record<string, typeof commons> = { COMMON: commons, RARE: rares, EPIC: epics, LEGENDARY: legendaries };
  const allPool = [...commons, ...rares, ...epics, ...legendaries];
  if (allPool.length === 0) {
    throw Object.assign(new Error('No Pokémon available in pool'), { status: 500 });
  }

  // Draw winner
  const pickedRarity = pickRarity();
  const candidates = pools[pickedRarity].length > 0 ? pools[pickedRarity] : allPool;
  const winner = candidates[Math.floor(Math.random() * candidates.length)];
  const isShiny = rollShiny();
  const winnerSpriteUrl = isShiny ? winner.sprite_url.replace('/normal/', '/shiny/') : winner.sprite_url;
  const finalPoints = isShiny ? winner.points * 3 : winner.points;

  const { userPokemonId, isDuplicate } = await prisma.$transaction(async tx => {
    if (opts.spendPrice) await spendCoins(tx, userId, event.price, 'event_pack');
    const created = await tx.userPokemon.create({
      data: { user_id: userId, pokemon_id: winner.id, source: opts.source, tradeable_at: null, is_shiny: isShiny },
    });
    await recalculateUserPokedexValue(tx, userId);
    const duplicateCount = await tx.userPokemon.count({
      where: { user_id: userId, pokemon_id: winner.id, is_shiny: isShiny, id: { not: created.id } },
    });
    return { userPokemonId: created.id, isDuplicate: duplicateCount > 0 };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  const sellPrice = getSellPrice({ is_shiny: isShiny, pokemon: { id: winner.id, points: winner.points, rarity: winner.rarity } });
  const updatedUser = await prisma.user.findUnique({ where: { id: userId }, select: { coins: true } });

  // Decoration strip from the same pool.
  const strip = Array.from({ length: STRIP_SIZE }, () => {
    const rarity = pickRarity();
    const pool = pools[rarity].length > 0 ? pools[rarity] : allPool;
    const p = pool[Math.floor(Math.random() * pool.length)];
    const shiny = rollShiny();
    return {
      id: p.id,
      name: p.name,
      sprite_url: shiny ? p.sprite_url.replace('/normal/', '/shiny/') : p.sprite_url,
      rarity: p.rarity,
      points: p.points,
      is_shiny: shiny,
    };
  });

  return {
    pokemon: { id: winner.id, name: winner.name, sprite_url: winnerSpriteUrl, rarity: winner.rarity, points: finalPoints, types: winner.types, is_shiny: isShiny },
    user_pokemon_id: userPokemonId,
    is_duplicate: isDuplicate,
    sell_price: sellPrice,
    strip,
    coins_remaining: updatedUser?.coins ?? 0,
  };
}
