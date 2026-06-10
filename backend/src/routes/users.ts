import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/authMiddleware';
import { addCoins } from '../services/coinService';
import { drawFromEvent } from '../services/eventDraw';
import { checkBadges } from '../services/badgeService';
import {
  STARTERS, STARTER_EVO, STREAK_BADGES, TRADE_BADGES, POKEDEX_BADGES,
  BATTLE_BADGES, MARKET_SELL_BADGES, MARKET_BUY_BADGES, SHINY_BADGES,
  GEN_COUNT, ALL_TYPES, TYPE_BADGE_TIERS,
} from '../services/badgeService';

const router = Router();
const prisma = new PrismaClient();

// GET /users/search?q=prénom+nom  — recherche élève par nom (min 2 chars)
router.get('/search', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) {
    res.json({ users: [] });
    return;
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { nickname: { contains: q, mode: 'insensitive' } },
        { display_name: { contains: q, mode: 'insensitive' } },
      ],
      NOT: { id: req.user!.userId }, // exclure soi-même
    },
    select: { id: true, display_name: true, nickname: true },
    orderBy: { display_name: 'asc' },
    take: 8,
  });

  res.json({ users: users.map(u => ({ id: u.id, display_name: u.nickname ?? u.display_name })) });
});

// GET /users/badges/me — liste complète des badges de l'utilisateur connecté
router.get('/badges/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const badges = await prisma.userBadge.findMany({
    where: { user_id: userId },
    include: { badge: true },
    orderBy: { unlocked_at: 'desc' },
  });

  res.json(badges);
});

// GET /users/badges/unnotified — badges débloqués mais pas encore affichés
router.get('/badges/unnotified', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const badges = await prisma.userBadge.findMany({
    where: { user_id: userId, notified: false },
    include: { badge: true },
    orderBy: { unlocked_at: 'asc' },
  });

  res.json(badges);
});

// POST /users/badges/notified — marquer des badges comme vus { badgeIds: string[] }
router.post('/badges/notified', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { badgeIds } = req.body as { badgeIds: string[] };

  if (!Array.isArray(badgeIds) || badgeIds.length === 0) {
    res.status(400).json({ error: 'badgeIds must be a non-empty array' });
    return;
  }

  await prisma.userBadge.updateMany({
    where: { user_id: userId, badge_id: { in: badgeIds } },
    data: { notified: true },
  });

  res.json({ success: true });
});

// PATCH /users/username — mettre à jour son nom d'utilisateur
router.patch('/username', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const displayName = String((req.body as { display_name?: unknown }).display_name ?? '').trim();

  if (displayName.length < 2) {
    res.status(400).json({ error: 'Nom trop court' });
    return;
  }

  if (displayName.length > 32) {
    res.status(400).json({ error: 'Nom trop long' });
    return;
  }

  // Write the chosen name to `nickname`, NOT `display_name` — display_name is
  // re-synced from Azure AD at every login and would overwrite a rename. The
  // effective name (nickname ?? display_name) is what every display surface returns.
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { nickname: displayName },
    select: { nickname: true, display_name: true },
  });

  res.json({ display_name: updated.nickname ?? updated.display_name });
});

// PATCH /users/featured-badges — mettre à jour les badges vitrine (max 3) { badgeIds: string[] }
router.patch('/featured-badges', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { badgeIds } = req.body as { badgeIds: string[] };

  if (!Array.isArray(badgeIds) || badgeIds.length > 3) {
    res.status(400).json({ error: 'badgeIds must be an array of at most 3 badge IDs' });
    return;
  }

  // Vérifier que l'user possède tous les badges demandés
  const owned = await prisma.userBadge.findMany({
    where: { user_id: userId, badge_id: { in: badgeIds } },
    select: { badge_id: true },
  });

  const ownedIds = new Set(owned.map(b => b.badge_id));
  const missing = badgeIds.filter(id => !ownedIds.has(id));
  if (missing.length > 0) {
    res.status(403).json({ error: 'Badge(s) not owned', missing });
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { featured_badges: badgeIds },
  });

  res.json({ success: true });
});

