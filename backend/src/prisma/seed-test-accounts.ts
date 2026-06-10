// [DEV ONLY - NEVER MERGE] - seeds two fixed test accounts (full Pokédex,
// 99999 coins) so multi-player features (e.g. Battle lobby) can be tested
// locally without real EPITA accounts. Idempotent: safe to re-run.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEST_ACCOUNTS = [
  { ms_id: 'test-account-1', display_name: 'Test Account 1' },
  { ms_id: 'test-account-2', display_name: 'Test Account 2' },
];

async function seedAccount(account: { ms_id: string; display_name: string }): Promise<void> {
  const user = await prisma.user.upsert({
    where: { ms_id: account.ms_id },
    update: {},
    create: {
      ms_id: account.ms_id,
      display_name: account.display_name,
      coins: 99999,
      total_score: 0,
      trade_count: 0,
    },
  });

  const pokemons = await prisma.pokemon.findMany({ select: { id: true } });
  const owned = await prisma.userPokemon.findMany({
    where: { user_id: user.id },
    select: { pokemon_id: true },
  });
  const ownedIds = new Set(owned.map(o => o.pokemon_id));

  const missing = pokemons.filter(p => !ownedIds.has(p.id));
  if (missing.length > 0) {
    await prisma.userPokemon.createMany({
      data: missing.map(p => ({
        user_id: user.id,
        pokemon_id: p.id,
        source: 'draw',
        tradeable_at: null,
      })),
    });
  }

  console.log(`[seed] ${account.display_name} : ${pokemons.length} Pokémon (${missing.length} insérés, ${ownedIds.size} déjà présents)`);
}

async function main(): Promise<void> {
  for (const account of TEST_ACCOUNTS) {
    await seedAccount(account);
  }
}

main()
  .catch(err => {
    console.error('[seed] échec :', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
