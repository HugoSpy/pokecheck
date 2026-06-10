import { Router, Request, Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/authMiddleware';
import { drawAndCreate } from '../services/drawService';
import { checkBadges } from '../services/badgeService';

const router = Router();
const prisma = new PrismaClient();

router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const isAdmin = req.user!.isAdmin === true;
  const drawGrant = req.user!.drawGrant;
  const hasOneShotGrant = drawGrant?.type === 'one-shot' && typeof drawGrant.tokenId === 'string';

  if (!isAdmin && !hasOneShotGrant) {
    res.status(403).json({ error: 'Direct draws are disabled. Use /attendance/open.' });
    return;
  }

  const source = hasOneShotGrant ? `oneshot_${drawGrant.tokenId}` : 'admin';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const forceShiny = isAdmin && (req.body as { force_shiny?: boolean }).force_shiny === true;
  // HIDDEN FEATURE
  const forceDitto = isAdmin && (req.body as { force_ditto?: boolean }).force_ditto === true;
  // END HIDDEN FEATURE

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      if (hasOneShotGrant) {
        const alreadyOpened = await tx.userPokemon.count({
          where: { user_id: userId, source },
        });

        if (alreadyOpened > 0) {
          throw Object.assign(new Error('Pack already opened'), { status: 403 });
        }
      } else {
        // Defensive cap for internal admin draws. Normal user draws go through
        // /attendance/open and one-shot sessions are limited by source replay.
        const drawCount = await tx.userPokemon.count({
          where: {
            user_id: userId,
            source: 'admin',
            obtained_at: { gte: today, lt: tomorrow },
          },
        });

        if (drawCount >= 100) {
          throw Object.assign(new Error('Admin draw limit reached'), { status: 403 });
        }
      }

      return drawAndCreate(tx, userId, { source, forceShiny, forceDitto });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (err: any) {
    if (err.status === 403) {
      res.status(403).json({ error: err.message });
      return;
    }
    // P2034 = serialization failure from concurrent draws - one request wins, others get 429.
    if (err.code === 'P2034') {
      res.status(429).json({ error: 'Too many requests, please slow down.' });
      return;
    }
    throw err;
  }

  const newBadges = await checkBadges(userId);

  res.json({
    pokemon: result.pokemon,
    user_pokemon_id: result.userPokemonId,
    is_duplicate: result.isDuplicate,
    sell_price: result.sellPrice,
    new_badges: newBadges,
  });
});

export default router;
