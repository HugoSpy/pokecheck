import { Router, Request, Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../middleware/authMiddleware';
import { getSellPrice, addCoins } from '../services/coinService';
import { recalculateUserPokedexValue } from '../services/pokedexValue';
import { checkBadges } from '../services/badgeService';

const router = Router();
const prisma = new PrismaClient();

// 5 sells/s per user — keyed by JWT user id, not IP, because students share a
// Cloudflare egress IP. Selling is a routine, legitimate action, so the limiter
// is generous (raised from 1/s) and exists only to blunt runaway scripts.
const sellLimiter = rateLimit({
  windowMs: 1_000,
  max: 5,
  keyGenerator: (req) => req.user?.userId ?? req.ip ?? 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

// Bulk sell is light-rate-limited per user (each call already sells up to 50).
const bulkSellLimiter = rateLimit({
  windowMs: 1_000,
  max: 3,
  keyGenerator: (req) => req.user?.userId ?? req.ip ?? 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

const MAX_BULK_SELL = 50;

// POST /sell/bulk — sell up to 50 owned Pokémon in one Serializable transaction.
// Declared BEFORE '/:userPokemonId' so Express doesn't treat "bulk" as an id.
// total_score is recomputed from scratch afterwards (recalculateUserPokedexValue
// is the source of truth), so a duplicate with a surviving copy keeps its points
// and only a last-copy sale lowers the score.
router.post('/bulk', authMiddleware, bulkSellLimiter, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { ids } = req.body as { ids?: unknown };

  if (!Array.isArray(ids) || ids.length === 0 || !ids.every(id => typeof id === 'string')) {
    res.status(400).json({ error: 'ids must be a non-empty array of strings' });
    return;
  }
  const uniqueIds = [...new Set(ids as string[])];
  if (uniqueIds.length > MAX_BULK_SELL) {
    res.status(400).json({ error: `Cannot sell more than ${MAX_BULK_SELL} Pokémon at once` });
    return;
  }

  let result: { sold: number; coinsEarned: number };
  try {
    result = await prisma.$transaction(async tx => {
      const owned = await tx.userPokemon.findMany({
        where: { id: { in: uniqueIds }, user_id: userId },
        include: { pokemon: true },
      });

      // Every id must resolve to a Pokémon the caller currently owns.
      if (owned.length !== uniqueIds.length) {
        throw Object.assign(new Error('One or more Pokémon are not yours or no longer exist'), { status: 403 });
      }

      // Refuse the whole batch if any selected Pokémon is locked in a pending trade.
      const lockedTrade = await tx.trade.findFirst({
        where: {
          status: 'pending',
          OR: [
            { from_pokemon_id: { in: uniqueIds } },
            { to_pokemon_id: { in: uniqueIds } },
          ],
        },
      });
      if (lockedTrade) {
        throw Object.assign(new Error('One or more Pokémon are in a pending trade offer'), { status: 409 });
      }

      const coinsEarned = owned.reduce((sum, up) => sum + getSellPrice(up), 0);

      // Auto-cancel any active market listings for these Pokémon, then delete.
      await tx.marketListing.updateMany({
        where: { pokemon_id: { in: uniqueIds }, status: 'active' },
        data: { status: 'cancelled' },
      });
      await tx.userPokemon.deleteMany({ where: { id: { in: uniqueIds }, user_id: userId } });
      await addCoins(tx, userId, coinsEarned, 'sell');
      await recalculateUserPokedexValue(tx, userId);

      return { sold: owned.length, coinsEarned };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (err) {
    const e = err as { status?: number; code?: string; message?: string };
    if (e.status === 403) { res.status(403).json({ error: e.message }); return; }
    if (e.status === 409) { res.status(409).json({ error: e.message }); return; }
    // P2034 = serialization failure from a concurrent write — caller can retry.
    if (e.code === 'P2034') { res.status(429).json({ error: 'Too many requests, please slow down.' }); return; }
    throw err;
  }

  const newBadges = await checkBadges(userId);
  res.json({ sold: result.sold, coins_earned: result.coinsEarned, new_badges: newBadges });
});

router.post('/:userPokemonId', authMiddleware, sellLimiter, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const userPokemonId = String(req.params.userPokemonId);

  const userPokemon = await prisma.userPokemon.findUnique({
    where: { id: userPokemonId },
    include: { pokemon: true },
  });

  if (!userPokemon) {
    res.status(404).json({ error: 'UserPokemon not found' });
    return;
  }

  if (userPokemon.user_id !== userId) {
    res.status(403).json({ error: 'This Pokémon does not belong to you' });
    return;
  }

  // Check no pending trade references this pokemon
  const pendingTrade = await prisma.trade.findFirst({
    where: {
      status: 'pending',
      OR: [
        { from_pokemon_id: userPokemonId },
        { to_pokemon_id: userPokemonId },
      ],
    },
  });
  if (pendingTrade) {
    res.status(409).json({ error: 'Pokémon is in a pending trade offer' });
    return;
  }

  const sellPrice = getSellPrice(userPokemon);

  await prisma.$transaction(async tx => {
    // Auto-cancel any active market listing so the user can sell directly
    await tx.marketListing.updateMany({
      where: { pokemon_id: userPokemonId, status: 'active' },
      data: { status: 'cancelled' },
    });
    await tx.userPokemon.delete({ where: { id: userPokemonId } });
    await addCoins(tx, userId, sellPrice, 'sell');
    await recalculateUserPokedexValue(tx, userId);
  });

  const newBadges = await checkBadges(userId);

  res.json({ coins_earned: sellPrice, sell_price: sellPrice, new_badges: newBadges });
});

export default router;
