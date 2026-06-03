import { Router, Request, Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/authMiddleware';
import { drawAndCreate } from '../services/drawService';
import { claimDailyLogin } from '../services/streakService';
import { checkBadges } from '../services/badgeService';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

// ── GET /attendance/available ────────────────────────────────────────────────
// Is there an active check the user has NOT yet opened?
router.get('/available', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const now = new Date();

  res.set('Cache-Control', 'no-store');

  const activeChecks = await prisma.attendanceCheck.findMany({
    where: { cancelled_at: null, expires_at: { gt: now } },
    orderBy: { created_at: 'desc' },
  });

  for (const check of activeChecks) {
    const opening = await prisma.attendanceOpening.findUnique({
      where: { attendance_id_user_id: { attendance_id: check.id, user_id: userId } },
    });
    if (!opening) {
      res.json({
        available: true,
        reason: 'available',
        attendance_id: check.id,
        expires_at: check.expires_at,
      });
      return;
    }
  }

  if (activeChecks.length > 0) {
    const latest = activeChecks[0];
    res.json({
      available: false,
      reason: 'already_opened',
      attendance_id: latest.id,
      expires_at: latest.expires_at,
    });
    return;
  }

  const latestCheck = await prisma.attendanceCheck.findFirst({
    where: { cancelled_at: null },
    orderBy: { created_at: 'desc' },
  });

  if (latestCheck && latestCheck.expires_at <= now) {
    res.json({
      available: false,
      reason: 'expired',
      attendance_id: latestCheck.id,
      expires_at: latestCheck.expires_at,
    });
    return;
  }

  res.json({ available: false, reason: 'no_active_check' });
});

// ── POST /attendance/open ─────────────────────────────────────────────────────
router.post('/open', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { attendance_id } = req.body as { attendance_id?: string };

  if (!attendance_id) {
    res.status(400).json({ error: 'attendance_id is required' });
    return;
  }

  const check = await prisma.attendanceCheck.findUnique({ where: { id: attendance_id } });
  if (!check) {
    res.status(404).json({ error: 'Check présence introuvable' });
    return;
  }
  if (check.cancelled_at) {
    res.status(403).json({ error: 'Ce check présence a été annulé' });
    return;
  }
  if (check.expires_at < new Date()) {
    res.status(403).json({ error: 'Ce check présence a expiré' });
    return;
  }

  const existing = await prisma.attendanceOpening.findUnique({
    where: { attendance_id_user_id: { attendance_id, user_id: userId } },
  });
  if (existing) {
    res.status(403).json({ error: 'Tu as déjà ouvert ton pack pour ce check présence' });
    return;
  }

  let drawn;
  try {
    drawn = await prisma.$transaction(async tx => {
      const result = await drawAndCreate(tx, userId, { source: 'attendance' });
      await tx.attendanceOpening.create({
        data: {
          attendance_id,
          user_id: userId,
          user_pokemon_id: result.userPokemonId,
        },
      });
      return result;
    });
  } catch (e) {
    // Unique constraint → user already opened (race condition)
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      res.status(403).json({ error: 'Tu as déjà ouvert ton pack pour ce check présence' });
      return;
    }
    throw e;
  }

  // Fire-and-forget streak claim (same as the one-shot flow); non-fatal
  claimDailyLogin(userId).catch(() => {});
  await checkBadges(userId);

  res.json({ pokemon: drawn.pokemon });
});

export default router;
