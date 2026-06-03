/// <reference types="node" />

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_EVENT_NAME = 'Shiny Surge';
const DRAW_COUNT = 10_000;
const BASE_SHINY_RATE = 1 / 4096;
const RARITIES = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const;

type Rarity = (typeof RARITIES)[number];
type RarityCounts = Record<Rarity, number>;

const BASE_RATES: Record<Rarity, number> = {
  COMMON: 79.5,
  RARE: 15,
  EPIC: 5,
  LEGENDARY: 0.5,
};

function assertDevDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is missing.');
  }

  const dbName = new URL(databaseUrl).pathname.replace(/^\//, '');
  if (dbName !== 'pokeschool_dev') {
    throw new Error(`Refusing to run on database "${dbName}". Expected "pokeschool_dev".`);
  }
}

function buildWeightedRates(multipliers: Record<string, number>): Record<Rarity, number> {
  return RARITIES.reduce((rates, rarity) => {
    rates[rarity] = BASE_RATES[rarity] * (multipliers[rarity] ?? 1.0);
    return rates;
  }, {} as Record<Rarity, number>);
}

function pickRarity(weightedRates: Record<Rarity, number>): Rarity {
  const totalWeight = Object.values(weightedRates).reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * totalWeight;

  for (const rarity of RARITIES) {
    roll -= weightedRates[rarity];
    if (roll < 0) return rarity;
  }

  return 'COMMON';
}

function rollShiny(multiplier: number | undefined): boolean {
  const shinyRate = Math.min(BASE_SHINY_RATE * (multiplier ?? 1.0), 1);
  return Math.random() < shinyRate;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(3)}%`;
}

function printRarityStats(counts: RarityCounts): void {
  console.log('\nRarity distribution:');
  for (const rarity of RARITIES) {
    const pct = counts[rarity] / DRAW_COUNT;
    console.log(`  ${rarity.padEnd(9)} ${String(counts[rarity]).padStart(5)}  ${formatPercent(pct)}`);
  }
}

async function main(): Promise<void> {
  assertDevDatabase();

  const eventName = process.argv.slice(2).join(' ') || DEFAULT_EVENT_NAME;
  const event = await prisma.event.findFirst({
    where: { name: eventName },
  });

  if (!event) {
    throw new Error(`Event "${eventName}" not found.`);
  }

  if (event.pokemon_pool.length === 0) {
    throw new Error(`Event "${eventName}" has an empty pokemon_pool.`);
  }

  const multipliers = event.rarity_multiplier as Record<string, number>;
  const weightedRates = buildWeightedRates(multipliers);

  const pokemonByRarity = await Promise.all(
    RARITIES.map(rarity => prisma.pokemon.findMany({
      where: { id: { in: event.pokemon_pool }, rarity },
      select: { id: true, rarity: true },
    })),
  );
  const pools = RARITIES.reduce((byRarity, rarity, index) => {
    byRarity[rarity] = pokemonByRarity[index];
    return byRarity;
  }, {} as Record<Rarity, Array<{ id: number; rarity: string }>>);
  const allPool = RARITIES.flatMap(rarity => pools[rarity]);

  if (allPool.length === 0) {
    throw new Error(`Event "${eventName}" has no available Pokemon in its pool.`);
  }

  const counts: RarityCounts = {
    COMMON: 0,
    RARE: 0,
    EPIC: 0,
    LEGENDARY: 0,
  };
  let shinyCount = 0;

  for (let i = 0; i < DRAW_COUNT; i++) {
    const pickedRarity = pickRarity(weightedRates);
    const candidates = pools[pickedRarity].length > 0 ? pools[pickedRarity] : allPool;
    const pokemon = candidates[Math.floor(Math.random() * candidates.length)];
    const actualRarity = RARITIES.includes(pokemon.rarity as Rarity)
      ? pokemon.rarity as Rarity
      : 'COMMON';

    counts[actualRarity]++;
    if (rollShiny(multipliers.SHINY)) {
      shinyCount++;
    }
  }

  const expectedShinyRate = Math.min(BASE_SHINY_RATE * (multipliers.SHINY ?? 1.0), 1);

  console.log(`Event: ${event.name}`);
  console.log(`Draws: ${DRAW_COUNT.toLocaleString()}`);
  console.log(`Pokemon pool: ${event.pokemon_pool.length.toLocaleString()} ids, ${allPool.length.toLocaleString()} available`);
  console.log(`Rarity multipliers: ${JSON.stringify(multipliers)}`);

  printRarityStats(counts);

  console.log('\nShiny:');
  console.log(`  observed ${String(shinyCount).padStart(5)}  ${formatPercent(shinyCount / DRAW_COUNT)}`);
  console.log(`  expected        ${formatPercent(expectedShinyRate)} (base ${formatPercent(BASE_SHINY_RATE)} x${multipliers.SHINY ?? 1.0})`);
  console.log(`  total shinies   ${shinyCount}/${DRAW_COUNT.toLocaleString()}`);
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
