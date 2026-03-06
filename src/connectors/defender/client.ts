/**
 * Microsoft Defender API Client
 *
 * Handles authentication and API requests to Microsoft Defender for Endpoint
 */

import axios, { type AxiosInstance } from 'axios';
import { logger } from '../../utils/logger.js';
import type { DefenderConfig } from '../../config/schema.js';

/**
 * Token response from Azure AD
 */
interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * Query response from Defender
 */
interface QueryResponse {
  Results: Array<Record<string, unknown>>;
}

/**
 * Microsoft Defender API Client
 */
export class DefenderClient {
  private config: DefenderConfig;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private client: AxiosInstance;

  constructor(config: DefenderConfig) {
    this.config = config;
    this.client = axios.create({
      timeout: 60000,
    });
  }

  /**
   * Get OAuth access token from Azure AD
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    logger.debug('Fetching new Defender access token');

    const tokenUrl = `https://login.microsoftonline.com/${this.config.tenant_id}/oauth2/v2.0/token`;

    const response = await this.client.post<TokenResponse>(
      tokenUrl,
      new URLSearchParams({
        client_id: this.config.client_id,
        client_secret: this.config.client_secret,
        scope: 'https://api.securitycenter.microsoft.com/.default',
        grant_type: 'client_credentials',
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

    logger.debug('Defender access token obtained');
    return this.accessToken;
  }

  /**
   * Execute an Advanced Hunting (KQL) query
   */
  async executeQuery(query: string): Promise<QueryResponse> {
    const token = await this.getAccessToken();

    const endpoint = 'https://api.securitycenter.microsoft.com/api/advancedqueries/run';

    logger.debug({ query: query.substring(0, 100) }, 'Executing Defender query');

    const response = await this.client.post<QueryResponse>(
      endpoint,
      { Query: query },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    logger.debug({ resultCount: response.data.Results?.length || 0 }, 'Query completed');

    return response.data;
  }

  /**
   * Test the connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getAccessToken();
      return true;
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'Defender connection test failed');
      return false;
    }
  }

  /**
   * Build a KQL query from patterns
   */
  buildQuery(patterns: string[], lookbackDays: number = 7): string {
    if (patterns.length === 0) {
      return '';
    }

    const patternClauses = patterns.map((pattern) => {
      const escaped = pattern.replace(/'/g, "''");
      return `FolderPath contains '${escaped}' or FileName contains '${escaped}' or ProcessCommandLine contains '${escaped}'`;
    });

    const query = `
DeviceProcessEvents
| where Timestamp > ago(${lookbackDays}d)
| where ${patternClauses.join(' or ')}
| project Timestamp, DeviceName, AccountName, OSPlatform, FolderPath, FileName, ProcessCommandLine, InitiatingProcessFileName
| limit 10000
    `.trim();

    return query;
  }
}

/**
 * Create a Defender client
 */
export function createDefenderClient(config: DefenderConfig): DefenderClient {
  return new DefenderClient(config);
}
