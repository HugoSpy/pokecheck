import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/authMiddleware';
import { spendCoins, addCoins } from '../services/coinService';
import { recalculateUserPokedexValue } from '../services/pokedexValue';
import { checkBadges } from '../services/badgeService';

const router = Router();
const prisma = new PrismaClient();

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

router.post('/list', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { userPokemonId, price_coins } = req.body as {
    userPokemonId: string;
    price_coins: number;
  };

  // M3 — Cap price to prevent griefing: a user could list a pokemon at INT_MAX
  // to effectively remove it from the market forever (no one can afford it).
  // 1 000 000 coins is well above any achievable balance in normal play.
  const MAX_PRICE = 1_000_000;
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
    // the Pokémon out of its current owner — cancel the stale listing instead.
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
  // their market-sell badges too (fire-and-forget — not part of the response).
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
