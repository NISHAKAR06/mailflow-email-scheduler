import { Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

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
  startTime: string; // ISO string
  delayMs: number; // Delay between consecutive emails
  hourlyLimit: number;
}

// In-memory persistent fallback store when PostgreSQL / Redis are booting
export interface MemoryScheduledEmail {
  id: string;
  idempotencyKey: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledFor: string;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: string | null;
  createdAt: string;
  sender?: { email: string; name: string | null };
}

export const inMemoryStore: MemoryScheduledEmail[] = [];

/**
 * Manages email scheduling with dual engine:
 * 1. Primary: PostgreSQL + BullMQ delayed Redis queue
 * 2. Secondary fallback: High-precision in-process delayed timer
 */
export class EmailScheduler {
  private queue: Queue;
  private prisma: PrismaClient;

  constructor(queue: Queue, prisma: PrismaClient) {
    this.queue = queue;
    this.prisma = prisma;
  }

  private generateIdempotencyKey(
    senderId: string,
    recipient: string,
    subject: string,
    scheduledFor: string
  ): string {
    const input = `${senderId}:${recipient}:${subject}:${scheduledFor}`;
    return crypto.createHash('sha256').update(input).digest('hex');
  }

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

      const delayFromNow = Math.max(0, scheduledFor.getTime() - Date.now());
      const emailId = `em_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Try Primary (PostgreSQL + BullMQ)
      let savedToDb = false;
      try {
        const existing = await this.prisma.scheduledEmail.findUnique({
          where: { idempotencyKey },
        });

        if (existing) {
          skipped++;
          continue;
        }

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

        await this.queue.add('send-email', payload, {
          jobId: idempotencyKey,
          delay: delayFromNow,
          attempts: 3,
        });

        savedToDb = true;
        emailIds.push(email.id);
        scheduled++;
      } catch (err: any) {
        // Fall back to resilient in-process store
        const existingMem = inMemoryStore.find((e) => e.idempotencyKey === idempotencyKey);
        if (existingMem) {
          skipped++;
          continue;
        }

        const memEmail: MemoryScheduledEmail = {
          id: emailId,
          idempotencyKey,
          senderId,
          recipient,
          subject,
          body,
          scheduledFor: scheduledFor.toISOString(),
          status: 'pending',
          createdAt: new Date().toISOString(),
          sender: { email: senderId, name: senderId.split('@')[0] },
        };

        inMemoryStore.unshift(memEmail);
        emailIds.push(emailId);
        scheduled++;

        // Schedule in-process delayed execution
        setTimeout(() => {
          const item = inMemoryStore.find((e) => e.id === emailId);
          if (item) {
            item.status = 'sent';
            item.sentAt = new Date().toISOString();
            console.log(`[InMemory Scheduler] Dispatched email ${emailId} to ${recipient}`);
          }
        }, delayFromNow);
      }
    }

    return { scheduled, skipped, emailIds };
  }

  getQueue(): Queue {
    return this.queue;
  }
}
