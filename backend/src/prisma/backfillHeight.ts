import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// PokeAPI returns `height` in decimetres - divide by 10 for metres.
async function fetchHeightM(id: number, retries = 3): Promise<number> {
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
    const data = (await res.json()) as { height: number };
    return data.height / 10;
  }
  throw new Error('unreachable');
}

async function main() {
  // Fail fast if DB is unreachable
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    console.error('Cannot connect to database. Check DATABASE_URL and that PostgreSQL is running.');
    process.exit(1);
  }

  // Only backfill rows still missing height_m so the script is safely re-runnable.
  const toFetch = await prisma.pokemon.findMany({
    where: { height_m: null },
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  console.log(`${toFetch.length} Pokémon missing height_m.`);
  if (toFetch.length === 0) {
    console.log('All Pokémon already have height_m - nothing to do.');
    return;
  }

  let updated = 0;
  let failed = 0;

  for (const { id } of toFetch) {
    try {
      const height_m = await fetchHeightM(id);
      await prisma.pokemon.update({ where: { id }, data: { height_m } });
      updated++;
      if (updated % 50 === 0) console.log(`Progress: ${updated}/${toFetch.length} (id #${id} → ${height_m}m)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Failed on #${id}: ${msg}`);
      failed++;
    }

    await sleep(300);
  }

  console.log(`\nDone: ${updated} updated, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
