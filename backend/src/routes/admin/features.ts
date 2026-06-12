import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { adminMiddleware } from '../../middleware/adminMiddleware';

const router = Router();

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

// ── PATCH /admin/features/:id/edit ────────────────────────────────────────────
// Edit a PUBLISHED feature's title/description in place (votes/score untouched).

router.patch('/:id/edit', async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const { title, description } = req.body as { title?: string; description?: string };

  if (title !== undefined && (!title.trim() || title.trim().length > 100)) {
    res.status(400).json({ error: 'title must be between 1 and 100 characters' });
    return;
  }
  if (description !== undefined && (!description.trim() || description.trim().length > 1000)) {
    res.status(400).json({ error: 'description must be between 1 and 1000 characters' });
    return;
  }

  const feature = await prisma.featureRequest.findUnique({ where: { id } });
  if (!feature) {
    res.status(404).json({ error: 'Feature not found' });
    return;
  }
  if (feature.status !== 'PUBLISHED') {
    res.status(400).json({ error: 'Only published features can be edited here' });
    return;
  }

  const updated = await prisma.featureRequest.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title: title.trim() } : {}),
      ...(description !== undefined ? { description: description.trim() } : {}),
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

// ── GET /admin/features/:id/votes ─────────────────────────────────────────────
// Who voted what on a published idea. Votes are per-Paris-day, so a voter can
// have several rows; we aggregate to a net value per user. Identifies voters by
// their REAL name (display_name) — deliberately NOT the nickname.

router.get('/:id/votes', async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);

  const feature = await prisma.featureRequest.findUnique({ where: { id } });
  if (!feature) {
    res.status(404).json({ error: 'Feature not found' });
    return;
  }

  const votes = await prisma.featureVote.findMany({
    where: { feature_id: id },
    include: { user: { select: { id: true, display_name: true } } },
  });

  // Aggregate to a net value per voter (sum of their daily votes).
  const byUser = new Map<string, { user_id: string; name: string; total: number }>();
  for (const v of votes) {
    const entry = byUser.get(v.user_id) ?? { user_id: v.user_id, name: v.user.display_name, total: 0 };
    entry.total += v.value;
    byUser.set(v.user_id, entry);
  }

  // Drop voters whose votes net to zero (e.g. up then down), then rank
  // upvoters first, downvoters last; alphabetical within equal totals.
  const result = [...byUser.values()]
    .filter(e => e.total !== 0)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  res.json(result);
});

export default router;