// GET /users/me — profil complet de l'utilisateur connecté
router.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      display_name: true,
      nickname: true,
      coins: true,
      streak_days: true,
      last_login: true,
      last_shiny_pack_claimed_at: true,
      total_score: true,
      trade_count: true,
      featured_badges: true,
      is_admin: true,
    },
  });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  const { nickname, ...rest } = user;
  res.json({ ...rest, display_name: nickname ?? rest.display_name });
});

// ── Free daily Shiny pack (reset at Paris midnight) ──────────────────────────
const SHINY_EVENT_NAME = 'Shiny Surge';

// The DB stores timestamps in UTC. The pack resets at midnight Paris time, and
// Paris is UTC+2 in summer (CEST), so midnight Paris == 22:00 UTC. The last reset
// boundary is therefore: floor((now - 22h) / 24h) * 24h + 22h.
// NOTE: hardcoded to UTC+2 (summer) per spec — would be 23:00 UTC in winter (CET).
const PARIS_OFFSET_MS = 22 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function lastShinyReset(now: Date): Date {
  return new Date(Math.floor((now.getTime() - PARIS_OFFSET_MS) / DAY_MS) * DAY_MS + PARIS_OFFSET_MS);
}
function nextShinyReset(now: Date): Date {
  return new Date(lastShinyReset(now).getTime() + DAY_MS);
}

router.post('/daily-shiny-pack', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const now = new Date();
  const resetBoundary = lastShinyReset(now);
  const availableAt = nextShinyReset(now).toISOString();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { last_shiny_pack_claimed_at: true },
  });
  if (user?.last_shiny_pack_claimed_at && user.last_shiny_pack_claimed_at >= resetBoundary) {
    res.status(429).json({ error: 'ALREADY_CLAIMED_TODAY', availableAt });
    return;
  }

  const event = await prisma.event.findFirst({ where: { name: SHINY_EVENT_NAME } });
  if (!event || event.pokemon_pool.length === 0) {
    res.status(500).json({ error: 'Shiny pack unavailable' });
    return;
  }

  // Atomic claim (compare-and-swap) so two concurrent requests can't both pass
  // the check above and double-draw. Only the first to flip the timestamp wins.
  const { count } = await prisma.user.updateMany({
    where: {
      id: userId,
      OR: [
        { last_shiny_pack_claimed_at: null },
        { last_shiny_pack_claimed_at: { lt: resetBoundary } },
      ],
    },
    data: { last_shiny_pack_claimed_at: now },
  });
  if (count === 0) {
    res.status(429).json({ error: 'ALREADY_CLAIMED_TODAY', availableAt });
    return;
  }

  let result;
  try {
    result = await drawFromEvent(userId, event, { spendPrice: false, source: 'shiny_daily' });
  } catch (err) {
    // Roll the claim back so the user can retry if the draw itself failed.
    await prisma.user.update({
      where: { id: userId },
      data: { last_shiny_pack_claimed_at: user?.last_shiny_pack_claimed_at ?? null },
    }).catch(() => {});
    throw err;
  }

  const newBadges = await checkBadges(userId);
  res.json({ ...result, new_badges: newBadges, availableAt });
});

// GET /users/all-badges — tous les badges avec statut débloqué pour l'user connecté
router.get('/all-badges', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const [allBadges, userBadges] = await Promise.all([
    prisma.badge.findMany({ orderBy: [{ category: 'asc' }, { id: 'asc' }] }),
    prisma.userBadge.findMany({
      where: { user_id: userId },
      select: { badge_id: true, unlocked_at: true, claimed: true, claimed_at: true },
    }),
  ]);
  const unlockedMap = new Map(userBadges.map(ub => [ub.badge_id, ub]));
  res.json(allBadges.map(badge => {
    const ub = unlockedMap.get(badge.id);
    return {
      ...badge,
      unlocked: !!ub,
      unlocked_at: ub?.unlocked_at ?? null,
      claimed: ub?.claimed ?? false,
      claimed_at: ub?.claimed_at ?? null,
    };
  }));
});

