import { Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import Redis from 'ioredis';

export interface ScheduleEmailPayload {
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledFor: string; // ISO string
  idempotencyKey: string;
  emailId: string;
  hourlyLimit: number;
}

export interface ScheduleBatchParams {
  senderId: string;
  recipients: string[];
  subject: string;
  body: string;
  startTime: string;    // ISO string
  delayMs: number;       // Delay between consecutive emails
  hourlyLimit: number;
}

/**
 * Manages the BullMQ queue for scheduling emails.
 * Responsible for creating ScheduledEmail DB rows and enqueuing delayed jobs.
 * Uses deterministic idempotency keys to prevent duplicate sends across restarts.
 */
export class EmailScheduler {
  private queue: Queue;
  private prisma: PrismaClient;

  constructor(queue: Queue, prisma: PrismaClient) {
    this.queue = queue;
    this.prisma = prisma;
  }

  /**
   * Generate a deterministic idempotency key.
   * SHA-256 hash of senderId + recipient + subject + scheduledFor.
   * This key is used as the BullMQ jobId so re-enqueue attempts are deduped by BullMQ itself.
   */
  private generateIdempotencyKey(
    senderId: string,
    recipient: string,
    subject: string,
    scheduledFor: string
  ): string {
    const input = `${senderId}:${recipient}:${subject}:${scheduledFor}`;
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * Schedule a batch of emails.
   * For each recipient:
   *   1. Compute scheduledFor = startTime + (index * delayMs)
   *   2. Create a ScheduledEmail row with a deterministic idempotencyKey
   *   3. Add a BullMQ delayed job with jobId = idempotencyKey
   */
  async scheduleBatch(params: ScheduleBatchParams): Promise<{
    scheduled: number;
    skipped: number;
    emailIds: string[];
  }> {
    const { senderId, recipients, subject, body, startTime, delayMs, hourlyLimit } = params;
    const startDate = new Date(startTime);
    let scheduled = 0;
    let skipped = 0;
    const emailIds: string[] = [];

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      const scheduledFor = new Date(startDate.getTime() + i * delayMs);
      const idempotencyKey = this.generateIdempotencyKey(
        senderId,
        recipient,
        subject,
        scheduledFor.toISOString()
      );

      // Check if this email was already scheduled (idempotency)
      const existing = await this.prisma.scheduledEmail.findUnique({
        where: { idempotencyKey },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Create the DB row
      const email = await this.prisma.scheduledEmail.create({
        data: {
          idempotencyKey,
          senderId,
          recipient,
          subject,
          body,
          scheduledFor,
          status: 'pending',
        },
      });

      // Calculate delay from now
      const delayFromNow = Math.max(0, scheduledFor.getTime() - Date.now());

      // Add BullMQ job with idempotencyKey as jobId for deduplication
      const payload: ScheduleEmailPayload = {
        senderId,
        recipient,
        subject,
        body,
        scheduledFor: scheduledFor.toISOString(),
        idempotencyKey,
        emailId: email.id,
        hourlyLimit,
      };

      try {
        await this.queue.add('send-email', payload, {
          jobId: idempotencyKey,
          delay: delayFromNow,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: { age: 86400 }, // Keep completed jobs for 24h
          removeOnFail: { age: 604800 },    // Keep failed jobs for 7 days
        });
        scheduled++;
        emailIds.push(email.id);
      } catch (error: any) {
        // BullMQ throws if jobId already exists — this is expected idempotency behavior
        if (error.message?.includes('Job already exists')) {
          skipped++;
        } else {
          throw error;
        }
      }
    }

    return { scheduled, skipped, emailIds };
  }

  /** Get the underlying queue instance (for bull-board). */
  getQueue(): Queue {
    return this.queue;
  }
}
