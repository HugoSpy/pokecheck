import { apiFetch } from './client';
import type { DailyShop, ShopBuyResult, MultiEventDrawResult } from './types';

/** Today's 3 rotating packs. */
export async function getDailyShop(): Promise<DailyShop> {
  return apiFetch<DailyShop>('/shop/daily');
}

/** Buy a single pack: draw one Pokémon from that generation. */
export async function buyShopPack(gen: number): Promise<ShopBuyResult> {
  return apiFetch<ShopBuyResult>(`/shop/buy/${gen}`, { method: 'POST' });
}

/** Multi-open (count > 1): N draws from that gen, one result per opened pack. */
export async function buyShopPackMulti(gen: number, count: number): Promise<MultiEventDrawResult> {
  return apiFetch<MultiEventDrawResult>(`/shop/buy/${gen}`, {
    method: 'POST',
    body: JSON.stringify({ count }),
  });
}
