import { apiFetch } from './client';
import type { TradeOffer, SentTrade, ProposeTradePayload } from './types';

export async function getTradeOffers(): Promise<TradeOffer[]> {
  return apiFetch<TradeOffer[]>('/trade/offers');
}

export async function getSentTrades(): Promise<SentTrade[]> {
  return apiFetch<SentTrade[]>('/trade/sent');
}

export async function cancelTrade(id: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/trade/cancel/${id}`, { method: 'POST' });
}

export async function proposeTrade(payload: ProposeTradePayload): Promise<{ id: string }> {
  return apiFetch<{ id: string }>('/trade/propose', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function acceptTrade(id: string): Promise<{
  success: boolean;
  bonusDraws: string[];
  shiny_proc?: boolean;
  shiny_pokemon_name?: string;
}> {
  return apiFetch<{
    success: boolean;
    bonusDraws: string[];
    shiny_proc?: boolean;
    shiny_pokemon_name?: string;
  }>(`/trade/accept/${id}`, { method: 'POST' });
}

export async function declineTrade(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/trade/decline/${id}`, { method: 'POST' });
}
