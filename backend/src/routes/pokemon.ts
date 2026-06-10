import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /pokemon/search?name=&type=&rarity=&limit= - search the global Pokémon
// species table (NOT a user's collection). Public, like /pokedex and /leaderboard.
router.get('/search', async (req: Request, res: Response): Promise<void> => {
  const name = String(req.query.name ?? '').trim();
  const type = String(req.query.type ?? '').trim();
  const rarity = String(req.query.rarity ?? '').trim();
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 200);

  const pokemons = await prisma.pokemon.findMany({
    where: {
      ...(name ? { name: { contains: name, mode: 'insensitive' } } : {}),
      ...(rarity ? { rarity } : {}),
      ...(type ? { types: { has: type } } : {}),
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

  res.json({ owners });
});

export default router;
