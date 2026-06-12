import { apiFetch } from './client';

export type FeatureStatus = 'PENDING' | 'PUBLISHED' | 'DONE';

export interface Feature {
  id: string;
  title: string;
  description: string;
  status: FeatureStatus;
  created_at: string;
  published_at: string | null;
  creator: string;
  score: number;
  myVoteToday: 1 | -1 | null;
}

export interface PendingFeature {
  id: string;
  title: string;
  description: string;
  status: FeatureStatus;
  created_by: string;
  created_at: string;
  published_at: string | null;
  done_at: string | null;
  creator_name: string;
}

export interface HistoryFeature {
  id: string;
  title: string;
  description: string;
  status: FeatureStatus;
  created_at: string;
  published_at: string | null;
  done_at: string | null;
  creator_name: string;
  score: number;
}

export interface VoteResult {
  score: number;
  myVoteToday: 1 | -1 | null;
}

// ── Public ────────────────────────────────────────────────────────────────────

export async function getFeatures(): Promise<Feature[]> {
  return apiFetch<Feature[]>('/features');
}

export async function proposeFeature(title: string, description: string): Promise<{ id: string; status: FeatureStatus }> {
  return apiFetch<{ id: string; status: FeatureStatus }>('/features/propose', {
    method: 'POST',
    body: JSON.stringify({ title, description }),
  });
}

export async function voteFeature(id: string, value: 1 | -1): Promise<VoteResult> {
  return apiFetch<VoteResult>(`/features/${id}/vote`, {
    method: 'POST',
    body: JSON.stringify({ value }),
  });
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export async function getPendingFeatures(): Promise<PendingFeature[]> {
  return apiFetch<PendingFeature[]>('/admin/features/pending');
}

export async function publishFeature(
  id: string,
  edits: { title?: string; description?: string },
): Promise<PendingFeature> {
  return apiFetch<PendingFeature>(`/admin/features/${id}/publish`, {
    method: 'PATCH',
    body: JSON.stringify(edits),
  });
}

export async function editFeature(
  id: string,
  edits: { title?: string; description?: string },
): Promise<PendingFeature> {
  return apiFetch<PendingFeature>(`/admin/features/${id}/edit`, {
    method: 'PATCH',
    body: JSON.stringify(edits),
  });
}

export async function rejectFeature(id: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/admin/features/${id}/reject`, { method: 'PATCH' });
}

export async function markFeatureDone(id: string): Promise<PendingFeature> {
  return apiFetch<PendingFeature>(`/admin/features/${id}/done`, { method: 'PATCH' });
}

export async function getFeaturesHistory(): Promise<HistoryFeature[]> {
  return apiFetch<HistoryFeature[]>('/admin/features/history');
}
