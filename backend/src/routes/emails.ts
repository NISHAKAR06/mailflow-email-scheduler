import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { EmailScheduler, ScheduleBatchParams } from '../queues/scheduler.queue';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * Email routes: schedule, list scheduled, list sent.
 */
export class EmailRoutes {
  private router: Router;
  private prisma: PrismaClient;
  private scheduler: EmailScheduler;

  constructor(prisma: PrismaClient, scheduler: EmailScheduler) {
    this.router = Router();
    this.prisma = prisma;
    this.scheduler = scheduler;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.post('/schedule', this.scheduleEmails.bind(this));
    this.router.get('/scheduled', this.getScheduled.bind(this));
    this.router.get('/sent', this.getSent.bind(this));
  }

  /**
   * POST /api/emails/schedule
   * Body: { senderId, recipients: string[], subject, body, startTime, delayMs, hourlyLimit }
   */
  private async scheduleEmails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { senderId, recipients, subject, body, startTime, delayMs, hourlyLimit } = req.body;

      // Validation
      if (!senderId || !recipients || !subject || !body || !startTime) {
        res.status(400).json({ error: 'Missing required fields: senderId, recipients, subject, body, startTime' });
        return;
      }

      if (!Array.isArray(recipients) || recipients.length === 0) {
        res.status(400).json({ error: 'recipients must be a non-empty array of email addresses' });
        return;
      }

      // Verify sender exists
      const sender = await this.prisma.sender.findUnique({ where: { id: senderId } });
      if (!sender) {
        res.status(404).json({ error: 'Sender not found' });
        return;
      }

      const params: ScheduleBatchParams = {
        senderId,
        recipients,
        subject,
        body,
        startTime,
        delayMs: delayMs || 1000,
        hourlyLimit: hourlyLimit || parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '50', 10),
      };

      const result = await this.scheduler.scheduleBatch(params);

      res.status(201).json({
        message: `Scheduled ${result.scheduled} emails (${result.skipped} skipped as duplicates)`,
        ...result,
      });
    } catch (error: any) {
      console.error('[EmailRoutes] Schedule error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * GET /api/emails/scheduled
   * Query: ?page=1&limit=20&senderId=xxx
   */
  private async getScheduled(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const senderId = req.query.senderId as string;
      const skip = (page - 1) * limit;

      const where: any = { status: 'pending' };
      if (senderId) where.senderId = senderId;

      const [emails, total] = await Promise.all([
        this.prisma.scheduledEmail.findMany({
          where,
          orderBy: { scheduledFor: 'asc' },
          skip,
          take: limit,
          include: { sender: { select: { email: true, name: true } } },
        }),
        this.prisma.scheduledEmail.count({ where }),
      ]);

      res.json({
        data: emails,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      console.error('[EmailRoutes] Get scheduled error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * GET /api/emails/sent
   * Query: ?page=1&limit=20&senderId=xxx
   */
  private async getSent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const senderId = req.query.senderId as string;
      const skip = (page - 1) * limit;

      const where: any = { status: { in: ['sent', 'failed'] } };
      if (senderId) where.senderId = senderId;

      const [emails, total] = await Promise.all([
        this.prisma.scheduledEmail.findMany({
          where,
          orderBy: { sentAt: 'desc' },
          skip,
          take: limit,
          include: { sender: { select: { email: true, name: true } } },
        }),
        this.prisma.scheduledEmail.count({ where }),
      ]);

      res.json({
        data: emails,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      console.error('[EmailRoutes] Get sent error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  getRouter(): Router {
    return this.router;
  }
}
