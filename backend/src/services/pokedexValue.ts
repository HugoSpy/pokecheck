import { Prisma, PrismaClient } from '@prisma/client';

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

export async function calculateUserPokedexValue(
  prisma: PrismaExecutor,
  userId: string
): Promise<number> {
  // A species contributes to the score only once, no matter how many copies are
  // owned. A shiny is treated as a *distinct variant* (its own 1/4096 rarity), so
  // the dedup key is (pokemon_id, is_shiny): owning a normal AND a shiny of the
  // same species counts twice, but a second normal (or second shiny) adds nothing.
  // Each distinct variant is worth points × (is_shiny ? 3 : 1).
  const variants = await prisma.userPokemon.findMany({
    where: { user_id: userId },
    distinct: ['pokemon_id', 'is_shiny'],
    select: {
      is_shiny: true,
      pokemon: { select: { points: true } },
    },
  });

  return variants.reduce(
    (total, owned) => total + owned.pokemon.points * (owned.is_shiny ? 3 : 1),
    0
  );
}

export async function recalculateUserPokedexValue(
  prisma: PrismaExecutor,
  userId: string
): Promise<number> {
  const totalScore = await calculateUserPokedexValue(prisma, userId);
  await prisma.user.update({
    where: { id: userId },
    data: { total_score: totalScore },
  });
  return totalScore;
}
