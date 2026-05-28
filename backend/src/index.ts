import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';

import authRouter from './routes/auth';
import drawRouter from './routes/draw';
import tradeRouter from './routes/trade';
import leaderboardRouter from './routes/leaderboard';
import pokedexRouter from './routes/pokedex';
import adminRouter from './routes/admin';
import usersRouter from './routes/users';

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

app.use('/auth', authRouter);
app.use('/draw', drawRouter);
app.use('/trade', tradeRouter);
app.use('/leaderboard', leaderboardRouter);
app.use('/pokedex', pokedexRouter);
app.use('/admin', adminRouter);
app.use('/users', usersRouter);

const PORT = parseInt(process.env.PORT ?? '3001', 10);
app.listen(PORT, '127.0.0.1', () => {
  console.log(`PokéCheck API running on port ${PORT}`);
});

export default app;
