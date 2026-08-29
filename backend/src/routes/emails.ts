import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { EmailScheduler, ScheduleBatchParams, inMemoryStore } from '../queues/scheduler.queue';
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
   */
  private async scheduleEmails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { senderId, recipients, subject, body, startTime, delayMs, hourlyLimit } = req.body;

      if (!senderId || !recipients || !subject || !body || !startTime) {
        res.status(400).json({ error: 'Missing required fields: senderId, recipients, subject, body, startTime' });
        return;
      }

      if (!Array.isArray(recipients) || recipients.length === 0) {
        res.status(400).json({ error: 'recipients must be a non-empty array of email addresses' });
        return;
      }

      const params: ScheduleBatchParams = {
        senderId,
        recipients,
        subject,
        body,
        startTime,
        delayMs: delayMs || 1000,
        hourlyLimit: hourlyLimit || 50,
      };

      const result = await this.scheduler.scheduleBatch(params);

      res.status(201).json({
        message: `Scheduled ${result.scheduled} email(s) successfully (${result.skipped} skipped as duplicate)`,
        ...result,
      });
    } catch (error: any) {
      console.error('[EmailRoutes] Schedule error:', error.message);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  /**
   * GET /api/emails/scheduled
   */
  private async getScheduled(req: AuthenticatedRequest, res: Response): Promise<void> {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const senderId = (req.query.senderId as string) || (req.user as any)?.senderId || req.user?.email;

    try {
      const skip = (page - 1) * limit;
      const where: any = { status: 'pending' };
      if (senderId) {
        where.OR = [
          { senderId: senderId },
          { sender: { email: senderId } },
          { sender: { id: senderId } },
        ];
      }

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
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      });
      return;
    } catch (err: any) {
      console.warn('[EmailRoutes] DB getScheduled query error:', err.message);
    }

    // Fallback to in-memory store if DB is offline
    const memEmails = inMemoryStore.filter(
      (e) => e.status === 'pending' && (!senderId || e.senderId === senderId || e.sender?.email === senderId)
    );
    const start = (page - 1) * limit;
    const paginated = memEmails.slice(start, start + limit);

    res.json({
      data: paginated,
      pagination: {
        page,
        limit,
        total: memEmails.length,
        totalPages: Math.ceil(memEmails.length / limit) || 1,
      },
    });
  }

  /**
   * GET /api/emails/sent
   */
  private async getSent(req: AuthenticatedRequest, res: Response): Promise<void> {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const senderId = (req.query.senderId as string) || (req.user as any)?.senderId || req.user?.email;

    try {
      const skip = (page - 1) * limit;
      const where: any = { status: { in: ['sent', 'failed'] } };
      if (senderId) {
        where.OR = [
          { senderId: senderId },
          { sender: { email: senderId } },
          { sender: { id: senderId } },
        ];
      }

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
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      });
      return;
    } catch (err: any) {
      console.warn('[EmailRoutes] DB getSent query error:', err.message);
    }

    // Fallback to in-memory store if DB is offline
    const memEmails = inMemoryStore.filter(
      (e) => (e.status === 'sent' || e.status === 'failed') && (!senderId || e.senderId === senderId || e.sender?.email === senderId)
    );
    const start = (page - 1) * limit;
    const paginated = memEmails.slice(start, start + limit);

    res.json({
      data: paginated,
      pagination: {
        page,
        limit,
        total: memEmails.length,
        totalPages: Math.ceil(memEmails.length / limit) || 1,
      },
    });
  }

  getRouter(): Router {
    return this.router;
  }
}
