import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../middleware/authMiddleware';
import { getSellPrice, addCoins } from '../services/coinService';
import { recalculateUserPokedexValue } from '../services/pokedexValue';
import { checkBadges } from '../services/badgeService';

const router = Router();
const prisma = new PrismaClient();

// 1 sell/s per user — keyed by JWT user id, not IP, because students share a
// Cloudflare egress IP. Placed after authMiddleware so req.user is populated.
const sellLimiter = rateLimit({
  windowMs: 1_000,
  max: 1,
  keyGenerator: (req) => req.user?.userId ?? req.ip ?? 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
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
