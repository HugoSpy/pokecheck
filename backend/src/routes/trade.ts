import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/authMiddleware';

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
      const fromPokemon = await prisma.userPokemon.findUnique({
        where: { id: trade.from_pokemon_id },
        include: { pokemon: true },
      });
      const toPokemon = await prisma.userPokemon.findUnique({
        where: { id: trade.to_pokemon_id },
        include: { pokemon: true },
      });
      return { ...trade, fromPokemon, toPokemon };
    })
  );

  res.json(enriched);
});

router.post('/propose', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { from_pokemon_id, to_user_id, to_pokemon_id } = req.body as {
    from_pokemon_id: string;
    to_user_id: string;
    to_pokemon_id: string;
  };

  const myPokemon = await prisma.userPokemon.findUnique({ where: { id: from_pokemon_id } });
  if (!myPokemon || myPokemon.user_id !== userId) {
    res.status(403).json({ error: 'Pokémon not owned by you' });
    return;
  }

  if (myPokemon.tradeable_at && myPokemon.tradeable_at > new Date()) {
    res.status(400).json({ error: 'Pokémon not tradeable yet', tradeable_at: myPokemon.tradeable_at });
    return;
  }

  const theirPokemon = await prisma.userPokemon.findUnique({ where: { id: to_pokemon_id } });
  if (!theirPokemon || theirPokemon.user_id !== to_user_id) {
    res.status(400).json({ error: 'Target Pokémon not valid' });
    return;
  }

  const trade = await prisma.trade.create({
    data: {
      from_user_id: userId,
      to_user_id,
      from_pokemon_id,
      to_pokemon_id,
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

  const tradeableAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.userPokemon.update({
      where: { id: trade.from_pokemon_id },
      data: { user_id: trade.to_user_id, tradeable_at: tradeableAt },
    }),
    prisma.userPokemon.update({
      where: { id: trade.to_pokemon_id },
      data: { user_id: trade.from_user_id, tradeable_at: tradeableAt },
    }),
    prisma.trade.update({
      where: { id },
      data: { status: 'accepted', resolved_at: new Date() },
    }),
    prisma.user.update({
      where: { id: trade.from_user_id },
      data: { trade_count: { increment: 1 } },
    }),
    prisma.user.update({
      where: { id: trade.to_user_id },
      data: { trade_count: { increment: 1 } },
    }),
  ]);

  const [fromUser, toUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: trade.from_user_id } }),
    prisma.user.findUnique({ where: { id: trade.to_user_id } }),
  ]);

  const bonusDraws: string[] = [];
  if (fromUser && fromUser.trade_count % 10 === 0) bonusDraws.push(trade.from_user_id);
  if (toUser && toUser.trade_count % 10 === 0) bonusDraws.push(trade.to_user_id);

  res.json({ success: true, bonusDraws });
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
