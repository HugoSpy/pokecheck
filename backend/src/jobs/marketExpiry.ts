import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const now = new Date();

  const expired = await prisma.marketListing.findMany({
    where: { status: 'active', expires_at: { lt: now } },
    select: { id: true },
  });

  if (expired.length === 0) {
    console.log(`[marketExpiry] ${now.toISOString()} — no expired listings`);
    return;
  }

  await prisma.marketListing.updateMany({
    where: { status: 'active', expires_at: { lt: now } },
    data: { status: 'cancelled' },
  });

  console.log(`[marketExpiry] ${now.toISOString()} — ${expired.length} listing(s) expired and cancelled`);
}

main()
  .catch(e => { console.error('[marketExpiry] Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
