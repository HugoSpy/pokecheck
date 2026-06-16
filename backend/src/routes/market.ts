import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../middleware/authMiddleware';
import { spendCoins, addCoins } from '../services/coinService';
import { recalculateUserPokedexValue } from '../services/pokedexValue';
import { checkBadges } from '../services/badgeService';

const router = Router();

const MAX_PRICE = 1_000_000;

// Bulk listing is light-rate-limited per user (each call already lists up to 50).
// Keyed by JWT user id, not IP, because students share a Cloudflare egress IP.
const bulkListLimiter = rateLimit({
  windowMs: 1_000,
  max: 3,
  keyGenerator: (req) => req.user?.userId ?? req.ip ?? 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

const MAX_BULK_LIST = 50;

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const listings = await prisma.marketListing.findMany({
    where: { status: 'active' },
    orderBy: { created_at: 'desc' },
    include: {
      seller: { select: { id: true, display_name: true, nickname: true } },
    },
  });

  const enriched = await Promise.all(
    listings.map(async listing => {
      const up = await prisma.userPokemon.findUnique({
        where: { id: listing.pokemon_id },
        include: { pokemon: true },
      });
      return {
        ...listing,
        seller: { id: listing.seller.id, display_name: listing.seller.nickname ?? listing.seller.display_name },
        userPokemon: up
          ? {
              instanceId: up.id,
              is_shiny: up.is_shiny,
              obtained_at: up.obtained_at,
              pokemon: {
                ...up.pokemon,
                sprite_url: up.is_shiny
                  ? up.pokemon.sprite_url.replace('/normal/', '/shiny/')
                  : up.pokemon.sprite_url,
                points: up.is_shiny ? up.pokemon.points * 3 : up.pokemon.points,
              },
            }
          : null,
      };
    })
  );

  res.json(enriched);
});

