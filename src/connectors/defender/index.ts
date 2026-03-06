/**
 * Microsoft Defender Connector
 *
 * Fetches events from Microsoft Defender for Endpoint via Advanced Hunting API
 */

import { BaseConnector } from '../base-connector.js';
import { DefenderClient, createDefenderClient } from './client.js';
import type { QueryOptions, DefenderEvent } from '../types.js';
import type { RawEvent } from '../../detectors/types.js';
import type { DefenderConfig } from '../../config/schema.js';
import { logger } from '../../utils/logger.js';

/**
 * Microsoft Defender connector
 */
export class DefenderConnector extends BaseConnector {
  readonly type = 'defender';
  readonly name = 'Microsoft Defender for Endpoint';

  private config: DefenderConfig;
  private client: DefenderClient | null = null;

  constructor(config: DefenderConfig) {
    super();
    this.config = config;
  }

  protected async doInitialize(): Promise<void> {
    this.client = createDefenderClient(this.config);
    const connected = await this.client.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to Microsoft Defender API');
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) {
      this.client = createDefenderClient(this.config);
    }
    return this.client.testConnection();
  }

  async fetchEvents(options: QueryOptions): Promise<RawEvent[]> {
    this.ensureInitialized();
    if (!this.client) {
      throw new Error('Defender client not initialized');
    }

    const patterns = options.patterns || [];
    if (patterns.length === 0) {
      logger.warn('No patterns provided for Defender query');
      return [];
    }

    const lookbackDays = options.lookbackDays || 7;
    const query = this.client.buildQuery(patterns, lookbackDays);

    const response = await this.client.executeQuery(query);

    const events = (response.Results || []) as DefenderEvent[];
    logger.info({ count: events.length }, 'Defender events fetched');

    return events.map((event) => this.normalizeEvent(event));
  }

  private normalizeEvent(event: DefenderEvent): RawEvent {
    return {
      timestamp: event.Timestamp,
      endpoint: event.DeviceName,
      username: event.AccountName,
      os_type: event.OSPlatform,
      file_path: event.FolderPath,
      image_name: event.FileName,
      command_line: event.ProcessCommandLine,
      parent_process: event.InitiatingProcessFileName,
    };
  }

  protected async doClose(): Promise<void> {
    this.client = null;
  }
}

/**
 * Create a Microsoft Defender connector
 */
export function createDefenderConnector(config: DefenderConfig): DefenderConnector {
  return new DefenderConnector(config);
}
