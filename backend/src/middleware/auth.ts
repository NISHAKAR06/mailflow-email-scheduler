import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  user?: {
    email: string;
    name?: string;
    senderId?: string;
  };
}

/**
 * JWT validation middleware.
 * Validates tokens issued by NextAuth (shared JWT_SECRET).
 * Extracts user info and attaches it to the request.
 */
export class AuthMiddleware {
  private secret: string;

  constructor() {
    this.secret = process.env.JWT_SECRET || 'fallback-secret';
    if (this.secret === 'fallback-secret') {
      console.warn('[AuthMiddleware] WARNING: Using fallback JWT secret. Set JWT_SECRET in .env');
    }
  }

  /**
   * Express middleware that validates the Authorization header.
   * Expects: Authorization: Bearer <token>
   */
  authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, this.secret) as {
        email?: string;
        name?: string;
        sub?: string;
        senderId?: string;
      };

      req.user = {
        email: decoded.email || decoded.sub || '',
        name: decoded.name,
        senderId: decoded.senderId,
      };

      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  };

  /**
   * Optional authentication — attaches user if token present, but doesn't block.
   */
  optionalAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, this.secret) as {
        email?: string;
        name?: string;
        sub?: string;
        senderId?: string;
      };

      req.user = {
        email: decoded.email || decoded.sub || '',
        name: decoded.name,
        senderId: decoded.senderId,
      };
    } catch {
      // Token invalid — continue without user
    }

    next();
  };
}
