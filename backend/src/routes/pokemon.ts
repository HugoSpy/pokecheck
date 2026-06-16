import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// GET /pokemon/search?name=&type=&rarity=&generation=&limit= - search the global
// Pokémon species table (NOT a user's collection). Public, like /pokedex.
router.get('/search', async (req: Request, res: Response): Promise<void> => {
  const name = String(req.query.name ?? '').trim();
  const type = String(req.query.type ?? '').trim();
  const rarity = String(req.query.rarity ?? '').trim();
  const generation = parseInt(String(req.query.generation ?? ''), 10);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 200);

  const pokemons = await prisma.pokemon.findMany({
    where: {
      ...(name ? { name: { contains: name, mode: 'insensitive' } } : {}),
      ...(rarity ? { rarity } : {}),
      ...(type ? { types: { has: type } } : {}),
      ...(Number.isInteger(generation) && generation >= 1 && generation <= 7 ? { generation } : {}),
    },
    orderBy: { id: 'asc' },
    take: limit,
    select: { id: true, name: true, rarity: true, points: true, types: true, generation: true, sprite_url: true },
  });

  res.json({ pokemons });
});

// GET /pokemon/:pokemonId/owners - users currently holding ≥1 instance of this
// species, with how many each owns. Sorted by count DESC then displayName ASC.
router.get('/:pokemonId/owners', async (req: Request, res: Response): Promise<void> => {
  const pokemonId = parseInt(String(req.params.pokemonId), 10);
  if (!Number.isInteger(pokemonId)) {
    res.status(400).json({ error: 'Invalid pokemonId' });
    return;
  }

  const grouped = await prisma.userPokemon.groupBy({
    by: ['user_id'],
    where: { pokemon_id: pokemonId },
    _count: { _all: true },
  });

  if (grouped.length === 0) {
    res.json({ owners: [] });
    return;
  }

  const users = await prisma.user.findMany({
    where: { id: { in: grouped.map(g => g.user_id) } },
    select: { id: true, display_name: true, nickname: true },
  });
  const nameMap = new Map(users.map(u => [u.id, u.nickname ?? u.display_name]));

  const owners = grouped
    .map(g => ({
      userId: g.user_id,
      displayName: nameMap.get(g.user_id) ?? '???',
      count: g._count._all,
    }))
    .sort((a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName));

  // Active market listings for this species. MarketListing.pokemon_id is a
  // UserPokemon instance id (not a species id) and there is no Prisma relation,
  // so resolve it in two steps - bounded by the (small) set of active listings
  // rather than by every instance of the species.
  const activeListings = await prisma.marketListing.findMany({
    where: { status: 'active' },
    select: { pokemon_id: true, price_coins: true },
  });
  let market: { lowest_price: number; count: number } | null = null;
  if (activeListings.length > 0) {
    const speciesInstances = await prisma.userPokemon.findMany({
      where: { pokemon_id: pokemonId, id: { in: activeListings.map(l => l.pokemon_id) } },
      select: { id: true },
    });
    const speciesInstanceIds = new Set(speciesInstances.map(i => i.id));
    const prices = activeListings
      .filter(l => speciesInstanceIds.has(l.pokemon_id))
      .map(l => l.price_coins);
    if (prices.length > 0) {
      market = { lowest_price: Math.min(...prices), count: prices.length };
    }
  }

  res.json({ owners, market });
});

export default router;
