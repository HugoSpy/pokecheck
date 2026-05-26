import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRouter from './routes/auth';
import drawRouter from './routes/draw';
import tradeRouter from './routes/trade';
import leaderboardRouter from './routes/leaderboard';
import pokedexRouter from './routes/pokedex';

const app = express();

app.use(cors({
  origin: [
    'https://pokeschool.vercel.app',
    /\.vercel\.app$/,
    'http://localhost:5173',
    'http://localhost:3000',
  ],
  credentials: true,
}));

app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/auth', authRouter);
app.use('/draw', drawRouter);
app.use('/trade', tradeRouter);
app.use('/leaderboard', leaderboardRouter);
app.use('/pokedex', pokedexRouter);

const PORT = parseInt(process.env.PORT ?? '3001', 10);
app.listen(PORT, '127.0.0.1', () => {
  console.log(`PokéSchool API running on port ${PORT}`);
});

export default app;
