import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

/**
 * Auth routes: session info and sender upsert.
 */
export class AuthRoutes {
  private router: Router;
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.router = Router();
    this.prisma = prisma;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.get('/session', this.getSession.bind(this));
    this.router.post('/sender', this.upsertSender.bind(this));
  }

  /**
   * GET /api/auth/session
   * Returns current user info from JWT.
   */
  private async getSession(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const token = authHeader.split(' ')[1];
      const secret = process.env.JWT_SECRET || 'fallback-secret';

      const decoded = jwt.verify(token, secret) as {
        email?: string;
        name?: string;
        sub?: string;
        picture?: string;
        senderId?: string;
      };

      // Find sender in DB
      const sender = await this.prisma.sender.findUnique({
        where: { email: decoded.email || decoded.sub || '' },
        include: { slackIntegration: true },
      });

      res.json({
        user: {
          email: decoded.email || decoded.sub,
          name: decoded.name,
          picture: decoded.picture,
          senderId: sender?.id,
          slackConnected: !!sender?.slackIntegration,
        },
      });
    } catch (error) {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  /**
   * POST /api/auth/sender
   * Creates or finds a Sender record for the authenticated user.
   * Called by the frontend after Google OAuth login.
   */
  private async upsertSender(req: Request, res: Response): Promise<void> {
    try {
      const { email, name } = req.body;

      if (!email) {
        res.status(400).json({ error: 'Email is required' });
        return;
      }

      const sender = await this.prisma.sender.upsert({
        where: { email },
        update: { name: name || undefined },
        create: { email, name },
      });

      res.json({ sender });
    } catch (error: any) {
      console.error('[AuthRoutes] Upsert sender error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  getRouter(): Router {
    return this.router;
  }
}
