import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/authMiddleware';
import { recalculateUserPokedexValue } from '../services/pokedexValue';
import { addCoins, spendCoins } from '../services/coinService';
import { checkBadges } from '../services/badgeService';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

router.get('/offers', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const offers = await prisma.trade.findMany({
    where: { to_user_id: userId, status: 'pending' },
    include: {
      from_user: { select: { id: true, display_name: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  const enriched = await Promise.all(
    offers.map(async trade => {
      const fromPokemon = trade.from_pokemon_id
        ? await prisma.userPokemon.findUnique({
            where: { id: trade.from_pokemon_id },
            include: { pokemon: true },
          })
        : null;
      const toPokemon = trade.to_pokemon_id
        ? await prisma.userPokemon.findUnique({
            where: { id: trade.to_pokemon_id },
            include: { pokemon: true },
          })
        : null;
      return { ...trade, fromPokemon, toPokemon };
    })
  );

  res.json(enriched);
});

router.post('/propose', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const {
    from_pokemon_id,
    to_user_id,
    to_pokemon_id,
    coins_offered = 0,
    coins_requested = 0,
  } = req.body as {
    from_pokemon_id: string;
    to_user_id: string;
    to_pokemon_id?: string;
    coins_offered?: number;
    coins_requested?: number;
  };

  if (!from_pokemon_id || !to_user_id) {
    res.status(400).json({ error: 'from_pokemon_id and to_user_id are required' });
    return;
  }

  const myPokemon = await prisma.userPokemon.findUnique({ where: { id: from_pokemon_id } });
  if (!myPokemon || myPokemon.user_id !== userId) {
    res.status(403).json({ error: 'Pokémon not owned by you' });
    return;
  }

  if (myPokemon.tradeable_at && myPokemon.tradeable_at > new Date()) {
    res.status(400).json({ error: 'Pokémon not tradeable yet', tradeable_at: myPokemon.tradeable_at });
    return;
  }

  if (to_pokemon_id) {
    const theirPokemon = await prisma.userPokemon.findUnique({ where: { id: to_pokemon_id } });
    if (!theirPokemon || theirPokemon.user_id !== to_user_id) {
      res.status(400).json({ error: 'Target Pokémon not valid' });
      return;
    }
  }

  if (coins_offered > 0) {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { coins: true } });
    if (!me || me.coins < coins_offered) {
      res.status(402).json({ error: 'Insufficient coins to offer' });
      return;
    }
  }

  const trade = await prisma.trade.create({
    data: {
      from_user_id: userId,
      to_user_id,
      from_pokemon_id,
      to_pokemon_id: to_pokemon_id ?? null,
      coins_offered,
      coins_requested,
      status: 'pending',
    },
  });

  res.status(201).json(trade);
});

router.post('/accept/:id', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const id = String(req.params.id);

  const trade = await prisma.trade.findUnique({ where: { id } });
  if (!trade || trade.to_user_id !== userId || trade.status !== 'pending') {
    res.status(404).json({ error: 'Trade not found or already resolved' });
    return;
  }

  // Pre-flight coin checks
  if (trade.coins_offered > 0) {
    const fromUser = await prisma.user.findUnique({
      where: { id: trade.from_user_id },
      select: { coins: true },
    });
    if (!fromUser || fromUser.coins < trade.coins_offered) {
      res.status(402).json({ error: 'Offerer no longer has enough coins' });
      return;
    }
  }
  if (trade.coins_requested > 0) {
    const toUser = await prisma.user.findUnique({
      where: { id: trade.to_user_id },
      select: { coins: true },
    });
    if (!toUser || toUser.coins < trade.coins_requested) {
      res.status(402).json({ error: 'Insufficient coins to accept this trade' });
      return;
    }
  }

  const tradeableAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pokemonExchanged = !!trade.to_pokemon_id;

  const { fromUser, toUser } = await prisma.$transaction(async tx => {
    // Transfer Pokémon
    await tx.userPokemon.update({
      where: { id: trade.from_pokemon_id },
      data: { user_id: trade.to_user_id, tradeable_at: tradeableAt },
    });

    if (trade.to_pokemon_id) {
      await tx.userPokemon.update({
        where: { id: trade.to_pokemon_id },
        data: { user_id: trade.from_user_id, tradeable_at: tradeableAt },
      });
    }

    // Transfer coins
    if (trade.coins_offered > 0) {
      await spendCoins(tx, trade.from_user_id, trade.coins_offered, 'trade');
      await addCoins(tx, trade.to_user_id, trade.coins_offered, 'trade');
    }
    if (trade.coins_requested > 0) {
      await spendCoins(tx, trade.to_user_id, trade.coins_requested, 'trade');
      await addCoins(tx, trade.from_user_id, trade.coins_requested, 'trade');
    }

    await tx.trade.update({
      where: { id },
      data: { status: 'accepted', resolved_at: new Date() },
    });

    // Increment trade_count only when at least one pokemon is exchanged
    let fromUserResult = null;
    let toUserResult = null;

    if (pokemonExchanged) {
      fromUserResult = await tx.user.update({
        where: { id: trade.from_user_id },
        data: { trade_count: { increment: 1 } },
      });
      toUserResult = await tx.user.update({
        where: { id: trade.to_user_id },
        data: { trade_count: { increment: 1 } },
      });
    }

    await recalculateUserPokedexValue(tx, trade.from_user_id);
    await recalculateUserPokedexValue(tx, trade.to_user_id);

    return { fromUser: fromUserResult, toUser: toUserResult };
  });

  const [fromBadges, toBadges] = await Promise.all([
    checkBadges(trade.from_user_id),
    checkBadges(trade.to_user_id),
  ]);

  const bonusDraws: string[] = [];
  if (pokemonExchanged) {
    if (fromUser && fromUser.trade_count % 10 === 0) bonusDraws.push(trade.from_user_id);
    if (toUser && toUser.trade_count % 10 === 0) bonusDraws.push(trade.to_user_id);
  }

  res.json({ success: true, bonusDraws, new_badges: { from: fromBadges, to: toBadges } });
});

router.post('/decline/:id', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const id = String(req.params.id);

  const trade = await prisma.trade.findUnique({ where: { id } });
  if (!trade || trade.to_user_id !== userId || trade.status !== 'pending') {
    res.status(404).json({ error: 'Trade not found or already resolved' });
    return;
  }

  await prisma.trade.update({
    where: { id },
    data: { status: 'declined', resolved_at: new Date() },
  });

  res.json({ success: true });
});

export default router;
