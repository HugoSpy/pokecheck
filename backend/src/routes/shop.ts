import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { getDailyShop, buyShopPack, buyShopPackMulti } from '../services/shopService';
import { checkBadges } from '../services/badgeService';

const router = Router();

// Today's 3 rotating packs (same for everyone - purchases are unlimited).
router.get('/daily', authMiddleware, async (_req: Request, res: Response): Promise<void> => {
  res.json(await getDailyShop());
});

// Buy a pack: deduct coins, draw from that generation.
// count === 1 (or omitted) -> single result (draw runs during the client anim).
// count  >  1              -> { results } for the parallel multi-pack animation.
router.post('/buy/:gen', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const gen = parseInt(String(req.params.gen), 10);
  const count = (req.body as { count?: number })?.count ?? 1;

  if (!Number.isInteger(gen) || gen < 1 || gen > 7) {
    res.status(400).json({ error: 'Génération invalide.' });
    return;
  }

  try {
    if (count > 1) {
      const result = await buyShopPackMulti(userId, gen, count);
      const newBadges = await checkBadges(userId);
      res.json({ ...result, new_badges: newBadges });
      return;
    }

    const result = await buyShopPack(userId, gen);
    const newBadges = await checkBadges(userId);
    res.json({ ...result, new_badges: newBadges });
  } catch (err: any) {
    // 400 not-on-offer / bad count, 402 insufficient coins.
    if (err.status === 400 || err.status === 402) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    // P2034 = serialization failure from concurrent buys - one wins, others retry.
    if (err.code === 'P2034') {
      res.status(429).json({ error: 'Too many requests, please slow down.' });
      return;
    }
    throw err;
  }
});

export default router;
