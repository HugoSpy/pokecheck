import { apiFetch } from './client';
import type { GameEvent, EventDrawResult } from './types';

export async function getActiveEvents(): Promise<GameEvent[]> {
  return apiFetch<GameEvent[]>('/event');
}

export async function drawEventPack(eventId: string): Promise<EventDrawResult> {
  return apiFetch<EventDrawResult>('/event/draw', {
    method: 'POST',
    body: JSON.stringify({ event_id: eventId }),
  });
}
