import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { getDailyShop, buyShopPack } from '../services/shopService';
import { checkBadges } from '../services/badgeService';

const router = Router();

// Today's 3 rotating packs + whether the current user already bought each.
router.get('/daily', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const shop = await getDailyShop(userId);
  res.json(shop);
});

// Buy a pack: deduct coins, draw one Pokémon from that generation.
router.post('/buy/:gen', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const gen = parseInt(String(req.params.gen), 10);

  if (!Number.isInteger(gen) || gen < 1 || gen > 7) {
    res.status(400).json({ error: 'Génération invalide.' });
    return;
  }

  let result;
  try {
    result = await buyShopPack(userId, gen);
  } catch (err: any) {
    // 400 not-today, 409 already-bought, 402 insufficient coins.
    if (err.status === 400 || err.status === 409 || err.status === 402) {
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

  const newBadges = await checkBadges(userId);

  res.json({ ...result, new_badges: newBadges });
});

export default router;
