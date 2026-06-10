import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function getGenFromId(id: number): number {
  if (id <= 151) return 1;
  if (id <= 251) return 2;
  if (id <= 386) return 3;
  if (id <= 493) return 4;
  if (id <= 649) return 5;
  if (id <= 721) return 6;
  return 7;
}

function computeRarityAndPoints(bst: number): { rarity: string; points: number } {
  if (bst < 300)  return { rarity: 'COMMON',    points: Math.round(1   + (bst / 300) * 199) };
  if (bst < 450)  return { rarity: 'RARE',      points: Math.round(201 + ((bst - 300) / 150) * 299) };
  if (bst <= 580) return { rarity: 'EPIC',      points: Math.round(501 + ((bst - 450) / 130) * 299) };
  return          { rarity: 'LEGENDARY', points: Math.round(801 + Math.min((bst - 580) / 200, 1) * 199) };
}

function applyPokemonOverrides(id: number, values: { bst: number; rarity: string; points: number }) {
  if (id === 132) {
    return { bst: 250, rarity: 'COMMON', points: 250 };
  }
  return values;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPokemon(id: number, retries = 3): Promise<{
  id: number;
  name: string;
  types: { type: { name: string } }[];
  stats: { base_stat: number }[];
}> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    if (res.status === 429 || res.status === 503) {
      if (attempt < retries) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      throw new Error(`PokeAPI rate-limited for #${id} after ${retries} retries`);
    }
    if (!res.ok) throw new Error(`PokeAPI returned ${res.status} for #${id}`);
    return res.json() as Promise<{
      id: number;
      name: string;
      types: { type: { name: string } }[];
      stats: { base_stat: number }[];
    }>;
  }
  throw new Error(`unreachable`);
}

async function main() {
  // Fail fast if DB is unreachable
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    console.error('Cannot connect to database. Check DATABASE_URL and that PostgreSQL is running.');
    process.exit(1);
  }

  const existing = await prisma.pokemon.findMany({ select: { id: true } });
  const existingIds = new Set(existing.map(p => p.id));
  const toFetch = Array.from({ length: 809 }, (_, i) => i + 1).filter(id => !existingIds.has(id));

  await prisma.pokemon.updateMany({
    where: { id: 132 },
    data: applyPokemonOverrides(132, { bst: 250, rarity: 'COMMON', points: 250 }),
  });

  console.log(`DB: ${existingIds.size} already seeded, ${toFetch.length} to fetch.`);
  if (toFetch.length === 0) {
    console.log('All 809 Pokémon already in DB - nothing to do.');
    return;
  }

  let seeded = 0;
  let failed = 0;

  for (const id of toFetch) {
    try {
      const data = await fetchPokemon(id);
      const rawBst = data.stats.reduce((sum, s) => sum + s.base_stat, 0);
      const { bst, rarity, points } = applyPokemonOverrides(id, {
        bst: rawBst,
        ...computeRarityAndPoints(rawBst),
      });
      const generation = getGenFromId(id);
      const types = data.types.map(t => t.type.name);
      const sprite_url = `https://img.pokemondb.net/sprites/home/normal/${data.name}.png`;

      await prisma.pokemon.upsert({
        where: { id },
        update: { name: data.name, generation, rarity, points, bst, sprite_url, types },
        create: { id, name: data.name, generation, rarity, points, bst, sprite_url, types },
      });

      seeded++;
      if (seeded % 50 === 0) console.log(`Progress: ${seeded}/${toFetch.length} seeded (id #${id})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Failed on #${id}: ${msg}`);
      failed++;
    }

    await sleep(300);
  }

  console.log(`\nDone: ${seeded} upserted, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
