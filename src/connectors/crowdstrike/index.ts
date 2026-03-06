/**
 * CrowdStrike Connector
 *
 * Fetches events from CrowdStrike Falcon via Humio API
 */

import { BaseConnector } from '../base-connector.js';
import { CrowdStrikeClient, createCrowdStrikeClient } from './client.js';
import type { QueryOptions, CrowdStrikeEvent } from '../types.js';
import type { RawEvent } from '../../detectors/types.js';
import type { CrowdstrikeConfig } from '../../config/schema.js';
import { logger } from '../../utils/logger.js';

/**
 * OS mapping for CrowdStrike
 */
const OS_MAPPING: Record<string, string> = {
  Win: 'Windows',
  Mac: 'macOS',
  Lin: 'Linux',
};

/**
 * CrowdStrike connector
 */
export class CrowdStrikeConnector extends BaseConnector {
  readonly type = 'crowdstrike';
  readonly name = 'CrowdStrike Falcon';

  private config: CrowdstrikeConfig;
  private client: CrowdStrikeClient | null = null;

  constructor(config: CrowdstrikeConfig) {
    super();
    this.config = config;
  }

  protected async doInitialize(): Promise<void> {
    this.client = createCrowdStrikeClient(this.config);
    const connected = await this.client.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to CrowdStrike API');
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) {
      this.client = createCrowdStrikeClient(this.config);
    }
    return this.client.testConnection();
  }

  async fetchEvents(options: QueryOptions): Promise<RawEvent[]> {
    this.ensureInitialized();
    if (!this.client) {
      throw new Error('CrowdStrike client not initialized');
    }

    const patterns = options.patterns || [];
    if (patterns.length === 0) {
      logger.warn('No patterns provided for CrowdStrike query');
      return [];
    }

    const lookbackDays = options.lookbackDays || 3;
    const query = this.client.buildQuery(patterns, lookbackDays);

    const response = await this.client.executeQuery(query, {
      start: `${lookbackDays}d`,
    });

    const events = response.events as CrowdStrikeEvent[];
    logger.info({ count: events.length }, 'CrowdStrike events fetched');

    return events.map((event) => this.normalizeEvent(event));
  }

  private normalizeEvent(event: CrowdStrikeEvent): RawEvent {
    return {
      timestamp: event['@timestamp'],
      endpoint: event.ComputerName,
      username: event.UserName,
      os_type: OS_MAPPING[event.event_platform] || event.event_platform,
      file_path: event.FilePath,
      image_name: event.ImageFileName,
      command_line: event.CommandLine,
      parent_process: event.ParentBaseFileName,
    };
  }

  protected async doClose(): Promise<void> {
    this.client = null;
  }
}

/**
 * Create a CrowdStrike connector
 */
export function createCrowdStrikeConnector(config: CrowdstrikeConfig): CrowdStrikeConnector {
  return new CrowdStrikeConnector(config);
}
