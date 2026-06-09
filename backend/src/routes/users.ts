import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/authMiddleware';
import { addCoins } from '../services/coinService';

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
      OR: [
        { nickname: { contains: q, mode: 'insensitive' } },
        { display_name: { contains: q, mode: 'insensitive' } },
      ],
      NOT: { id: req.user!.userId }, // exclure soi-même
    },
    select: { id: true, display_name: true, nickname: true },
    orderBy: { display_name: 'asc' },
    take: 8,
  });

  res.json({ users: users.map(u => ({ id: u.id, display_name: u.nickname ?? u.display_name })) });
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

// PATCH /users/username — mettre à jour son nom d'utilisateur
router.patch('/username', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const displayName = String((req.body as { display_name?: unknown }).display_name ?? '').trim();

  if (displayName.length < 2) {
    res.status(400).json({ error: 'Nom trop court' });
    return;
  }

  if (displayName.length > 32) {
    res.status(400).json({ error: 'Nom trop long' });
    return;
  }

  // Write the chosen name to `nickname`, NOT `display_name` — display_name is
  // re-synced from Azure AD at every login and would overwrite a rename. The
  // effective name (nickname ?? display_name) is what every display surface returns.
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { nickname: displayName },
    select: { nickname: true, display_name: true },
  });

  res.json({ display_name: updated.nickname ?? updated.display_name });
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

// GET /users/me — profil complet de l'utilisateur connecté
router.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      display_name: true,
      nickname: true,
      coins: true,
      streak_days: true,
      last_login: true,
      total_score: true,
      trade_count: true,
      featured_badges: true,
      is_admin: true,
    },
  });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  const { nickname, ...rest } = user;
  res.json({ ...rest, display_name: nickname ?? rest.display_name });
});

// GET /users/all-badges — tous les badges avec statut débloqué pour l'user connecté
router.get('/all-badges', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const [allBadges, userBadges] = await Promise.all([
    prisma.badge.findMany({ orderBy: [{ category: 'asc' }, { id: 'asc' }] }),
    prisma.userBadge.findMany({
      where: { user_id: userId },
      select: { badge_id: true, unlocked_at: true, claimed: true, claimed_at: true },
    }),
  ]);
  const unlockedMap = new Map(userBadges.map(ub => [ub.badge_id, ub]));
  res.json(allBadges.map(badge => {
    const ub = unlockedMap.get(badge.id);
    return {
      ...badge,
      unlocked: !!ub,
      unlocked_at: ub?.unlocked_at ?? null,
      claimed: ub?.claimed ?? false,
      claimed_at: ub?.claimed_at ?? null,
    };
  }));
});

// POST /users/badges/:badgeId/claim — réclamer les coins d'un badge débloqué
router.post('/badges/:badgeId/claim', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const badgeId = String(req.params.badgeId);

  const coinsEarned = await prisma.$transaction(async tx => {
    const { count } = await tx.userBadge.updateMany({
      where: {
        user_id: userId,
        badge_id: badgeId,
        claimed: false,
      },
      data: {
        claimed: true,
        claimed_at: new Date(),
      },
    });

    if (count === 0) {
      throw Object.assign(new Error('Badge not found or already claimed'), { status: 409 });
    }

    const badge = await tx.badge.findUnique({ where: { id: badgeId } });
    if (!badge) {
      throw Object.assign(new Error('Badge not found'), { status: 404 });
    }

    await addCoins(tx, userId, badge.coin_reward, 'badge');
    return badge.coin_reward;
  });

  const updated = await prisma.user.findUnique({
    where: { id: userId },
    select: { coins: true },
  });

  res.json({ coins_earned: coinsEarned, total_coins: updated?.coins ?? 0 });
});

export default router;
