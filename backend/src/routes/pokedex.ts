import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

router.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const [userPokemons, user] = await Promise.all([
    prisma.userPokemon.findMany({
      where: { user_id: userId },
      include: { pokemon: true },
      orderBy: { obtained_at: 'desc' },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, display_name: true, total_score: true, trade_count: true },
    }),
  ]);

  res.json({
    user,
    pokemons: userPokemons.map(up => ({
      instanceId: up.id,
      obtainedAt: up.obtained_at,
      source: up.source,
      tradeable_at: up.tradeable_at,
      is_shiny: up.is_shiny,
      ...up.pokemon,
      sprite_url: up.is_shiny ? up.pokemon.sprite_url.replace('/normal/', '/shiny/') : up.pokemon.sprite_url,
      points: up.is_shiny ? up.pokemon.points * 3 : up.pokemon.points,
    })),
  });
});

router.get('/random-weighted', async (req: Request, res: Response): Promise<void> => {
  const count = Math.min(Math.max(parseInt(String(req.query.count ?? '30'), 10) || 30, 1), 60);

  function pickRarity(): string {
    const roll = Math.random();
    if (roll < 0.795) return 'COMMON';
    if (roll < 0.945) return 'RARE';
    if (roll < 0.995) return 'EPIC';
    return 'LEGENDARY';
  }

  // Précharger un pool par rareté pour éviter N requêtes DB
  const [commons, rares, epics, legendaries] = await Promise.all([
    prisma.pokemon.findMany({ where: { rarity: 'COMMON' }, select: { id: true, name: true, sprite_url: true, rarity: true, points: true } }),
    prisma.pokemon.findMany({ where: { rarity: 'RARE' }, select: { id: true, name: true, sprite_url: true, rarity: true, points: true } }),
    prisma.pokemon.findMany({ where: { rarity: 'EPIC' }, select: { id: true, name: true, sprite_url: true, rarity: true, points: true } }),
    prisma.pokemon.findMany({ where: { rarity: 'LEGENDARY' }, select: { id: true, name: true, sprite_url: true, rarity: true, points: true } }),
  ]);

  const pools: Record<string, typeof commons> = { COMMON: commons, RARE: rares, EPIC: epics, LEGENDARY: legendaries };

  const pokemons = Array.from({ length: count }, () => {
    const rarity = pickRarity();
    const pool = pools[rarity];
    return pool[Math.floor(Math.random() * pool.length)];
  });

  res.json({ pokemons });
});

router.get('/random', async (req: Request, res: Response): Promise<void> => {
  const count = Math.min(Math.max(parseInt(String(req.query.count ?? '30'), 10) || 30, 1), 60);

  const allIds = await prisma.pokemon.findMany({ select: { id: true } });
  const shuffled = allIds.sort(() => Math.random() - 0.5).slice(0, count);
  const ids = shuffled.map(p => p.id);

  const pokemons = await prisma.pokemon.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, sprite_url: true, rarity: true, points: true },
  });

  const orderMap = new Map(ids.map((id, i) => [id, i]));
  pokemons.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

  res.json({ pokemons });
});

router.get('/:userId', async (req: Request, res: Response): Promise<void> => {
  const userId = String(req.params.userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, display_name: true, total_score: true, trade_count: true, featured_badges: true },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const featuredBadgeDetails = user.featured_badges.length > 0
    ? await prisma.badge.findMany({ where: { id: { in: user.featured_badges } } })
    : [];
  const badgeMap = new Map(featuredBadgeDetails.map(b => [b.id, b]));
  const featured_badge_objects = user.featured_badges
    .map(id => badgeMap.get(id))
    .filter((b): b is NonNullable<typeof b> => b !== undefined);

  const userPokemons = await prisma.userPokemon.findMany({
    where: { user_id: userId },
    include: { pokemon: true },
    orderBy: { obtained_at: 'desc' },
  });

  res.json({
    user: { ...user, featured_badges: featured_badge_objects },
    pokemons: userPokemons.map(up => ({
      instanceId: up.id,
      obtainedAt: up.obtained_at,
      source: up.source,
      tradeable_at: up.tradeable_at,
      is_shiny: up.is_shiny,
      ...up.pokemon,
      sprite_url: up.is_shiny ? up.pokemon.sprite_url.replace('/normal/', '/shiny/') : up.pokemon.sprite_url,
      points: up.is_shiny ? up.pokemon.points * 3 : up.pokemon.points,
    })),
  });
});

export default router;
