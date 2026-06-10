import { PrismaClient } from '@prisma/client';
import { addCoins } from './coinService';

const prisma = new PrismaClient();

export interface DailyLoginResult {
  coins_earned: number;
  streak_days: number;
  total_coins: number;
  already_claimed: boolean;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

function isYesterday(date: Date, reference: Date): boolean {
  const yesterday = new Date(reference.getTime() - 24 * 60 * 60 * 1000);
  return isSameDay(date, yesterday);
}

export async function claimDailyLogin(userId: string): Promise<DailyLoginResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { coins: true, streak_days: true, last_login: true },
  });
  if (!user) throw new Error('User not found');

  const now = new Date();

  if (user.last_login && isSameDay(user.last_login, now)) {
    return {
      coins_earned: 0,
      streak_days: user.streak_days,
      total_coins: user.coins,
      already_claimed: true,
    };
  }

  const newStreak =
    user.last_login && isYesterday(user.last_login, now) ? user.streak_days + 1 : 1;

  // Coin economy: base 20 + 5 per additional day, capped at 150 (reached day 27).
  // The old formula (100 base) handed out too many coins too fast - a 7-day streak
  // already yielded 160 coins/day, making the 500-coin event pack trivially free.
  // With the new formula a standard event pack takes ~3–4 days of streak to afford,
  // keeping it as a meaningful goal without gating casual players entirely.
  const coinsEarned = Math.min(20 + (newStreak - 1) * 5, 150);

  // today at midnight UTC - must match the isSameDay comparison above which also
  // uses toISOString() (UTC), so the boundary is consistent.
  const todayStart = new Date(now.toISOString().slice(0, 10) + 'T00:00:00.000Z');

  // Race-condition guard: the isSameDay check above reads last_login outside the
  // transaction. Two simultaneous requests (e.g. POST /daily-login raced against
  // /attendance/open or /auth/one-shot) can both pass that check before either
  // commits. The updateMany below is a compare-and-swap: PostgreSQL re-evaluates
  // the WHERE condition after acquiring the row lock, so the second concurrent
  // update will find last_login = now (committed by the first) and get count = 0.
  let alreadyClaimed = false;

  await prisma.$transaction(async tx => {
    const { count } = await tx.user.updateMany({
      where: {
        id: userId,
        OR: [{ last_login: null }, { last_login: { lt: todayStart } }],
      },
      data: { streak_days: newStreak, last_login: now },
    });

    if (count === 0) {
      alreadyClaimed = true;
      return;
    }

    await addCoins(tx, userId, coinsEarned, 'streak');
  });

  if (alreadyClaimed) {
    const fresh = await prisma.user.findUnique({
      where: { id: userId },
      select: { coins: true, streak_days: true },
    });
    return {
      coins_earned: 0,
      streak_days: fresh?.streak_days ?? user.streak_days,
      total_coins: fresh?.coins ?? user.coins,
      already_claimed: true,
    };
  }

  const updated = await prisma.user.findUnique({
    where: { id: userId },
    select: { coins: true },
  });

  return {
    coins_earned: coinsEarned,
    streak_days: newStreak,
    total_coins: updated?.coins ?? 0,
    already_claimed: false,
  };
}
