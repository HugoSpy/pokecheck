import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { STARTER_EVO, RARITY_COLLECTION, GENERATION_COLLECTION_TIERS } from '../services/badgeService';

const prisma = new PrismaClient();

const BADGES = [
  // Streak
  { id: 'streak_1',   name: 'Première connexion',        description: 'Connecte-toi pour la première fois',                   category: 'streak',     coin_reward: 50    },
  { id: 'streak_7',   name: 'Premier pas',              description: 'Connecte-toi 7 jours de suite',                        category: 'streak',     coin_reward: 200   },
  { id: 'streak_14',  name: 'Habitué',                   description: 'Connecte-toi 14 jours de suite',                       category: 'streak',     coin_reward: 350   },
  { id: 'streak_30',  name: 'Régulier',                  description: 'Connecte-toi 30 jours de suite',                       category: 'streak',     coin_reward: 700   },
  { id: 'streak_50',  name: 'Hardcore',                  description: 'Connecte-toi 50 jours de suite',                       category: 'streak',     coin_reward: 1200  },
  { id: 'streak_100', name: "Légendaire de l'assiduité", description: 'Connecte-toi 100 jours de suite',                      category: 'streak',     coin_reward: 3000  },
  // Échanges
  { id: 'trade_1',    name: 'Commerçant débutant',       description: 'Complète ton premier échange',                         category: 'trade',      coin_reward: 25    },
  { id: 'trade_5',    name: 'Négociateur',               description: 'Complète 5 échanges',                                  category: 'trade',      coin_reward: 100   },
  { id: 'trade_15',   name: 'Trader',                    description: 'Complète 15 échanges',                                 category: 'trade',      coin_reward: 250   },
  { id: 'trade_30',   name: 'Broker',                    description: 'Complète 30 échanges',                                 category: 'trade',      coin_reward: 500   },
  { id: 'trade_100',  name: 'Magnat',                    description: 'Complète 100 échanges',                                category: 'trade',      coin_reward: 2000  },
  // Starters
  { id: 'starters_gen1', name: 'Trio Kanto',   description: 'Possède Bulbizarre, Salamèche et Carapuce',   category: 'starters', coin_reward: 500 },
  { id: 'starters_gen2', name: 'Trio Johto',   description: 'Possède Germignon, Héricendre et Totodile',   category: 'starters', coin_reward: 500 },
  { id: 'starters_gen3', name: 'Trio Hoenn',   description: 'Possède Arcko, Poussifeu et Gobou',           category: 'starters', coin_reward: 500 },
  { id: 'starters_gen4', name: 'Trio Sinnoh',  description: 'Possède Tortipouss, Ouisticram et Tiplouf',   category: 'starters', coin_reward: 500 },
  { id: 'starters_gen5', name: 'Trio Unova',   description: 'Possède Vipélierre, Gruikui et Moustillon',   category: 'starters', coin_reward: 500 },
  { id: 'starters_gen6', name: 'Trio Kalos',   description: 'Possède Marisson, Feunnec et Grenousse',      category: 'starters', coin_reward: 500 },
  { id: 'starters_gen7', name: 'Trio Alola',   description: 'Possède Brindibou, Flamiaou et Otaquin',      category: 'starters', coin_reward: 500 },
  // Types
  { id: 'all_types', name: 'Collectionneur de types', description: 'Possède au moins 1 Pokémon de chacun des 18 types', category: 'types', coin_reward: 1500 },
  // Légendaires
  { id: 'legendary_hunter', name: 'Chasseur de légendes', description: 'Possède au moins 1 légendaire de chaque génération', category: 'legendary', coin_reward: 800  },
  { id: 'legendary_gen1',   name: 'Maître Kanto',          description: 'Possède tous les légendaires Gen 1',                 category: 'legendary', coin_reward: 2000 },
  { id: 'legendary_gen2',   name: 'Maître Johto',          description: 'Possède tous les légendaires Gen 2',                 category: 'legendary', coin_reward: 2000 },
  { id: 'legendary_gen3',   name: 'Maître Hoenn',          description: 'Possède tous les légendaires Gen 3',                 category: 'legendary', coin_reward: 2000 },
  { id: 'legendary_gen4',   name: 'Maître Sinnoh',         description: 'Possède tous les légendaires Gen 4',                 category: 'legendary', coin_reward: 2000 },
  { id: 'legendary_gen5',   name: 'Maître Unova',          description: 'Possède tous les légendaires Gen 5',                 category: 'legendary', coin_reward: 2000 },
  { id: 'legendary_gen6',   name: 'Maître Kalos',          description: 'Possède tous les légendaires Gen 6',                 category: 'legendary', coin_reward: 2000 },
  { id: 'legendary_gen7',   name: 'Maître Alola',          description: 'Possède tous les légendaires Gen 7',                 category: 'legendary', coin_reward: 2000 },
  // Pokédex
  { id: 'pokedex_10',  name: 'Débutant',        description: 'Possède 10 Pokémon différents',  category: 'pokedex', coin_reward: 100   },
  { id: 'pokedex_50',  name: 'Explorateur',     description: 'Possède 50 Pokémon différents',  category: 'pokedex', coin_reward: 300   },
  { id: 'pokedex_150', name: 'Collectionneur',  description: 'Possède 150 Pokémon différents', category: 'pokedex', coin_reward: 700   },
  { id: 'pokedex_300', name: 'Expert',          description: 'Possède 300 Pokémon différents', category: 'pokedex', coin_reward: 1500  },
  { id: 'pokedex_500', name: 'Maître Pokémon',  description: 'Possède 500 Pokémon différents', category: 'pokedex', coin_reward: 3000  },
  { id: 'pokedex_809', name: 'Pokédex Complet', description: 'Possède les 809 espèces',        category: 'pokedex', coin_reward: 10000 },
  // Générations complètes
  { id: 'gen1_complete', name: 'Complétion Kanto',  description: 'Possède les 151 Pokémon de Kanto',  category: 'generation', coin_reward: 5000 },
  { id: 'gen2_complete', name: 'Complétion Johto',  description: 'Possède les 100 Pokémon de Johto',  category: 'generation', coin_reward: 5000 },
  { id: 'gen3_complete', name: 'Complétion Hoenn',  description: 'Possède les 135 Pokémon de Hoenn',  category: 'generation', coin_reward: 5000 },
  { id: 'gen4_complete', name: 'Complétion Sinnoh', description: 'Possède les 107 Pokémon de Sinnoh', category: 'generation', coin_reward: 5000 },
  { id: 'gen5_complete', name: 'Complétion Unova',  description: 'Possède les 156 Pokémon de Unova',  category: 'generation', coin_reward: 5000 },
  { id: 'gen6_complete', name: 'Complétion Kalos',  description: 'Possède les 72 Pokémon de Kalos',   category: 'generation', coin_reward: 5000 },
  { id: 'gen7_complete', name: 'Complétion Alola',  description: 'Possède les 88 Pokémon de Alola',   category: 'generation', coin_reward: 5000 },
  // Battle (victoires en Battle de caisse)
  { id: 'battle_first_win', name: 'Baptême du Feu',      description: 'Remporte ta première battle',  category: 'battle', coin_reward: 100  },
  { id: 'battle_5_wins',    name: 'Combattant',          description: 'Remporte 5 battles',           category: 'battle', coin_reward: 300  },
  { id: 'battle_10_wins',   name: 'Guerrier',            description: 'Remporte 10 battles',          category: 'battle', coin_reward: 600  },
  { id: 'battle_25_wins',   name: 'Vétéran',             description: 'Remporte 25 battles',          category: 'battle', coin_reward: 1200 },
  { id: 'battle_50_wins',   name: 'Champion de Battle',  description: 'Remporte 50 battles',          category: 'battle', coin_reward: 2500 },
  // Marché
  { id: 'market_sell_1',  name: 'Premier Vendeur',  description: 'Vends 1 Pokémon sur le marché',   category: 'market', coin_reward: 50   },
  { id: 'market_sell_10', name: 'Marchand',         description: 'Vends 10 Pokémon sur le marché',  category: 'market', coin_reward: 200  },
  { id: 'market_sell_50', name: 'Baron du Marché',  description: 'Vends 50 Pokémon sur le marché',  category: 'market', coin_reward: 1000 },
  { id: 'market_buy_1',   name: 'Premier Achat',    description: 'Achète 1 Pokémon sur le marché',  category: 'market', coin_reward: 50   },
  { id: 'market_buy_10',  name: 'Acheteur Régulier', description: 'Achète 10 Pokémon sur le marché', category: 'market', coin_reward: 200 },
  // Shinies
  { id: 'shiny_1',  name: 'Première Étoile',              description: 'Possède 1 Pokémon shiny',             category: 'shiny', coin_reward: 200  },
  { id: 'shiny_5',  name: 'Collectionneur Chromatique',   description: 'Possède 5 Pokémon shiny distincts',   category: 'shiny', coin_reward: 700  },
  { id: 'shiny_10', name: 'Chasseur Chromatique',         description: 'Possède 10 Pokémon shiny distincts',  category: 'shiny', coin_reward: 1500 },
];

