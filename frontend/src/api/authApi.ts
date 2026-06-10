import { apiFetch } from './client';
import type { UserInfo } from './types';

export async function consumeOneShotToken(token: string): Promise<{ user: UserInfo }> {
  return apiFetch<{ user: UserInfo }>(`/auth/one-shot?token=${encodeURIComponent(token)}`);
}

// HIDDEN FEATURE - force_ditto added to response type
export async function consumeOneShotCode(code: string): Promise<{ user: UserInfo; force_shiny: boolean; force_ditto: boolean }> {
  return apiFetch<{ user: UserInfo; force_shiny: boolean; force_ditto: boolean }>(`/auth/one-shot?code=${encodeURIComponent(code)}`);
}
// END HIDDEN FEATURE
