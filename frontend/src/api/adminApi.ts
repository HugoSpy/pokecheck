import { apiFetch } from './client';

export async function generateAdminPack(force_shiny: boolean): Promise<{ code: string }> {
  return apiFetch<{ code: string }>('/admin/generate-pack', {
    method: 'POST',
    body: JSON.stringify({ force_shiny }),
  });
}
