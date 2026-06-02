import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const expiryDays = parseInt(process.env.COIN_EXPIRY_DAYS ?? '14', 10);
  const cutoff = new Date(Date.now() - expiryDays * 24 * 60 * 60 * 1000);

  const result = await prisma.user.updateMany({
    where: {
      coins: { gt: 0 },
      OR: [
        { last_login: { lt: cutoff } },
        { last_login: null },
      ],
    },
    data: { coins: 0 },
  });

  console.log(`[coinExpiry] ${new Date().toISOString()} — ${result.count} user(s) had coins reset (inactive > ${expiryDays} days)`);
}

main()
  .catch(e => { console.error('[coinExpiry] Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
