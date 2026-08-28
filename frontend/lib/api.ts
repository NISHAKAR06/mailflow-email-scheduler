/**
 * Production REST API client for MailFlow Express backend.
 * Uses Next.js server-side reverse proxy (/api/backend) on port 3000 to seamlessly
 * route to the Express BullMQ scheduler on port 4000 without CORS or cross-origin connection issues.
 */

const API_BASE_URL = typeof window !== 'undefined'
  ? '/api/backend'
  : (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000/api');

export interface ScheduledEmailItem {
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

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SchedulePayload {
  senderId: string;
  recipients: string[];
  subject: string;
  body: string;
  startTime: string; // ISO string
  delayMs: number;
  hourlyLimit: number;
}

export const api = {
  /**
   * Schedule emails via BullMQ delayed queue
   */
  async scheduleEmails(payload: SchedulePayload, token: string): Promise<{
    scheduled: number;
    skipped: number;
    emailIds: string[];
    message: string;
  }> {
    const res = await fetch(`${API_BASE_URL}/emails/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to schedule emails');
    }
    return data;
  },

  /**
   * Fetch pending scheduled emails for the sender
   */
  async getScheduledEmails(
    senderId: string,
    token: string,
    page = 1,
    limit = 50
  ): Promise<PaginatedResponse<ScheduledEmailItem>> {
    const res = await fetch(
      `${API_BASE_URL}/emails/scheduled?senderId=${encodeURIComponent(senderId)}&page=${page}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch scheduled emails');
    }
    return res.json();
  },

  /**
   * Fetch sent / failed emails for the sender
   */
  async getSentEmails(
    senderId: string,
    token: string,
    page = 1,
    limit = 50
  ): Promise<PaginatedResponse<ScheduledEmailItem>> {
    const res = await fetch(
      `${API_BASE_URL}/emails/sent?senderId=${encodeURIComponent(senderId)}&page=${page}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch sent emails');
    }
    return res.json();
  },

  /**
   * Elasticsearch multi-match search over subject + recipient
   */
  async searchEmails(
    query: string,
    token: string,
    page = 1,
    limit = 50
  ): Promise<PaginatedResponse<ScheduledEmailItem>> {
    const res = await fetch(
      `${API_BASE_URL}/emails/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Search failed');
    }
    return res.json();
  },

  /**
   * Check if Slack integration is active for this sender
   */
  async getSlackStatus(senderId: string): Promise<{ connected: boolean }> {
    try {
      const res = await fetch(
        `${API_BASE_URL}/slack/status?senderId=${encodeURIComponent(senderId)}`
      );
      if (!res.ok) return { connected: false };
      return await res.json();
    } catch {
      return { connected: false };
    }
  },

  /**
   * Disconnect Slack integration
   */
  async disconnectSlack(senderId: string, token: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/slack/disconnect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ senderId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to disconnect Slack');
    }
  },
};
