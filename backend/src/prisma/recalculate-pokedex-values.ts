import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { recalculateUserPokedexValue } from '../services/pokedexValue';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const users = await prisma.user.findMany({
    select: { id: true, display_name: true, total_score: true },
    orderBy: { display_name: 'asc' },
  });

  let changed = 0;

  for (const user of users) {
    const nextScore = await recalculateUserPokedexValue(prisma, user.id);
    if (nextScore !== user.total_score) changed += 1;
    console.log(`${user.display_name}: ${user.total_score} -> ${nextScore}`);
  }

  console.log(`Recalculated ${users.length} users, updated ${changed} incorrect values.`);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
