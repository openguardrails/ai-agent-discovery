/**
 * Connector Module
 *
 * Factory for creating EDR connectors
 */

import type { Connector } from './types.js';
import type { ConnectorConfig } from '../config/schema.js';
import { FileConnector, createFileConnector } from './file/index.js';
import { CrowdStrikeConnector, createCrowdStrikeConnector } from './crowdstrike/index.js';
import { DefenderConnector, createDefenderConnector } from './defender/index.js';
import { logger } from '../utils/logger.js';

export * from './types.js';
export { BaseConnector } from './base-connector.js';
export { FileConnector, createFileConnector } from './file/index.js';
export { CrowdStrikeConnector, createCrowdStrikeConnector } from './crowdstrike/index.js';
export { DefenderConnector, createDefenderConnector } from './defender/index.js';

/**
 * Create a connector based on configuration
 */
export function getConnector(config: ConnectorConfig): Connector {
  logger.info({ type: config.type }, 'Creating connector');

  switch (config.type) {
    case 'file':
      if (!config.file) {
        throw new Error('File connector configuration required');
      }
      return createFileConnector(config.file);

    case 'crowdstrike':
      if (!config.crowdstrike) {
        throw new Error('CrowdStrike connector configuration required');
      }
      return createCrowdStrikeConnector(config.crowdstrike);

    case 'defender':
      if (!config.defender) {
        throw new Error('Defender connector configuration required');
      }
      return createDefenderConnector(config.defender);

    default:
      throw new Error(`Unknown connector type: ${config.type}`);
  }
}

/**
 * Get available connector types
 */
export function getAvailableConnectorTypes(): string[] {
  return ['file', 'crowdstrike', 'defender'];
}

/**
 * Validate connector configuration
 */
export function validateConnectorConfig(config: ConnectorConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.type) {
    errors.push('Connector type is required');
    return { valid: false, errors };
  }

  switch (config.type) {
    case 'file':
      if (!config.file) {
        errors.push('File configuration is required for file connector');
      } else if (!config.file.path) {
        errors.push('File path is required');
      }
      break;

    case 'crowdstrike':
      if (!config.crowdstrike) {
        errors.push('CrowdStrike configuration is required');
      } else {
        if (!config.crowdstrike.client_id) {
          errors.push('CrowdStrike client_id is required');
        }
        if (!config.crowdstrike.client_secret) {
          errors.push('CrowdStrike client_secret is required');
        }
      }
      break;

    case 'defender':
      if (!config.defender) {
        errors.push('Defender configuration is required');
      } else {
        if (!config.defender.tenant_id) {
          errors.push('Defender tenant_id is required');
        }
        if (!config.defender.client_id) {
          errors.push('Defender client_id is required');
        }
        if (!config.defender.client_secret) {
          errors.push('Defender client_secret is required');
        }
      }
      break;

    default:
      errors.push(`Unknown connector type: ${config.type}`);
  }

  return { valid: errors.length === 0, errors };
}
