import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EVENT_DURATION_DAYS = 30;
const POKEMON_POOL = Array.from({ length: 809 }, (_, index) => index + 1);

type EventConfig = {
  name: string;
  pokemon_pool: number[];
  rarity_multiplier: Record<string, number>;
  price: number;
  published: boolean;
};

const SHINY_SURGE_EVENT: EventConfig = {
  name: 'Shiny Surge',
  pokemon_pool: POKEMON_POOL,
  rarity_multiplier: {
    COMMON: 1.0,
    RARE: 1.0,
    EPIC: 1.0,
    LEGENDARY: 1.0,
    SHINY: 10.0,
  },
  price: 500,
  published: true,
};

// Idempotent upsert by event name: refreshes the 30-day window and config on
// every run, creating the event the first time.
async function upsertEvent(config: EventConfig): Promise<void> {
  const startsAt = new Date();
  const endsAt = new Date(startsAt);
  endsAt.setDate(endsAt.getDate() + EVENT_DURATION_DAYS);

  const existing = await prisma.event.findFirst({
    where: { name: config.name },
    select: { id: true },
  });

  const data = {
    ...config,
    starts_at: startsAt,
    ends_at: endsAt,
  };

  if (existing) {
    await prisma.event.update({ where: { id: existing.id }, data });
    console.log(`Updated event: ${config.name}`);
    return;
  }

  await prisma.event.create({ data });
  console.log(`Created event: ${config.name}`);
}

// Canicule: free daily pack pool of every Fire-type Pokémon (primary or
// secondary type). No rarity boost - all multipliers at 1.0.
async function seedCanicule(): Promise<void> {
  const fireMons = await prisma.pokemon.findMany({
    where: { types: { has: 'fire' } },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  const pool = fireMons.map(p => p.id);
  console.log(`Canicule pool: ${pool.length} Fire-type Pokémon`);

  await upsertEvent({
    name: 'Canicule',
    pokemon_pool: pool,
    rarity_multiplier: { COMMON: 1.0, RARE: 1.0, EPIC: 1.0, LEGENDARY: 1.0 },
    price: 500,
    published: true,
  });
}

async function main(): Promise<void> {
  await upsertEvent(SHINY_SURGE_EVENT);
  await seedCanicule();
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
