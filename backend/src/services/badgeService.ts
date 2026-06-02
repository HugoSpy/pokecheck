import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STARTERS: Record<string, number[]> = {
  starters_gen1: [1, 4, 7],
  starters_gen2: [152, 155, 158],
  starters_gen3: [252, 255, 258],
  starters_gen4: [387, 390, 393],
  starters_gen5: [495, 498, 501],
  starters_gen6: [650, 653, 656],
  starters_gen7: [722, 725, 728],
};

const STREAK_BADGES: Array<{ id: string; threshold: number }> = [
  { id: 'streak_1',   threshold: 1   },
  { id: 'streak_7',   threshold: 7   },
  { id: 'streak_14',  threshold: 14  },
  { id: 'streak_30',  threshold: 30  },
  { id: 'streak_50',  threshold: 50  },
  { id: 'streak_100', threshold: 100 },
];

const TRADE_BADGES: Array<{ id: string; threshold: number }> = [
  { id: 'trade_1',   threshold: 1   },
  { id: 'trade_5',   threshold: 5   },
  { id: 'trade_15',  threshold: 15  },
  { id: 'trade_30',  threshold: 30  },
  { id: 'trade_100', threshold: 100 },
];

const POKEDEX_BADGES: Array<{ id: string; threshold: number }> = [
  { id: 'pokedex_10',  threshold: 10  },
  { id: 'pokedex_50',  threshold: 50  },
  { id: 'pokedex_150', threshold: 150 },
  { id: 'pokedex_300', threshold: 300 },
  { id: 'pokedex_500', threshold: 500 },
  { id: 'pokedex_809', threshold: 809 },
];

const GEN_COUNT: Record<number, number> = {
  1: 151, 2: 100, 3: 135, 4: 107, 5: 156, 6: 72, 7: 88,
};

async function unlockBadge(
  userId: string,
  badgeId: string,
  alreadyUnlocked: Set<string>
): Promise<string | null> {
  if (alreadyUnlocked.has(badgeId)) return null;

  const badge = await prisma.badge.findUnique({ where: { id: badgeId } });
  if (!badge) return null;

  try {
    await prisma.userBadge.create({
      data: { user_id: userId, badge_id: badgeId, notified: false },
    });
    return badgeId;
  } catch {
    return null;
  }
}

export async function checkBadges(userId: string): Promise<string[]> {
  const [user, existingBadges, ownedPokemons] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { streak_days: true, trade_count: true },
    }),
    prisma.userBadge.findMany({
      where: { user_id: userId },
      select: { badge_id: true },
    }),
    prisma.userPokemon.findMany({
      where: { user_id: userId },
      select: {
        pokemon_id: true,
        pokemon: { select: { generation: true, rarity: true, types: true } },
      },
    }),
  ]);

  if (!user) return [];

  const alreadyUnlocked = new Set(existingBadges.map(b => b.badge_id));
  const newBadges: string[] = [];

  const unlock = async (badgeId: string) => {
    const result = await unlockBadge(userId, badgeId, alreadyUnlocked);
    if (result) {
      newBadges.push(result);
      alreadyUnlocked.add(result);
    }
  };

  // Streak badges
  for (const { id, threshold } of STREAK_BADGES) {
    if (user.streak_days >= threshold) await unlock(id);
  }

  // Trade badges
  for (const { id, threshold } of TRADE_BADGES) {
    if (user.trade_count >= threshold) await unlock(id);
  }

  // Build helper sets
  const ownedPokemonIds = new Set(ownedPokemons.map(p => p.pokemon_id));
  const distinctPokemonCount = ownedPokemonIds.size;

  // Pokédex size badges
  for (const { id, threshold } of POKEDEX_BADGES) {
    if (distinctPokemonCount >= threshold) await unlock(id);
  }

  // Starters badges
  for (const [badgeId, ids] of Object.entries(STARTERS)) {
    if (ids.every(id => ownedPokemonIds.has(id))) await unlock(badgeId);
  }

  // All 18 types badge
  const ownedTypes = new Set(ownedPokemons.flatMap(p => p.pokemon.types));
  const ALL_TYPES = [
    'normal','fire','water','electric','grass','ice',
    'fighting','poison','ground','flying','psychic','bug',
    'rock','ghost','dragon','dark','steel','fairy',
  ];
  if (ALL_TYPES.every(t => ownedTypes.has(t))) await unlock('all_types');

  // Legendary badges
  const legendaryByGen = new Map<number, Set<number>>();
  for (const p of ownedPokemons) {
    if (p.pokemon.rarity === 'LEGENDARY') {
      const gen = p.pokemon.generation;
      if (!legendaryByGen.has(gen)) legendaryByGen.set(gen, new Set());
      legendaryByGen.get(gen)!.add(p.pokemon_id);
    }
  }

  // legendary_hunter: at least 1 legendary in each gen 1-7
  if ([1,2,3,4,5,6,7].every(g => (legendaryByGen.get(g)?.size ?? 0) > 0)) {
    await unlock('legendary_hunter');
  }

  // legendary_genX: all legendaries of that generation
  for (const gen of [1,2,3,4,5,6,7]) {
    const allLegendariesOfGen = await prisma.pokemon.findMany({
      where: { generation: gen, rarity: 'LEGENDARY' },
      select: { id: true },
    });
    const ownedInGen = legendaryByGen.get(gen) ?? new Set();
    if (
      allLegendariesOfGen.length > 0 &&
      allLegendariesOfGen.every(p => ownedInGen.has(p.id))
    ) {
      await unlock(`legendary_gen${gen}`);
    }
  }

  // Generation complete badges
  const ownedByGen = new Map<number, Set<number>>();
  for (const p of ownedPokemons) {
    const gen = p.pokemon.generation;
    if (!ownedByGen.has(gen)) ownedByGen.set(gen, new Set());
    ownedByGen.get(gen)!.add(p.pokemon_id);
  }

  for (const gen of [1,2,3,4,5,6,7]) {
    const totalInGen = await prisma.pokemon.count({ where: { generation: gen } });
    const ownedInGen = ownedByGen.get(gen)?.size ?? 0;
    if (totalInGen > 0 && ownedInGen >= totalInGen) {
      await unlock(`gen${gen}_complete`);
    }
  }

  return newBadges;
}
