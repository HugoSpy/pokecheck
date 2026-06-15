const COOLDOWN_MS = 60_000;
const LS_KEY = 'pokecheck_last_export_ts';

export function canExport(): boolean {
  const last = localStorage.getItem(LS_KEY);
  if (!last) return true;
  return Date.now() - parseInt(last) > COOLDOWN_MS;
}

export function getRemainingCooldownSeconds(): number {
  const last = localStorage.getItem(LS_KEY);
  if (!last) return 0;
  const remaining = COOLDOWN_MS - (Date.now() - parseInt(last));
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

export function markExport(): void {
  localStorage.setItem(LS_KEY, Date.now().toString());
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const val = String(row[h] ?? '');
        return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(',')
    ),
  ];
  return lines.join('\n');
}

export function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
