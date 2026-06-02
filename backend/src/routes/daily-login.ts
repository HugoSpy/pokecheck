import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { claimDailyLogin } from '../services/streakService';
import { checkBadges } from '../services/badgeService';

const router = Router();

router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const result = await claimDailyLogin(userId);

  const newBadges = result.already_claimed ? [] : await checkBadges(userId);

  res.json({ ...result, new_badges: newBadges });
});

export default router;
