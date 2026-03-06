/**
 * CrowdStrike API Client
 *
 * Handles authentication and API requests to CrowdStrike Falcon
 */

import axios, { type AxiosInstance } from 'axios';
import { logger } from '../../utils/logger.js';
import type { CrowdstrikeConfig } from '../../config/schema.js';

/**
 * Token response from CrowdStrike OAuth
 */
interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * Query response from CrowdStrike
 */
interface QueryResponse {
  events: Array<Record<string, unknown>>;
  metadata?: {
    eventCount: number;
    totalCount?: number;
  };
}

/**
 * CrowdStrike API Client
 */
export class CrowdStrikeClient {
  private config: CrowdstrikeConfig;
  private baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private client: AxiosInstance;

  constructor(config: CrowdstrikeConfig) {
    this.config = config;
    this.baseUrl = config.base_url || 'https://api.crowdstrike.com';
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 60000,
    });
  }

  /**
   * Get OAuth access token
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    logger.debug('Fetching new CrowdStrike access token');

    const response = await this.client.post<TokenResponse>(
      '/oauth2/token',
      new URLSearchParams({
        client_id: this.config.client_id,
        client_secret: this.config.client_secret,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    this.accessToken = response.data.access_token;
    // Set expiry 5 minutes before actual expiry
    this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);

    logger.debug('CrowdStrike access token obtained');
    return this.accessToken;
  }

  /**
   * Execute a Humio query
   */
  async executeQuery(query: string, options: {
    start?: string;
    end?: string;
    repository?: string;
  } = {}): Promise<QueryResponse> {
    const token = await this.getAccessToken();

    const repository = options.repository || 'search-all';
    const endpoint = `/humio/api/v1/repositories/${repository}/query`;

    const requestBody = {
      queryString: query,
      start: options.start || '3d',
      end: options.end || 'now',
      isLive: false,
    };

    logger.debug({ query: query.substring(0, 100), repository }, 'Executing CrowdStrike query');

    const response = await this.client.post(endpoint, requestBody, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const events = Array.isArray(response.data) ? response.data : [];

    logger.debug({ eventCount: events.length }, 'Query completed');

    return {
      events,
      metadata: {
        eventCount: events.length,
      },
    };
  }

  /**
   * Test the connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getAccessToken();
      return true;
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'CrowdStrike connection test failed');
      return false;
    }
  }

  /**
   * Build a query from patterns
   */
  buildQuery(patterns: string[], lookbackDays: number = 3): string {
    if (patterns.length === 0) {
      return '';
    }

    const patternClauses = patterns.map((pattern) => {
      const escaped = pattern.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&');
      return `FilePath=/${escaped}/i OR ImageFileName=/${escaped}/i OR CommandLine=/${escaped}/i`;
    });

    const query = `
      ${patternClauses.join(' OR ')}
      | select([@timestamp, UserName, ComputerName, event_platform, FilePath, ImageFileName, CommandLine, ParentBaseFileName])
      | tail(10000)
    `.trim();

    return query;
  }
}

/**
 * Create a CrowdStrike client
 */
export function createCrowdStrikeClient(config: CrowdstrikeConfig): CrowdStrikeClient {
  return new CrowdStrikeClient(config);
}
