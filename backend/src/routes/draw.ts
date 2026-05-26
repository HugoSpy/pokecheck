import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

const RARITY_WEIGHTS: Record<string, number> = {
  COMMON: 60,
  RARE: 25,
  EPIC: 12,
  LEGENDARY: 3,
};

function pickRarity(): string {
  const roll = Math.random() * 100;
  if (roll < 60) return 'COMMON';
  if (roll < 85) return 'RARE';
  if (roll < 97) return 'EPIC';
  return 'LEGENDARY';
}

router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const source = (req.body as { source?: string }).source ?? 'draw';

  if (source === 'draw') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingDraw = await prisma.userPokemon.findFirst({
      where: {
        user_id: userId,
        source: 'draw',
        obtained_at: { gte: today, lt: tomorrow },
      },
    });

    if (existingDraw) {
      res.status(403).json({ error: 'Already drawn today' });
      return;
    }
  }

  const rarity = pickRarity();

  const pokemonsOfRarity = await prisma.pokemon.findMany({ where: { rarity } });
  if (pokemonsOfRarity.length === 0) {
    res.status(500).json({ error: 'No Pokémon found for rarity' });
    return;
  }

  const pokemon = pokemonsOfRarity[Math.floor(Math.random() * pokemonsOfRarity.length)];

  await prisma.userPokemon.create({
    data: {
      user_id: userId,
      pokemon_id: pokemon.id,
      source,
      tradeable_at: null,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { total_score: { increment: pokemon.points } },
  });

  res.json({
    pokemon: {
      id: pokemon.id,
      name: pokemon.name,
      sprite_url: pokemon.sprite_url,
      rarity: pokemon.rarity,
      points: pokemon.points,
      types: pokemon.types,
    },
  });
});

export default router;
