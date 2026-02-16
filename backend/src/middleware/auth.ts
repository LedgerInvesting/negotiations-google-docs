import { Request, Response, NextFunction } from 'express';
import { clerkMiddleware, requireAuth as clerkRequireAuth, getAuth } from '@clerk/express';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    orgId?: string;
  };
}

// Clerk middleware for authentication
export const requireAuth = clerkRequireAuth();

// Extract user info from Clerk auth
export const extractUserInfo = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const auth = getAuth(req);
    
    if (!auth || !auth.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Store in req.user instead of req.auth to avoid conflict with Clerk's auth()
    req.user = {
      userId: auth.userId,
      orgId: auth.orgId || undefined,
    };
    
    next();
  } catch (error) {
    console.error('Auth extraction error:', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
};
