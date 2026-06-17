import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const [userPokemons, user, totalPokemon] = await Promise.all([
    prisma.userPokemon.findMany({
      where: { user_id: userId },
      include: { pokemon: true, original_owner: true },
      orderBy: { obtained_at: 'desc' },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, display_name: true, nickname: true, total_score: true, trade_count: true },
    }),
    prisma.pokemon.count(),
  ]);

  res.json({
    user: user && { id: user.id, display_name: user.nickname ?? user.display_name, total_score: user.total_score, trade_count: user.trade_count },
    totalPokemon,
    pokemons: userPokemons.map(up => ({
      instanceId: up.id,
      obtainedAt: up.obtained_at,
      source: up.source,
      tradeable_at: up.tradeable_at,
      is_shiny: up.is_shiny,
      original_owner_id: up.original_owner_id,
      original_owner_name: up.original_owner
        ? (up.original_owner.nickname ?? up.original_owner.display_name)
        : null,
      trade_count: up.trade_count,
      ...up.pokemon,
      sprite_url: up.is_shiny ? up.pokemon.sprite_url.replace('/normal/', '/shiny/') : up.pokemon.sprite_url,
      points: up.pokemon.points,
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

  console.log('Strip:', pokemons.map(p => `${p.name}(${p.rarity})`).join(', '));

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

router.get('/export', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const userPokemons = await prisma.userPokemon.findMany({
    where: { user_id: userId },
    include: { pokemon: true, original_owner: true },
    orderBy: [{ pokemon: { id: 'asc' } }],
  });

  const data = userPokemons.map(up => ({
    instance_id: up.id,
    pokedex_id: up.pokemon.id,
    name: up.pokemon.name,
    generation: up.pokemon.generation,
    rarity: up.pokemon.rarity,
    is_shiny: up.is_shiny,
    points: up.pokemon.points,
    bst: up.pokemon.bst,
    types: up.pokemon.types.join('/'),
    source: up.source,
    obtained_at: up.obtained_at.toISOString(),
    original_owner: up.original_owner
      ? (up.original_owner.nickname ?? up.original_owner.display_name)
      : 'Inconnu',
    trade_count: up.trade_count,
  }));

  res.json(data);
});

router.get('/:userId', async (req: Request, res: Response): Promise<void> => {
  const userId = String(req.params.userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, display_name: true, nickname: true, total_score: true,
      trade_count: true, featured_badges: true, trainer_gender: true, trainer_avatar: true,
      favorite_pokemon: {
        include: { pokemon: { select: { id: true, name: true, sprite_url: true, height_m: true } } },
      },
    },
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

  // When fetched for the trade-proposal target picker (?for_trade=1), hide the
  // Pokémon already locked in one of this user's pending trades (as offered OR
  // requested) so they can't be selected - mirrors the conflict check in
  // POST /trade/propose. The public profile view omits the flag and still shows
  // the full collection.
  const forTrade = req.query.for_trade === '1' || req.query.for_trade === 'true';
  let lockedIds: string[] = [];
  if (forTrade) {
    const pendingTrades = await prisma.trade.findMany({
      where: {
        status: 'pending',
        OR: [{ from_user_id: userId }, { to_user_id: userId }],
      },
      select: { from_pokemon_id: true, to_pokemon_id: true },
    });
    lockedIds = pendingTrades.flatMap(t =>
      t.to_pokemon_id ? [t.from_pokemon_id, t.to_pokemon_id] : [t.from_pokemon_id],
    );
  }

  const userPokemons = await prisma.userPokemon.findMany({
    where: {
      user_id: userId,
      ...(lockedIds.length > 0 ? { id: { notIn: lockedIds } } : {}),
      // For trade selection, also hide Pokémon still under the 24h trade cooldown
      // (tradeable_at in the future). null = never traded = tradeable.
      ...(forTrade ? { OR: [{ tradeable_at: null }, { tradeable_at: { lte: new Date() } }] } : {}),
    },
    include: { pokemon: true },
    orderBy: { obtained_at: 'desc' },
  });

  // Distinct species this user owns across their WHOLE collection (ignoring the
  // tradeable/locked filtering above). Powers the trade "Non-obtenu" filter,
  // which crosses one side's tradeable list against the other's full Pokédex.
  // Single grouped query - no N+1.
  let owned_species_ids: number[] | undefined;
  if (forTrade) {
    const distinctSpecies = await prisma.userPokemon.findMany({
      where: { user_id: userId },
      select: { pokemon_id: true },
      distinct: ['pokemon_id'],
    });
    owned_species_ids = distinctSpecies.map(s => s.pokemon_id);
  }

  res.json({
    owned_species_ids,
    user: {
      id: user.id,
      display_name: user.nickname ?? user.display_name,
      total_score: user.total_score,
      trade_count: user.trade_count,
      featured_badges: featured_badge_objects,
      trainer_gender: user.trainer_gender,
      trainer_avatar: user.trainer_avatar,
      favorite_pokemon: user.favorite_pokemon && {
        instanceId: user.favorite_pokemon.id,
        is_shiny: user.favorite_pokemon.is_shiny,
        pokemon: {
          id: user.favorite_pokemon.pokemon.id,
          name: user.favorite_pokemon.pokemon.name,
          height_m: user.favorite_pokemon.pokemon.height_m,
          sprite_url: user.favorite_pokemon.is_shiny
            ? user.favorite_pokemon.pokemon.sprite_url.replace('/normal/', '/shiny/')
            : user.favorite_pokemon.pokemon.sprite_url,
        },
      },
    },
    pokemons: userPokemons.map(up => ({
      instanceId: up.id,
      obtainedAt: up.obtained_at,
      source: up.source,
      tradeable_at: up.tradeable_at,
      is_shiny: up.is_shiny,
      ...up.pokemon,
      sprite_url: up.is_shiny ? up.pokemon.sprite_url.replace('/normal/', '/shiny/') : up.pokemon.sprite_url,
      points: up.pokemon.points,
    })),
  });
});

export default router;
