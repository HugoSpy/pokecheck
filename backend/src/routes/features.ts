import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/authMiddleware';
import { getParisDayStart } from '../utils/parisTime';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

// ── GET /features ─────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const today = getParisDayStart();

  const features = await prisma.featureRequest.findMany({
    where: { status: 'PUBLISHED' },
    include: {
      votes: { select: { value: true, user_id: true, vote_date: true } },
      creator: { select: { display_name: true, nickname: true } },
    },
    orderBy: { created_at: 'asc' },
  });

  const result = features
    .map(f => {
      const score = f.votes.reduce((sum, v) => sum + v.value, 0);
      const myVoteRow = f.votes.find(
        v => v.user_id === userId && v.vote_date.getTime() === today.getTime()
      );
      return {
        id: f.id,
        title: f.title,
        description: f.description,
        status: f.status,
        created_at: f.created_at,
        published_at: f.published_at,
        creator: f.creator.nickname ?? f.creator.display_name,
        score,
        myVoteToday: myVoteRow ? myVoteRow.value as 1 | -1 : null,
      };
    })
    // Highest score first; on a tie, the oldest idea ranks higher (most recent
    // sinks to the bottom of the tie group). The asc orderBy above makes the
    // stable sort keep oldest-first within equal scores.
    .sort((a, b) => b.score - a.score);

  res.json(result);
});

// ── POST /features/propose ────────────────────────────────────────────────────

router.post('/propose', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { title, description } = req.body as { title?: string; description?: string };

  if (!title?.trim()) {
    res.status(400).json({ error: 'title is required' });
    return;
  }
  if (!description?.trim()) {
    res.status(400).json({ error: 'description is required' });
    return;
  }
  if (title.trim().length > 100) {
    res.status(400).json({ error: 'title must be 100 characters or less' });
    return;
  }
  if (description.trim().length > 1000) {
    res.status(400).json({ error: 'description must be 1000 characters or less' });
    return;
  }

  // Re-read is_admin from DB — never trust the JWT claim alone.
  const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { is_admin: true } });
  const isAdmin = dbUser?.is_admin === true;

  const now = new Date();
  const feature = await prisma.featureRequest.create({
    data: {
      title: title.trim(),
      description: description.trim(),
      status: isAdmin ? 'PUBLISHED' : 'PENDING',
      created_by: userId,
      published_at: isAdmin ? now : null,
    },
  });

  res.status(201).json(feature);
});

// ── POST /features/:id/vote ───────────────────────────────────────────────────

router.post('/:id/vote', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const featureId = String(req.params.id);
  const { value } = req.body as { value?: number };

  if (value !== 1 && value !== -1) {
    res.status(400).json({ error: 'value must be 1 or -1' });
    return;
  }

  const feature = await prisma.featureRequest.findUnique({ where: { id: featureId } });
  if (!feature) {
    res.status(404).json({ error: 'Feature not found' });
    return;
  }
  if (feature.status !== 'PUBLISHED') {
    res.status(403).json({ error: 'Cannot vote on a feature that is not published' });
    return;
  }

  const voteDate = getParisDayStart();

  const existing = await prisma.featureVote.findUnique({
    where: { feature_id_user_id_vote_date: { feature_id: featureId, user_id: userId, vote_date: voteDate } },
  });

  if (!existing) {
    await prisma.featureVote.create({
      data: { feature_id: featureId, user_id: userId, value, vote_date: voteDate },
    });
  } else if (existing.value === value) {
    // Same value → toggle off (un-vote)
    await prisma.featureVote.delete({ where: { id: existing.id } });
  } else {
    // Opposite value → switch
    await prisma.featureVote.update({ where: { id: existing.id }, data: { value } });
  }

  // Compute new score and current user vote state
  const allVotes = await prisma.featureVote.findMany({ where: { feature_id: featureId } });
  const score = allVotes.reduce((sum, v) => sum + v.value, 0);
  const myVoteRow = allVotes.find(
    v => v.user_id === userId && v.vote_date.getTime() === voteDate.getTime()
  );

  res.json({ score, myVoteToday: myVoteRow ? myVoteRow.value as 1 | -1 : null });
});

export default router;