// GET /users/badges/progress — every badge with unlock/claim status, plus a
// progress breakdown (current/required, and missingPokemon for collection
// badges) for locked ones. Mirrors the thresholds used by checkBadges.
router.get('/badges/progress', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const [allBadges, userBadges, user, ownedPokemons, allPokemon, battleWins, marketSold, marketBought] = await Promise.all([
    prisma.badge.findMany({ orderBy: [{ category: 'asc' }, { id: 'asc' }] }),
    prisma.userBadge.findMany({
      where: { user_id: userId },
      select: { badge_id: true, unlocked_at: true, claimed: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { streak_days: true, trade_count: true } }),
    prisma.userPokemon.findMany({
      where: { user_id: userId },
      select: { pokemon_id: true, is_shiny: true, pokemon: { select: { generation: true, rarity: true, types: true } } },
    }),
    prisma.pokemon.findMany({ select: { id: true, name: true, sprite_url: true, rarity: true, generation: true, points: true, types: true } }),
    prisma.battleRecord.count({ where: { winner_id: userId } }),
    prisma.marketListing.count({ where: { seller_id: userId, status: 'sold' } }),
    prisma.marketListing.count({ where: { buyer_id: userId, status: 'sold' } }),
  ]);

  const unlockedMap = new Map(userBadges.map(ub => [ub.badge_id, ub]));
  const pokemonMap = new Map(allPokemon.map(p => [p.id, p]));

  const ownedIds = new Set(ownedPokemons.map(p => p.pokemon_id));
  const distinctCount = ownedIds.size;
  const shinySpecies = new Set(ownedPokemons.filter(p => p.is_shiny).map(p => p.pokemon_id));

  const speciesByType = new Map<string, Set<number>>();
  const speciesByRarity = new Map<string, Set<number>>();
  const legendaryOwnedByGen = new Map<number, Set<number>>();
  const ownedByGen = new Map<number, Set<number>>();
  for (const p of ownedPokemons) {
    for (const type of p.pokemon.types) {
      (speciesByType.get(type) ?? speciesByType.set(type, new Set()).get(type)!).add(p.pokemon_id);
    }
    const rarity = p.pokemon.rarity;
    (speciesByRarity.get(rarity) ?? speciesByRarity.set(rarity, new Set()).get(rarity)!).add(p.pokemon_id);
    const gen = p.pokemon.generation;
    (ownedByGen.get(gen) ?? ownedByGen.set(gen, new Set()).get(gen)!).add(p.pokemon_id);
    if (p.pokemon.rarity === 'LEGENDARY') {
      (legendaryOwnedByGen.get(gen) ?? legendaryOwnedByGen.set(gen, new Set()).get(gen)!).add(p.pokemon_id);
    }
  }

  const legendaryIdsByGen = new Map<number, number[]>();
  for (const p of allPokemon) {
    if (p.rarity === 'LEGENDARY') {
      const arr = legendaryIdsByGen.get(p.generation) ?? legendaryIdsByGen.set(p.generation, []).get(p.generation)!;
      arr.push(p.id);
    }
  }

  const missing = (ids: number[]) =>
    ids.filter(id => !ownedIds.has(id)).map(id => {
      const p = pokemonMap.get(id);
      return {
        id,
        name: p?.name ?? `#${id}`,
        spriteUrl: p?.sprite_url ?? '',
        rarity: p?.rarity ?? 'COMMON',
        points: p?.points ?? 0,
        types: p?.types ?? [],
        generation: p?.generation ?? 0,
      };
    });

  const thr = (arr: Array<{ id: string; threshold: number }>, id: string) => arr.find(b => b.id === id)?.threshold;

  type Progress = {
    current: number;
    required: number;
    missingPokemon?: Array<{ id: number; name: string; spriteUrl: string; rarity: string; points: number; types: string[]; generation: number }>;
  };
  function computeProgress(badgeId: string): Progress | undefined {
    let t: number | undefined;
    if ((t = thr(STREAK_BADGES, badgeId)) !== undefined)      return { current: Math.min(user!.streak_days, t), required: t };
    if ((t = thr(TRADE_BADGES, badgeId)) !== undefined)       return { current: Math.min(user!.trade_count, t), required: t };
    if ((t = thr(POKEDEX_BADGES, badgeId)) !== undefined)     return { current: Math.min(distinctCount, t), required: t };
    if ((t = thr(BATTLE_BADGES, badgeId)) !== undefined)      return { current: Math.min(battleWins, t), required: t };
    if ((t = thr(MARKET_SELL_BADGES, badgeId)) !== undefined) return { current: Math.min(marketSold, t), required: t };
    if ((t = thr(MARKET_BUY_BADGES, badgeId)) !== undefined)  return { current: Math.min(marketBought, t), required: t };
    if ((t = thr(SHINY_BADGES, badgeId)) !== undefined)       return { current: Math.min(shinySpecies.size, t), required: t };

    const lineage = STARTERS[badgeId] ?? STARTER_EVO[badgeId];
    if (lineage) {
      return { current: lineage.filter(id => ownedIds.has(id)).length, required: lineage.length, missingPokemon: missing(lineage) };
    }

    const legGen = badgeId.match(/^legendary_gen(\d)$/);
    if (legGen) {
      const ids = legendaryIdsByGen.get(Number(legGen[1])) ?? [];
      return { current: ids.filter(id => ownedIds.has(id)).length, required: ids.length, missingPokemon: missing(ids) };
    }
    if (badgeId === 'legendary_hunter') {
      const covered = [1, 2, 3, 4, 5, 6, 7].filter(g => (legendaryOwnedByGen.get(g)?.size ?? 0) > 0).length;
      return { current: covered, required: 7 };
    }

    const typeMatch = badgeId.match(/^type_([a-z]+)_(\d+)$/);
    if (typeMatch && TYPE_BADGE_TIERS.includes(Number(typeMatch[2]))) {
      const cur = speciesByType.get(typeMatch[1])?.size ?? 0;
      return { current: Math.min(cur, Number(typeMatch[2])), required: Number(typeMatch[2]) };
    }
    if (badgeId === 'all_types') {
      const covered = ALL_TYPES.filter(ty => (speciesByType.get(ty)?.size ?? 0) > 0).length;
      return { current: covered, required: ALL_TYPES.length };
    }

    const genComplete = badgeId.match(/^gen(\d)_complete$/);
    if (genComplete) {
      const gen = Number(genComplete[1]);
      const total = GEN_COUNT[gen] ?? 0;
      return { current: Math.min(ownedByGen.get(gen)?.size ?? 0, total), required: total };
    }

    // Rarity collection — distinct species owned of a rarity.
    const rarMatch = badgeId.match(/^rarity_(common|rare|epic|legendary)_(\d+)$/);
    if (rarMatch) {
      const cur = speciesByRarity.get(rarMatch[1].toUpperCase())?.size ?? 0;
      return { current: Math.min(cur, Number(rarMatch[2])), required: Number(rarMatch[2]) };
    }

    // Generation collection — distinct species owned of a generation (gen{N}_{tier}).
    const genColl = badgeId.match(/^gen(\d+)_(\d+)$/);
    if (genColl) {
      const cur = ownedByGen.get(Number(genColl[1]))?.size ?? 0;
      return { current: Math.min(cur, Number(genColl[2])), required: Number(genColl[2]) };
    }

    return undefined;
  }

  res.json(allBadges.map(badge => {
    const ub = unlockedMap.get(badge.id);
    if (ub) {
      return { badgeId: badge.id, unlocked: true, unlockedAt: ub.unlocked_at, claimed: ub.claimed, coinReward: badge.coin_reward };
    }
    return { badgeId: badge.id, unlocked: false, claimed: false, coinReward: badge.coin_reward, progress: computeProgress(badge.id) };
  }));
});

// POST /users/badges/:badgeId/claim — réclamer les coins d'un badge débloqué
router.post('/badges/:badgeId/claim', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const badgeId = String(req.params.badgeId);

  const coinsEarned = await prisma.$transaction(async tx => {
    const { count } = await tx.userBadge.updateMany({
      where: {
        user_id: userId,
        badge_id: badgeId,
        claimed: false,
      },
      data: {
        claimed: true,
        claimed_at: new Date(),
      },
    });

    if (count === 0) {
      throw Object.assign(new Error('Badge not found or already claimed'), { status: 409 });
    }

    const badge = await tx.badge.findUnique({ where: { id: badgeId } });
    if (!badge) {
      throw Object.assign(new Error('Badge not found'), { status: 404 });
    }

    await addCoins(tx, userId, badge.coin_reward, 'badge');
    return badge.coin_reward;
  });

  const updated = await prisma.user.findUnique({
    where: { id: userId },
    select: { coins: true },
  });

  res.json({ coins_earned: coinsEarned, total_coins: updated?.coins ?? 0 });
});

export default router;
