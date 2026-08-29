import { Worker, Queue, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import Redis from 'ioredis';
import { RateLimiter } from '../lib/rateLimiter';
import { SlackNotifier } from '../lib/slack';
import { SearchIndexer } from '../lib/elasticsearch';
import { ScheduleEmailPayload } from './scheduler.queue';

/**
 * BullMQ worker that processes scheduled email jobs.
 *
 * Processing logic:
 * 1. Check rate limit for the sender in the current hour window.
 * 2. If under limit: send via nodemailer/Ethereal, update DB, index to Elasticsearch.
 * 3. If at limit: re-add a delayed job for the next hour window, notify via Slack if connected.
 *
 * Restart-safe: BullMQ jobs persist in Redis. The worker simply reconnects and
 * resumes processing — no boot-time re-enqueue is needed.
 */
export class EmailWorker {
  private worker: Worker;
  private queue: Queue;
  private prisma: PrismaClient;
  private rateLimiter: RateLimiter;
  private slackNotifier: SlackNotifier;
  private searchIndexer: SearchIndexer;
  private transporter: nodemailer.Transporter;

  constructor(
    queue: Queue,
    prisma: PrismaClient,
    rateLimiter: RateLimiter,
    slackNotifier: SlackNotifier,
    searchIndexer: SearchIndexer,
    transporter: nodemailer.Transporter,
    connection: Redis
  ) {
    this.queue = queue;
    this.prisma = prisma;
    this.rateLimiter = rateLimiter;
    this.slackNotifier = slackNotifier;
    this.searchIndexer = searchIndexer;
    this.transporter = transporter;

    const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '3', 10);
    const minSendDelayMs = parseInt(process.env.MIN_SEND_DELAY_MS || '500', 10);

    this.worker = new Worker(
      'email-queue',
      async (job: Job<ScheduleEmailPayload>) => {
        await this.processJob(job);
      },
      {
        connection,
        concurrency,
        limiter: {
          max: 1,
          duration: minSendDelayMs,
        },
      }
    );

    this.worker.on('completed', (job) => {
      console.log(`[EmailWorker] Job ${job.id} completed`);
    });

    this.worker.on('failed', (job, error) => {
      console.error(`[EmailWorker] Job ${job?.id} failed:`, error.message);
    });

    this.worker.on('error', (error) => {
      console.error('[EmailWorker] Worker error:', error);
    });

    console.log(`[EmailWorker] Started with concurrency=${concurrency}, minDelay=${minSendDelayMs}ms`);
  }

  /**
   * Core job processing logic.
   */
  private async processJob(job: Job<ScheduleEmailPayload>): Promise<void> {
    const { senderId, recipient, subject, body, idempotencyKey, emailId, hourlyLimit } = job.data;

    // Verify the email record still exists and is pending
    const emailRecord = await this.prisma.scheduledEmail.findUnique({
      where: { id: emailId },
      include: { sender: true },
    });

    if (!emailRecord || emailRecord.status !== 'pending') {
      console.log(`[EmailWorker] Skipping job ${job.id} — email ${emailId} is ${emailRecord?.status || 'missing'}`);
      return;
    }

    // Step 1: Check rate limit
    const limitCheck = await this.rateLimiter.checkLimit(senderId);

    if (!limitCheck.allowed) {
      // Rate limit exceeded — reschedule to next hour window
      await this.handleRateLimitExceeded(job, limitCheck.retryAfterMs!);
      return;
    }

    // Step 2: Send the email via nodemailer
    try {
      const fromSenderName = emailRecord.sender?.name || 'MailFlow';
      const fromSenderEmail = process.env.SMTP_FROM || process.env.SMTP_USER || emailRecord.sender?.email || 'mailflow@ethereal.email';
      const fromHeader = `"${fromSenderName}" <${fromSenderEmail}>`;

      const info = await this.transporter.sendMail({
        from: fromHeader,
        to: recipient,
        subject,
        html: body,
      });

      console.log(`[EmailWorker] Email successfully sent to ${recipient} (From: ${fromHeader}) — Message ID: ${info.messageId}`);
      const testPreview = nodemailer.getTestMessageUrl(info);
      if (testPreview) {
        console.log(`[EmailWorker] Test Preview URL: ${testPreview}`);
      }

      // Step 3: Increment rate counter AFTER successful send
      await this.rateLimiter.increment(senderId);

      // Step 4: Update DB status to 'sent'
      const updatedEmail = await this.prisma.scheduledEmail.update({
        where: { id: emailId },
        data: {
          status: 'sent',
          sentAt: new Date(),
        },
      });

      // Step 5: Index into Elasticsearch
      try {
        await this.searchIndexer.indexEmail({
          id: updatedEmail.id,
          senderId: updatedEmail.senderId,
          recipient: updatedEmail.recipient,
          subject: updatedEmail.subject,
          body: updatedEmail.body,
          status: updatedEmail.status,
          scheduledFor: updatedEmail.scheduledFor,
          sentAt: updatedEmail.sentAt,
          createdAt: updatedEmail.createdAt,
        });
      } catch (esError) {
        // Elasticsearch indexing failure is non-fatal
        console.error(`[EmailWorker] Elasticsearch indexing failed for ${emailId}:`, esError);
      }
    } catch (sendError: any) {
      console.error(`[EmailWorker] Failed to send email to ${recipient}:`, sendError.message);

      // Update DB status to 'failed'
      await this.prisma.scheduledEmail.update({
        where: { id: emailId },
        data: { status: 'failed' },
      });

      throw sendError; // Let BullMQ handle the retry
    }
  }

  /**
   * Handle rate-limit-exceeded: re-add a delayed job for the next hour window.
   * Do NOT fail the job — just silently reschedule.
   */
  private async handleRateLimitExceeded(
    job: Job<ScheduleEmailPayload>,
    retryAfterMs: number
  ): Promise<void> {
    const { senderId, recipient, subject, body, idempotencyKey, emailId, hourlyLimit } = job.data;

    console.log(
      `[EmailWorker] Rate limit hit for sender ${senderId}. ` +
      `Rescheduling email ${emailId} — retry in ${Math.round(retryAfterMs / 1000)}s`
    );

    // Calculate the start of the next hour + preserve intra-hour offset
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(nextHour.getHours() + 1);

    // Preserve original offset within the hour (minutes/seconds)
    const originalScheduled = new Date(job.data.scheduledFor);
    const offsetMs = (originalScheduled.getMinutes() * 60 + originalScheduled.getSeconds()) * 1000;
    const newScheduledFor = new Date(nextHour.getTime() + offsetMs);
    const newDelay = Math.max(0, newScheduledFor.getTime() - Date.now());

    // Generate a new idempotency key for the rescheduled time
    const newIdempotencyKey = `${idempotencyKey}_retry_${nextHour.toISOString()}`;

    try {
      await this.queue.add(
        'send-email',
        {
          ...job.data,
          scheduledFor: newScheduledFor.toISOString(),
        },
        {
          jobId: newIdempotencyKey,
          delay: newDelay,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { age: 86400 },
          removeOnFail: { age: 604800 },
        }
      );
    } catch (error: any) {
      // If the retry job already exists, that's fine
      if (!error.message?.includes('Job already exists')) {
        throw error;
      }
    }

    // Notify via Slack if connected (read fresh from DB)
    try {
      const message =
        `⚠️ *Rate limit reached* for sender \`${senderId}\`\n` +
        `Email to \`${recipient}\` (subject: "${subject}") has been rescheduled ` +
        `to ${newScheduledFor.toISOString()}.\n` +
        `Current limit: ${hourlyLimit} emails/hour.`;

      await this.slackNotifier.notify(senderId, message);
    } catch (slackError) {
      // Slack notification failure is non-fatal
      console.error('[EmailWorker] Slack notification failed:', slackError);
    }
  }

  /** Gracefully shut down the worker. */
  async close(): Promise<void> {
    await this.worker.close();
  }
}
