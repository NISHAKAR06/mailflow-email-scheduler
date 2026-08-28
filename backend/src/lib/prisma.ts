import { PrismaClient } from '@prisma/client';

/**
 * Singleton wrapper for the Prisma client.
 * Ensures a single connection pool is shared across the application.
 */
export class DatabaseClient {
  private static instance: PrismaClient | null = null;

  static getInstance(): PrismaClient {
    if (!DatabaseClient.instance) {
      DatabaseClient.instance = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      });
    }
    return DatabaseClient.instance;
  }

  static async disconnect(): Promise<void> {
    if (DatabaseClient.instance) {
      await DatabaseClient.instance.$disconnect();
      DatabaseClient.instance = null;
    }
  }
}

export const prisma = DatabaseClient.getInstance();
