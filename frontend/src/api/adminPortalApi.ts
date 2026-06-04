import { apiFetch } from './client';

export interface AdminUser {
  id: string;
  display_name: string;
}

export function getAdminUsers(): Promise<{ users: AdminUser[] }> {
  return apiFetch('/admin/users');
}

export function sendMessageAll(content: string): Promise<{ sent: number }> {
  return apiFetch('/admin/message/all', {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export function sendMessageUser(userId: string, content: string): Promise<{ ok: boolean }> {
  return apiFetch('/admin/message/user', {
    method: 'POST',
    body: JSON.stringify({ userId, content }),
  });
}
