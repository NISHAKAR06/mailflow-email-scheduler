import { Client } from '@elastic/elasticsearch';

/**
 * Elasticsearch client for indexing and searching scheduled/sent emails.
 * Single responsibility: manage the 'emails' index lifecycle and queries.
 */
export class SearchIndexer {
  private client: Client;
  private readonly indexName = 'emails';

  constructor(elasticsearchUrl?: string) {
    this.client = new Client({
      node: elasticsearchUrl || process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    });
  }

  /** Create the emails index with appropriate mappings if it doesn't exist. */
  async initialize(): Promise<void> {
    const exists = await this.client.indices.exists({ index: this.indexName });
    if (!exists) {
      await this.client.indices.create({
        index: this.indexName,
        body: {
          mappings: {
            properties: {
              id:           { type: 'keyword' },
              senderId:     { type: 'keyword' },
              recipient:    { type: 'text', analyzer: 'standard' },
              subject:      { type: 'text', analyzer: 'standard' },
              body:         { type: 'text', analyzer: 'standard' },
              status:       { type: 'keyword' },
              scheduledFor: { type: 'date' },
              sentAt:       { type: 'date' },
              createdAt:    { type: 'date' },
            },
          },
        },
      });
      console.log('[SearchIndexer] Created "emails" index');
    }
  }

  /** Index a single email document. */
  async indexEmail(doc: {
    id: string;
    senderId: string;
    recipient: string;
    subject: string;
    body: string;
    status: string;
    scheduledFor: Date | string;
    sentAt?: Date | string | null;
    createdAt: Date | string;
  }): Promise<void> {
    await this.client.index({
      index: this.indexName,
      id: doc.id,
      body: {
        ...doc,
        scheduledFor: new Date(doc.scheduledFor).toISOString(),
        sentAt: doc.sentAt ? new Date(doc.sentAt).toISOString() : null,
        createdAt: new Date(doc.createdAt).toISOString(),
      },
      refresh: true,
    });
  }

  /** Multi-match search across subject + recipient fields. */
  async search(query: string, from = 0, size = 20): Promise<{
    hits: Array<{ _id: string; _source: Record<string, unknown> }>;
    total: number;
  }> {
    const result = await this.client.search({
      index: this.indexName,
      body: {
        from,
        size,
        query: {
          multi_match: {
            query,
            fields: ['subject', 'recipient'],
            type: 'best_fields',
            fuzziness: 'AUTO',
          },
        },
        sort: [{ createdAt: { order: 'desc' } }],
      },
    });

    const hits = (result.hits.hits as Array<{ _id: string; _source: Record<string, unknown> }>);
    const total = typeof result.hits.total === 'number'
      ? result.hits.total
      : (result.hits.total as { value: number }).value;

    return { hits, total };
  }
}
