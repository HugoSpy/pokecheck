import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { adminMiddleware } from '../middleware/adminMiddleware';
import { recalculateUserPokedexValue } from '../services/pokedexValue';
import { createNotification, createNotificationForAllUsers } from '../utils/notifications';

const router = Router();
const prisma = new PrismaClient();

const ATTENDANCE_TTL_MS = 15 * 60 * 1000;

router.use(adminMiddleware);

/** Decrement coins for a rollback, allowing the balance to go negative. */
async function removeCoinsAllowNegative(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: number,
  reason: string
): Promise<void> {
  await tx.user.update({
    where: { id: userId },
    data: { coins: { decrement: amount } },
  });
  await tx.coinTransaction.create({
    data: { user_id: userId, amount: -amount, reason },
  });
}

const SHORT_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function generateShortCode(length = 10): string {
  let code = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += SHORT_CODE_CHARS[bytes[i] % SHORT_CODE_CHARS.length];
  }
  return code;
}

router.post('/generate-pack', async (req: Request, res: Response): Promise<void> => {
  // HIDDEN FEATURE
  const { force_shiny = false, force_ditto = false } = req.body as { force_shiny?: boolean; force_ditto?: boolean };
  // END HIDDEN FEATURE
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  let shortCode!: string;
  let attempts = 0;
  do {
    shortCode = generateShortCode();
    const existing = await prisma.oneshotToken.findUnique({ where: { short_code: shortCode } });
    if (!existing) break;
  } while (++attempts < 5);

  const tokenHash = crypto.createHash('sha256').update(shortCode).digest('hex');
  await prisma.oneshotToken.create({
    data: {
      user_id: req.user!.userId,
      token_hash: tokenHash,
      short_code: shortCode,
      expires_at: expiresAt,
      force_shiny,
      force_ditto, // HIDDEN FEATURE
    },
  });

  res.json({ code: shortCode });
});

// ── Attendance check system (temporary, admin-driven) ────────────────────────

// POST /admin/attendance/start
router.post('/attendance/start', async (req: Request, res: Response): Promise<void> => {
  const force = (req.body as { force?: boolean }).force === true;
  const now = new Date();

  if (!force) {
    const active = await prisma.attendanceCheck.findFirst({
      where: { cancelled_at: null, expires_at: { gt: now } },
    });
    if (active) {
      res.status(409).json({ error: 'Un check présence est déjà actif', active_id: active.id });
      return;
    }
  }

  const check = await prisma.attendanceCheck.create({
    data: {
      created_by: req.user!.userId,
      expires_at: new Date(now.getTime() + ATTENDANCE_TTL_MS),
    },
  });

  res.json({ id: check.id, expires_at: check.expires_at });

  // Fire-and-forget: notify all users that attendance is open
  createNotificationForAllUsers('ATTENDANCE', {
    message: 'Check présence lancé — va tirer ton Pokémon !',
    checkId: check.id,
  }).catch(() => {});
});

// GET /admin/attendance/active — checks from the last 24h (active, expired, cancelled)
router.get('/attendance/active', async (_req: Request, res: Response): Promise<void> => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [totalUsers, checks] = await Promise.all([
    prisma.user.count(),
    prisma.attendanceCheck.findMany({
      where: { created_at: { gte: since } },
      orderBy: { created_at: 'desc' },
      include: { _count: { select: { openings: true } } },
    }),
  ]);

  res.json({
    checks: checks.map(c => ({
      id: c.id,
      created_at: c.created_at,
      expires_at: c.expires_at,
      cancelled_at: c.cancelled_at,
      openings_count: c._count.openings,
      total_users: totalUsers,
    })),
  });
});

