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

const SHORT_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generateShortCode(length = 10): string {
  let code = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += SHORT_CODE_CHARS[bytes[i] % SHORT_CODE_CHARS.length];
  }
  return code;
}

// POST /auth/generate-token — called by school intranet, protected by API key
router.post('/generate-token', async (req: Request, res: Response): Promise<void> => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.SCHOOL_API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { ms_id, display_name } = req.body as { ms_id?: string; display_name?: string };
  if (!ms_id || !display_name) {
    res.status(400).json({ error: 'ms_id and display_name are required' });
    return;
  }

  const user = await prisma.user.upsert({
    where: { ms_id },
    update: { display_name },
    create: { ms_id, display_name },
  });

  const ttlMinutes = parseInt(process.env.ONE_SHOT_TTL_MINUTES ?? '15', 10);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  // Generate a unique short code (retry on collision, extremely unlikely)
  let shortCode: string;
  let attempts = 0;
  do {
    shortCode = generateShortCode();
    const existing = await prisma.oneshotToken.findUnique({ where: { short_code: shortCode } });
    if (!existing) break;
    attempts++;
  } while (attempts < 5);

  const tokenHash = crypto.createHash('sha256').update(shortCode).digest('hex');

  await prisma.oneshotToken.create({
    data: {
      user_id: user.id,
      token_hash: tokenHash,
      short_code: shortCode,
      expires_at: expiresAt,
    },
  });

  const baseUrl = process.env.FRONTEND_URL ?? 'https://pokecheck.fr';
  res.json({
    code: shortCode,
    url: `${baseUrl}/open?code=${shortCode}`,
    expires_in: ttlMinutes * 60,
  });
});

// GET /auth/one-shot — accepts ?code= (new) or ?token= (legacy JWT)
router.get('/one-shot', async (req: Request, res: Response): Promise<void> => {
  const { token, code } = req.query as { token?: string; code?: string };

  if (code) {
    const record = await prisma.oneshotToken.findUnique({ where: { short_code: code } });

    if (!record) {
      res.status(401).json({ error: 'Code invalide' });
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

    const user = await prisma.user.findUnique({ where: { id: record.user_id } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const sessionToken = jwt.sign(
      { userId: user.id, ms_id: user.ms_id, display_name: user.display_name },
      process.env.JWT_SECRET!,
      { expiresIn: (process.env.SESSION_DURATION ?? '1h') as jwt.SignOptions['expiresIn'] }
    );

    res.json({ sessionToken, user: { id: user.id, display_name: user.display_name, total_score: user.total_score } });
    return;
  }

  // Legacy JWT path
  if (!token) {
    res.status(400).json({ error: 'Token or code is required' });
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
    create: { ms_id: payload.ms_id, display_name: payload.display_name },
  });

  const sessionToken = jwt.sign(
    { userId: user.id, ms_id: user.ms_id, display_name: user.display_name },
    process.env.JWT_SECRET!,
    { expiresIn: (process.env.SESSION_DURATION ?? '1h') as jwt.SignOptions['expiresIn'] }
  );

  res.json({ sessionToken, user: { id: user.id, display_name: user.display_name, total_score: user.total_score } });
});

export default router;
