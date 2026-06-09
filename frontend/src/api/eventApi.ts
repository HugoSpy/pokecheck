import { apiFetch } from './client';
import type { GameEvent, EventDrawResult, MultiEventDrawResult } from './types';

export async function getActiveEvents(): Promise<GameEvent[]> {
  return apiFetch<GameEvent[]>('/event');
}

export async function drawEventPack(eventId: string): Promise<EventDrawResult> {
  return apiFetch<EventDrawResult>('/event/draw', {
    method: 'POST',
    body: JSON.stringify({ event_id: eventId }),
  });
}

/** Multi-open (count > 1): returns one result per opened pack. */
export async function drawEventPackMulti(eventId: string, count: number): Promise<MultiEventDrawResult> {
  return apiFetch<MultiEventDrawResult>('/event/draw', {
    method: 'POST',
    body: JSON.stringify({ event_id: eventId, count }),
  });
}
