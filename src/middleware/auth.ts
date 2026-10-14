import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { verifySignedUserToken } from '../server/licenseStore.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken | { uid: string; email: string; tier?: string };
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1].trim();
  try {
    // Attempt Firebase ID token verification
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    return next();
  } catch {
    // Fallback: Verify HMAC signed user token
    const signed = verifySignedUserToken(token);
    if (signed.valid && signed.user) {
      req.user = {
        uid: signed.user.email,
        email: signed.user.email,
        tier: signed.user.tier,
      };
      return next();
    }

    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split('Bearer ')[1].trim();
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
  } catch {
    const signed = verifySignedUserToken(token);
    if (signed.valid && signed.user) {
      req.user = {
        uid: signed.user.email,
        email: signed.user.email,
        tier: signed.user.tier,
      };
    }
  }
  next();
};
