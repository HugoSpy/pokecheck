import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const notifications = await prisma.notification.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
  });
  const unreadCount = notifications.filter(n => !n.read).length;
  res.json({ notifications, unreadCount });
});

router.get('/unread-count', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const count = await prisma.notification.count({
    where: { user_id: userId, read: false },
  });
  res.json({ count });
});

// read-all MUST come before /:id/read to avoid Express matching 'read-all' as an id
router.patch('/read-all', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { count } = await prisma.notification.updateMany({
    where: { user_id: userId, read: false },
    data: { read: true },
  });
  res.json({ updated: count });
});

router.patch('/:id/read', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const id = String(req.params.id);
  const notif = await prisma.notification.findUnique({ where: { id } });
  if (!notif || notif.user_id !== userId) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }
  await prisma.notification.update({ where: { id }, data: { read: true } });
  res.json({ ok: true });
});

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const id = String(req.params.id);
  const notif = await prisma.notification.findUnique({ where: { id } });
  if (!notif || notif.user_id !== userId) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }
  await prisma.notification.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