// ── Type collection badges (3 tiers × 18 types = 54), generated programmatically.
// `art` is the French partitive article (with its trailing space, or apostrophe
// for "de l'") so the name reads naturally per type's gender/initial.
const TYPE_BADGE_TYPES: Array<{ key: string; fr: string; art: string }> = [
  { key: 'normal',   fr: 'Normal',   art: 'du '   },
  { key: 'fire',     fr: 'Feu',      art: 'du '   },
  { key: 'water',    fr: 'Eau',      art: "de l'" },
  { key: 'electric', fr: 'Électrik', art: "de l'" },
  { key: 'grass',    fr: 'Plante',   art: 'de la ' },
  { key: 'ice',      fr: 'Glace',    art: 'de la ' },
  { key: 'fighting', fr: 'Combat',   art: 'du '   },
  { key: 'poison',   fr: 'Poison',   art: 'du '   },
  { key: 'ground',   fr: 'Sol',      art: 'du '   },
  { key: 'flying',   fr: 'Vol',      art: 'du '   },
  { key: 'psychic',  fr: 'Psy',      art: 'du '   },
  { key: 'bug',      fr: 'Insecte',  art: "de l'" },
  { key: 'rock',     fr: 'Roche',    art: 'de la ' },
  { key: 'ghost',    fr: 'Spectre',  art: 'du '   },
  { key: 'dragon',   fr: 'Dragon',   art: 'du '   },
  { key: 'dark',     fr: 'Ténèbres', art: 'des '  },
  { key: 'steel',    fr: 'Acier',    art: "de l'" },
  { key: 'fairy',    fr: 'Fée',      art: 'de la ' },
];