// POST /market/list/bulk - list up to 50 owned Pokémon at the SAME price in one
// Serializable transaction. Declared BEFORE '/list' is irrelevant (distinct path)
// but kept near it for clarity. Validation is fail-all: if any Pokémon is invalid
// (not owned, favorite, locked, already listed or in a pending trade) the whole
// batch is rejected, so the caller never ends up with a partial listing.
router.post('/list/bulk', authMiddleware, bulkListLimiter, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { ids, price_coins } = req.body as { ids?: unknown; price_coins?: unknown };

  if (typeof price_coins !== 'number' || !Number.isFinite(price_coins) || price_coins <= 0 || price_coins > MAX_PRICE) {
    res.status(400).json({ error: `price_coins must be between 1 and ${MAX_PRICE}` });
    return;
  }
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every(id => typeof id === 'string')) {
    res.status(400).json({ error: 'ids must be a non-empty array of strings' });
    return;
  }
  const uniqueIds = [...new Set(ids as string[])];
  if (uniqueIds.length > MAX_BULK_LIST) {
    res.status(400).json({ error: `Cannot list more than ${MAX_BULK_LIST} Pokémon at once` });
    return;
  }

  let listed: number;
  try {
    listed = await prisma.$transaction(async tx => {
      const owned = await tx.userPokemon.findMany({
        where: { id: { in: uniqueIds }, user_id: userId },
      });
      // Every id must resolve to a Pokémon the caller currently owns.
      if (owned.length !== uniqueIds.length) {
        throw Object.assign(new Error('Un ou plusieurs Pokémon ne vous appartiennent pas ou n\'existent plus'), { status: 403 });
      }

      // The favorite Pokémon can never be sold - a market listing is a sale.
      const seller = await tx.user.findUnique({ where: { id: userId }, select: { favorite_pokemon_id: true } });
      if (seller?.favorite_pokemon_id && uniqueIds.includes(seller.favorite_pokemon_id)) {
        throw Object.assign(new Error('Impossible de vendre votre Pokémon favori'), { status: 400 });
      }

      // Locked Pokémon (tradeable_at in the future) cannot be listed yet.
      const now = new Date();
      if (owned.some(up => up.tradeable_at && up.tradeable_at > now)) {
        throw Object.assign(new Error('Un Pokémon n\'est pas encore échangeable'), { status: 400 });
      }

      // Refuse if any Pokémon is tied to a pending trade (TradeItem covers
      // multi-Pokémon trades the legacy from/to columns would miss).
      const pendingTradeItem = await tx.tradeItem.findFirst({
        where: { pokemon_id: { in: uniqueIds }, trade: { status: 'pending' } },
      });
      if (pendingTradeItem) {
        throw Object.assign(new Error('Un Pokémon est engagé dans un échange en attente'), { status: 400 });
      }

      // Refuse if any Pokémon already has an active listing.
      const alreadyListed = await tx.marketListing.findFirst({
        where: { pokemon_id: { in: uniqueIds }, status: 'active' },
      });
      if (alreadyListed) {
        throw Object.assign(new Error('Un Pokémon est déjà en vente sur le marché'), { status: 409 });
      }

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const result = await tx.marketListing.createMany({
        data: uniqueIds.map(pokemonId => ({
          seller_id: userId,
          pokemon_id: pokemonId,
          price_coins,
          status: 'active',
          expires_at: expiresAt,
        })),
      });
      return result.count;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (err) {
    const e = err as { status?: number; code?: string; message?: string };
    if (e.status === 400) { res.status(400).json({ error: e.message }); return; }
    if (e.status === 403) { res.status(403).json({ error: e.message }); return; }
    if (e.status === 409) { res.status(409).json({ error: e.message }); return; }
    // P2034 = serialization failure from a concurrent write - caller can retry.
    if (e.code === 'P2034') { res.status(429).json({ error: 'Too many requests, please slow down.' }); return; }
    throw err;
  }

  res.status(201).json({ listed });
});

router.post('/list', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { userPokemonId, price_coins } = req.body as {
    userPokemonId: string;
    price_coins: number;
  };

  // M3 - Cap price to prevent griefing: a user could list a pokemon at INT_MAX
  // to effectively remove it from the market forever (no one can afford it).
  // 1 000 000 coins is well above any achievable balance in normal play.
  if (!userPokemonId || typeof price_coins !== 'number' || price_coins <= 0 || price_coins > MAX_PRICE) {
    res.status(400).json({ error: `userPokemonId and price_coins (1–${MAX_PRICE}) are required` });
    return;
  }

  const userPokemon = await prisma.userPokemon.findUnique({ where: { id: userPokemonId } });
  if (!userPokemon || userPokemon.user_id !== userId) {
    res.status(403).json({ error: 'Pokémon not owned by you' });
    return;
  }

  if (userPokemon.tradeable_at && userPokemon.tradeable_at > new Date()) {
    res.status(400).json({ error: 'Pokémon not tradeable yet', tradeable_at: userPokemon.tradeable_at });
    return;
  }

  // The favorite Pokémon can never be sold - a market listing is a sale.
  const seller = await prisma.user.findUnique({ where: { id: userId }, select: { favorite_pokemon_id: true } });
  if (seller?.favorite_pokemon_id === userPokemonId) {
    res.status(400).json({ error: 'Impossible de vendre votre Pokémon favori' });
    return;
  }

  const pendingTrade = await prisma.trade.findFirst({
    where: {
      status: 'pending',
      OR: [{ from_pokemon_id: userPokemonId }, { to_pokemon_id: userPokemonId }],
    },
  });
  if (pendingTrade) {
    res.status(409).json({ error: 'Pokémon is in a pending trade offer' });
    return;
  }

  const activeListing = await prisma.marketListing.findFirst({
    where: { pokemon_id: userPokemonId, status: 'active' },
  });
  if (activeListing) {
    res.status(409).json({ error: 'Pokémon is already listed on the market' });
    return;
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const listing = await prisma.marketListing.create({
    data: {
      seller_id: userId,
      pokemon_id: userPokemonId,
      price_coins,
      status: 'active',
      expires_at: expiresAt,
    },
  });

  res.status(201).json(listing);
});

router.post('/buy/:listingId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const buyerId = req.user!.userId;
  const listingId = String(req.params.listingId);

  const listing = await prisma.marketListing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status !== 'active' || listing.expires_at < new Date()) {
    res.status(404).json({ error: 'Listing not found or expired' });
    return;
  }

  if (listing.seller_id === buyerId) {
    res.status(400).json({ error: 'Cannot buy your own listing' });
    return;
  }

  const buyer = await prisma.user.findUnique({ where: { id: buyerId }, select: { coins: true } });
  if (!buyer || buyer.coins < listing.price_coins) {
    res.status(402).json({ error: 'Insufficient coins' });
    return;
  }

  const tradeableAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Race-condition guard: the outer findUnique + coin check above run outside the
  // transaction. Two concurrent buyers can both pass those checks simultaneously.
  // The updateMany below acts as an atomic compare-and-swap at the DB level:
  // PostgreSQL re-evaluates the WHERE after acquiring the row lock, so the second
  // concurrent request will find status='sold' (committed by the first) and get
  // count=0, triggering the 409 before any coins are moved.
  let raceDetected = false;
  let ownershipInvalid = false;

  await prisma.$transaction(async tx => {
    const { count } = await tx.marketListing.updateMany({
      where: { id: listingId, status: 'active' },
      data: { status: 'sold', sold_at: new Date(), buyer_id: buyerId },
    });

    if (count === 0) {
      raceDetected = true;
      return;
    }

    // Ownership re-verification: the listed Pokémon may have left the seller (via
    // a trade) while the listing stayed 'active'. Don't charge the buyer or rip
    // the Pokémon out of its current owner - cancel the stale listing instead.
    // (Same principle as the ownership re-check in /trade/accept, hotfix 963d83b.)
    const pokemon = await tx.userPokemon.findUnique({ where: { id: listing.pokemon_id } });
    if (!pokemon || pokemon.user_id !== listing.seller_id) {
      await tx.marketListing.update({
        where: { id: listingId },
        data: { status: 'cancelled', sold_at: null, buyer_id: null },
      });
      ownershipInvalid = true;
      return;
    }

    await spendCoins(tx, buyerId, listing.price_coins, 'market');
    await addCoins(tx, listing.seller_id, listing.price_coins, 'market');

    await tx.userPokemon.update({
      where: { id: listing.pokemon_id },
      data: { user_id: buyerId, tradeable_at: tradeableAt },
    });

    await recalculateUserPokedexValue(tx, listing.seller_id);
    await recalculateUserPokedexValue(tx, buyerId);
  });

  if (raceDetected || ownershipInvalid) {
    res.status(409).json({ error: 'Listing no longer available' });
    return;
  }

  // The buyer earns buy badges; the seller just completed a sale, so re-check
  // their market-sell badges too (fire-and-forget - not part of the response).
  const newBadges = await checkBadges(buyerId);
  checkBadges(listing.seller_id).catch(() => {});

  const updatedBuyer = await prisma.user.findUnique({
    where: { id: buyerId },
    select: { coins: true },
  });

  res.json({ success: true, coins_remaining: updatedBuyer?.coins ?? 0, new_badges: newBadges });
});

router.post('/cancel/:listingId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const listingId = String(req.params.listingId);

  const listing = await prisma.marketListing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status !== 'active') {
    res.status(404).json({ error: 'Listing not found or not active' });
    return;
  }

  if (listing.seller_id !== userId) {
    res.status(403).json({ error: 'Not your listing' });
    return;
  }

  await prisma.marketListing.update({
    where: { id: listingId },
    data: { status: 'cancelled' },
  });

  res.json({ success: true });
});

export default router;
