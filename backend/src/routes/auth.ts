import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

interface OneShotPayload {
  ms_id: string;
  display_name: string;
  expires_at: number;
}

router.get('/one-shot', async (req: Request, res: Response): Promise<void> => {
  const { token } = req.query as { token?: string };

  if (!token) {
    res.status(400).json({ error: 'Token is required' });
    return;
  }

  let payload: OneShotPayload;
  try {
    payload = jwt.verify(token, process.env.JWT_ONE_SHOT_SECRET!) as OneShotPayload;
  } catch {
    res.status(401).json({ error: 'Invalid token signature' });
    return;
  }

  if (Date.now() > payload.expires_at) {
    res.status(401).json({ error: 'Token expired' });
    return;
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const record = await prisma.oneshotToken.findUnique({ where: { token_hash: tokenHash } });

  if (!record) {
    res.status(401).json({ error: 'Token not found' });
    return;
  }

  if (record.used) {
    res.status(410).json({ error: 'Token already used' });
    return;
  }

  if (record.expires_at < new Date()) {
    res.status(401).json({ error: 'Token expired' });
    return;
  }

  await prisma.oneshotToken.update({ where: { id: record.id }, data: { used: true } });

  const user = await prisma.user.upsert({
    where: { ms_id: payload.ms_id },
    update: { display_name: payload.display_name },
    create: {
      ms_id: payload.ms_id,
      display_name: payload.display_name,
    },
  });

  const sessionToken = jwt.sign(
    { userId: user.id, ms_id: user.ms_id, display_name: user.display_name },
    process.env.JWT_SECRET!,
    { expiresIn: (process.env.SESSION_DURATION ?? '1h') as jwt.SignOptions['expiresIn'] }
  );

  res.json({ sessionToken, user: { id: user.id, display_name: user.display_name, total_score: user.total_score } });
});

export default router;
