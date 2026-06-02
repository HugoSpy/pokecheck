import { apiFetch } from './client';
import type { UserBadge, DailyLoginResult, SellResult } from './types';

export async function searchUsers(q: string): Promise<{ users: { id: string; display_name: string }[] }> {
  return apiFetch<{ users: { id: string; display_name: string }[] }>(`/users/search?q=${encodeURIComponent(q)}`);
}

export async function claimDailyLogin(): Promise<DailyLoginResult> {
  return apiFetch<DailyLoginResult>('/daily-login', { method: 'POST' });
}

export async function sellPokemon(userPokemonId: string): Promise<SellResult> {
  return apiFetch<SellResult>(`/sell/${userPokemonId}`, { method: 'POST' });
}

export async function getMyBadges(): Promise<UserBadge[]> {
  return apiFetch<UserBadge[]>('/users/badges');
}

export async function getUnnotifiedBadges(): Promise<UserBadge[]> {
  return apiFetch<UserBadge[]>('/users/badges/unnotified');
}

export async function markBadgesNotified(badgeIds: string[]): Promise<void> {
  await apiFetch<void>('/users/badges/notified', {
    method: 'POST',
    body: JSON.stringify({ badgeIds }),
  });
}

export async function updateFeaturedBadges(badgeIds: string[]): Promise<void> {
  await apiFetch<void>('/users/badges/featured', {
    method: 'POST',
    body: JSON.stringify({ badgeIds }),
  });
}
