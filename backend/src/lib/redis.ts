import Redis from 'ioredis';

/**
 * Manages Redis connections for the application.
 * Provides separate connections for general use and BullMQ (which requires its own).
 */
export class RedisManager {
  private static instance: Redis | null = null;

  private static getConnectionConfig() {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      maxRetriesPerRequest: null, // Required by BullMQ
      retryStrategy(times: number) {
        return Math.min(times * 1000, 5000);
      },
      lazyConnect: false,
    };
  }

  /** Shared Redis connection for rate limiting, caching, etc. */
  static getInstance(): Redis {
    if (!RedisManager.instance) {
      RedisManager.instance = new Redis(RedisManager.getConnectionConfig());
      RedisManager.instance.on('error', (err) => {
        // Log cleanly without uncaught exception crash
        if (err.code !== 'ECONNREFUSED') {
          console.warn('[Redis] Connection event:', err.message);
        }
      });
    }
    return RedisManager.instance;
  }

  /** Creates a new connection — BullMQ requires dedicated connections. */
  static createConnection(): Redis {
    const conn = new Redis(RedisManager.getConnectionConfig());
    conn.on('error', (err) => {
      if (err.code !== 'ECONNREFUSED') {
        console.warn('[Redis Worker] Connection event:', err.message);
      }
    });
    return conn;
  }

  static async disconnect(): Promise<void> {
    if (RedisManager.instance) {
      await RedisManager.instance.quit().catch(() => {});
      RedisManager.instance = null;
    }
  }
}
