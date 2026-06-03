import { Router, Request, Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/authMiddleware';
import { drawAndCreate } from '../services/drawService';
import { checkBadges } from '../services/badgeService';

const router = Router();
const prisma = new PrismaClient();

router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  // source is always 'draw' for this endpoint — never accepted from the client.
  // Accepting it from the body would let anyone bypass the daily draw limit by
  // sending { source: "bonus" } (only 'draw' triggers the count check below).
  const source = 'draw';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isAdmin = req.user!.isAdmin === true;
  const forceShiny = isAdmin && (req.body as { force_shiny?: boolean }).force_shiny === true;

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      // Count check is inside the Serializable transaction so concurrent requests
      // cannot both pass the 100-draw limit before either commit (TOCTOU fix).
      const drawCount = await tx.userPokemon.count({
        where: {
          user_id: userId,
          source: 'draw',
          obtained_at: { gte: today, lt: tomorrow },
        },
      });

      if (drawCount >= 100) {
        throw Object.assign(new Error('Already drawn today'), { status: 403 });
      }

      return drawAndCreate(tx, userId, { source, forceShiny });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (err: any) {
    if (err.status === 403) {
      res.status(403).json({ error: 'Already drawn today' });
      return;
    }
    // P2034 = serialization failure from concurrent draws — one request wins, others get 429.
    if (err.code === 'P2034') {
      res.status(429).json({ error: 'Too many requests, please slow down.' });
      return;
    }
    throw err;
  }

  const newBadges = await checkBadges(userId);

  res.json({ pokemon: result.pokemon, new_badges: newBadges });
});

export default router;
