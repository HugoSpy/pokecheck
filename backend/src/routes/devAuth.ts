// [DEV ONLY - NEVER MERGE] - backdoor login for the two seeded test accounts
// (see prisma/seed-test-accounts.ts). Returns a raw JWT (not a session cookie)
// so each browser tab can hold its own token in localStorage - a shared
// httpOnly cookie would force every tab to the same account, defeating the
// purpose of testing multi-player features (e.g. Battle lobby) with two
// independent sessions in one browser.
//
// Guarded by DEV_BACKDOOR=true - must never be set in the prod .env.
import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { signSessionToken } from './auth';

const router = Router();
const prisma = new PrismaClient();

const TEST_MS_IDS: Record<string, string> = {
  '1': 'test-account-1',
  '2': 'test-account-2',
};

router.use((_req: Request, res: Response, next: NextFunction) => {
  if (process.env.DEV_BACKDOOR !== 'true') {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  next();
});

router.get('/test-login', async (req: Request, res: Response): Promise<void> => {
  const account = typeof req.query.account === 'string' ? req.query.account : undefined;
  const ms_id = account ? TEST_MS_IDS[account] : undefined;

  if (!ms_id) {
    res.status(400).json({ error: 'Unknown test account - use ?account=1 or ?account=2' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { ms_id } });
  if (!user) {
    res.status(404).json({ error: 'Test account not seeded - run npm run seed:test-accounts' });
    return;
  }

  const token = signSessionToken({
    id: user.id,
    ms_id: user.ms_id,
    display_name: user.display_name,
    nickname: user.nickname,
    is_admin: user.is_admin,
  });
  res.json({ token });
});

export default router;
