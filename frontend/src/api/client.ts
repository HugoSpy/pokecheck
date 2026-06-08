const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// [DEV ONLY - NEVER MERGE] localStorage key for the test-account backdoor JWT
// (see Login.tsx loginAsTest / backend routes/devAuth.ts). Storing it per-tab
// in localStorage — instead of relying on the shared httpOnly session cookie —
// lets two browser tabs be logged in as two different test accounts at once.
export const DEV_TOKEN_STORAGE_KEY = 'pokecheck_dev_token';

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  const devToken = localStorage.getItem(DEV_TOKEN_STORAGE_KEY);
  if (devToken) headers['Authorization'] = `Bearer ${devToken}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: 'include' });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
    const err = new Error(body.error ?? `HTTP ${res.status}`);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function logout(): Promise<void> {
  await apiFetch<void>('/auth/logout', { method: 'POST' });
}
