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
      ...up.pokemon,
    })),
  });
});

router.get('/:userId', async (req: Request, res: Response): Promise<void> => {
  const userId = String(req.params.userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, display_name: true, total_score: true, trade_count: true },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const userPokemons = await prisma.userPokemon.findMany({
    where: { user_id: userId },
    include: { pokemon: true },
    orderBy: { obtained_at: 'desc' },
  });

  res.json({
    user,
    pokemons: userPokemons.map(up => ({
      instanceId: up.id,
      obtainedAt: up.obtained_at,
      source: up.source,
      tradeable_at: up.tradeable_at,
      ...up.pokemon,
    })),
  });
});

export default router;
