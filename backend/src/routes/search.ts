import { Router, Request, Response } from 'express';
import { SearchIndexer } from '../lib/elasticsearch';

/**
 * Search routes: Elasticsearch multi-match over subject + recipient.
 */
export class SearchRoutes {
  private router: Router;
  private searchIndexer: SearchIndexer;

  constructor(searchIndexer: SearchIndexer) {
    this.router = Router();
    this.searchIndexer = searchIndexer;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.get('/search', this.searchEmails.bind(this));
  }

  /**
   * GET /api/emails/search?q=<query>&page=1&limit=20
   */
  private async searchEmails(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query.q as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!query || query.trim().length === 0) {
        res.status(400).json({ error: 'Search query "q" is required' });
        return;
      }

      const from = (page - 1) * limit;
      const result = await this.searchIndexer.search(query, from, limit);

      res.json({
        data: result.hits.map((hit) => ({
          id: hit._id,
          ...hit._source,
        })),
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    } catch (error: any) {
      console.error('[SearchRoutes] Search error:', error);
      res.status(500).json({ error: error.message || 'Search failed' });
    }
  }

  getRouter(): Router {
    return this.router;
  }
}
