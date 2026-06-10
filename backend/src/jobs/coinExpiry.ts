import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const expiryDays = parseInt(process.env.COIN_EXPIRY_DAYS ?? '14', 10);
  const cutoff = new Date(Date.now() - expiryDays * 24 * 60 * 60 * 1000);

  const usersToExpire = await prisma.user.findMany({
    where: {
      coins: { gt: 0 },
      OR: [
        { last_login: { lt: cutoff } },
        { last_login: null },
      ],
    },
    select: { id: true, coins: true },
  });

  for (const user of usersToExpire) {
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { coins: 0 } }),
      prisma.coinTransaction.create({ data: { user_id: user.id, amount: -user.coins, reason: 'expiry' } }),
    ]);
  }

  console.log(`[coinExpiry] ${new Date().toISOString()} - ${usersToExpire.length} user(s) had coins reset (inactive > ${expiryDays} days)`);
}

main()
  .catch(e => { console.error('[coinExpiry] Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
