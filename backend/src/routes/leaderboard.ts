import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const sort = req.query.sort === 'coins' ? 'coins' : 'total_score';

  const users = await prisma.user.findMany({
    orderBy: { [sort]: 'desc' },
    take: 50,
    select: {
      id: true,
      display_name: true,
      nickname: true,
      total_score: true,
      coins: true,
      trade_count: true,
      pokemons: {
        select: { pokemon: { select: { rarity: true } } },
      },
    },
  });

  const result = users.map(user => ({
    id: user.id,
    display_name: user.nickname ?? user.display_name,
    total_score: user.total_score,
    coins: user.coins,
    trade_count: user.trade_count,
    pokemon_count: user.pokemons.length,
    legendary_count: user.pokemons.filter(p => p.pokemon.rarity === 'LEGENDARY').length,
  }));

  res.json(result);
});

export default router;
