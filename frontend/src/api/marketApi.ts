import { apiFetch } from './client';
import type { MarketListing } from './types';

export async function getMarketListings(): Promise<MarketListing[]> {
  return apiFetch<MarketListing[]>('/market');
}

export async function createListing(userPokemonId: string, price_coins: number): Promise<MarketListing> {
  return apiFetch<MarketListing>('/market/list', {
    method: 'POST',
    body: JSON.stringify({ userPokemonId, price_coins }),
  });
}

export async function buyListing(listingId: string): Promise<{ success: boolean; coins_remaining: number; new_badges: string[] }> {
  return apiFetch<{ success: boolean; coins_remaining: number; new_badges: string[] }>(`/market/buy/${listingId}`, {
    method: 'POST',
  });
}

export async function cancelListing(listingId: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/market/cancel/${listingId}`, {
    method: 'POST',
  });
}
