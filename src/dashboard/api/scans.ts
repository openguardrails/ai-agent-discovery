/**
 * Scans API Routes
 *
 * REST API endpoints for scan management
 */

import { Router, type Request, type Response } from 'express';
import type { Config } from '../../config/index.js';
import type { DetectionResult } from '../../detectors/index.js';

/**
 * Scan state
 */
interface ScanState {
  lastScanTime: Date | null;
  scanInProgress: boolean;
  results: DetectionResult[];
}

/**
 * Create scans router
 */
export function createScansRouter(
  state: ScanState,
  runScan: () => Promise<DetectionResult[]>
): Router {
  const router = Router();

  /**
   * GET /api/scans/status - Get scan status
   */
  router.get('/status', (_req: Request, res: Response) => {
    res.json({
      lastScan: state.lastScanTime,
      scanInProgress: state.scanInProgress,
      resultCount: state.results.length,
    });
  });

  /**
   * POST /api/scans/run - Run a new scan
   */
  router.post('/run', async (_req: Request, res: Response) => {
    if (state.scanInProgress) {
      res.status(409).json({ error: 'Scan already in progress' });
      return;
    }

    try {
      state.scanInProgress = true;
      const results = await runScan();
      state.results = results;
      state.lastScanTime = new Date();

      res.json({
        success: true,
        resultCount: results.length,
        scanTime: state.lastScanTime,
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    } finally {
      state.scanInProgress = false;
    }
  });

  /**
   * GET /api/scans/results - Get scan results
   */
  router.get('/results', (_req: Request, res: Response) => {
    res.json({
      results: state.results,
      lastScan: state.lastScanTime,
      count: state.results.length,
    });
  });

  return router;
}
