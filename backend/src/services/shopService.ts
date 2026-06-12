// Daily rotating shop. Three packs (gen 1-7) are selected deterministically from
// the Paris-time date so every user sees the same offers each day, rotating at
// Paris midnight. Buying a pack triggers one gen-filtered draw (same logic as
// POST /draw via drawService) inside a Serializable transaction.
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { spendCoins, getSellPrice } from './coinService';
import { drawAndCreate } from './drawService';
import { parisDayKey, getParisDayStart as _getParisDayStart } from '../utils/parisTime';
export { parisDayKey } from '../utils/parisTime';


// Decoration cards flanking the winner in the CSGO-style roll animation.
const STRIP_SIZE = 29;       // single-open: winner is inserted client-side at index 22
const FULL_STRIP_SIZE = 30;  // multi-open: winner is baked into the strip server-side
const WINNER_INDEX = 22;     // matches PackRoll's TARGET_INDEX
const MAX_COUNT = 10;
const BASE_SHINY_RATE = 1 / 4096;

// Gen number -> region name shown on the pack card.
export const GENERATION_NAMES: Record<number, string> = {
  1: 'Kanto',
  2: 'Johto',
  3: 'Hoenn',
  4: 'Sinnoh',
  5: 'Unys',
  6: 'Kalos',
  7: 'Alola',
};

// Pack texture URL per gen (served from frontend/public). All 7 textures follow
// the texture_pack_gen_<n>.png naming convention.
function textureUrl(gen: number): string {
  return `/texture_pack_gen_${gen}.png`;
}

const ALL_GENERATIONS = [1, 2, 3, 4, 5, 6, 7];
const PACKS_PER_DAY = 3;

/** Fixed price per pack, read from env (default 100). Never trust a client value. */
export function getPackPrice(): number {
  const parsed = parseInt(process.env.SHOP_PACK_PRICE ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
}

// ── Paris-time helpers ────────────────────────────────────────────────────────

/** UTC instant of the next Paris midnight (for the rotation countdown). */
export function nextRotationAt(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value);
  // Hour 24 is emitted by some runtimes for midnight - normalise to 0.
  const hour = get('hour') % 24;
  const elapsedMs =
    (hour * 3600 + get('minute') * 60 + get('second')) * 1000 + now.getMilliseconds();
  const msUntilMidnight = 24 * 3600 * 1000 - elapsedMs;
  return new Date(now.getTime() + msUntilMidnight);
}

// ── Deterministic daily selection ─────────────────────────────────────────────

