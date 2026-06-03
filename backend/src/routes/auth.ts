import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import passport from 'passport';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import { PrismaClient } from '@prisma/client';
import { claimDailyLogin } from '../services/streakService';

const router = Router();
const prisma = new PrismaClient();

// M2 — JWT duration is now driven by SESSION_DURATION (default 1h) for both
// Microsoft OAuth and one-shot tokens. The previous 24h hardcoded default meant
// a compromised admin token stayed valid for a full day; 1h limits the blast
// radius if a token is stolen or the JWT_SECRET is briefly leaked.
const SESSION_DURATION = (process.env.SESSION_DURATION ?? '1h') as jwt.SignOptions['expiresIn'];

function signSessionToken(
  user: { id: string; ms_id: string; display_name: string; is_admin: boolean },
  expiresIn: jwt.SignOptions['expiresIn'] = SESSION_DURATION
): string {
  return jwt.sign(
    {
      userId: user.id,
      ms_id: user.ms_id,
      display_name: user.display_name,
      isAdmin: user.is_admin === true,
    },
    process.env.JWT_SECRET!,
    { expiresIn }
  );
}

// ── State cookie CSRF (pattern SIGambling) ──────────────────────────────────
const STATE_COOKIE = 'ms_oauth_state';
const STATE_TTL_MS = 10 * 60 * 1000;

function issueState(res: Response): string {
  const state = jwt.sign(
    { purpose: 'ms_oauth_state', nonce: crypto.randomBytes(32).toString('hex') },
    process.env.JWT_SECRET!,
    { expiresIn: '10m' }
  );
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: STATE_TTL_MS,
    path: '/auth',
  });
  return state;
}

function verifyState(req: Request): void {
  const qState = typeof req.query.state === 'string' ? req.query.state : undefined;
  const cState = typeof req.cookies?.[STATE_COOKIE] === 'string' ? req.cookies[STATE_COOKIE] : undefined;
  if (!qState || !cState || qState !== cState) {
    throw Object.assign(new Error('OAuth state invalide'), { status: 403 });
  }
  try {
    const p = jwt.verify(qState, process.env.JWT_SECRET!) as { purpose: string };
    if (p.purpose !== 'ms_oauth_state') throw new Error();
  } catch {
    throw Object.assign(new Error('OAuth state expiré'), { status: 403 });
  }
}

function clearState(res: Response) {
  res.clearCookie(STATE_COOKIE, { httpOnly: true, secure: true, sameSite: 'lax', path: '/auth' });
}

// ── Passport Microsoft strategy ─────────────────────────────────────────────
interface MsProfile {
  id: string;
  displayName?: string;
  emails?: { value: string }[];
}

if (process.env.MICROSOFT_CLIENT_ID) {
  passport.use(
  new MicrosoftStrategy(
    {
      clientID: process.env.MICROSOFT_CLIENT_ID ?? '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? '',
      callbackURL: process.env.MICROSOFT_REDIRECT_URI ?? '',
      scope: ['openid', 'profile', 'email', 'User.Read'],
      tenant: process.env.MICROSOFT_TENANT_ID ?? 'common',
    },
    async (_at: string, _rt: string, profile: MsProfile, done: (e: unknown, u?: unknown) => void) => {
      try {
        const email = profile.emails?.[0]?.value?.toLowerCase() ?? '';
        const user = await prisma.user.upsert({
          where: { ms_id: profile.id },
          update: { display_name: profile.displayName ?? email },
          create: { ms_id: profile.id, display_name: profile.displayName ?? email },
        });
        done(null, {
          userId: user.id,
          ms_id: user.ms_id,
          display_name: user.display_name,
          is_admin: user.is_admin,
        });
      } catch (e) {
        done(e);
      }
    }
  )
);
}

// ── GET /auth/microsoft — démarre le flow ────────────────────────────────────
router.get('/microsoft', (req: Request, res: Response, next: NextFunction) => {
  if (!process.env.MICROSOFT_CLIENT_ID) {
    res.status(503).json({ error: 'Microsoft OAuth non configuré — voir README' });
    return;
  }
  const state = issueState(res);
  passport.authenticate('microsoft', {
    session: false,
    state,
    prompt: 'select_account',
  })(req, res, next);
});

// ── GET /auth/microsoft/callback ─────────────────────────────────────────────
router.get('/microsoft/callback', (req: Request, res: Response, next: NextFunction) => {
  clearState(res);

  if (!req.query.error) {
    try { verifyState(req); } catch (e) { next(e); return; }
  }

  passport.authenticate('microsoft', { session: false },
    (err: unknown, user: unknown) => {
      if (err || !user) {
        const msg = err instanceof Error ? encodeURIComponent(err.message) : 'auth_failed';
        res.redirect(`${process.env.FRONTEND_REDIRECT_URL ?? 'https://pokecheck-tau.vercel.app'}?auth_error=${msg}`);
        return;
      }
      const u = user as { userId: string; ms_id: string; display_name: string; is_admin: boolean };
      const sessionToken = signSessionToken({
        id: u.userId,
        ms_id: u.ms_id,
        display_name: u.display_name,
        is_admin: u.is_admin,
      });
      res.redirect(`${process.env.FRONTEND_REDIRECT_URL ?? 'https://pokecheck-tau.vercel.app'}?session=${sessionToken}`);
    }
  )(req, res, next);
});

