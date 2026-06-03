import { Prisma, PrismaClient } from '@prisma/client';

type Tx = PrismaClient | Prisma.TransactionClient;

const DROP_RATE: Record<string, number> = {
  COMMON: 0.60,
  RARE: 0.25,
  EPIC: 0.12,
  LEGENDARY: 0.012, // 0.2% drop rate (was 0.5%), price scales ×2.5
};
const NORM = 20;

export async function addCoins(
  prismaOrTx: Tx,
  userId: string,
  amount: number,
  reason: string
): Promise<void> {
  await prismaOrTx.user.update({
    where: { id: userId },
    data: {
      coins: { increment: amount },
      coins_earned_total: { increment: amount },
    },
  });
  await prismaOrTx.coinTransaction.create({
    data: { user_id: userId, amount, reason },
  });
}

export async function spendCoins(
  prismaOrTx: Tx,
  userId: string,
  amount: number,
  reason: string
): Promise<void> {
  // M7 — Atomic compare-and-swap: the previous implementation read coins then
  // decremented in two separate statements. Under PostgreSQL READ COMMITTED two
  // concurrent spend calls could both pass the balance check before either
  // committed, resulting in a negative balance (e.g. event-draw raced with a
  // market buy). updateMany with `coins: { gte: amount }` in the WHERE clause
  // makes the read+write a single atomic operation; if count === 0 the user
  // either doesn't exist or had insufficient funds.
  const { count } = await prismaOrTx.user.updateMany({
    where: { id: userId, coins: { gte: amount } },
    data: { coins: { decrement: amount } },
  });
  if (count === 0) {
    throw Object.assign(new Error('Insufficient coins'), { status: 402 });
  }
  await prismaOrTx.coinTransaction.create({
    data: { user_id: userId, amount: -amount, reason },
  });
}

export function getSellPrice(userPokemon: {
  is_shiny: boolean;
  pokemon: { points: number; rarity: string };
}): number {
  const effectivePoints = userPokemon.pokemon.points * (userPokemon.is_shiny ? 3 : 1);
  const dropRate = DROP_RATE[userPokemon.pokemon.rarity] ?? 0.60;
  return Math.round(effectivePoints * (1 / dropRate) / NORM);
}
