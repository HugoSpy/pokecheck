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

const MAX_PER_SIDE = 6;

// ── Enrichment ────────────────────────────────────────────────────────────────

type TradeUserRef = { id: string; display_name: string; nickname?: string | null };

// A UserPokemon row joined with its species, with shiny sprite/points applied.
function shinyEnrich(up: {
  id: string;
  tradeable_at: Date | null;
  is_shiny: boolean;
  pokemon: { sprite_url: string; points: number } & Record<string, unknown>;
} | null) {
  if (!up) return null;
  return {
    id: up.id,
    tradeable_at: up.tradeable_at,
    is_shiny: up.is_shiny,
    pokemon: {
      ...up.pokemon,
      is_shiny: up.is_shiny,
      sprite_url: up.is_shiny ? up.pokemon.sprite_url.replace('/normal/', '/shiny/') : up.pokemon.sprite_url,
      points: up.is_shiny ? up.pokemon.points * 3 : up.pokemon.points,
    },
  };
}

// Loads every TradeItem for a trade, grouped + enriched. Returns the full `items`
// array plus legacy `fromPokemon`/`toPokemon` (the first item of each side) so the
// current single-Pokémon frontend keeps rendering during the transition.
async function buildItems(tradeId: string) {
  const rows = await prisma.tradeItem.findMany({
    where: { trade_id: tradeId },
    include: { pokemon: { include: { pokemon: true } } },
    orderBy: { id: 'asc' },
  });

  const items = rows.map(r => ({ owner: r.owner, ...shinyEnrich(r.pokemon)! }));
  const fromItems = items.filter(i => i.owner === 'from');
  const toItems = items.filter(i => i.owner === 'to');
  return {
    items,
    fromPokemon: fromItems[0] ?? null,
    toPokemon: toItems[0] ?? null,
  };
}

async function enrichTrade<T extends { id: string; from_user?: TradeUserRef; to_user?: TradeUserRef }>(trade: T) {
  const { items, fromPokemon, toPokemon } = await buildItems(trade.id);
  const effectiveName = (u: TradeUserRef) => ({ id: u.id, display_name: u.nickname ?? u.display_name });
  return {
    ...trade,
    ...(trade.from_user ? { from_user: effectiveName(trade.from_user) } : {}),
    ...(trade.to_user ? { to_user: effectiveName(trade.to_user) } : {}),
    items,
    fromPokemon,
    toPokemon,
  };
}

// ── Listings ──────────────────────────────────────────────────────────────────

router.get('/offers', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const offers = await prisma.trade.findMany({
    where: { to_user_id: userId, status: 'pending' },
    include: { from_user: { select: { id: true, display_name: true, nickname: true } } },
    orderBy: { created_at: 'desc' },
  });
  res.json(await Promise.all(offers.map(enrichTrade)));
});

router.get('/sent', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const sent = await prisma.trade.findMany({
    where: { from_user_id: userId, status: 'pending' },
    include: { to_user: { select: { id: true, display_name: true, nickname: true } } },
    orderBy: { created_at: 'desc' },
  });
  res.json(await Promise.all(sent.map(enrichTrade)));
});

// ── Propose ───────────────────────────────────────────────────────────────────

function normalizeIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every(v => typeof v === 'string' && v.length > 0)) return null;
  return value as string[];
}

