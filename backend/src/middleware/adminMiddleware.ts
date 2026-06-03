import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from './authMiddleware';

const prisma = new PrismaClient();

export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  authMiddleware(req, res, async () => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { is_admin: true },
      });

      if (!user?.is_admin) {
        res.status(403).json({ error: 'Admin access revoked' });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  });
}
