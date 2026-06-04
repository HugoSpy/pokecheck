import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type NotificationType = 'BADGE' | 'TRADE_RECEIVED' | 'TRADE_ACCEPTED' | 'ATTENDANCE';

export async function createNotification(
  userId: string,
  type: NotificationType,
  payload: Record<string, unknown>
): Promise<void> {
  await prisma.notification.create({
    data: { user_id: userId, type, payload },
  });
}

export async function createNotificationForAllUsers(
  type: 'ATTENDANCE',
  payload: Record<string, unknown>
): Promise<void> {
  const users = await prisma.user.findMany({ select: { id: true } });
  await prisma.notification.createMany({
    data: users.map(u => ({ user_id: u.id, type, payload })),
  });
}
