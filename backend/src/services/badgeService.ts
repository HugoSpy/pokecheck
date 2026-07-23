import { prisma } from '../lib/prisma';


export const STARTERS: Record<string, number[]> = {
  starters_gen1: [1, 4, 7],
  starters_gen2: [152, 155, 158],
  starters_gen3: [252, 255, 258],
  starters_gen4: [387, 390, 393],
  starters_gen5: [495, 498, 501],
  starters_gen6: [650, 653, 656],
  starters_gen7: [722, 725, 728],
};

// Full starter evolution lineages - own all 3 stages. base = first id (used for
// the badge's French name in seedBadges.ts). id format: starter_evo_{type}_gen{n}.
export const STARTER_EVO: Record<string, number[]> = {
  starter_evo_fire_gen1:  [4, 5, 6],     starter_evo_water_gen1: [7, 8, 9],     starter_evo_grass_gen1: [1, 2, 3],
  starter_evo_fire_gen2:  [155, 156, 157], starter_evo_water_gen2: [158, 159, 160], starter_evo_grass_gen2: [152, 153, 154],
  starter_evo_fire_gen3:  [255, 256, 257], starter_evo_water_gen3: [258, 259, 260], starter_evo_grass_gen3: [252, 253, 254],
  starter_evo_fire_gen4:  [390, 391, 392], starter_evo_water_gen4: [393, 394, 395], starter_evo_grass_gen4: [387, 388, 389],
  starter_evo_fire_gen5:  [498, 499, 500], starter_evo_water_gen5: [501, 502, 503], starter_evo_grass_gen5: [495, 496, 497],
  starter_evo_fire_gen6:  [653, 654, 655], starter_evo_water_gen6: [656, 657, 658], starter_evo_grass_gen6: [650, 651, 652],
  starter_evo_fire_gen7:  [725, 726, 727], starter_evo_water_gen7: [728, 729, 730], starter_evo_grass_gen7: [722, 723, 724],
};

// Trainer team badges - own at least one instance of every species on a famous
// trainer's team. `one_of` (optional) requires owning at least one id from that
// list IN ADDITION to all required_pokemon_ids - used by N, whose team counts as
// complete with either Reshiram (643) OR Zekrom (644).
export const TRAINER_BADGES: Array<{ id: string; required_pokemon_ids: number[]; one_of?: number[] }> = [
  { id: 'trainer_red',      required_pokemon_ids: [3, 6, 9, 25, 131, 143] },
  { id: 'trainer_cynthia',  required_pokemon_ids: [350, 407, 442, 445, 448, 468] },
  { id: 'trainer_misty',    required_pokemon_ids: [54, 120, 121, 175, 183, 230] },
  { id: 'trainer_n',        required_pokemon_ids: [565, 567, 571, 584, 601], one_of: [643, 644] },
  { id: 'trainer_brock',    required_pokemon_ids: [74, 95, 42, 37, 204, 453] },
  { id: 'trainer_giovanni', required_pokemon_ids: [31, 34, 51, 53, 112] },
];

export const BATTLE_BADGES: Array<{ id: string; threshold: number }> = [
  { id: 'battle_first_win', threshold: 1  },
  { id: 'battle_5_wins',    threshold: 5  },
  { id: 'battle_10_wins',   threshold: 10 },
  { id: 'battle_25_wins',   threshold: 25 },
  { id: 'battle_50_wins',   threshold: 50 },
];

export const MARKET_SELL_BADGES: Array<{ id: string; threshold: number }> = [
  { id: 'market_sell_1',  threshold: 1  },
  { id: 'market_sell_10', threshold: 10 },
  { id: 'market_sell_50', threshold: 50 },
];

export const MARKET_BUY_BADGES: Array<{ id: string; threshold: number }> = [
  { id: 'market_buy_1',  threshold: 1  },
  { id: 'market_buy_10', threshold: 10 },
];

export const SHINY_BADGES: Array<{ id: string; threshold: number }> = [
  { id: 'shiny_1',  threshold: 1  },
  { id: 'shiny_5',  threshold: 5  },
  { id: 'shiny_10', threshold: 10 },
];

export const STREAK_BADGES: Array<{ id: string; threshold: number }> = [
  { id: 'streak_1',   threshold: 1   },
  { id: 'streak_7',   threshold: 7   },
  { id: 'streak_14',  threshold: 14  },
  { id: 'streak_30',  threshold: 30  },
  { id: 'streak_50',  threshold: 50  },
  { id: 'streak_100', threshold: 100 },
];

export const TRADE_BADGES: Array<{ id: string; threshold: number }> = [
  { id: 'trade_1',   threshold: 1   },
  { id: 'trade_5',   threshold: 5   },
  { id: 'trade_15',  threshold: 15  },
  { id: 'trade_30',  threshold: 30  },
  { id: 'trade_100', threshold: 100 },
];

