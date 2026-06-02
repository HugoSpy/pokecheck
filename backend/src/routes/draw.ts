import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/authMiddleware';
import { drawAndCreate } from '../services/drawService';
import { checkBadges } from '../services/badgeService';

const router = Router();
const prisma = new PrismaClient();

router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const source = (req.body as { source?: string }).source ?? 'draw';

  if (source === 'draw') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const drawCount = await prisma.userPokemon.count({
      where: {
        user_id: userId,
        source: 'draw',
        obtained_at: { gte: today, lt: tomorrow },
      },
    });

    if (drawCount >= 100) {
      res.status(403).json({ error: 'Already drawn today' });
      return;
    }
  }

  const isAdmin = req.user!.isAdmin === true;
  const forceShiny = isAdmin && (req.body as { force_shiny?: boolean }).force_shiny === true;

  const result = await prisma.$transaction(tx =>
    drawAndCreate(tx, userId, { source, forceShiny })
  );

  const newBadges = await checkBadges(userId);

  res.json({ pokemon: result.pokemon, new_badges: newBadges });
});

export default router;
