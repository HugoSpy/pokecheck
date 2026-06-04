import { apiFetch } from './client';

export interface NotificationItem {
  id: string;
  type: 'BADGE' | 'TRADE_RECEIVED' | 'TRADE_ACCEPTED' | 'ATTENDANCE' | 'ADMIN_MESSAGE';
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export function getNotifications(): Promise<{ notifications: NotificationItem[]; unreadCount: number }> {
  return apiFetch('/notifications');
}

export function getUnreadCount(): Promise<{ count: number }> {
  return apiFetch('/notifications/unread-count');
}

export function markRead(id: string): Promise<{ ok: boolean }> {
  return apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
}

export function markAllRead(): Promise<{ updated: number }> {
  return apiFetch('/notifications/read-all', { method: 'PATCH' });
}

export function deleteNotification(id: string): Promise<{ ok: boolean }> {
  return apiFetch(`/notifications/${id}`, { method: 'DELETE' });
}
