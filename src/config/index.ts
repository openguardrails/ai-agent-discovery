/**
 * Configuration Loader
 *
 * Loads and validates configuration from YAML files and environment variables
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { config as dotenvConfig } from 'dotenv';
import { configSchema, type Config } from './schema.js';
import { defaultConfig, envMappings, configPaths } from './defaults.js';
import { logger } from '../utils/logger.js';

export * from './schema.js';
export { defaultConfig, configPaths } from './defaults.js';

// Load .env file
dotenvConfig();

/**
 * Replace environment variable placeholders in a string
 */
function replaceEnvVars(value: string): string {
  let result = value;
  for (const [placeholder, envVar] of Object.entries(envMappings)) {
    if (result.includes(placeholder)) {
      const envValue = process.env[envVar];
      if (envValue) {
        result = result.replace(placeholder, envValue);
      }
    }
  }
  // Also handle generic ${VAR} patterns
  return result.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    return process.env[varName] || match;
  });
}

/**
 * Recursively replace environment variables in an object
 */
function replaceEnvVarsInObject(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return replaceEnvVars(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(replaceEnvVarsInObject);
  }
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = replaceEnvVarsInObject(value);
    }
    return result;
  }
  return obj;
}

/**
 * Find the config file
 */
export function findConfigFile(customPath?: string): string | null {
  if (customPath) {
    if (fs.existsSync(customPath)) {
      return customPath;
    }
    return null;
  }

  for (const configPath of configPaths) {
    const fullPath = path.resolve(process.cwd(), configPath);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

/**
 * Load configuration from file and environment
 */
export function loadConfig(customPath?: string): Config {
  const configFile = findConfigFile(customPath);

  let fileConfig: Record<string, unknown> = {};

  if (configFile) {
    logger.info({ path: configFile }, 'Loading configuration');
    const content = fs.readFileSync(configFile, 'utf8');
    fileConfig = yaml.load(content) as Record<string, unknown>;
    fileConfig = replaceEnvVarsInObject(fileConfig) as Record<string, unknown>;
  } else {
    logger.warn('No configuration file found, using defaults');
  }

  // Merge with defaults
  const merged = {
    ...defaultConfig,
    ...fileConfig,
    scan: { ...defaultConfig.scan, ...(fileConfig.scan as object) },
    dashboard: { ...defaultConfig.dashboard, ...(fileConfig.dashboard as object) },
    output: { ...defaultConfig.output, ...(fileConfig.output as object) },
  };

  // Validate
  const result = configSchema.safeParse(merged);
  if (!result.success) {
    logger.error({ errors: result.error.issues }, 'Configuration validation failed');
    throw new Error(`Invalid configuration: ${result.error.issues.map((i) => i.message).join(', ')}`);
  }

  return result.data;
}

/**
 * Create a default config file
 */
export function createDefaultConfig(targetPath: string = './config/config.yaml'): void {
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const defaultYaml = `# AI Agent Discovery Configuration

# EDR connector settings
connector:
  type: file  # Options: crowdstrike, defender, file

  # CrowdStrike configuration (uncomment to use)
  # crowdstrike:
  #   client_id: \${CROWDSTRIKE_CLIENT_ID}
  #   client_secret: \${CROWDSTRIKE_CLIENT_SECRET}

  # Microsoft Defender configuration (uncomment to use)
  # defender:
  #   tenant_id: \${AZURE_TENANT_ID}
  #   client_id: \${AZURE_CLIENT_ID}
  #   client_secret: \${AZURE_CLIENT_SECRET}

  # File connector (for testing/importing)
  file:
    path: ./tests/fixtures/sample-events.json
    format: json  # Options: csv, json, ndjson

# Scan settings
scan:
  lookback_days: 14
  max_events: 10000

# Dashboard settings
dashboard:
  port: 3000
  host: 0.0.0.0

# Output settings
output:
  format: html  # Options: html, json, csv
  path: ./results
`;

  fs.writeFileSync(targetPath, defaultYaml);
  logger.info({ path: targetPath }, 'Configuration file created');
}

/**
 * Get a specific config value by path
 */
export function getConfigValue(config: Config, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = config;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Update config file with a new value
 */
export function updateConfigFile(configPath: string, key: string, value: unknown): void {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const content = fs.readFileSync(configPath, 'utf8');
  const config = yaml.load(content) as Record<string, unknown>;

  // Set nested value
  const parts = key.split('.');
  let current = config;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;

  // Write back
  const newContent = yaml.dump(config, { indent: 2 });
  fs.writeFileSync(configPath, newContent);
  logger.info({ key, value }, 'Configuration updated');
}
