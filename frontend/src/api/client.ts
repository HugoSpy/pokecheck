const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// [DEV ONLY - NEVER MERGE] sessionStorage key for the test-account backdoor JWT
// (see Login.tsx loginAsTest / backend routes/devAuth.ts). sessionStorage is
// scoped per-tab - unlike localStorage and cookies, which are shared across
// every tab of the same origin - so two tabs can independently be Test 1/Test 2.
export const DEV_TOKEN_STORAGE_KEY = 'pokecheck_dev_token';

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  const devToken = sessionStorage.getItem(DEV_TOKEN_STORAGE_KEY);
  if (devToken) headers['Authorization'] = `Bearer ${devToken}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: 'include' });

  if (res.status === 401) {
    // Drops a stale/expired test-account token so it doesn't keep getting
    // resent on every retry. removeItem on an absent key is a no-op, so this
    // is harmless for normal (cookie-based) sessions too.
    sessionStorage.removeItem(DEV_TOKEN_STORAGE_KEY);
  }

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