const TYPE_BADGE_TIERS = [
  { threshold: 5,  prefix: 'Amateur',        coins: 75  },
  { threshold: 10, prefix: 'Collectionneur', coins: 200 },
  { threshold: 25, prefix: 'Chercheur',      coins: 400 },
];

for (const t of TYPE_BADGE_TYPES) {
  for (const tier of TYPE_BADGE_TIERS) {
    BADGES.push({
      id: `type_${t.key}_${tier.threshold}`,
      name: `${tier.prefix} ${t.art}${t.fr}`,
      description: `Possède ${tier.threshold} espèces distinctes de type ${t.fr}`,
      category: 'types',
      coin_reward: tier.coins,
    });
  }
}

// ── Rarity collection badges (15): distinct species per rarity ──
const RARITY_BADGE_DEFS: Array<{ key: string; fr: string }> = [
  { key: 'common',    fr: 'Communs'     },
  { key: 'rare',      fr: 'Rares'       },
  { key: 'epic',      fr: 'Épiques'     },
  { key: 'legendary', fr: 'Légendaires' },
];
const RARITY_TIER_META: Record<number, { prefix: string; coins: Record<string, number> }> = {
  5:  { prefix: 'Amateur des',         coins: { common: 50,  rare: 75,   epic: 100,  legendary: 150  } },
  10: { prefix: 'Collectionneur des',  coins: { common: 150, rare: 200,  epic: 300,  legendary: 500  } },
  25: { prefix: 'Expert des',          coins: { common: 300, rare: 500,  epic: 800,  legendary: 1500 } },
  50: { prefix: 'Maître des',          coins: { common: 600, rare: 1000, epic: 2000, legendary: 5000 } },
};
for (const { key, fr } of RARITY_BADGE_DEFS) {
  for (const tier of RARITY_COLLECTION[key.toUpperCase()]) {
    const meta = RARITY_TIER_META[tier];
    BADGES.push({
      id: `rarity_${key}_${tier}`,
      name: `${meta.prefix} ${fr}`,
      description: `Possède ${tier} Pokémon ${fr} distincts`,
      category: 'rarity',
      coin_reward: meta.coins[key],
    });
  }
}

