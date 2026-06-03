import { apiFetch } from './client';
import type { UserInfo } from './types';

export async function consumeOneShotToken(token: string): Promise<{ user: UserInfo }> {
  return apiFetch<{ user: UserInfo }>(`/auth/one-shot?token=${encodeURIComponent(token)}`);
}

export async function consumeOneShotCode(code: string): Promise<{ user: UserInfo; force_shiny: boolean }> {
  return apiFetch<{ user: UserInfo; force_shiny: boolean }>(`/auth/one-shot?code=${encodeURIComponent(code)}`);
}