// POST /admin/attendance/:id/cancel — cancel + full rollback
router.post('/attendance/:id/cancel', async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const adminId = req.user!.userId;

  const check = await prisma.attendanceCheck.findUnique({ where: { id } });
  if (!check) {
    res.status(404).json({ error: 'Check présence introuvable' });
    return;
  }
  if (check.cancelled_at) {
    res.status(409).json({ error: 'Ce check présence est déjà annulé' });
    return;
  }

  const result = await prisma.$transaction(async tx => {
    await tx.attendanceCheck.update({
      where: { id },
      data: { cancelled_at: new Date(), cancelled_by: adminId },
    });

    const openings = await tx.attendanceOpening.findMany({
      where: { attendance_id: id, rolled_back: false, user_pokemon_id: { not: null } },
    });

    const impactedUsers = new Set<string>();
    // Per-user cache of un-consumed sell transactions since the check started,
    // to claw back coins for Pokémons that were sold (UserPokemon deleted).
    const sellTxCache = new Map<string, { id: string; amount: number }[]>();
    const consumedSellTxIds = new Set<string>();
    let coinsRemoved = 0;
    let rolledBackCount = 0;

    for (const opening of openings) {
      const upId = opening.user_pokemon_id!;
      const userPokemon = await tx.userPokemon.findUnique({ where: { id: upId } });

      if (userPokemon) {
        // Still exists (held, listed, in a pending trade, or owned by someone
        // after a trade/market buy). Unwind references, then delete.
        await tx.trade.updateMany({
          where: {
            status: 'pending',
            OR: [{ from_pokemon_id: upId }, { to_pokemon_id: upId }],
          },
          data: { status: 'cancelled', resolved_at: new Date() },
        });
        await tx.marketListing.updateMany({
          where: { pokemon_id: upId, status: 'active' },
          data: { status: 'cancelled' },
        });
        impactedUsers.add(userPokemon.user_id);
        await tx.userPokemon.delete({ where: { id: upId } });
      } else {
        // Gone → it was sold. Claw back the matching sell transaction (best
        // effort: no FK links a sale to a Pokémon). Balance may go negative.
        let txs = sellTxCache.get(opening.user_id);
        if (!txs) {
          const sells = await tx.coinTransaction.findMany({
            where: {
              user_id: opening.user_id,
              reason: 'sell',
              created_at: { gte: check.created_at },
            },
            orderBy: { created_at: 'asc' },
          });
          txs = sells.map(s => ({ id: s.id, amount: s.amount }));
          sellTxCache.set(opening.user_id, txs);
        }
        const match = txs.find(t => !consumedSellTxIds.has(t.id));
        if (match) {
          consumedSellTxIds.add(match.id);
          await removeCoinsAllowNegative(tx, opening.user_id, match.amount, 'attendance_rollback');
          coinsRemoved += match.amount;
          impactedUsers.add(opening.user_id);
        }
        // else: coins untraceable (already spent / no record) → accept loss.
      }

      await tx.attendanceOpening.update({
        where: { id: opening.id },
        data: { rolled_back: true, user_pokemon_id: null },
      });
      rolledBackCount++;
    }

    for (const uid of impactedUsers) {
      await recalculateUserPokedexValue(tx, uid);
    }

    return { rolled_back_count: rolledBackCount, coins_removed: coinsRemoved };
  }, { timeout: 30000, maxWait: 10000 });

  res.json(result);
});

// GET /admin/users — dropdown list for messaging
router.get('/users', async (_req: Request, res: Response): Promise<void> => {
  const users = await prisma.user.findMany({
    select: { id: true, display_name: true, nickname: true },
    orderBy: { display_name: 'asc' },
  });
  res.json({ users: users.map(u => ({ id: u.id, display_name: u.nickname ?? u.display_name })) });
});

// POST /admin/message/all — broadcast to every user
router.post('/message/all', async (req: Request, res: Response): Promise<void> => {
  const { content } = req.body as { content?: string };
  if (!content?.trim()) {
    res.status(400).json({ error: 'content is required' });
    return;
  }
  await createNotificationForAllUsers('ADMIN_MESSAGE', { content: content.trim(), fromAdmin: true });
  const count = await prisma.user.count();
  res.json({ sent: count });
});

// POST /admin/message/user — message to a specific user
router.post('/message/user', async (req: Request, res: Response): Promise<void> => {
  const { userId, content } = req.body as { userId?: string; content?: string };
  if (!userId || !content?.trim()) {
    res.status(400).json({ error: 'userId and content are required' });
    return;
  }
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!target) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  await createNotification(userId, 'ADMIN_MESSAGE', { content: content.trim(), fromAdmin: true });
  res.json({ ok: true });
});

export default router;
