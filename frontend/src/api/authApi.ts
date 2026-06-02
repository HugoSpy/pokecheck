import { apiFetch, setToken } from './client';
import type { UserInfo } from './types';

export async function consumeOneShotToken(token: string): Promise<{ sessionToken: string; user: UserInfo }> {
  const data = await apiFetch<{ sessionToken: string; user: UserInfo }>(`/auth/one-shot?token=${encodeURIComponent(token)}`);
  setToken(data.sessionToken);
  return data;
}

export async function consumeOneShotCode(code: string): Promise<{ sessionToken: string; user: UserInfo; force_shiny: boolean }> {
  const data = await apiFetch<{ sessionToken: string; user: UserInfo; force_shiny: boolean }>(`/auth/one-shot?code=${encodeURIComponent(code)}`);
  setToken(data.sessionToken);
  return data;
}
