import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

function pickRarity(): string {
  const roll = Math.random() * 100;
  if (roll < 78.9) return 'COMMON';
  if (roll < 98.9) return 'RARE';
  if (roll < 99.9) return 'EPIC';
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

    const drawCount = await prisma.userPokemon.count({
      where: {
        user_id: userId,
        source: 'draw',
        obtained_at: { gte: today, lt: tomorrow },
      },
    });

    if (drawCount >= 100) {
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

  const isAdmin = req.user!.ms_id === process.env.ADMIN_MS_ID;
  const forceShiny = isAdmin && (req.body as { force_shiny?: boolean }).force_shiny === true;
  const isShiny = forceShiny || Math.random() < (1 / 4096);
  const spriteUrl = isShiny
    ? pokemon.sprite_url.replace('/normal/', '/shiny/')
    : pokemon.sprite_url;
  const finalPoints = isShiny ? pokemon.points * 3 : pokemon.points;

  await prisma.userPokemon.create({
    data: {
      user_id: userId,
      pokemon_id: pokemon.id,
      source,
      tradeable_at: null,
      is_shiny: isShiny,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { total_score: { increment: finalPoints } },
  });

  res.json({
    pokemon: {
      id: pokemon.id,
      name: pokemon.name,
      sprite_url: spriteUrl,
      rarity: pokemon.rarity,
      points: finalPoints,
      types: pokemon.types,
      is_shiny: isShiny,
    },
  });
});

export default router;
