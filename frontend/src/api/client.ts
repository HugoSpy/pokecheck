const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const SESSION_KEY = 'pokecheck_session';

export function getToken(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(SESSION_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(SESSION_KEY);
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
    const err = new Error(body.error ?? `HTTP ${res.status}`);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }

  return res.json() as Promise<T>;
}
