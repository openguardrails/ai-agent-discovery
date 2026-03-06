/**
 * Configuration Schema
 *
 * Zod schemas for validating configuration
 */

import { z } from 'zod';

/**
 * CrowdStrike connector configuration
 */
export const crowdstrikeConfigSchema = z.object({
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  base_url: z.string().url().optional(),
});

/**
 * Microsoft Defender connector configuration
 */
export const defenderConfigSchema = z.object({
  tenant_id: z.string().min(1),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
});

/**
 * File connector configuration
 */
export const fileConfigSchema = z.object({
  path: z.string().min(1),
  format: z.enum(['csv', 'json', 'ndjson']).default('csv'),
});

/**
 * Connector configuration
 */
export const connectorConfigSchema = z.object({
  type: z.enum(['crowdstrike', 'defender', 'file']),
  crowdstrike: crowdstrikeConfigSchema.optional(),
  defender: defenderConfigSchema.optional(),
  file: fileConfigSchema.optional(),
});

/**
 * Scan configuration
 */
export const scanConfigSchema = z.object({
  lookback_days: z.number().int().min(1).max(90).default(14),
  max_events: z.number().int().min(100).max(100000).default(10000),
});

/**
 * Dashboard configuration
 */
export const dashboardConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).default(3000),
  host: z.string().default('0.0.0.0'),
});

/**
 * Output configuration
 */
export const outputConfigSchema = z.object({
  format: z.enum(['html', 'json', 'csv']).default('html'),
  path: z.string().default('./results'),
});

/**
 * Complete configuration schema
 */
export const configSchema = z.object({
  connector: connectorConfigSchema,
  scan: scanConfigSchema.default({}),
  dashboard: dashboardConfigSchema.default({}),
  output: outputConfigSchema.default({}),
});

/**
 * Configuration type
 */
export type Config = z.infer<typeof configSchema>;
export type ConnectorConfig = z.infer<typeof connectorConfigSchema>;
export type CrowdstrikeConfig = z.infer<typeof crowdstrikeConfigSchema>;
export type DefenderConfig = z.infer<typeof defenderConfigSchema>;
export type FileConfig = z.infer<typeof fileConfigSchema>;
export type ScanConfig = z.infer<typeof scanConfigSchema>;
export type DashboardConfig = z.infer<typeof dashboardConfigSchema>;
export type OutputConfig = z.infer<typeof outputConfigSchema>;
