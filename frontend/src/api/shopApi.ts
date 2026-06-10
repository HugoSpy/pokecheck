import { apiFetch } from './client';
import type { DailyShop, ShopBuyResult } from './types';

/** Today's 3 rotating packs + whether the current user already bought each. */
export async function getDailyShop(): Promise<DailyShop> {
  return apiFetch<DailyShop>('/shop/daily');
}

/** Buy a pack: deduct coins and draw one Pokémon from that generation. */
export async function buyShopPack(gen: number): Promise<ShopBuyResult> {
  return apiFetch<ShopBuyResult>(`/shop/buy/${gen}`, { method: 'POST' });
}
