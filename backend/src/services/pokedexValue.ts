import { Prisma, PrismaClient } from '@prisma/client';

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

export async function calculateUserPokedexValue(
  prisma: PrismaExecutor,
  userId: string
): Promise<number> {
  const ownedPokemons = await prisma.userPokemon.findMany({
    where: { user_id: userId },
    select: {
      is_shiny: true,
      pokemon: { select: { points: true } },
    },
  });

  return ownedPokemons.reduce(
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
