import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

// GET /users/search?q=prénom+nom  — recherche élève par nom (min 2 chars)
router.get('/search', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) {
    res.json({ users: [] });
    return;
  }

  const users = await prisma.user.findMany({
    where: {
      display_name: { contains: q, mode: 'insensitive' },
      NOT: { id: req.user!.userId }, // exclure soi-même
    },
    select: { id: true, display_name: true },
    orderBy: { display_name: 'asc' },
    take: 8,
  });

  res.json({ users });
});

export default router;
