import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import rateLimit from 'express-rate-limit';

import authRouter from './routes/auth';
import drawRouter from './routes/draw';
import tradeRouter from './routes/trade';
import leaderboardRouter from './routes/leaderboard';
import pokedexRouter from './routes/pokedex';
import adminRouter from './routes/admin';
import usersRouter from './routes/users';
import dailyLoginRouter from './routes/daily-login';
import sellRouter from './routes/sell';
import marketRouter from './routes/market';
import eventRouter from './routes/event';
import attendanceRouter from './routes/attendance';

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      /https:\/\/.*\.vercel\.app$/,
      /https:\/\/.*\.pokecheck\.fr$/,
      /https:\/\/pokecheck\.fr$/,
      /http:\/\/localhost:\d+$/,
    ];
    if (!origin || allowed.some(r => r.test(origin))) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
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
// Each route gets its OWN rateLimit() instance — express-rate-limit uses a
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
app.use('/sell',          rl(10));
app.use('/market/buy',    rl(10));
app.use('/trade/accept',  rl(10));
// /auth/one-shot is a login endpoint — more generous to avoid blocking a whole
// class behind the same school NAT during a simultaneous login session.
app.use('/auth/one-shot', rl(30));

app.use('/auth', authRouter);
app.use('/draw', drawRouter);
app.use('/trade', tradeRouter);
app.use('/leaderboard', leaderboardRouter);
app.use('/pokedex', pokedexRouter);
app.use('/admin', adminRouter);
app.use('/users', usersRouter);
app.use('/daily-login', dailyLoginRouter);
app.use('/sell', sellRouter);
app.use('/market', marketRouter);
app.use('/event', eventRouter);
app.use('/attendance', attendanceRouter);

const PORT = parseInt(process.env.PORT ?? '3001', 10);
app.listen(PORT, '127.0.0.1', () => {
  console.log(`PokéCheck API running on port ${PORT}`);
});

export default app;
