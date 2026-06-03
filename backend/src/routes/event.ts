import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/authMiddleware';
import { spendCoins } from '../services/coinService';
import { recalculateUserPokedexValue } from '../services/pokedexValue';
import { checkBadges } from '../services/badgeService';

const router = Router();
const prisma = new PrismaClient();

const STRIP_SIZE = 29;

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
  const { event_id } = req.body as { event_id: string };

  if (!event_id) {
    res.status(400).json({ error: 'event_id is required' });
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

  // Draw winner
  const pickedRarity = pickRarity();
  const candidates = pools[pickedRarity].length > 0 ? pools[pickedRarity] : allPool;
  const pokemon = candidates[Math.floor(Math.random() * candidates.length)];

  const isShiny = Math.random() < 1 / 4096;
  const winnerSpriteUrl = isShiny
    ? pokemon.sprite_url.replace('/normal/', '/shiny/')
    : pokemon.sprite_url;
  const finalPoints = isShiny ? pokemon.points * 3 : pokemon.points;

  await prisma.$transaction(async tx => {
    await spendCoins(tx, userId, event.price, 'event_pack');
    await tx.userPokemon.create({
      data: {
        user_id: userId,
        pokemon_id: pokemon.id,
        source: 'event',
        tradeable_at: null,
        is_shiny: isShiny,
      },
    });
    await recalculateUserPokedexValue(tx, userId);
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
    const shiny = Math.random() < 1 / 4096;
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
    strip,
    coins_remaining: updatedUser?.coins ?? 0,
    new_badges: newBadges,
  });
});

export default router;
