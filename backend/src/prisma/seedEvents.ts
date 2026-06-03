import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EVENT_DURATION_DAYS = 30;
const POKEMON_POOL = Array.from({ length: 809 }, (_, index) => index + 1);

const SHINY_SURGE_EVENT = {
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

async function seedShinySurge(): Promise<void> {
  const startsAt = new Date();
  const endsAt = new Date(startsAt);
  endsAt.setDate(endsAt.getDate() + EVENT_DURATION_DAYS);

  const existing = await prisma.event.findFirst({
    where: { name: SHINY_SURGE_EVENT.name },
    select: { id: true },
  });

  const data = {
    ...SHINY_SURGE_EVENT,
    starts_at: startsAt,
    ends_at: endsAt,
  };

  if (existing) {
    await prisma.event.update({
      where: { id: existing.id },
      data,
    });
    console.log(`Updated event: ${SHINY_SURGE_EVENT.name}`);
    return;
  }

  await prisma.event.create({ data });
  console.log(`Created event: ${SHINY_SURGE_EVENT.name}`);
}

async function main(): Promise<void> {
  await seedShinySurge();
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
