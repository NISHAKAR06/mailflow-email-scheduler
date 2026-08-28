import { Router, Request, Response } from 'express';
import { SlackNotifier } from '../lib/slack';

/**
 * Slack routes: OAuth connect and callback.
 */
export class SlackRoutes {
  private router: Router;
  private slackNotifier: SlackNotifier;

  constructor(slackNotifier: SlackNotifier) {
    this.router = Router();
    this.slackNotifier = slackNotifier;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.get('/connect', this.connect.bind(this));
    this.router.get('/callback', this.callback.bind(this));
    this.router.get('/status', this.getStatus.bind(this));
    this.router.post('/disconnect', this.disconnect.bind(this));
  }

  /**
   * GET /api/slack/connect?senderId=xxx
   * Redirects to Slack OAuth authorize URL.
   */
  private async connect(req: Request, res: Response): Promise<void> {
    const senderId = req.query.senderId as string;

    if (!senderId) {
      res.status(400).json({ error: 'senderId is required' });
      return;
    }

    const authorizeUrl = this.slackNotifier.getAuthorizeUrl(senderId);
    res.redirect(authorizeUrl);
  }

  /**
   * GET /api/slack/callback
   * Handles the OAuth callback — exchanges code, upserts SlackIntegration.
   */
  private async callback(req: Request, res: Response): Promise<void> {
    try {
      const code = req.query.code as string;
      const senderId = req.query.state as string;
      const error = req.query.error as string;

      if (error) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}/dashboard?slack=error&message=${encodeURIComponent(error)}`);
        return;
      }

      if (!code || !senderId) {
        res.status(400).json({ error: 'Missing code or state parameter' });
        return;
      }

      await this.slackNotifier.handleCallback(code, senderId);

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/dashboard?slack=connected`);
    } catch (error: any) {
      console.error('[SlackRoutes] Callback error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/dashboard?slack=error&message=${encodeURIComponent(error.message)}`);
    }
  }

  /**
   * GET /api/slack/status?senderId=xxx
   * Returns whether Slack is connected for the given sender.
   */
  private async getStatus(req: Request, res: Response): Promise<void> {
    const senderId = req.query.senderId as string;

    if (!senderId) {
      res.status(400).json({ error: 'senderId is required' });
      return;
    }

    try {
      const connected = await this.slackNotifier.isConnected(senderId);
      res.json({ connected });
    } catch {
      res.json({ connected: false });
    }
  }

  /**
   * POST /api/slack/disconnect
   * Body: { senderId }
   */
  private async disconnect(req: Request, res: Response): Promise<void> {
    try {
      const { senderId } = req.body;

      if (!senderId) {
        res.status(400).json({ error: 'senderId is required' });
        return;
      }

      await this.slackNotifier.disconnect(senderId);
      res.json({ message: 'Slack disconnected' });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  getRouter(): Router {
    return this.router;
  }
}
