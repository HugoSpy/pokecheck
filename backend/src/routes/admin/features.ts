import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { adminMiddleware } from '../../middleware/adminMiddleware';

const router = Router();
const prisma = new PrismaClient();

router.use(adminMiddleware);

// ── GET /admin/features/pending ───────────────────────────────────────────────

router.get('/pending', async (_req: Request, res: Response): Promise<void> => {
  const features = await prisma.featureRequest.findMany({
    where: { status: 'PENDING' },
    include: { creator: { select: { display_name: true, nickname: true } } },
    orderBy: { created_at: 'asc' },
  });

  res.json(features.map(f => ({
    ...f,
    creator_name: f.creator.nickname ?? f.creator.display_name,
  })));
});

// ── PATCH /admin/features/:id/publish ─────────────────────────────────────────

router.patch('/:id/publish', async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const { title, description } = req.body as { title?: string; description?: string };

  const feature = await prisma.featureRequest.findUnique({ where: { id } });
  if (!feature) {
    res.status(404).json({ error: 'Feature not found' });
    return;
  }
  if (feature.status !== 'PENDING') {
    res.status(400).json({ error: 'Feature is not in PENDING status' });
    return;
  }

  const updated = await prisma.featureRequest.update({
    where: { id },
    data: {
      ...(title?.trim() ? { title: title.trim() } : {}),
      ...(description?.trim() ? { description: description.trim() } : {}),
      status: 'PUBLISHED',
      published_at: new Date(),
    },
  });

  res.json(updated);
});

// ── PATCH /admin/features/:id/reject ──────────────────────────────────────────

router.patch('/:id/reject', async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);

  const feature = await prisma.featureRequest.findUnique({ where: { id } });
  if (!feature) {
    res.status(404).json({ error: 'Feature not found' });
    return;
  }
  if (feature.status !== 'PENDING') {
    res.status(404).json({ error: 'Feature not found or not pending' });
    return;
  }

  await prisma.featureRequest.delete({ where: { id } });
  res.json({ ok: true });
});

// ── PATCH /admin/features/:id/done ────────────────────────────────────────────

router.patch('/:id/done', async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);

  const feature = await prisma.featureRequest.findUnique({ where: { id } });
  if (!feature) {
    res.status(404).json({ error: 'Feature not found' });
    return;
  }
  if (feature.status !== 'PUBLISHED') {
    res.status(400).json({ error: 'Feature must be PUBLISHED to mark as done' });
    return;
  }

  const updated = await prisma.featureRequest.update({
    where: { id },
    data: { status: 'DONE', done_at: new Date() },
  });

  res.json(updated);
});

// ── GET /admin/features/history ───────────────────────────────────────────────

router.get('/history', async (_req: Request, res: Response): Promise<void> => {
  const features = await prisma.featureRequest.findMany({
    where: { status: 'DONE' },
    include: {
      votes: { select: { value: true } },
      creator: { select: { display_name: true, nickname: true } },
    },
    orderBy: { done_at: 'desc' },
  });

  res.json(features.map(f => ({
    id: f.id,
    title: f.title,
    description: f.description,
    status: f.status,
    created_at: f.created_at,
    published_at: f.published_at,
    done_at: f.done_at,
    creator_name: f.creator.nickname ?? f.creator.display_name,
    score: f.votes.reduce((sum, v) => sum + v.value, 0),
  })));
});

export default router;