router.post('/propose', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const {
    from_pokemon_ids,
    to_user_id,
    to_pokemon_ids,
    coins_offered = 0,
    coins_requested = 0,
  } = req.body as {
    from_pokemon_ids: string[];
    to_user_id: string;
    to_pokemon_ids: string[];
    coins_offered?: number;
    coins_requested?: number;
  };

  const fromIds = normalizeIds(from_pokemon_ids);
  const toIds = normalizeIds(to_pokemon_ids);

  if (!fromIds || !toIds || !to_user_id) {
    res.status(400).json({ error: 'from_pokemon_ids, to_pokemon_ids (arrays) and to_user_id are required' });
    return;
  }
  if (fromIds.length < 1 || fromIds.length > MAX_PER_SIDE || toIds.length < 1 || toIds.length > MAX_PER_SIDE) {
    res.status(400).json({ error: `Each side must have between 1 and ${MAX_PER_SIDE} Pokémon` });
    return;
  }
  // No duplicates within a side, no overlap between sides.
  if (new Set(fromIds).size !== fromIds.length || new Set(toIds).size !== toIds.length) {
    res.status(400).json({ error: 'Duplicate Pokémon in a trade side' });
    return;
  }
  if (fromIds.some(id => toIds.includes(id))) {
    res.status(400).json({ error: 'A Pokémon cannot be on both sides' });
    return;
  }
  if (to_user_id === userId) {
    res.status(400).json({ error: 'Cannot trade with yourself' });
    return;
  }
  if (!Number.isInteger(coins_offered) || !Number.isInteger(coins_requested) || coins_offered < 0 || coins_requested < 0) {
    res.status(400).json({ error: 'Coin amounts must be non-negative integers' });
    return;
  }
  if (coins_offered > 0 && coins_requested > 0) {
    res.status(400).json({ error: 'Cannot both offer and request coins' });
    return;
  }

  const allIds = [...fromIds, ...toIds];
  const now = new Date();
  const involved = await prisma.userPokemon.findMany({ where: { id: { in: allIds } } });
  const byId = new Map(involved.map(p => [p.id, p]));

  // Ownership + cooldown for the proposer's side.
  for (const id of fromIds) {
    const p = byId.get(id);
    if (!p || p.user_id !== userId) {
      res.status(403).json({ error: 'Pokémon not owned by you' });
      return;
    }
    if (p.tradeable_at && p.tradeable_at > now) {
      res.status(400).json({ error: 'Pokémon not tradeable yet', tradeable_at: p.tradeable_at });
      return;
    }
  }
  // Ownership + cooldown for the recipient's side.
  for (const id of toIds) {
    const p = byId.get(id);
    if (!p || p.user_id !== to_user_id) {
      res.status(400).json({ error: 'Target Pokémon not valid' });
      return;
    }
    if (p.tradeable_at && p.tradeable_at > now) {
      res.status(400).json({ error: 'Target Pokémon not tradeable yet', tradeable_at: p.tradeable_at });
      return;
    }
  }

  // None of the proposer's Pokémon may be actively listed on the market.
  const listed = await prisma.marketListing.findFirst({
    where: { pokemon_id: { in: fromIds }, status: 'active' },
  });
  if (listed) {
    res.status(409).json({ error: 'A Pokémon is listed on the market' });
    return;
  }

  if (coins_offered > 0) {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { coins: true } });
    if (!me || me.coins < coins_offered) {
      res.status(402).json({ error: 'Insufficient coins to offer' });
      return;
    }
  }

  // A UserPokemon may only be tied to ONE pending trade at a time (on either
  // side). The conflict check + create run in one Serializable transaction so
  // two simultaneous proposals can't slip a Pokémon into two pending trades.
  // This also subsumes the exact-duplicate-trade case.
  let trade;
  try {
    trade = await prisma.$transaction(async (tx) => {
      const conflict = await tx.tradeItem.findFirst({
        where: { pokemon_id: { in: allIds }, trade: { status: 'pending' } },
      });
      if (conflict) throw Object.assign(new Error('POKEMON_ALREADY_IN_TRADE'), { status: 409 });

      const created = await tx.trade.create({
        data: {
          from_user_id: userId,
          to_user_id,
          // Legacy scalar columns kept in sync (= first of each side) for the
          // transition; the source of truth is the TradeItem rows below.
          from_pokemon_id: fromIds[0],
          to_pokemon_id: toIds[0],
          coins_offered,
          coins_requested,
          status: 'pending',
        },
      });

      await tx.tradeItem.createMany({
        data: [
          ...fromIds.map(pid => ({ trade_id: created.id, owner: 'from', pokemon_id: pid })),
          ...toIds.map(pid => ({ trade_id: created.id, owner: 'to', pokemon_id: pid })),
        ],
      });

      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (err) {
    if ((err as { status?: number }).status === 409) {
      res.status(409).json({ error: 'POKEMON_ALREADY_IN_TRADE' });
      return;
    }
    throw err;
  }

  res.status(201).json(trade);

  // Fire-and-forget: notify recipient (first Pokémon of each side, like before).
  const fromDisplayName = req.user!.display_name;
  Promise.all([
    byId.get(fromIds[0])
      ? prisma.pokemon.findUnique({ where: { id: byId.get(fromIds[0])!.pokemon_id }, select: { name: true } })
      : Promise.resolve(null),
    byId.get(toIds[0])
      ? prisma.pokemon.findUnique({ where: { id: byId.get(toIds[0])!.pokemon_id }, select: { name: true } })
      : Promise.resolve(null),
  ]).then(([fromPkm, toPkm]) =>
    createNotification(to_user_id, 'TRADE_RECEIVED', {
      tradeId: trade.id,
      fromUserId: userId,
      fromUserName: fromDisplayName,
      fromPokemonName: fromPkm?.name ?? '?',
      toPokemonName: toPkm?.name ?? null,
    })
  ).catch(() => {});
});

// ── Accept ────────────────────────────────────────────────────────────────────

router.post('/accept/:id', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const id = String(req.params.id);

  const trade = await prisma.trade.findUnique({ where: { id } });
  if (!trade || trade.to_user_id !== userId || trade.status !== 'pending') {
    res.status(404).json({ error: 'Trade not found or already resolved' });
    return;
  }

  // Pre-flight coin checks.
  if (trade.coins_offered > 0) {
    const fromUser = await prisma.user.findUnique({ where: { id: trade.from_user_id }, select: { coins: true } });
    if (!fromUser || fromUser.coins < trade.coins_offered) {
      res.status(402).json({ error: 'Offerer no longer has enough coins' });
      return;
    }
  }
  if (trade.coins_requested > 0) {
    const toUser = await prisma.user.findUnique({ where: { id: trade.to_user_id }, select: { coins: true } });
    if (!toUser || toUser.coins < trade.coins_requested) {
      res.status(402).json({ error: 'Insufficient coins to accept this trade' });
      return;
    }
  }

  const tradeableAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const now = new Date();

  let raceDetected = false;
  let ownershipInvalid = false;

  const { fromUser, toUser, fromCount, toCount } = await prisma.$transaction(async tx => {
    // Compare-and-swap: only one concurrent accept flips pending -> accepted.
    const { count } = await tx.trade.updateMany({
      where: { id, status: 'pending' },
      data: { status: 'accepted', resolved_at: new Date() },
    });
    if (count === 0) {
      raceDetected = true;
      return { fromUser: null, toUser: null, fromCount: 0, toCount: 0 };
    }

    const items = await tx.tradeItem.findMany({ where: { trade_id: id } });
    const fromIds = items.filter(i => i.owner === 'from').map(i => i.pokemon_id);
    const toIds = items.filter(i => i.owner === 'to').map(i => i.pokemon_id);

    // TOCTOU re-verification: every item must still be owned by the expected
    // side and off cooldown. Any failure cancels the trade instead of transferring.
    const involved = await tx.userPokemon.findMany({ where: { id: { in: [...fromIds, ...toIds] } } });
    const byId = new Map(involved.map(p => [p.id, p]));

    const valid = (ids: string[], expectedOwner: string) => ids.every(pid => {
      const p = byId.get(pid);
      return p && p.user_id === expectedOwner && (!p.tradeable_at || p.tradeable_at <= now);
    });

    if (!valid(fromIds, trade.from_user_id) || !valid(toIds, trade.to_user_id)) {
      await tx.trade.update({ where: { id }, data: { status: 'cancelled', resolved_at: new Date() } });
      ownershipInvalid = true;
      return { fromUser: null, toUser: null, fromCount: 0, toCount: 0 };
    }

    // Transfer: from side -> recipient, to side -> proposer.
    await tx.userPokemon.updateMany({
      where: { id: { in: fromIds } },
      data: { user_id: trade.to_user_id, tradeable_at: tradeableAt },
    });
    await tx.userPokemon.updateMany({
      where: { id: { in: toIds } },
      data: { user_id: trade.from_user_id, tradeable_at: tradeableAt },
    });

    const exchangedIds = [...fromIds, ...toIds];

    // Cancel sibling pending trades that reference any exchanged Pokémon.
    const siblingItems = await tx.tradeItem.findMany({
      where: { pokemon_id: { in: exchangedIds }, trade_id: { not: id }, trade: { status: 'pending' } },
      select: { trade_id: true },
    });
    const siblingTradeIds = [...new Set(siblingItems.map(s => s.trade_id))];
    if (siblingTradeIds.length > 0) {
      await tx.trade.updateMany({
        where: { id: { in: siblingTradeIds }, status: 'pending' },
        data: { status: 'cancelled', resolved_at: new Date() },
      });
    }

    // Cancel active market listings for the exchanged Pokémon (owner just changed).
    await tx.marketListing.updateMany({
      where: { pokemon_id: { in: exchangedIds }, status: 'active' },
      data: { status: 'cancelled' },
    });

    // Coins.
    if (trade.coins_offered > 0) {
      await spendCoins(tx, trade.from_user_id, trade.coins_offered, 'trade');
      await addCoins(tx, trade.to_user_id, trade.coins_offered, 'trade');
    }
    if (trade.coins_requested > 0) {
      await spendCoins(tx, trade.to_user_id, trade.coins_requested, 'trade');
      await addCoins(tx, trade.from_user_id, trade.coins_requested, 'trade');
    }

    // trade_count: each side gains its number of exchanged Pokémon.
    const fromUserResult = await tx.user.update({
      where: { id: trade.from_user_id },
      data: { trade_count: { increment: fromIds.length } },
    });
    const toUserResult = await tx.user.update({
      where: { id: trade.to_user_id },
      data: { trade_count: { increment: toIds.length } },
    });

    await recalculateUserPokedexValue(tx, trade.from_user_id);
    await recalculateUserPokedexValue(tx, trade.to_user_id);

    return { fromUser: fromUserResult, toUser: toUserResult, fromCount: fromIds.length, toCount: toIds.length };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

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

  // Bonus draw every 10 trades. With a multi-Pokémon increment the count can jump
  // several at once, so award when the side crosses a multiple of 10.
  const crossedTen = (user: { trade_count: number } | null, added: number) =>
    !!user && added > 0 && Math.floor(user.trade_count / 10) > Math.floor((user.trade_count - added) / 10);

  const bonusDraws: string[] = [];
  if (crossedTen(fromUser, fromCount)) bonusDraws.push(trade.from_user_id);
  if (crossedTen(toUser, toCount)) bonusDraws.push(trade.to_user_id);

  res.json({ success: true, bonusDraws, new_badges: { from: fromBadges, to: toBadges } });

  // Fire-and-forget: notify proposer (first Pokémon of each side, like before).
  const accepterName = req.user!.display_name;
  Promise.all([
    trade.from_pokemon_id
      ? prisma.userPokemon.findUnique({ where: { id: trade.from_pokemon_id }, include: { pokemon: true } })
      : Promise.resolve(null),
    trade.to_pokemon_id
      ? prisma.userPokemon.findUnique({ where: { id: trade.to_pokemon_id }, include: { pokemon: true } })
      : Promise.resolve(null),
  ]).then(([fromUpkm, toUpkm]) => {
    const shinySprite = (up: typeof fromUpkm) =>
      up ? (up.is_shiny ? up.pokemon.sprite_url.replace('/normal/', '/shiny/') : up.pokemon.sprite_url) : '';
    return createNotification(trade.from_user_id, 'TRADE_ACCEPTED', {
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

// ── Decline / Cancel (status-only, items kept for history) ─────────────────────

router.post('/decline/:id', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const id = String(req.params.id);

  const trade = await prisma.trade.findUnique({ where: { id } });
  if (!trade || trade.to_user_id !== userId || trade.status !== 'pending') {
    res.status(404).json({ error: 'Trade not found or already resolved' });
    return;
  }

  await prisma.trade.update({ where: { id }, data: { status: 'declined', resolved_at: new Date() } });
  res.json({ success: true });
});

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

  await prisma.trade.update({ where: { id }, data: { status: 'cancelled', resolved_at: new Date() } });
  res.json({ ok: true });
});

export default router;
