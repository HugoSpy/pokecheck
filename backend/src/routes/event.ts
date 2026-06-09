import { Router, Request, Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/authMiddleware';
import { spendCoins, getSellPrice } from '../services/coinService';
import { recalculateUserPokedexValue } from '../services/pokedexValue';
import { checkBadges } from '../services/badgeService';

const router = Router();
const prisma = new PrismaClient();

const STRIP_SIZE = 29;
const FULL_STRIP_SIZE = 30; // multi-open returns full strips with the winner baked in
const WINNER_INDEX = 22;    // matches PackRoll's TARGET_INDEX
const MAX_COUNT = 10;
const BASE_SHINY_RATE = 1 / 4096;

function rollShiny(multiplier: number | undefined): boolean {
  const shinyRate = Math.min(BASE_SHINY_RATE * (multiplier ?? 1.0), 1);
  return Math.random() < shinyRate;
}

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const now = new Date();
  const events = await prisma.event.findMany({
    where: {
      published: true,
      starts_at: { lte: now },
      ends_at: { gte: now },
    },
    orderBy: { starts_at: 'asc' },
  });
  res.json(events);
});

router.post('/draw', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { event_id, count: rawCount } = req.body as { event_id: string; count?: number };

  if (!event_id) {
    res.status(400).json({ error: 'event_id is required' });
    return;
  }

  const count = rawCount ?? 1;
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    res.status(400).json({ error: `count must be an integer between 1 and ${MAX_COUNT}` });
    return;
  }

  const now = new Date();
  const event = await prisma.event.findUnique({ where: { id: event_id } });

  if (!event || !event.published || event.starts_at > now || event.ends_at < now) {
    res.status(404).json({ error: 'Event not found or not active' });
    return;
  }

  if (event.pokemon_pool.length === 0) {
    res.status(500).json({ error: 'Event pool is empty' });
    return;
  }

  const multipliers = event.rarity_multiplier as Record<string, number>;
  const baseRates: Record<string, number> = {
    COMMON: 79.5,
    RARE: 15,
    EPIC: 5,
    LEGENDARY: 0.5,
  };

  const weightedRates: Record<string, number> = {};
  for (const [rarity, base] of Object.entries(baseRates)) {
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

  // Fetch pool by rarity (used for winner + strip)
  const [commons, rares, epics, legendaries] = await Promise.all([
    prisma.pokemon.findMany({ where: { id: { in: event.pokemon_pool }, rarity: 'COMMON' }, select: { id: true, name: true, sprite_url: true, rarity: true, points: true, types: true } }),
    prisma.pokemon.findMany({ where: { id: { in: event.pokemon_pool }, rarity: 'RARE' }, select: { id: true, name: true, sprite_url: true, rarity: true, points: true, types: true } }),
    prisma.pokemon.findMany({ where: { id: { in: event.pokemon_pool }, rarity: 'EPIC' }, select: { id: true, name: true, sprite_url: true, rarity: true, points: true, types: true } }),
    prisma.pokemon.findMany({ where: { id: { in: event.pokemon_pool }, rarity: 'LEGENDARY' }, select: { id: true, name: true, sprite_url: true, rarity: true, points: true, types: true } }),
  ]);
  const pools: Record<string, typeof commons> = { COMMON: commons, RARE: rares, EPIC: epics, LEGENDARY: legendaries };
  const allPool = [...commons, ...rares, ...epics, ...legendaries];

  if (allPool.length === 0) {
    res.status(500).json({ error: 'No Pokémon available in pool' });
    return;
  }

  // Build a full 30-card strip with the given winner baked in at WINNER_INDEX —
  // the exact shape PackRoll renders (used by the multi-open path).
  function buildFullStrip(winnerCard: typeof commons[number] & { is_shiny: boolean; points: number }) {
    const strip = Array.from({ length: FULL_STRIP_SIZE }, () => {
      const rarity = pickRarity();
      const pool = pools[rarity].length > 0 ? pools[rarity] : allPool;
      const p = pool[Math.floor(Math.random() * pool.length)];
      const shiny = rollShiny(multipliers.SHINY);
      return {
        id: p.id,
        name: p.name,
        sprite_url: shiny ? p.sprite_url.replace('/normal/', '/shiny/') : p.sprite_url,
        rarity: p.rarity,
        points: p.points,
        is_shiny: shiny,
      };
    });
    strip[WINNER_INDEX] = {
      id: winnerCard.id,
      name: winnerCard.name,
      sprite_url: winnerCard.sprite_url,
      rarity: winnerCard.rarity,
      points: winnerCard.points,
      is_shiny: winnerCard.is_shiny,
    };
    return strip;
  }

  // ── Multi-open (count > 1): N independent draws in one Serializable tx ──
  if (count > 1) {
    const totalPrice = event.price * count;
    const buyer = await prisma.user.findUnique({ where: { id: userId }, select: { coins: true } });
    if (!buyer || buyer.coins < totalPrice) {
      res.status(402).json({ error: 'Insufficient coins' });
      return;
    }

    // Roll all winners up front (pure RNG), then persist them atomically.
    const rolls = Array.from({ length: count }, () => {
      const r = pickRarity();
      const cand = pools[r].length > 0 ? pools[r] : allPool;
      const p = cand[Math.floor(Math.random() * cand.length)];
      const shiny = rollShiny(multipliers.SHINY);
      return { p, shiny };
    });

    let coinsRemaining = buyer.coins - totalPrice;
    try {
      const persisted = await prisma.$transaction(async tx => {
        await spendCoins(tx, userId, totalPrice, 'event_pack');
        const created: Array<{ id: string; isDuplicate: boolean }> = [];
        for (const { p, shiny } of rolls) {
          const row = await tx.userPokemon.create({
            data: { user_id: userId, pokemon_id: p.id, source: 'event', tradeable_at: null, is_shiny: shiny },
          });
          // Duplicate accounts for earlier creates in this same batch (visible in-tx).
          const duplicateCount = await tx.userPokemon.count({
            where: { user_id: userId, pokemon_id: p.id, is_shiny: shiny, id: { not: row.id } },
          });
          created.push({ id: row.id, isDuplicate: duplicateCount > 0 });
        }
        await recalculateUserPokedexValue(tx, userId);
        const fresh = await tx.user.findUnique({ where: { id: userId }, select: { coins: true } });
        return { created, coins: fresh?.coins ?? coinsRemaining };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      coinsRemaining = persisted.coins;

      const newBadges = await checkBadges(userId);

      const results = rolls.map(({ p, shiny }, i) => {
        const spriteUrl = shiny ? p.sprite_url.replace('/normal/', '/shiny/') : p.sprite_url;
        const finalPoints = shiny ? p.points * 3 : p.points;
        const winnerCard = { ...p, sprite_url: spriteUrl, points: finalPoints, is_shiny: shiny };
        return {
          pokemon: {
            id: p.id, name: p.name, sprite_url: spriteUrl, rarity: p.rarity,
            points: finalPoints, types: p.types, is_shiny: shiny,
          },
          strip: buildFullStrip(winnerCard),
          user_pokemon_id: persisted.created[i].id,
          is_duplicate: persisted.created[i].isDuplicate,
          sell_price: getSellPrice({ is_shiny: shiny, pokemon: { id: p.id, points: p.points, rarity: p.rarity } }),
        };
      });

      res.json({ results, coins_remaining: coinsRemaining, new_badges: newBadges });
    } catch (err) {
      const e = err as { status?: number; code?: string };
      if (e.status === 402) { res.status(402).json({ error: 'Insufficient coins' }); return; }
      if (e.code === 'P2034') { res.status(429).json({ error: 'Too many requests, please slow down.' }); return; }
      throw err;
    }
    return;
  }

  // Draw winner
  const pickedRarity = pickRarity();
  const candidates = pools[pickedRarity].length > 0 ? pools[pickedRarity] : allPool;
  const pokemon = candidates[Math.floor(Math.random() * candidates.length)];

  const isShiny = rollShiny(multipliers.SHINY);
  const winnerSpriteUrl = isShiny
    ? pokemon.sprite_url.replace('/normal/', '/shiny/')
    : pokemon.sprite_url;
  const finalPoints = isShiny ? pokemon.points * 3 : pokemon.points;

  const { userPokemonId, isDuplicate } = await prisma.$transaction(async tx => {
    await spendCoins(tx, userId, event.price, 'event_pack');
    const created = await tx.userPokemon.create({
      data: {
        user_id: userId,
        pokemon_id: pokemon.id,
        source: 'event',
        tradeable_at: null,
        is_shiny: isShiny,
      },
    });
    await recalculateUserPokedexValue(tx, userId);
    // Duplicate = another instance of this exact variant (species + shiny state).
    const duplicateCount = await tx.userPokemon.count({
      where: { user_id: userId, pokemon_id: pokemon.id, is_shiny: isShiny, id: { not: created.id } },
    });
    return { userPokemonId: created.id, isDuplicate: duplicateCount > 0 };
  });

  const sellPrice = getSellPrice({
    is_shiny: isShiny,
    pokemon: { id: pokemon.id, points: pokemon.points, rarity: pokemon.rarity },
  });

  const newBadges = await checkBadges(userId);

  const updatedUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { coins: true },
  });

  // Generate decoration strip from same pool
  const strip = Array.from({ length: STRIP_SIZE }, () => {
    const rarity = pickRarity();
    const pool = pools[rarity].length > 0 ? pools[rarity] : allPool;
    const p = pool[Math.floor(Math.random() * pool.length)];
    const shiny = rollShiny(multipliers.SHINY);
    return {
      id: p.id,
      name: p.name,
      sprite_url: shiny ? p.sprite_url.replace('/normal/', '/shiny/') : p.sprite_url,
      rarity: p.rarity,
      points: p.points,
      is_shiny: shiny,
    };
  });

  res.json({
    pokemon: {
      id: pokemon.id,
      name: pokemon.name,
      sprite_url: winnerSpriteUrl,
      rarity: pokemon.rarity,
      points: finalPoints,
      types: pokemon.types,
      is_shiny: isShiny,
    },
    user_pokemon_id: userPokemonId,
    is_duplicate: isDuplicate,
    sell_price: sellPrice,
    strip,
    coins_remaining: updatedUser?.coins ?? 0,
    new_badges: newBadges,
  });
});

export default router;
