import { Prisma, PrismaClient } from '@prisma/client';

type Tx = PrismaClient | Prisma.TransactionClient;

const DROP_RATE: Record<string, number> = {
  COMMON: 0.60,
  RARE: 0.25,
  EPIC: 0.12,
  LEGENDARY: 0.03,
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
  const user = await prismaOrTx.user.findUnique({
    where: { id: userId },
    select: { coins: true },
  });
  if (!user || user.coins < amount) {
    throw Object.assign(new Error('Insufficient coins'), { status: 402 });
  }
  await prismaOrTx.user.update({
    where: { id: userId },
    data: { coins: { decrement: amount } },
  });
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
