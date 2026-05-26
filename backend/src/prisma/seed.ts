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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPokemon(id: number) {
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch pokemon ${id}: ${res.status}`);
  return res.json() as Promise<{
    id: number;
    name: string;
    types: { type: { name: string } }[];
    stats: { base_stat: number }[];
  }>;
}

async function main() {
  console.log('Starting Pokémon seed (Gen 1–7, ids 1–809)...');
  let seeded = 0;
  let failed = 0;

  for (let id = 1; id <= 809; id++) {
    try {
      const data = await fetchPokemon(id);
      const bst = data.stats.reduce((sum: number, s: { base_stat: number }) => sum + s.base_stat, 0);
      const { rarity, points } = computeRarityAndPoints(bst);
      const generation = getGenFromId(id);
      const types = data.types.map((t: { type: { name: string } }) => t.type.name);
      const sprite_url = `https://img.pokemondb.net/sprites/home/normal/${data.name}.png`;

      await prisma.pokemon.upsert({
        where: { id },
        update: { name: data.name, generation, rarity, points, bst, sprite_url, types },
        create: { id, name: data.name, generation, rarity, points, bst, sprite_url, types },
      });

      seeded++;
      if (id % 50 === 0) console.log(`Progress: ${id}/809`);
    } catch (err) {
      console.error(`Failed on #${id}:`, err);
      failed++;
    }

    await sleep(300);
  }

  console.log(`Seed complete: ${seeded} upserted, ${failed} failed.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
