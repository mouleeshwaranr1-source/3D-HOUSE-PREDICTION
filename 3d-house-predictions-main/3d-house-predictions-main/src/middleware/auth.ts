import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateFirebaseUser, getUserById, recordAuditLog } from '../db/repository.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'buildvision-architectural-studio-2026';

export interface SafeUserRecord {
  id: number;
  uid: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  emailVerified: boolean;
  avatarUrl: string | null;
  preferences: { unit: 'm' | 'ft'; currency: string; region: string } | null;
  lastLoginAt: Date | null;
  createdAt: Date | null;
}

export interface AuthRequest extends Request {
  dbUser?: SafeUserRecord;
}

export function signSessionToken(user: { id: number; uid: string; email: string; role: string }) {
  return jwt.sign(
    { userId: user.id, uid: user.uid, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function sanitizeUser(row: any): SafeUserRecord {
  const { passwordHash: _ph, ...safe } = row;
  return safe;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing authentication token' });
    return;
  }

  const token = authHeader.split('Bearer ')[1];

  // Try local JWT first
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; uid: string };
    if (decoded && typeof decoded.userId === 'number') {
      const user = await getUserById(decoded.userId);
      if (!user) {
        res.status(401).json({ error: 'Unauthorized: Account not found' });
        return;
      }
      if (user.status === 'suspended') {
        res.status(403).json({ error: 'Account suspended. Contact administrator.' });
        return;
      }
      req.dbUser = sanitizeUser(user);
      next();
      return;
    }
  } catch {
    // Fall through to Firebase ID token verification
  }

  try {
    const decodedFirebase = await adminAuth.verifyIdToken(token);
    const email = decodedFirebase.email || `${decodedFirebase.uid}@firebase.local`;
    const user = await getOrCreateFirebaseUser({
      uid: decodedFirebase.uid,
      email,
      fullName: decodedFirebase.name || email.split('@')[0],
      avatarUrl: decodedFirebase.picture,
      emailVerified: Boolean(decodedFirebase.email_verified),
    });
    if (user.status === 'suspended') {
      res.status(403).json({ error: 'Account suspended. Contact administrator.' });
      return;
    }
    req.dbUser = sanitizeUser(user);
    next();
  } catch (error) {
    console.error('Authentication verification failed:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.dbUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (req.dbUser.role !== 'admin') {
    await recordAuditLog({
      actorUserId: req.dbUser.id,
      actorEmail: req.dbUser.email,
      action: 'UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT',
      targetType: 'admin_route',
      targetId: req.originalUrl,
      details: `User with role "${req.dbUser.role}" attempted to access ${req.method} ${req.originalUrl}`,
    });
    res.status(403).json({ error: 'Forbidden: Administrator privileges required' });
    return;
  }
  next();
};
