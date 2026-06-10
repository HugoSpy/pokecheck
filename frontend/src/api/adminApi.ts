import { apiFetch } from './client';

// HIDDEN FEATURE - force_ditto added
export async function generateAdminPack(force_shiny: boolean, force_ditto = false): Promise<{ code: string }> {
  return apiFetch<{ code: string }>('/admin/generate-pack', {
    method: 'POST',
    body: JSON.stringify({ force_shiny, force_ditto }),
  });
}
// END HIDDEN FEATURE
