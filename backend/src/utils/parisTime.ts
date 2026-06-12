/** "YYYY-MM-DD" for the current Paris day (DST-aware). */
export function parisDayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Midnight UTC for the given Paris calendar day — used as a stable vote_date key. */
export function getParisDayStart(date: Date = new Date()): Date {
  return new Date(parisDayKey(date) + 'T00:00:00.000Z');
}
