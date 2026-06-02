import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

// GET /users/search?q=prénom+nom  — recherche élève par nom (min 2 chars)
router.get('/search', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) {
    res.json({ users: [] });
    return;
  }

  const users = await prisma.user.findMany({
    where: {
      display_name: { contains: q, mode: 'insensitive' },
      NOT: { id: req.user!.userId }, // exclure soi-même
    },
    select: { id: true, display_name: true },
    orderBy: { display_name: 'asc' },
    take: 8,
  });

  res.json({ users });
});

// GET /users/badges/me — liste complète des badges de l'utilisateur connecté
router.get('/badges/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const badges = await prisma.userBadge.findMany({
    where: { user_id: userId },
    include: { badge: true },
    orderBy: { unlocked_at: 'desc' },
  });

  res.json(badges);
});

// GET /users/badges/unnotified — badges débloqués mais pas encore affichés
router.get('/badges/unnotified', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const badges = await prisma.userBadge.findMany({
    where: { user_id: userId, notified: false },
    include: { badge: true },
    orderBy: { unlocked_at: 'asc' },
  });

  res.json(badges);
});

// POST /users/badges/notified — marquer des badges comme vus { badgeIds: string[] }
router.post('/badges/notified', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { badgeIds } = req.body as { badgeIds: string[] };

  if (!Array.isArray(badgeIds) || badgeIds.length === 0) {
    res.status(400).json({ error: 'badgeIds must be a non-empty array' });
    return;
  }

  await prisma.userBadge.updateMany({
    where: { user_id: userId, badge_id: { in: badgeIds } },
    data: { notified: true },
  });

  res.json({ success: true });
});

// PATCH /users/featured-badges — mettre à jour les badges vitrine (max 3) { badgeIds: string[] }
router.patch('/featured-badges', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { badgeIds } = req.body as { badgeIds: string[] };

  if (!Array.isArray(badgeIds) || badgeIds.length > 3) {
    res.status(400).json({ error: 'badgeIds must be an array of at most 3 badge IDs' });
    return;
  }

  // Vérifier que l'user possède tous les badges demandés
  const owned = await prisma.userBadge.findMany({
    where: { user_id: userId, badge_id: { in: badgeIds } },
    select: { badge_id: true },
  });

  const ownedIds = new Set(owned.map(b => b.badge_id));
  const missing = badgeIds.filter(id => !ownedIds.has(id));
  if (missing.length > 0) {
    res.status(403).json({ error: 'Badge(s) not owned', missing });
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { featured_badges: badgeIds },
  });

  res.json({ success: true });
});

export default router;
