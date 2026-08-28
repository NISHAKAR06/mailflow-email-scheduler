import { PrismaClient } from '@prisma/client';
import { WebClient } from '@slack/web-api';

/**
 * Interface for notification delivery channels.
 * SlackNotifier implements this; additional channels (email, webhook, etc.)
 * can be added without changing consumer code.
 */
export interface NotificationChannel {
  notify(senderId: string, message: string): Promise<boolean>;
}

/**
 * Slack notification channel.
 * Always reads SlackIntegration fresh from the DB (never caches tokens).
 * Implements the full OAuth authorize-code flow for connecting.
 */
export class SlackNotifier implements NotificationChannel {
  private prisma: PrismaClient;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.clientId = process.env.SLACK_CLIENT_ID || '';
    this.clientSecret = process.env.SLACK_CLIENT_SECRET || '';
    this.redirectUri = process.env.SLACK_REDIRECT_URI || '';
  }

  /** Generate the Slack OAuth authorization URL. */
  getAuthorizeUrl(senderId: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      scope: 'chat:write,incoming-webhook',
      redirect_uri: this.redirectUri,
      state: senderId,
    });
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /** Exchange an OAuth authorization code for an access token and upsert the integration. */
  async handleCallback(code: string, senderId: string): Promise<void> {
    const client = new WebClient();
    const result = await client.oauth.v2.access({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: this.redirectUri,
    });

    if (!result.ok || !result.access_token) {
      throw new Error(`Slack OAuth failed: ${result.error}`);
    }

    const webhookUrl = result.incoming_webhook?.url || null;

    await this.prisma.slackIntegration.upsert({
      where: { senderId },
      update: {
        accessToken: result.access_token,
        webhookUrl,
        connectedAt: new Date(),
      },
      create: {
        senderId,
        accessToken: result.access_token,
        webhookUrl,
      },
    });
  }

  /**
   * Send a notification to the sender's connected Slack workspace.
   * Reads the integration fresh from the DB every time (no caching).
   * Returns true if sent, false if no integration exists.
   */
  async notify(senderId: string, message: string): Promise<boolean> {
    // Always read fresh from DB
    const integration = await this.prisma.slackIntegration.findUnique({
      where: { senderId },
    });

    if (!integration) {
      return false; // No Slack connected — silently skip
    }

    try {
      if (integration.webhookUrl) {
        // Use incoming webhook
        const response = await fetch(integration.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: message }),
        });
        return response.ok;
      } else {
        // Fall back to chat.postMessage via Web API
        const client = new WebClient(integration.accessToken);
        // Post to the first available conversation (or a default channel)
        const result = await client.chat.postMessage({
          channel: '#general',
          text: message,
        });
        return result.ok === true;
      }
    } catch (error) {
      console.error(`[SlackNotifier] Failed to notify sender ${senderId}:`, error);
      return false;
    }
  }

  /** Check if a sender has Slack connected. */
  async isConnected(senderId: string): Promise<boolean> {
    const integration = await this.prisma.slackIntegration.findUnique({
      where: { senderId },
    });
    return !!integration;
  }

  /** Disconnect a sender's Slack integration. */
  async disconnect(senderId: string): Promise<void> {
    await this.prisma.slackIntegration.deleteMany({
      where: { senderId },
    });
  }
}
