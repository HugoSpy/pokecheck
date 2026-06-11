import { apiFetch } from './client';
import type { UserBadge, DailyLoginResult, SellResult, BulkSellResult, MyProfile, AllBadgeEntry, BadgeProgressEntry } from './types';

export async function getMyProfile(): Promise<MyProfile> {
  return apiFetch<MyProfile>('/users/me');
}

export async function getAllBadges(): Promise<AllBadgeEntry[]> {
  return apiFetch<AllBadgeEntry[]>('/users/all-badges');
}

export async function getBadgeProgress(): Promise<BadgeProgressEntry[]> {
  return apiFetch<BadgeProgressEntry[]>('/users/badges/progress');
}

export async function searchUsers(q: string): Promise<{ users: { id: string; display_name: string }[] }> {
  return apiFetch<{ users: { id: string; display_name: string }[] }>(`/users/search?q=${encodeURIComponent(q)}`);
}

export async function claimDailyLogin(): Promise<DailyLoginResult> {
  return apiFetch<DailyLoginResult>('/daily-login', { method: 'POST' });
}

export async function sellPokemon(userPokemonId: string): Promise<SellResult> {
  return apiFetch<SellResult>(`/sell/${userPokemonId}`, { method: 'POST' });
}

export async function sellPokemonBulk(ids: string[]): Promise<BulkSellResult> {
  return apiFetch<BulkSellResult>('/sell/bulk', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}

export async function getMyBadges(): Promise<UserBadge[]> {
  return apiFetch<UserBadge[]>('/users/badges/me');
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

export async function updateUsername(displayName: string): Promise<{ display_name: string }> {
  return apiFetch<{ display_name: string }>('/users/username', {
    method: 'PATCH',
    body: JSON.stringify({ display_name: displayName }),
  });
}

export async function updateTrainerProfile(patch: {
  trainer_gender?: 'M' | 'F';
  favorite_pokemon_id?: string | null;
}): Promise<{ trainer_gender: 'M' | 'F' | null; favorite_pokemon_id: string | null }> {
  return apiFetch('/users/profile', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function updateFeaturedBadges(badgeIds: string[]): Promise<void> {
  await apiFetch<void>('/users/featured-badges', {
    method: 'PATCH',
    body: JSON.stringify({ badgeIds }),
  });
}

export async function claimBadge(badgeId: string): Promise<{ coins_earned: number; total_coins: number }> {
  return apiFetch<{ coins_earned: number; total_coins: number }>(`/users/badges/${badgeId}/claim`, {
    method: 'POST',
  });
}