export const POKEDEX_BADGES: Array<{ id: string; threshold: number }> = [
  { id: 'pokedex_10',  threshold: 10  },
  { id: 'pokedex_50',  threshold: 50  },
  { id: 'pokedex_100', threshold: 100 },
  { id: 'pokedex_150', threshold: 150 },
  { id: 'pokedex_200', threshold: 200 },
  { id: 'pokedex_300', threshold: 300 },
  { id: 'pokedex_400', threshold: 400 },
  { id: 'pokedex_500', threshold: 500 },
  { id: 'pokedex_600', threshold: 600 },
  { id: 'pokedex_700', threshold: 700 },
  { id: 'pokedex_809', threshold: 809 },
];

export const GEN_COUNT: Record<number, number> = {
  1: 151, 2: 100, 3: 135, 4: 107, 5: 156, 6: 72, 7: 88,
};

export const ALL_TYPES = [
  'normal','fire','water','electric','grass','ice',
  'fighting','poison','ground','flying','psychic','bug',
  'rock','ghost','dragon','dark','steel','fairy',
];

export const TYPE_BADGE_TIERS = [5, 10, 25];

// Lategame distinct-species-per-type tiers, beyond the 5/10/25 midgame set. Only
// tiers reachable given the Gen 1-7 species count per type are listed (validated
// against pokeschool_dev). id format: type_{type}_{tier}. Types absent here (or
// with an empty list) get only the "complete" badge below.
export const TYPE_LATEGAME_TIERS: Record<string, number[]> = {
  water:    [50, 75, 100],
  normal:   [50, 75, 100],
  flying:   [50, 75],
  grass:    [50, 75],
  psychic:  [50, 75],
  bug:      [50, 75],
  poison:   [50],
  ground:   [50],
  fire:     [50],
  rock:     [50],
  fighting: [50],
  // steel, electric, fairy, dark, dragon, ghost, ice: < 50 species → no tier
};

// "Complete the type" - threshold is the exact distinct-species count of that
// type in Gen 1-7 (validated against pokeschool_dev). Every type gets one.
// id format: type_{type}_all.
export const TYPE_TOTAL: Record<string, number> = {
  water: 131, normal: 109, flying: 98, grass: 97, psychic: 82, bug: 77,
  poison: 66, ground: 64, fire: 64, rock: 60, fighting: 54,
  steel: 49, electric: 48, fairy: 47, dark: 46, dragon: 45, ghost: 43, ice: 34,
};

// Distinct-species-per-rarity tiers. Commun has no tier-5 badge (too easy).
// id format: rarity_{rarity-lowercase}_{tier}.
export const RARITY_COLLECTION: Record<string, number[]> = {
  COMMON:    [10, 25, 50],
  RARE:      [5, 10, 25, 50],
  EPIC:      [5, 10, 25, 50],
  LEGENDARY: [5, 10, 25, 50],
};

// Lategame distinct-species-per-rarity tiers, beyond the 5/10/25/50 midgame set
// above. Only tiers reachable given the Gen 1-7 species count per rarity are
// listed (COMMON tops out at 113, LEGENDARY at 50 → no ≥100 tier).
// id format: rarity_{rarity-lowercase}_{tier}.
export const RARITY_LATEGAME_TIERS: Record<string, number[]> = {
  COMMON:    [100],
  RARE:      [100, 150, 200, 250, 300],
  EPIC:      [100, 150, 200, 250, 300],
  LEGENDARY: [],
};

// "Collect them all" per rarity - threshold is the exact distinct-species count
// of that rarity in Gen 1-7 (validated against pokeschool_dev). id format:
// rarity_{rarity-lowercase}_all. NOTE: rarity_legendary_all shares its threshold
// (50) with the existing rarity_legendary_50 tier since there are exactly 50
// legendaries - both unlock on the same action.
export const RARITY_TOTAL: Record<string, number> = {
  COMMON:    113,
  RARE:      310,
  EPIC:      336,
  LEGENDARY: 50,
};

// Distinct-species-per-generation tiers. Tier 100 only applies to generations
// that actually have ≥100 species (gens 6/7 don't). id format: gen{N}_{tier}.
export const GENERATION_COLLECTION_TIERS = [10, 25, 50, 100];

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
    // Fire-and-forget notification
    prisma.notification.create({
      data: {
        user_id: userId,
        type: 'BADGE',
        payload: {
          badgeName: badge.name,
          badgeDescription: badge.description,
          badgeIcon: badge.icon_url ?? null,
        },
      },
    }).catch(() => {});
    return badgeId;
  } catch {
    return null;
  }
}

