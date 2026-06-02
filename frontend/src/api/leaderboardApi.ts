import { apiFetch } from './client';
import type { LeaderboardEntry } from './types';

export async function getLeaderboard(sort: 'score' | 'coins' = 'score'): Promise<LeaderboardEntry[]> {
  return apiFetch<LeaderboardEntry[]>(sort === 'coins' ? '/leaderboard?sort=coins' : '/leaderboard');
}
