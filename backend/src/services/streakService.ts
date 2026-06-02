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

  const coinsEarned = 100 + (newStreak - 1) * 10;

  await prisma.$transaction(async tx => {
    await tx.user.update({
      where: { id: userId },
      data: { streak_days: newStreak, last_login: now },
    });
    await addCoins(tx, userId, coinsEarned, 'streak');
  });

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
