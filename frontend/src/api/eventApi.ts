import { apiFetch } from './client';
import type { GameEvent, DrawResult } from './types';

export async function getActiveEvents(): Promise<GameEvent[]> {
  return apiFetch<GameEvent[]>('/event');
}

export async function drawEventPack(eventId: string, packType: 'standard' | 'premium'): Promise<DrawResult> {
  return apiFetch<DrawResult>('/event/draw', {
    method: 'POST',
    body: JSON.stringify({ event_id: eventId, pack_type: packType }),
  });
}
