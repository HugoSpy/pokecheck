import { Router, Request, Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/authMiddleware';
import { recalculateUserPokedexValue } from '../services/pokedexValue';
import { addCoins, spendCoins } from '../services/coinService';
import { checkBadges } from '../services/badgeService';
import { createNotification } from '../utils/notifications';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

// Resolves a trade's from_/to_ UserPokemon and applies shiny sprite/points so
// the client can render the cards. Shared by the received (/offers) and sent
// (/sent) listings.
async function enrichTradePokemon<T extends { from_pokemon_id: string | null; to_pokemon_id: string | null }>(trade: T) {
  const fromRaw = trade.from_pokemon_id
    ? await prisma.userPokemon.findUnique({ where: { id: trade.from_pokemon_id }, include: { pokemon: true } })
    : null;
  const toRaw = trade.to_pokemon_id
    ? await prisma.userPokemon.findUnique({ where: { id: trade.to_pokemon_id }, include: { pokemon: true } })
    : null;

  const shinyEnrich = (up: typeof fromRaw) =>
    up
      ? {
          id: up.id,
          tradeable_at: up.tradeable_at,
          is_shiny: up.is_shiny,
          pokemon: {
            ...up.pokemon,
            is_shiny: up.is_shiny,
            sprite_url: up.is_shiny
              ? up.pokemon.sprite_url.replace('/normal/', '/shiny/')
              : up.pokemon.sprite_url,
            points: up.is_shiny ? up.pokemon.points * 3 : up.pokemon.points,
          },
        }
      : null;

  return { ...trade, fromPokemon: shinyEnrich(fromRaw), toPokemon: shinyEnrich(toRaw) };
}

router.get('/offers', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const offers = await prisma.trade.findMany({
    where: { to_user_id: userId, status: 'pending' },
    include: {
      from_user: { select: { id: true, display_name: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  const enriched = await Promise.all(offers.map(enrichTradePokemon));
  res.json(enriched);
});

// Pending trades the current user has proposed (so they can cancel them).
router.get('/sent', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const sent = await prisma.trade.findMany({
    where: { from_user_id: userId, status: 'pending' },
    include: {
      to_user: { select: { id: true, display_name: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  const enriched = await Promise.all(sent.map(enrichTradePokemon));
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

  // Prevent self-trades: a user trading with themselves increments trade_count for
  // both sides of the same row (two UPDATE calls on the same user inside a single
  // transaction), resulting in +2 per self-trade and easy badge farming.
  if (to_user_id === userId) {
    res.status(400).json({ error: 'Cannot trade with yourself' });
    return;
  }

  // Coin component validation. Both must be non-negative integers, and coins may
  // only flow ONE way: offering AND requesting coins at once is nonsensical
  // (and a pure pokemon↔coins swap is the market's job, but that's already
  // prevented since both from_/to_pokemon are required for a normal trade).
  if (!Number.isInteger(coins_offered) || !Number.isInteger(coins_requested) || coins_offered < 0 || coins_requested < 0) {
    res.status(400).json({ error: 'Coin amounts must be non-negative integers' });
    return;
  }
  if (coins_offered > 0 && coins_requested > 0) {
    res.status(400).json({ error: 'Cannot both offer and request coins' });
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

  const myActiveListing = await prisma.marketListing.findFirst({
    where: { pokemon_id: from_pokemon_id, status: 'active' },
  });
  if (myActiveListing) {
    res.status(409).json({ error: 'Pokémon is listed on the market' });
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

  // A UserPokemon may only be tied to ONE pending trade at a time, on either
  // side. The conflict check and the create run in one Serializable transaction
  // so two simultaneous proposals can't both slip a pokemon into two pending
  // trades (TOCTOU).
  const pokemonIds = [from_pokemon_id, ...(to_pokemon_id ? [to_pokemon_id] : [])];

  let trade;
  try {
    trade = await prisma.$transaction(async (tx) => {
      const conflict = await tx.trade.findFirst({
        where: {
          status: 'pending',
          OR: [
            { from_pokemon_id: { in: pokemonIds } },
            { to_pokemon_id: { in: pokemonIds } },
          ],
        },
      });
      if (conflict) {
        throw Object.assign(new Error('POKEMON_ALREADY_IN_TRADE'), { status: 409 });
      }

      return tx.trade.create({
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
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (err) {
    if ((err as { status?: number }).status === 409) {
      res.status(409).json({ error: 'POKEMON_ALREADY_IN_TRADE' });
      return;
    }
    throw err;
  }

  res.status(201).json(trade);

  // Fire-and-forget: notify recipient that a trade was proposed
  const fromUserId = userId;
  const fromDisplayName = req.user!.display_name;
  const fromPokemonId = myPokemon.pokemon_id;
  Promise.all([
    prisma.pokemon.findUnique({ where: { id: fromPokemonId }, select: { name: true } }),
    to_pokemon_id
      ? prisma.userPokemon.findUnique({ where: { id: to_pokemon_id }, include: { pokemon: true } })
      : Promise.resolve(null),
  ]).then(([fromPkm, toPkmRaw]) =>
    createNotification(to_user_id, 'TRADE_RECEIVED', {
      tradeId: trade.id,
      fromUserId,
      fromUserName: fromDisplayName,
      fromPokemonName: fromPkm?.name ?? '?',
      toPokemonName: toPkmRaw?.pokemon?.name ?? null,
    })
  ).catch(() => {});
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

  // Race-condition guard: the outer findUnique check (status === 'pending') runs
  // outside the transaction. Two simultaneous accepts can both pass that check.
  // The updateMany at the start of the transaction is a compare-and-swap: only one
  // concurrent transaction will match status='pending'; the second will get count=0
  // after PostgreSQL re-evaluates the WHERE against the first's committed state.
  let raceDetected = false;
  let ownershipInvalid = false;

  const { fromUser, toUser } = await prisma.$transaction(async tx => {
    const { count } = await tx.trade.updateMany({
      where: { id, status: 'pending' },
      data: { status: 'accepted', resolved_at: new Date() },
    });

    if (count === 0) {
      raceDetected = true;
      return { fromUser: null, toUser: null };
    }

    // Ownership re-verification: a stale duplicate proposal can reference a Pokémon
    // whose owner changed via another accepted trade since this one was created.
    // The by-id transfers below would otherwise silently steal it from its current
    // owner — so cancel this trade instead of transferring.
    const fromPokemon = await tx.userPokemon.findUnique({ where: { id: trade.from_pokemon_id } });
    if (!fromPokemon || fromPokemon.user_id !== trade.from_user_id) {
      await tx.trade.update({ where: { id }, data: { status: 'cancelled', resolved_at: new Date() } });
      ownershipInvalid = true;
      return { fromUser: null, toUser: null };
    }
    if (trade.to_pokemon_id) {
      const toPokemon = await tx.userPokemon.findUnique({ where: { id: trade.to_pokemon_id } });
      if (!toPokemon || toPokemon.user_id !== trade.to_user_id) {
        await tx.trade.update({ where: { id }, data: { status: 'cancelled', resolved_at: new Date() } });
        ownershipInvalid = true;
        return { fromUser: null, toUser: null };
      }
    }

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

    // Invalidate sibling pending trades referencing either Pokémon just exchanged,
    // so the same Pokémon can't be offered to (and accepted by) several people.
    const exchangedPokemonIds = [trade.from_pokemon_id];
    if (trade.to_pokemon_id) exchangedPokemonIds.push(trade.to_pokemon_id);
    await tx.trade.updateMany({
      where: {
        id: { not: id },
        status: 'pending',
        OR: [
          { from_pokemon_id: { in: exchangedPokemonIds } },
          { to_pokemon_id: { in: exchangedPokemonIds } },
        ],
      },
      data: { status: 'cancelled', resolved_at: new Date() },
    });

    // Transfer coins
    if (trade.coins_offered > 0) {
      await spendCoins(tx, trade.from_user_id, trade.coins_offered, 'trade');
      await addCoins(tx, trade.to_user_id, trade.coins_offered, 'trade');
    }
    if (trade.coins_requested > 0) {
      await spendCoins(tx, trade.to_user_id, trade.coins_requested, 'trade');
      await addCoins(tx, trade.from_user_id, trade.coins_requested, 'trade');
    }

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

  if (raceDetected) {
    res.status(409).json({ error: 'Trade already resolved' });
    return;
  }

  if (ownershipInvalid) {
    res.status(409).json({ error: 'POKEMON_NO_LONGER_OWNED' });
    return;
  }

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

  // Fire-and-forget: notify proposer that their trade was accepted
  const accepterName = req.user!.display_name;
  const fromPokemonId2 = trade.from_pokemon_id;
  const toPokemonId2 = trade.to_pokemon_id;
  const fromUserId2 = trade.from_user_id;
  Promise.all([
    prisma.userPokemon.findUnique({ where: { id: fromPokemonId2 }, include: { pokemon: true } }),
    toPokemonId2
      ? prisma.userPokemon.findUnique({ where: { id: toPokemonId2 }, include: { pokemon: true } })
      : Promise.resolve(null),
  ]).then(([fromUpkm, toUpkm]) => {
    const shinySprite = (up: typeof fromUpkm) =>
      up ? (up.is_shiny ? up.pokemon.sprite_url.replace('/normal/', '/shiny/') : up.pokemon.sprite_url) : '';
    return createNotification(fromUserId2, 'TRADE_ACCEPTED', {
      tradeId: trade.id,
      accepterName,
      givenPokemonName: fromUpkm?.pokemon.name ?? '?',
      givenPokemonSprite: shinySprite(fromUpkm),
      givenPokemonIsShiny: fromUpkm?.is_shiny ?? false,
      receivedPokemonName: toUpkm?.pokemon.name ?? null,
      receivedPokemonSprite: toUpkm ? shinySprite(toUpkm) : null,
      receivedPokemonIsShiny: toUpkm?.is_shiny ?? false,
    });
  }).catch(() => {});
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

// Proposer-side cancellation of a still-pending trade. Keeps the row (status
// 'cancelled') for history rather than deleting it.
router.post('/cancel/:id', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const id = String(req.params.id);

  const trade = await prisma.trade.findUnique({ where: { id } });
  if (!trade) {
    res.status(404).json({ error: 'Trade not found' });
    return;
  }
  if (trade.from_user_id !== userId) {
    res.status(403).json({ error: 'Only the proposer can cancel this trade' });
    return;
  }
  if (trade.status !== 'pending') {
    res.status(404).json({ error: 'Trade already resolved' });
    return;
  }

  await prisma.trade.update({
    where: { id },
    data: { status: 'cancelled', resolved_at: new Date() },
  });

  res.json({ ok: true });
});

export default router;