// ── Existing one-shot routes preserved below ─────────────────────────────────

const SHORT_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generateShortCode(length = 10): string {
  let code = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += SHORT_CODE_CHARS[bytes[i] % SHORT_CODE_CHARS.length];
  }
  return code;
}

interface OneShotPayload { ms_id: string; display_name: string; expires_at: number; }

router.post('/generate-token', async (req: Request, res: Response): Promise<void> => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.SCHOOL_API_KEY) {
    res.status(401).json({ error: 'Unauthorized' }); return;
  }
  const { ms_id, display_name } = req.body as { ms_id?: string; display_name?: string };
  if (!ms_id || !display_name) {
    res.status(400).json({ error: 'ms_id and display_name are required' }); return;
  }
  const user = await prisma.user.upsert({
    where: { ms_id }, update: { display_name }, create: { ms_id, display_name },
  });
  const ttlMinutes = parseInt(process.env.ONE_SHOT_TTL_MINUTES ?? '15', 10);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  let shortCode!: string;
  let attempts = 0;
  do {
    shortCode = generateShortCode();
    const existing = await prisma.oneshotToken.findUnique({ where: { short_code: shortCode } });
    if (!existing) break;
  } while (++attempts < 5);
  const tokenHash = crypto.createHash('sha256').update(shortCode).digest('hex');
  await prisma.oneshotToken.create({
    data: { user_id: user.id, token_hash: tokenHash, short_code: shortCode, expires_at: expiresAt },
  });
  const baseUrl = process.env.FRONTEND_REDIRECT_URL ?? 'https://pokecheck-tau.vercel.app';
  res.json({ code: shortCode, url: `${baseUrl}/open?code=${shortCode}`, expires_in: ttlMinutes * 60 });
});

router.get('/one-shot', async (req: Request, res: Response): Promise<void> => {
  const { token, code } = req.query as { token?: string; code?: string };
  if (code) {
    const record = await prisma.oneshotToken.findUnique({ where: { short_code: code } });
    if (!record)                      { res.status(401).json({ error: 'Code invalide' }); return; }
    if (record.used)                  { res.status(410).json({ error: 'Token already used' }); return; }
    if (record.expires_at < new Date()) { res.status(401).json({ error: 'Token expired' }); return; }
    await prisma.oneshotToken.update({ where: { id: record.id }, data: { used: true } });
    const user = await prisma.user.findUnique({ where: { id: record.user_id } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    const sessionToken = signSessionToken(
      user,
      (process.env.SESSION_DURATION ?? '1h') as jwt.SignOptions['expiresIn']
    );
    res.json({ sessionToken, user: { id: user.id, display_name: user.display_name, total_score: user.total_score }, force_shiny: record.force_shiny });
    // Fire-and-forget streak claim — errors are non-fatal
    claimDailyLogin(user.id).catch(() => {});
    return;
  }
  if (!token) { res.status(400).json({ error: 'Token or code is required' }); return; }
  let payload: OneShotPayload;
  try { payload = jwt.verify(token, process.env.JWT_ONE_SHOT_SECRET!) as OneShotPayload; }
  catch { res.status(401).json({ error: 'Invalid token signature' }); return; }
  if (Date.now() > payload.expires_at) { res.status(401).json({ error: 'Token expired' }); return; }
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const record = await prisma.oneshotToken.findUnique({ where: { token_hash: tokenHash } });
  if (!record)                      { res.status(401).json({ error: 'Token not found' }); return; }
  if (record.used)                  { res.status(410).json({ error: 'Token already used' }); return; }
  if (record.expires_at < new Date()) { res.status(401).json({ error: 'Token expired' }); return; }
  await prisma.oneshotToken.update({ where: { id: record.id }, data: { used: true } });
  const user = await prisma.user.upsert({
    where: { ms_id: payload.ms_id },
    update: { display_name: payload.display_name },
    create: { ms_id: payload.ms_id, display_name: payload.display_name },
  });
  const sessionToken = signSessionToken(
    user,
    (process.env.SESSION_DURATION ?? '1h') as jwt.SignOptions['expiresIn']
  );
  res.json({ sessionToken, user: { id: user.id, display_name: user.display_name, total_score: user.total_score } });
  claimDailyLogin(user.id).catch(() => {});
});

export default router;
