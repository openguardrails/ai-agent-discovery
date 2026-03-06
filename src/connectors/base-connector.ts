/**
 * Base Connector
 *
 * Abstract base class for EDR connectors
 */

import type { Connector, QueryOptions } from './types.js';
import type { RawEvent } from '../detectors/types.js';
import { logger } from '../utils/logger.js';

/**
 * Abstract base connector class
 */
export abstract class BaseConnector implements Connector {
  abstract readonly type: string;
  abstract readonly name: string;

  protected initialized: boolean = false;

  /**
   * Initialize the connector
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info({ connector: this.type }, 'Initializing connector');
    await this.doInitialize();
    this.initialized = true;
    logger.info({ connector: this.type }, 'Connector initialized');
  }

  /**
   * Implementation-specific initialization
   */
  protected abstract doInitialize(): Promise<void>;

  /**
   * Test the connection
   */
  abstract testConnection(): Promise<boolean>;

  /**
   * Fetch events from the data source
   */
  abstract fetchEvents(options: QueryOptions): Promise<RawEvent[]>;

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    logger.info({ connector: this.type }, 'Closing connector');
    await this.doClose();
    this.initialized = false;
    logger.info({ connector: this.type }, 'Connector closed');
  }

  /**
   * Implementation-specific cleanup
   */
  protected async doClose(): Promise<void> {
    // Default: no-op
  }

  /**
   * Ensure connector is initialized
   */
  protected ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(`Connector ${this.type} not initialized. Call initialize() first.`);
    }
  }
}
