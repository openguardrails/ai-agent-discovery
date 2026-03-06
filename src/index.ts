/**
 * AI Agent Discovery
 *
 * An open-source enterprise tool for discovering all AI Agents
 * running within an organization.
 */

export { loadTaxonomy, type Kingdom, type Family, type Species } from './taxonomy/index.js';
export { loadConfig, type Config } from './config/index.js';
export { DetectionEngine, type DetectionResult } from './detectors/index.js';
export { getConnector, type Connector } from './connectors/index.js';
export type { RawEvent } from './detectors/types.js';
export { startDashboard } from './dashboard/server.js';
export { logger } from './utils/logger.js';
