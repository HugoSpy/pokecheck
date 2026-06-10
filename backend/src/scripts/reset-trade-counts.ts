// One-off PROD data fix: reset trade_count to 0 for two specific users
// (Alexandre Girold + Léandro Tolaini). Looks them up by ms_id (unique) and
// resets both inside a single transaction. Prints before/after for audit.
//
// Run from ~/pokecheck/backend:  npx ts-node --transpile-only src/scripts/reset-trade-counts.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ms_id is the unique Microsoft identifier - safer than display_name.
const TARGET_MS_IDS = [
  '139346e1-d975-4667-b56f-32a47daf7394', // Alexandre Girold
  'c30f8657-0546-420d-9913-66c117d2aecb', // Léandro Tolaini
];

async function main(): Promise<void> {
  const before = await prisma.user.findMany({
    where: { ms_id: { in: TARGET_MS_IDS } },
    select: { id: true, display_name: true, ms_id: true, trade_count: true },
  });

  console.log('BEFORE:');
  for (const u of before) console.log(`  ${u.display_name} (${u.id}) trade_count=${u.trade_count}`);

  if (before.length !== TARGET_MS_IDS.length) {
    throw new Error(`Expected ${TARGET_MS_IDS.length} users, found ${before.length} - aborting.`);
  }

  await prisma.$transaction(async (tx) => {
    for (const ms_id of TARGET_MS_IDS) {
      await tx.user.update({ where: { ms_id }, data: { trade_count: 0 } });
    }
  });

  const after = await prisma.user.findMany({
    where: { ms_id: { in: TARGET_MS_IDS } },
    select: { id: true, display_name: true, trade_count: true },
  });

  console.log('AFTER:');
  for (const u of after) console.log(`  ${u.display_name} (${u.id}) trade_count=${u.trade_count}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