async function main() {
  // Fail fast if DB is unreachable
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    console.error('Cannot connect to database. Check DATABASE_URL and that PostgreSQL is running.');
    process.exit(1);
  }

  // Starter evolution lineage badges (21) — named after the base starter using
  // the FR name from the Pokemon table, e.g. "Lignée Salamèche".
  const evoBaseIds = Object.values(STARTER_EVO).map(ids => ids[0]);
  const evoBaseNames = new Map(
    (await prisma.pokemon.findMany({ where: { id: { in: evoBaseIds } }, select: { id: true, name: true } }))
      .map(p => [p.id, p.name]),
  );
  for (const [id, ids] of Object.entries(STARTER_EVO)) {
    const baseName = evoBaseNames.get(ids[0]) ?? `#${ids[0]}`;
    BADGES.push({
      id,
      name: `Lignée ${baseName}`,
      description: `Possède toutes les évolutions de ${baseName}`,
      category: 'starter_evo',
      coin_reward: 600,
    });
  }

  // Generation collection badges — distinct species per region. Tier 100 is
  // gated on the real per-gen species count read from the DB (gens 6/7 < 100).
  const REGIONS: Record<number, string> = { 1: 'Kanto', 2: 'Johto', 3: 'Hoenn', 4: 'Sinnoh', 5: 'Unova', 6: 'Kalos', 7: 'Alola' };
  const GEN_TIER_PREFIX: Record<number, string> = { 10: 'Explorateur', 25: 'Voyageur', 50: 'Habitué', 100: 'Expert' };
  const GEN_TIER_COINS: Record<number, number> = { 10: 100, 25: 250, 50: 500, 100: 1200 };
  const genCounts = await prisma.pokemon.groupBy({ by: ['generation'], _count: { id: true } });
  const genTotal = new Map(genCounts.map(g => [g.generation, g._count.id]));
  for (let gen = 1; gen <= 7; gen++) {
    const region = REGIONS[gen];
    const elision = /^[AEIOU]/i.test(region) ? "d'" : 'de ';
    for (const tier of GENERATION_COLLECTION_TIERS) {
      if (tier === 100 && (genTotal.get(gen) ?? 0) < 100) continue;
      BADGES.push({
        id: `gen${gen}_${tier}`,
        name: `${GEN_TIER_PREFIX[tier]} ${elision}${region}`,
        description: `Possède ${tier} espèces distinctes ${elision}${region}`,
        category: 'region',
        coin_reward: GEN_TIER_COINS[tier],
      });
    }
  }

  console.log(`Seeding ${BADGES.length} badges...`);
  for (const badge of BADGES) {
    await prisma.badge.upsert({
      where: { id: badge.id },
      update: { name: badge.name, description: badge.description, coin_reward: badge.coin_reward },
      create: badge,
    });
    process.stdout.write('.');
  }
  console.log(`\nDone — ${BADGES.length} badges upserted.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
