import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/authMiddleware';
import { getSellPrice, addCoins } from '../services/coinService';
import { recalculateUserPokedexValue } from '../services/pokedexValue';
import { checkBadges } from '../services/badgeService';

const router = Router();
const prisma = new PrismaClient();

router.post('/:userPokemonId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
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

  // Check no active market listing references this pokemon
  const activeListing = await prisma.marketListing.findFirst({
    where: { pokemon_id: userPokemonId, status: 'active' },
  });
  if (activeListing) {
    res.status(409).json({ error: 'Pokémon is listed on the market' });
    return;
  }

  const sellPrice = getSellPrice(userPokemon);

  await prisma.$transaction(async tx => {
    await tx.userPokemon.delete({ where: { id: userPokemonId } });
    await addCoins(tx, userId, sellPrice, 'sell');
    await recalculateUserPokedexValue(tx, userId);
  });

  const newBadges = await checkBadges(userId);

  res.json({ coins_earned: sellPrice, sell_price: sellPrice, new_badges: newBadges });
});

export default router;