export async function checkBadges(userId: string): Promise<string[]> {
  const [user, existingBadges, ownedPokemons, battleWins, marketSold, marketBought] = await Promise.all([
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
        is_shiny: true,
        pokemon: { select: { generation: true, rarity: true, types: true } },
      },
    }),
    prisma.battleRecord.count({ where: { winner_id: userId } }),
    prisma.marketListing.count({ where: { seller_id: userId, status: 'sold' } }),
    prisma.marketListing.count({ where: { buyer_id: userId, status: 'sold' } }),
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

  // Battle win badges (BattleRecord.winner_id === userId)
  for (const { id, threshold } of BATTLE_BADGES) {
    if (battleWins >= threshold) await unlock(id);
  }

  // Market badges - completed sales (as seller) / purchases (as buyer)
  for (const { id, threshold } of MARKET_SELL_BADGES) {
    if (marketSold >= threshold) await unlock(id);
  }
  for (const { id, threshold } of MARKET_BUY_BADGES) {
    if (marketBought >= threshold) await unlock(id);
  }

  // Build helper sets
  const ownedPokemonIds = new Set(ownedPokemons.map(p => p.pokemon_id));
  const distinctPokemonCount = ownedPokemonIds.size;

  // Shiny badges - distinct shiny species owned
  const shinySpecies = new Set(ownedPokemons.filter(p => p.is_shiny).map(p => p.pokemon_id));
  for (const { id, threshold } of SHINY_BADGES) {
    if (shinySpecies.size >= threshold) await unlock(id);
  }

  // Rarity collection badges - distinct species owned per rarity
  const speciesByRarity = new Map<string, Set<number>>();
  for (const p of ownedPokemons) {
    const r = p.pokemon.rarity;
    (speciesByRarity.get(r) ?? speciesByRarity.set(r, new Set()).get(r)!).add(p.pokemon_id);
  }
  for (const [rarity, tiers] of Object.entries(RARITY_COLLECTION)) {
    const count = speciesByRarity.get(rarity)?.size ?? 0;
    for (const tier of tiers) {
      if (count >= tier) await unlock(`rarity_${rarity.toLowerCase()}_${tier}`);
    }
  }

  // Lategame rarity tiers (100+) and "collect them all" per rarity
  for (const [rarity, tiers] of Object.entries(RARITY_LATEGAME_TIERS)) {
    const count = speciesByRarity.get(rarity)?.size ?? 0;
    for (const tier of tiers) {
      if (count >= tier) await unlock(`rarity_${rarity.toLowerCase()}_${tier}`);
    }
  }
  for (const [rarity, total] of Object.entries(RARITY_TOTAL)) {
    const count = speciesByRarity.get(rarity)?.size ?? 0;
    if (count >= total) await unlock(`rarity_${rarity.toLowerCase()}_all`);
  }

  // Pokédex size badges
  for (const { id, threshold } of POKEDEX_BADGES) {
    if (distinctPokemonCount >= threshold) await unlock(id);
  }

  // Starters badges
  for (const [badgeId, ids] of Object.entries(STARTERS)) {
    if (ids.every(id => ownedPokemonIds.has(id))) await unlock(badgeId);
  }

  // Starter evolution lineage badges (own all 3 stages)
  for (const [badgeId, ids] of Object.entries(STARTER_EVO)) {
    if (ids.every(id => ownedPokemonIds.has(id))) await unlock(badgeId);
  }

  // Trainer team badges - own every species on the team. N additionally needs
  // one of his box legendaries (one_of). All checks hit the in-memory set, no
  // extra query.
  for (const tb of TRAINER_BADGES) {
    const hasTeam = tb.required_pokemon_ids.every(id => ownedPokemonIds.has(id));
    const hasOneOf = !tb.one_of || tb.one_of.some(id => ownedPokemonIds.has(id));
    if (hasTeam && hasOneOf) await unlock(tb.id);
  }

  // All 18 types badge
  const ownedTypes = new Set(ownedPokemons.flatMap(p => p.pokemon.types));
  if (ALL_TYPES.every(t => ownedTypes.has(t))) await unlock('all_types');

  // Type collection badges - distinct species owned per type, 5/10/25 tiers.
  // Grouped in-memory from ownedPokemons (which already includes types), so all
  // 18 types × 3 tiers are checked without any extra DB query.
  const speciesByType = new Map<string, Set<number>>();
  for (const p of ownedPokemons) {
    for (const type of p.pokemon.types) {
      let set = speciesByType.get(type);
      if (!set) { set = new Set(); speciesByType.set(type, set); }
      set.add(p.pokemon_id);
    }
  }
  for (const type of ALL_TYPES) {
    const distinctCount = speciesByType.get(type)?.size ?? 0;
    for (const threshold of TYPE_BADGE_TIERS) {
      if (distinctCount >= threshold) await unlock(`type_${type}_${threshold}`);
    }
    // Lategame type tiers (50/75/100, per-type) and "complete the type" badge
    for (const tier of TYPE_LATEGAME_TIERS[type] ?? []) {
      if (distinctCount >= tier) await unlock(`type_${type}_${tier}`);
    }
    const total = TYPE_TOTAL[type];
    if (total !== undefined && distinctCount >= total) await unlock(`type_${type}_all`);
  }

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
    // Generation collection tiers - distinct species in the gen. Tier 100 only
    // exists for gens that actually have ≥100 species.
    for (const tier of GENERATION_COLLECTION_TIERS) {
      if (tier === 100 && totalInGen < 100) continue;
      if (ownedInGen >= tier) await unlock(`gen${gen}_${tier}`);
    }
  }

  return newBadges;
}
