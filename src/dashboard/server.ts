/**
 * Dashboard Server
 *
 * Express.js server for the web dashboard
 */

import express, { type Express, type Request, type Response } from 'express';
import * as path from 'path';
import * as url from 'url';
import { loadTaxonomy, getTaxonomyTree, searchTaxonomy } from '../taxonomy/index.js';
import { DetectionEngine, type DetectionResult } from '../detectors/index.js';
import { getConnector } from '../connectors/index.js';
import { getAllPatterns } from '../utils/filters.js';
import { logger } from '../utils/logger.js';
import type { Config } from '../config/index.js';

// Get directory path for serving static files
const getDirname = (): string => {
  // In ESM context, use import.meta.url
  // In CJS context, use __dirname
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  // For ESM, we need to resolve from process.cwd()
  return path.join(process.cwd(), 'dist', 'dashboard');
};

/**
 * Dashboard options
 */
interface DashboardOptions {
  port: number;
  host: string;
  config: Config;
}

/**
 * In-memory store for scan results
 */
let lastScanResults: DetectionResult[] = [];
let lastScanTime: Date | null = null;
let scanInProgress = false;

/**
 * Create the Express app
 */
function createApp(config: Config): Express {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(getDirname(), 'public')));

  // API Routes

  /**
   * GET /api/status - Get server status
   */
  app.get('/api/status', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      version: '1.0.0',
      lastScan: lastScanTime,
      scanInProgress,
      resultCount: lastScanResults.length,
    });
  });

  /**
   * GET /api/taxonomy - Get taxonomy tree
   */
  app.get('/api/taxonomy', (_req: Request, res: Response) => {
    try {
      const taxonomy = loadTaxonomy();
      const tree = getTaxonomyTree(taxonomy);
      res.json({
        tree,
        stats: {
          kingdoms: taxonomy.kingdoms.size,
          families: taxonomy.families.size,
          species: taxonomy.species.size,
        },
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  /**
   * GET /api/taxonomy/search - Search taxonomy
   */
  app.get('/api/taxonomy/search', (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        res.status(400).json({ error: 'Query parameter "q" is required' });
        return;
      }

      const taxonomy = loadTaxonomy();
      const results = searchTaxonomy(taxonomy, query);
      res.json({ results });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  /**
   * GET /api/agents - Get detected agents
   */
  app.get('/api/agents', (_req: Request, res: Response) => {
    res.json({
      agents: lastScanResults,
      lastScan: lastScanTime,
      count: lastScanResults.length,
    });
  });

  /**
   * GET /api/agents/summary - Get summary statistics
   */
  app.get('/api/agents/summary', (_req: Request, res: Response) => {
    const byKingdom: Record<string, number> = {};
    const byFamily: Record<string, number> = {};
    const bySpecies: Record<string, number> = {};
    const endpoints = new Set<string>();
    const users = new Set<string>();

    for (const agent of lastScanResults) {
      byKingdom[agent.agent.kingdom] = (byKingdom[agent.agent.kingdom] || 0) + 1;
      byFamily[agent.agent.family] = (byFamily[agent.agent.family] || 0) + 1;
      bySpecies[agent.agent.species] = (bySpecies[agent.agent.species] || 0) + 1;
      endpoints.add(agent.endpoint.hostname);
      users.add(agent.user.username);
    }

    res.json({
      totalAgents: lastScanResults.length,
      uniqueEndpoints: endpoints.size,
      uniqueUsers: users.size,
      byKingdom,
      byFamily,
      bySpecies,
      lastScan: lastScanTime,
    });
  });

  /**
   * POST /api/scan - Run a new scan
   */
  app.post('/api/scan', async (_req: Request, res: Response) => {
    if (scanInProgress) {
      res.status(409).json({ error: 'Scan already in progress' });
      return;
    }

    scanInProgress = true;

    try {
      logger.info('Starting scan from dashboard');

      const taxonomy = loadTaxonomy();
      const engine = new DetectionEngine(taxonomy);
      engine.setConnectorType(config.connector.type);

      const connector = getConnector(config.connector);
      await connector.initialize();

      const patterns = getAllPatterns();
      const events = await connector.fetchEvents({
        lookbackDays: config.scan.lookback_days,
        maxEvents: config.scan.max_events,
        patterns,
      });

      engine.processEvents(events);
      lastScanResults = engine.getResults();
      lastScanTime = new Date();

      await connector.close();

      logger.info({ resultCount: lastScanResults.length }, 'Scan completed');

      res.json({
        success: true,
        resultCount: lastScanResults.length,
        scanTime: lastScanTime,
      });
    } catch (error) {
      logger.error({ error }, 'Scan failed');
      res.status(500).json({ error: (error as Error).message });
    } finally {
      scanInProgress = false;
    }
  });

  /**
   * GET /api/export - Export results
   */
  app.get('/api/export', (req: Request, res: Response) => {
    const format = req.query.format as string || 'json';

    if (format === 'csv') {
      const headers = ['hostname', 'os', 'username', 'kingdom', 'family', 'species', 'confidence', 'first_seen', 'last_seen'];
      const rows = lastScanResults.map((r) => [
        r.endpoint.hostname,
        r.endpoint.os,
        r.user.username,
        r.agent.kingdom,
        r.agent.family,
        r.agent.species,
        r.agent.confidence.toString(),
        r.timestamps.firstSeen.toISOString(),
        r.timestamps.lastSeen.toISOString(),
      ].join(','));

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=agents.csv');
      res.send([headers.join(','), ...rows].join('\n'));
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=agents.json');
      res.json(lastScanResults);
    }
  });

  /**
   * Serve the frontend
   */
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(getDirname(), 'public', 'index.html'));
  });

  return app;
}

/**
 * Start the dashboard server
 */
export async function startDashboard(options: DashboardOptions): Promise<void> {
  const app = createApp(options.config);

  return new Promise((resolve) => {
    app.listen(options.port, options.host, () => {
      logger.info({ port: options.port, host: options.host }, 'Dashboard started');
      console.log(`Dashboard running at http://${options.host}:${options.port}`);
      resolve();
    });
  });
}

export { createApp };
