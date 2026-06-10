// Daily rotating shop. Three packs (gen 1-7) are selected deterministically from
// the Paris-time date so every user sees the same offers each day, rotating at
// Paris midnight. Buying a pack triggers one gen-filtered draw (same logic as
// POST /draw via drawService) inside a Serializable transaction.
import { Prisma, PrismaClient } from '@prisma/client';
import { spendCoins, getSellPrice } from './coinService';
import { drawAndCreate } from './drawService';

const prisma = new PrismaClient();

// Decoration cards flanking the winner in the CSGO-style roll animation.
const STRIP_SIZE = 29;
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

const ALL_GENERATIONS = [1, 2, 3, 4, 5, 6, 7];
const PACKS_PER_DAY = 3;

/** Fixed price per pack, read from env (default 100). Never trust a client value. */
export function getPackPrice(): number {
  const parsed = parseInt(process.env.SHOP_PACK_PRICE ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
}

// ── Paris-time helpers ────────────────────────────────────────────────────────

/** "YYYY-MM-DD" for the current Paris day. Used as the rotation seed + replay key. */
export function parisDayKey(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD; Europe/Paris handles DST automatically.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

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

/** Source tag stored on the UserPokemon - also the per-day/per-gen replay key. */
export function shopSource(gen: number, dayKey: string = parisDayKey()): string {
  return `shop_${dayKey}_gen${gen}`;
}

// ── Shop reads ────────────────────────────────────────────────────────────────

export interface ShopPack {
  generation: number;
  name: string;
  texture_url: string;
  price: number;
  bought: boolean;
}

export interface DailyShop {
  packs: ShopPack[];
  rotates_at: string;
}

export async function getDailyShop(userId: string): Promise<DailyShop> {
  const dayKey = parisDayKey();
  const gens = dailyGenerations(dayKey);
  const price = getPackPrice();

  const sources = gens.map(g => shopSource(g, dayKey));
  const bought = await prisma.userPokemon.findMany({
    where: { user_id: userId, source: { in: sources } },
    select: { source: true },
  });
  const boughtSources = new Set(bought.map(b => b.source));

  return {
    packs: gens.map(gen => ({
      generation: gen,
      name: GENERATION_NAMES[gen],
      texture_url: `/texture_pack_gen_${gen}.png`,
      price,
      bought: boughtSources.has(shopSource(gen, dayKey)),
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

export async function buyShopPack(userId: string, gen: number): Promise<ShopBuyResult> {
  const dayKey = parisDayKey();

  // Server-authoritative: the gen must be one of today's deterministic offers.
  if (!dailyGenerations(dayKey).includes(gen)) {
    throw Object.assign(new Error("Ce pack n'est pas disponible aujourd'hui."), { status: 400 });
  }

  const price = getPackPrice();
  const source = shopSource(gen, dayKey);

  const draw = await prisma.$transaction(async tx => {
    // One purchase per pack per Paris day - the source tag doubles as a replay
    // guard (same pattern as one-shot draws in POST /draw).
    const already = await tx.userPokemon.count({ where: { user_id: userId, source } });
    if (already > 0) {
      throw Object.assign(new Error('Pack déjà acheté aujourd\'hui.'), { status: 409 });
    }

    // TOCTOU-safe: spendCoins is an atomic compare-and-swap (gte amount).
    await spendCoins(tx, userId, price, `shop_pack_gen${gen}`);

    return drawAndCreate(tx, userId, { source, generation: gen });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  // Decoration strip - cosmetic only, drawn from the same gen pool.
  const strip = await buildStrip(gen);

  const updatedUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { coins: true },
  });

  return {
    pokemon: draw.pokemon,
    user_pokemon_id: draw.userPokemonId,
    is_duplicate: draw.isDuplicate,
    sell_price: draw.sellPrice,
    strip,
    coins_remaining: updatedUser?.coins ?? 0,
  };
}

// Cosmetic roll strip: STRIP_SIZE random cards from the gen's pool, weighted by
// the same rarity distribution as a real draw.
async function buildStrip(gen: number): Promise<ShopBuyResult['strip']> {
  const select = { id: true, name: true, sprite_url: true, rarity: true, points: true } as const;
  const [commons, rares, epics, legendaries] = await Promise.all([
    prisma.pokemon.findMany({ where: { generation: gen, rarity: 'COMMON' }, select }),
    prisma.pokemon.findMany({ where: { generation: gen, rarity: 'RARE' }, select }),
    prisma.pokemon.findMany({ where: { generation: gen, rarity: 'EPIC' }, select }),
    prisma.pokemon.findMany({ where: { generation: gen, rarity: 'LEGENDARY' }, select }),
  ]);
  const pools: Record<string, typeof commons> = { COMMON: commons, RARE: rares, EPIC: epics, LEGENDARY: legendaries };
  const allPool = [...commons, ...rares, ...epics, ...legendaries];

  function pickRarity(): string {
    const roll = Math.random();
    if (roll < 0.798) return 'COMMON';
    if (roll < 0.948) return 'RARE';
    if (roll < 0.998) return 'EPIC';
    return 'LEGENDARY';
  }

  return Array.from({ length: STRIP_SIZE }, () => {
    const rarity = pickRarity();
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
  });
}
