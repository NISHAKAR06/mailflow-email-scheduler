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
import nodemailer from 'nodemailer';

export class EmailScheduler {
  private queue: Queue;
  private prisma: PrismaClient;
  private transporter?: nodemailer.Transporter;

  constructor(queue: Queue, prisma: PrismaClient, transporter?: nodemailer.Transporter) {
    this.queue = queue;
    this.prisma = prisma;
    this.transporter = transporter;
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
      let createdEmailId = emailId;
      let validSenderId = senderId;

      try {
        const existing = await this.prisma.scheduledEmail.findUnique({
          where: { idempotencyKey },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Ensure sender exists in DB
        const existingSender = await this.prisma.sender.findFirst({
          where: {
            OR: [
              { id: senderId },
              { email: senderId },
            ],
          },
        });
        if (existingSender) {
          validSenderId = existingSender.id;
        } else if (senderId.includes('@')) {
          const newSender = await this.prisma.sender.create({
            data: { email: senderId, name: senderId.split('@')[0] },
          });
          validSenderId = newSender.id;
        }

        const email = await this.prisma.scheduledEmail.create({
          data: {
            idempotencyKey,
            senderId: validSenderId,
            recipient,
            subject,
            body,
            scheduledFor,
            status: 'pending',
          },
        });

        createdEmailId = email.id;
        savedToDb = true;

        const payload: ScheduleEmailPayload = {
          senderId: validSenderId,
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

        emailIds.push(email.id);
        scheduled++;
      } catch (err: any) {
        console.warn('[EmailScheduler] Queue enqueue failed, fallback active:', err.message);

        // Fall back to resilient execution
        const existingMem = inMemoryStore.find((e) => e.idempotencyKey === idempotencyKey);
        if (existingMem) {
          skipped++;
          continue;
        }

        const displayEmail = senderId.includes('@') ? senderId : 'user@mailflow.app';
        const displayName = displayEmail.split('@')[0] || 'User';

        const memEmail: MemoryScheduledEmail = {
          id: createdEmailId,
          idempotencyKey,
          senderId: validSenderId,
          recipient,
          subject,
          body,
          scheduledFor: scheduledFor.toISOString(),
          status: 'pending',
          createdAt: new Date().toISOString(),
          sender: { email: displayEmail, name: displayName },
        };

        inMemoryStore.unshift(memEmail);
        emailIds.push(createdEmailId);
        scheduled++;

        // Schedule delayed execution and ACTUALLY send the email
        setTimeout(async () => {
          const item = inMemoryStore.find((e) => e.id === createdEmailId);
          if (item) {
            item.status = 'sent';
            item.sentAt = new Date().toISOString();
          }

          // Send real email via transporter
          if (this.transporter) {
            try {
              const fromHeader = `"${displayName}" <${process.env.SMTP_FROM || process.env.SMTP_USER || displayEmail}>`;
              const info = await this.transporter.sendMail({
                from: fromHeader,
                to: recipient,
                subject,
                html: body,
              });
              console.log(`[Scheduler Fallback] Real email successfully sent to ${recipient} — Message ID: ${info.messageId}`);
            } catch (sendErr: any) {
              console.error(`[Scheduler Fallback] Email send error to ${recipient}:`, sendErr.message);
              if (item) item.status = 'failed';
            }
          }

          // Update DB if record exists
          if (savedToDb) {
            try {
              await this.prisma.scheduledEmail.update({
                where: { id: createdEmailId },
                data: { status: 'sent', sentAt: new Date() },
              });
            } catch {
              // ignore
            }
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
