import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Queue } from 'bullmq';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import nodemailer from 'nodemailer';

import { DatabaseClient, prisma } from './lib/prisma';
import { RedisManager } from './lib/redis';
import { RateLimiter } from './lib/rateLimiter';
import { SlackNotifier } from './lib/slack';
import { SearchIndexer } from './lib/elasticsearch';
import { EmailScheduler } from './queues/scheduler.queue';
import { EmailWorker } from './queues/email.worker';
import { AuthMiddleware } from './middleware/auth';
import { EmailRoutes } from './routes/emails';
import { SearchRoutes } from './routes/search';
import { AuthRoutes } from './routes/auth';
import { SlackRoutes } from './routes/slack';

async function main() {
  const app = express();
  const port = parseInt(process.env.PORT || '4000', 10);

  // ── Middleware ────────────────────────────────────
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    })
  );
  app.use(express.json({ limit: '10mb' }));

  // ── Infrastructure Clients ───────────────────────
  const redis = RedisManager.getInstance();
  const workerConnection = RedisManager.createConnection();

  // ── BullMQ Queue using safe RedisManager connection ──
  const emailQueue = new Queue('email-queue', {
    connection: redis as any,
  });

  emailQueue.on('error', (err: any) => {
    if (err?.code !== 'ECONNREFUSED') {
      console.warn('[Queue] Event:', err.message);
    }
  });

  // ── Nodemailer Transporter ────────────────────────
  let transporter: nodemailer.Transporter;

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for 587 / other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log(`[Server] Real SMTP Transporter initialized (${process.env.SMTP_HOST || 'smtp.gmail.com'}:${smtpPort}) for ${process.env.SMTP_USER}`);
  } else {
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log(`[Server] Ethereal account ready: ${testAccount.user}`);
    } catch {
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: 'test', pass: 'test' },
      });
    }
  }

  // ── Service Classes (OOP, constructor-injected) ──
  const rateLimiter = new RateLimiter(redis);
  const slackNotifier = new SlackNotifier(prisma);
  const searchIndexer = new SearchIndexer();
  const emailScheduler = new EmailScheduler(emailQueue, prisma, transporter);
  const authMiddleware = new AuthMiddleware();

  // ── Initialize Elasticsearch Index ───────────────
  searchIndexer.initialize().catch((error) => {
    console.warn('[Server] Elasticsearch not ready — search fallback active:', error.message);
  });

  // ── BullMQ Worker ────────────────────────────────
  let emailWorker: EmailWorker | null = null;
  try {
    emailWorker = new EmailWorker(
      emailQueue,
      prisma,
      rateLimiter,
      slackNotifier,
      searchIndexer,
      transporter,
      workerConnection
    );
  } catch (err: any) {
    console.warn('[Server] Worker init deferred until Redis is reachable:', err.message);
  }

  // ── Bull Board (live queue dashboard) ────────────
  try {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');
    createBullBoard({
      queues: [new BullMQAdapter(emailQueue) as any],
      serverAdapter,
    });
    app.use('/admin/queues', serverAdapter.getRouter());
  } catch (err: any) {
    console.warn('[Server] Bull Board init deferred:', err.message);
  }

  // ── API Routes ───────────────────────────────────
  const emailRoutes = new EmailRoutes(prisma, emailScheduler);
  const searchRoutes = new SearchRoutes(searchIndexer);
  const authRoutes = new AuthRoutes(prisma);
  const slackRoutes = new SlackRoutes(slackNotifier);

  // Public routes
  app.use('/api/auth', authRoutes.getRouter());
  app.use('/api/slack', slackRoutes.getRouter());

  // Protected routes (require JWT)
  app.use('/api/emails', authMiddleware.authenticate, emailRoutes.getRouter());
  app.use('/api/emails', authMiddleware.authenticate, searchRoutes.getRouter());

  // ── Health Check ─────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── Start HTTP Server ────────────────────────────
  const server = app.listen(port, () => {
    console.log(`[Server] MailFlow backend running on port ${port}`);
    console.log(`[Server] Bull Board: http://localhost:${port}/admin/queues`);
    console.log(`[Server] Health check: http://localhost:${port}/api/health`);
  });

  // ── Graceful Shutdown ────────────────────────────
  const shutdown = async () => {
    console.log('\n[Server] Shutting down gracefully...');
    if (emailWorker) await emailWorker.close();
    await emailQueue.close();
    await RedisManager.disconnect();
    await DatabaseClient.disconnect();
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('[Server] Fatal error:', error);
});
