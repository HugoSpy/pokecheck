import 'dotenv/config';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import rateLimit from 'express-rate-limit';

import authRouter from './routes/auth';
import drawRouter from './routes/draw';
import tradeRouter from './routes/trade';
import leaderboardRouter from './routes/leaderboard';
import pokedexRouter from './routes/pokedex';
import pokemonRouter from './routes/pokemon';
import adminRouter from './routes/admin';
import usersRouter from './routes/users';
import dailyLoginRouter from './routes/daily-login';
import sellRouter from './routes/sell';
import marketRouter from './routes/market';
import eventRouter from './routes/event';
import shopRouter from './routes/shop';
import attendanceRouter from './routes/attendance';
import notificationsRouter from './routes/notifications';
import { initBattleSocket } from './socket';

const app = express();

// Trust the first proxy hop (Cloudflare Tunnel) so req.ip reflects the real
// student IP instead of the tunnel's loopback address. Without this, all
// requests share one rate-limit bucket (the tunnel IP) rather than one per client.
app.set('trust proxy', 1);

// M4 - Security headers (X-Content-Type-Options, X-Frame-Options, HSTS, etc.).
// Applied before everything else so no response escapes without the headers.
// crossOriginResourcePolicy is set to 'cross-origin' because the frontend
// (a separate Vite SPA on a different origin) fetches all API responses.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// M1 - Strict CORS: only explicitly listed origins are allowed.
// Previously the wildcard /.*\.vercel\.app$/ let any attacker-controlled
// Vercel deployment make credentialed cross-origin requests on a victim's behalf.
// FRONTEND_URL may be a comma-separated list for multi-domain setups.
const allowedOrigins = new Set<string>(
  (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
);
// Always permit localhost for local development.
const localhostPattern = /^http:\/\/localhost:\d+$/;

// Vercel generates a unique URL per preview deployment
// (e.g. pokecheck-h34xinbo5-hugospyropoulos-2590s-projects.vercel.app).
// Allowing these on prod would re-open the wildcard attack vector we closed in
// Sprint 2. Instead, ALLOW_VERCEL_PREVIEWS=true is only set in the staging
// .env so only the dev backend accepts preview URLs.
const vercelPreviewPattern = process.env.ALLOW_VERCEL_PREVIEWS === 'true'
  ? /^https:\/\/pokecheck-[a-z0-9]+-hugospyropoulos-2590s-projects\.vercel\.app$/
  : null;

app.use(cors({
  origin: (origin, callback) => {
    // Requests with no Origin header (curl, server-to-server) are always allowed.
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin)) return callback(null, true);
    if (localhostPattern.test(origin)) return callback(null, true);
    if (vercelPreviewPattern?.test(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Rate limiting on monetary and auth-sensitive endpoints.
// Keyed by IP (Express default). If the deployment is behind a trusted reverse
// proxy that sets X-Forwarded-For, add `app.set('trust proxy', 1)` so the real
// client IP is used instead of the proxy's IP.
// Note: if many students share a single NAT/VPN, increase `max` accordingly.
//
// Each route gets its OWN rateLimit() instance - express-rate-limit uses a
// per-instance in-memory store, so a shared instance would merge all routes into
// a single counter per IP (5 /draw + 5 /sell = limit hit on /daily-login).
const rl = (max: number) => rateLimit({
  windowMs: 60_000,  // 1-minute sliding window
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

// These app.use() calls are registered BEFORE the routers so the limiter runs
// first. Express matches path prefixes, so /daily-login covers POST /daily-login,
// /market/buy covers POST /market/buy/:id, etc.
app.use('/daily-login',   rl(10));
app.use('/draw',          rl(10));
// /sell has a per-user-id limiter defined in the route itself (user-keyed, 1 req/s)
app.use('/market/buy',    rl(10));
app.use('/trade/accept',  rl(10));
app.use('/event/draw',    rl(10));
app.use('/shop/buy',      rl(10));
// /auth/one-shot is a login endpoint - more generous to avoid blocking a whole
// class behind the same school NAT during a simultaneous login session.
app.use('/auth/one-shot', rl(30));

app.use('/auth', authRouter);
app.use('/draw', drawRouter);
app.use('/trade', tradeRouter);
app.use('/leaderboard', leaderboardRouter);
app.use('/pokedex', pokedexRouter);
app.use('/pokemon', pokemonRouter);
app.use('/admin', adminRouter);
app.use('/users', usersRouter);
app.use('/daily-login', dailyLoginRouter);
app.use('/sell', sellRouter);
app.use('/market', marketRouter);
app.use('/event', eventRouter);
app.use('/shop', shopRouter);
app.use('/attendance', attendanceRouter);
app.use('/notifications', notificationsRouter);

const PORT = parseInt(process.env.PORT ?? '3001', 10);

// http.createServer wraps the Express app so Socket.IO can share the same
// listener (the "Battle de caisse" lobby runs over WebSockets on /socket.io).
const server = createServer(app);
initBattleSocket(server);

server.listen(PORT, '127.0.0.1', () => {
  console.log(`PokéCheck API running on port ${PORT}`);
});

export default app;
