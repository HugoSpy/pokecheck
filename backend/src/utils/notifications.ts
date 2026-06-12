import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';


export type NotificationType = 'BADGE' | 'TRADE_RECEIVED' | 'TRADE_ACCEPTED' | 'ATTENDANCE' | 'ADMIN_MESSAGE';

export async function createNotification(
  userId: string,
  type: NotificationType,
  payload: Record<string, unknown>
): Promise<void> {
  await prisma.notification.create({
    data: { user_id: userId, type, payload: payload as Prisma.InputJsonValue },
  });
}

export async function createNotificationForAllUsers(
  type: 'ATTENDANCE' | 'ADMIN_MESSAGE',
  payload: Record<string, unknown>
): Promise<void> {
  const users = await prisma.user.findMany({ select: { id: true } });
  await prisma.notification.createMany({
    data: users.map(u => ({ user_id: u.id, type, payload: payload as Prisma.InputJsonValue })),
  });
}
