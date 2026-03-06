/**
 * Default Configuration Values
 */

import type { Config } from './schema.js';

/**
 * Default configuration
 */
export const defaultConfig: Partial<Config> = {
  scan: {
    lookback_days: 14,
    max_events: 10000,
  },
  dashboard: {
    port: 3000,
    host: '0.0.0.0',
  },
  output: {
    format: 'html',
    path: './results',
  },
};

/**
 * Environment variable mappings
 */
export const envMappings: Record<string, string> = {
  '${CROWDSTRIKE_CLIENT_ID}': 'CROWDSTRIKE_CLIENT_ID',
  '${CROWDSTRIKE_CLIENT_SECRET}': 'CROWDSTRIKE_CLIENT_SECRET',
  '${AZURE_TENANT_ID}': 'AZURE_TENANT_ID',
  '${AZURE_CLIENT_ID}': 'AZURE_CLIENT_ID',
  '${AZURE_CLIENT_SECRET}': 'AZURE_CLIENT_SECRET',
};

/**
 * Config file locations (in order of priority)
 */
export const configPaths = [
  './config/config.yaml',
  './config.yaml',
  './.aad.yaml',
];
