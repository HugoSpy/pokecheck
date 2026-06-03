import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthPayload {
  userId: string;
  ms_id: string;
  display_name: string;
  isAdmin?: boolean;
}

// Extend Express.User so passport and our JWT middleware share the same type
declare global {
  namespace Express {
    interface User extends AuthPayload {}
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const cookieToken = typeof req.cookies?.session === 'string' ? req.cookies.session : undefined;
  const bearerToken = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  const token = cookieToken ?? bearerToken;

  if (!token) {
    res.status(401).json({ error: 'Missing or invalid session' });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
