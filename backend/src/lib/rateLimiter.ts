import Redis from 'ioredis';

/**
 * Rate limiter using Redis INCR + conditional EXPIRE.
 *
 * Concurrency-safety note:
 * We use INCR first, then conditionally EXPIRE when the counter is 1 (newly created).
 * This is not perfectly atomic — there's a tiny gap between INCR and EXPIRE where a
 * crash could leave a key without an expiry. In practice this is safe for our use case:
 * the worst case is a counter that persists beyond its hour window, which is conservative
 * (over-counts, never under-counts). For true atomicity, a Lua script combining both
 * operations would be needed.
 */
export class RateLimiter {
  private redis: Redis;
  private readonly maxPerHour: number;
  private readonly maxPerHourPerSender: number;

  constructor(redis: Redis) {
    this.redis = redis;
    this.maxPerHour = parseInt(process.env.MAX_EMAILS_PER_HOUR || '100', 10);
    this.maxPerHourPerSender = parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '50', 10);
  }

  /** Returns the hour-window key, e.g. "2026-08-28T14" */
  private getHourWindow(date: Date = new Date()): string {
    return date.toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
  }

  /** Returns seconds remaining until the end of the current hour. */
  private getSecondsUntilNextHour(date: Date = new Date()): number {
    const nextHour = new Date(date);
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(nextHour.getHours() + 1);
    return Math.ceil((nextHour.getTime() - date.getTime()) / 1000);
  }

  /**
   * Check if a sender can send an email right now.
   * Returns { allowed: true } or { allowed: false, retryAfterMs }.
   */
  async checkLimit(senderId: string): Promise<{
    allowed: boolean;
    retryAfterMs?: number;
  }> {
    const now = new Date();
    const hourWindow = this.getHourWindow(now);
    const key = `ratelimit:${senderId}:${hourWindow}`;

    const currentCount = await this.redis.get(key);
    const count = currentCount ? parseInt(currentCount, 10) : 0;

    if (count >= this.maxPerHourPerSender) {
      const retryAfterMs = this.getSecondsUntilNextHour(now) * 1000;
      return { allowed: false, retryAfterMs };
    }

    return { allowed: true };
  }

  /**
   * Increment the rate limit counter for a sender.
   * Should be called AFTER a successful send.
   * Uses INCR + conditional EXPIRE (set TTL only when counter is newly created).
   */
  async increment(senderId: string): Promise<number> {
    const now = new Date();
    const hourWindow = this.getHourWindow(now);
    const key = `ratelimit:${senderId}:${hourWindow}`;
    const ttl = this.getSecondsUntilNextHour(now);

    // INCR the counter
    const newCount = await this.redis.incr(key);

    // If this is the first increment (counter was just created), set expiry
    if (newCount === 1) {
      await this.redis.expire(key, ttl);
    }

    return newCount;
  }

  /** Get current count for a sender in the current hour window. */
  async getCurrentCount(senderId: string): Promise<number> {
    const hourWindow = this.getHourWindow();
    const key = `ratelimit:${senderId}:${hourWindow}`;
    const count = await this.redis.get(key);
    return count ? parseInt(count, 10) : 0;
  }

  get maxPerHourLimit(): number {
    return this.maxPerHourPerSender;
  }
}
