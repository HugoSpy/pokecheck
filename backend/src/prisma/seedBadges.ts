import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BADGES = [
  // Streak
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
];

async function main() {
  // Fail fast if DB is unreachable
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    console.error('Cannot connect to database. Check DATABASE_URL and that PostgreSQL is running.');
    process.exit(1);
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