// Small string hash (djb2) -> 32-bit seed.
function hashSeed(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

// mulberry32 PRNG - deterministic given a seed.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The 3 gens on offer for the given Paris day (sorted asc, deterministic). */
export function dailyGenerations(dayKey: string = parisDayKey()): number[] {
  const rand = mulberry32(hashSeed(dayKey));
  // Fisher-Yates shuffle of all gens, then take the first PACKS_PER_DAY.
  const pool = [...ALL_GENERATIONS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, PACKS_PER_DAY).sort((a, b) => a - b);
}

// All shop-drawn Pokémon share a single flat source tag.
const SHOP_SOURCE = 'shop';

// ── Shop reads ────────────────────────────────────────────────────────────────

export interface ShopPack {
  generation: number;
  name: string;
  texture_url: string;
  price: number;
}

export interface DailyShop {
  packs: ShopPack[];
  rotates_at: string;
}

// Purchases are unlimited, so the shop is the same for everyone - no per-user state.
export async function getDailyShop(): Promise<DailyShop> {
  const gens = dailyGenerations(parisDayKey());
  const price = getPackPrice();

  return {
    packs: gens.map(gen => ({
      generation: gen,
      name: GENERATION_NAMES[gen],
      texture_url: textureUrl(gen),
      price,
    })),
    rotates_at: nextRotationAt().toISOString(),
  };
}

// ── Purchase + draw ─────────────────────────────────────────────────────────

export interface ShopBuyResult {
  pokemon: {
    id: number; name: string; sprite_url: string; rarity: string;
    points: number; types: string[]; is_shiny: boolean;
    is_ditto_disguise?: boolean;
    original_legendary?: { id: number; name: string; sprite_url: string };
  };
  user_pokemon_id: string;
  is_duplicate: boolean;
  sell_price: number;
  strip: Array<{ id: number; name: string; sprite_url: string; rarity: string; points: number; is_shiny: boolean }>;
  coins_remaining: number;
}

export interface ShopMultiResult {
  results: Array<{
    pokemon: ShopBuyResult['pokemon'];
    user_pokemon_id: string;
    is_duplicate: boolean;
    sell_price: number;
    strip: ShopBuyResult['strip'];
  }>;
  coins_remaining: number;
}

/** Single pack: draw is performed during the client-side opening animation. */
export async function buyShopPack(userId: string, gen: number): Promise<ShopBuyResult> {
  assertGenOnOffer(gen);
  const price = getPackPrice();

  // TOCTOU-safe: spendCoins is an atomic compare-and-swap (gte amount).
  // Purchases are unlimited - no daily gating (the ShopPurchase table is kept
  // in the schema but no longer written to or checked).
  const draw = await prisma.$transaction(async tx => {
    await spendCoins(tx, userId, price, `shop_pack_gen${gen}`);
    return drawAndCreate(tx, userId, { source: SHOP_SOURCE, generation: gen });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  // Decoration strip - cosmetic only, winner is inserted client-side.
  const pools = await getGenPools(gen);
  const strip = buildStrip(pools);

  const updatedUser = await prisma.user.findUnique({ where: { id: userId }, select: { coins: true } });

  return {
    pokemon: draw.pokemon,
    user_pokemon_id: draw.userPokemonId,
    is_duplicate: draw.isDuplicate,
    sell_price: draw.sellPrice,
    strip,
    coins_remaining: updatedUser?.coins ?? 0,
  };
}

/** Multi pack (count > 1): N gen-filtered draws in one Serializable tx, each
 *  returned with a full 30-card strip (winner baked in) for the parallel anim. */
export async function buyShopPackMulti(userId: string, gen: number, count: number): Promise<ShopMultiResult> {
  assertGenOnOffer(gen);
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    throw Object.assign(new Error(`count must be an integer between 1 and ${MAX_COUNT}`), { status: 400 });
  }

  const totalPrice = getPackPrice() * count;

  const draws = await prisma.$transaction(async tx => {
    await spendCoins(tx, userId, totalPrice, `shop_pack_gen${gen}_x${count}`);
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push(await drawAndCreate(tx, userId, { source: SHOP_SOURCE, generation: gen }));
    }
    return out;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  const pools = await getGenPools(gen);
  const results = draws.map(d => ({
    pokemon: d.pokemon,
    user_pokemon_id: d.userPokemonId,
    is_duplicate: d.isDuplicate,
    sell_price: d.sellPrice,
    strip: buildFullStrip(pools, {
      id: d.pokemon.id,
      name: d.pokemon.name,
      sprite_url: d.pokemon.sprite_url,
      rarity: d.pokemon.rarity,
      points: d.pokemon.points,
      is_shiny: d.pokemon.is_shiny,
    }),
  }));

  const updatedUser = await prisma.user.findUnique({ where: { id: userId }, select: { coins: true } });
  return { results, coins_remaining: updatedUser?.coins ?? 0 };
}

function assertGenOnOffer(gen: number): void {
  // Server-authoritative: the gen must be one of today's deterministic offers.
  if (!dailyGenerations(parisDayKey()).includes(gen)) {
    throw Object.assign(new Error("Ce pack n'est pas disponible aujourd'hui."), { status: 400 });
  }
}

type StripCard = ShopBuyResult['strip'][number];
interface GenPools {
  pools: Record<string, Array<{ id: number; name: string; sprite_url: string; rarity: string; points: number }>>;
  allPool: Array<{ id: number; name: string; sprite_url: string; rarity: string; points: number }>;
}

// Fetch the gen's Pokémon once, grouped by rarity (shared by both strip builders).
async function getGenPools(gen: number): Promise<GenPools> {
  const select = { id: true, name: true, sprite_url: true, rarity: true, points: true } as const;
  const [commons, rares, epics, legendaries] = await Promise.all([
    prisma.pokemon.findMany({ where: { generation: gen, rarity: 'COMMON' }, select }),
    prisma.pokemon.findMany({ where: { generation: gen, rarity: 'RARE' }, select }),
    prisma.pokemon.findMany({ where: { generation: gen, rarity: 'EPIC' }, select }),
    prisma.pokemon.findMany({ where: { generation: gen, rarity: 'LEGENDARY' }, select }),
  ]);
  const pools = { COMMON: commons, RARE: rares, EPIC: epics, LEGENDARY: legendaries };
  return { pools, allPool: [...commons, ...rares, ...epics, ...legendaries] };
}

function pickStripRarity(): string {
  const roll = Math.random();
  if (roll < 0.798) return 'COMMON';
  if (roll < 0.948) return 'RARE';
  if (roll < 0.998) return 'EPIC';
  return 'LEGENDARY';
}

function randomStripCard({ pools, allPool }: GenPools): StripCard {
  const rarity = pickStripRarity();
  const pool = pools[rarity].length > 0 ? pools[rarity] : allPool;
  const p = pool[Math.floor(Math.random() * pool.length)];
  const shiny = Math.random() < BASE_SHINY_RATE;
  return {
    id: p.id,
    name: p.name,
    sprite_url: shiny ? p.sprite_url.replace('/normal/', '/shiny/') : p.sprite_url,
    rarity: p.rarity,
    points: p.points,
    is_shiny: shiny,
  };
}

// Cosmetic roll strip (winner inserted client-side at index 22).
function buildStrip(pools: GenPools): StripCard[] {
  return Array.from({ length: STRIP_SIZE }, () => randomStripCard(pools));
}

// Full 30-card strip with the winner baked in at WINNER_INDEX (multi-open shape).
function buildFullStrip(pools: GenPools, winner: StripCard): StripCard[] {
  const strip = Array.from({ length: FULL_STRIP_SIZE }, () => randomStripCard(pools));
  strip[WINNER_INDEX] = winner;
  return strip;
}
