// Phase 2 — "Battle de caisse" draw generation.
//
// This mirrors the winner + strip logic of POST /event/draw (routes/event.ts)
// EXACTLY — same base rates, same rarity_multiplier weighting, same shiny roll,
// same sprite/points transforms — but it is PURE: it never writes a UserPokemon.
// Battle draws are not added to anyone's Pokédex (decided later), so the draw is
// decoupled from persistence and can be run for every player in one pass.
import { Prisma, PrismaClient } from '@prisma/client';
import type { BattlePokemon } from '../socket/battleManager';

type Tx = PrismaClient | Prisma.TransactionClient;

// Full strip length incl. the winner slot. Solo (EventPackOpen) renders 30 cards
// with the real draw at index 22; we bake the winner straight into the strip.
const STRIP_SIZE = 30;
export const WINNER_INDEX = 22;

const BASE_SHINY_RATE = 1 / 4096;

// Same base distribution as routes/event.ts.
const BASE_RATES: Record<string, number> = {
  COMMON: 79.5,
  RARE: 15,
  EPIC: 5,
  LEGENDARY: 0.5,
};

interface PoolPokemon {
  id: number;
  name: string;
  sprite_url: string;
  rarity: string;
  points: number;
}

export interface EventPools {
  pools: Record<string, PoolPokemon[]>;
  all: PoolPokemon[];
  weighted: Record<string, number>;
  total: number;
  shinyMultiplier: number | undefined;
}

/**
 * Loads an event's Pokémon pool grouped by rarity and precomputes the weighted
 * rarity table (base rate × the event's rarity_multiplier). Returns null when
 * the event is missing or its pool is empty — caller should abort the battle.
 */
export async function loadEventPools(prisma: Tx, eventId: string): Promise<EventPools | null> {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.pokemon_pool.length === 0) return null;

  const multipliers = (event.rarity_multiplier as Record<string, number>) ?? {};
  const select = { id: true, name: true, sprite_url: true, rarity: true, points: true } as const;

  const [commons, rares, epics, legendaries] = await Promise.all([
    prisma.pokemon.findMany({ where: { id: { in: event.pokemon_pool }, rarity: 'COMMON' }, select }),
    prisma.pokemon.findMany({ where: { id: { in: event.pokemon_pool }, rarity: 'RARE' }, select }),
    prisma.pokemon.findMany({ where: { id: { in: event.pokemon_pool }, rarity: 'EPIC' }, select }),
    prisma.pokemon.findMany({ where: { id: { in: event.pokemon_pool }, rarity: 'LEGENDARY' }, select }),
  ]);

  const pools: Record<string, PoolPokemon[]> = { COMMON: commons, RARE: rares, EPIC: epics, LEGENDARY: legendaries };
  const all = [...commons, ...rares, ...epics, ...legendaries];
  if (all.length === 0) return null;

  const weighted: Record<string, number> = {};
  for (const [rarity, base] of Object.entries(BASE_RATES)) {
    weighted[rarity] = base * (multipliers[rarity] ?? 1.0);
  }
  const total = Object.values(weighted).reduce((s, w) => s + w, 0);

  return { pools, all, weighted, total, shinyMultiplier: multipliers.SHINY };
}

function pickRarity(ep: EventPools): string {
  let roll = Math.random() * ep.total;
  for (const [rarity, weight] of Object.entries(ep.weighted)) {
    roll -= weight;
    if (roll < 0) return rarity;
  }
  return 'COMMON';
}

function rollShiny(multiplier: number | undefined): boolean {
  const shinyRate = Math.min(BASE_SHINY_RATE * (multiplier ?? 1.0), 1);
  return Math.random() < shinyRate;
}

/** Rolls one Pokémon from the pool — identical selection logic to the event draw. */
export function rollBattlePokemon(ep: EventPools): BattlePokemon {
  const rarity = pickRarity(ep);
  const candidates = ep.pools[rarity].length > 0 ? ep.pools[rarity] : ep.all;
  const p = candidates[Math.floor(Math.random() * candidates.length)];
  const shiny = rollShiny(ep.shinyMultiplier);
  return {
    id: p.id,
    name: p.name,
    sprite_url: shiny ? p.sprite_url.replace('/normal/', '/shiny/') : p.sprite_url,
    rarity: p.rarity,
    points: shiny ? p.points * 3 : p.points,
    is_shiny: shiny,
  };
}

/**
 * Builds a 30-card strip of decoys with the real winner planted at index 22 —
 * the same shape the solo client renders. The winner is the result used for the
 * battle's score comparison.
 */
export function buildStrip(ep: EventPools): { strip: BattlePokemon[]; winner: BattlePokemon } {
  const strip = Array.from({ length: STRIP_SIZE }, () => rollBattlePokemon(ep));
  const winner = rollBattlePokemon(ep);
  strip[WINNER_INDEX] = winner;
  return { strip, winner };
}
