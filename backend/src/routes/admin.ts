import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

const SHORT_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function generateShortCode(length = 10): string {
  let code = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += SHORT_CODE_CHARS[bytes[i] % SHORT_CODE_CHARS.length];
  }
  return code;
}

router.post('/generate-pack', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const adminId = process.env.ADMIN_MS_ID;
  if (!adminId || req.user!.ms_id !== adminId) {
    res.status(403).json({ error: 'Admin only' });
    return;
  }

  const { force_shiny = false } = req.body as { force_shiny?: boolean };
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  let shortCode!: string;
  let attempts = 0;
  do {
    shortCode = generateShortCode();
    const existing = await prisma.oneshotToken.findUnique({ where: { short_code: shortCode } });
    if (!existing) break;
  } while (++attempts < 5);

  const tokenHash = crypto.createHash('sha256').update(shortCode).digest('hex');
  await prisma.oneshotToken.create({
    data: {
      user_id: req.user!.userId,
      token_hash: tokenHash,
      short_code: shortCode,
      expires_at: expiresAt,
      force_shiny,
    },
  });

  res.json({ code: shortCode });
});

export default router;
