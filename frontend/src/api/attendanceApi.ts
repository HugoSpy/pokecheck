import { apiFetch } from './client';
import type { PokemonInfo, DrawDuplicateInfo } from './types';

export interface AttendanceAvailable {
  available: boolean;
  reason?: 'available' | 'already_opened' | 'no_active_check' | 'expired' | 'unknown';
  attendance_id?: string;
  expires_at?: string;
}

export interface AttendanceCheckSummary {
  id: string;
  created_at: string;
  expires_at: string;
  cancelled_at: string | null;
  openings_count: number;
  total_users: number;
}

// ── User ──
export async function getAttendanceAvailable(): Promise<AttendanceAvailable> {
  return apiFetch<AttendanceAvailable>('/attendance/available', { cache: 'no-store' });
}

export async function openAttendance(attendanceId: string): Promise<{ pokemon: PokemonInfo } & DrawDuplicateInfo> {
  return apiFetch<{ pokemon: PokemonInfo } & DrawDuplicateInfo>('/attendance/open', {
    method: 'POST',
    body: JSON.stringify({ attendance_id: attendanceId }),
  });
}

// ── Admin ──
export async function startAttendanceCheck(force = false): Promise<{ id: string; expires_at: string }> {
  return apiFetch<{ id: string; expires_at: string }>('/admin/attendance/start', {
    method: 'POST',
    body: JSON.stringify({ force }),
  });
}

export async function getActiveAttendanceChecks(): Promise<{ checks: AttendanceCheckSummary[] }> {
  return apiFetch<{ checks: AttendanceCheckSummary[] }>('/admin/attendance/active');
}

export async function cancelAttendanceCheck(id: string): Promise<{ rolled_back_count: number; coins_removed: number }> {
  return apiFetch<{ rolled_back_count: number; coins_removed: number }>(`/admin/attendance/${id}/cancel`, {
    method: 'POST',
  });
}
