/**
 * Agents API Routes
 *
 * REST API endpoints for agent management
 */

import { Router, type Request, type Response } from 'express';
import type { DetectionResult } from '../../detectors/index.js';

/**
 * Create agents router
 */
export function createAgentsRouter(getResults: () => DetectionResult[]): Router {
  const router = Router();

  /**
   * GET /api/agents - List all detected agents
   */
  router.get('/', (_req: Request, res: Response) => {
    const results = getResults();
    res.json({
      agents: results,
      count: results.length,
    });
  });

  /**
   * GET /api/agents/:id - Get a specific agent by ID
   */
  router.get('/:id', (req: Request, res: Response) => {
    const results = getResults();
    const agent = results.find((r) => r.id === req.params.id);

    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    res.json(agent);
  });

  /**
   * GET /api/agents/by-endpoint/:hostname - Get agents by endpoint
   */
  router.get('/by-endpoint/:hostname', (req: Request, res: Response) => {
    const results = getResults();
    const agents = results.filter(
      (r) => r.endpoint.hostname.toLowerCase() === req.params.hostname.toLowerCase()
    );

    res.json({
      agents,
      count: agents.length,
    });
  });

  /**
   * GET /api/agents/by-user/:username - Get agents by user
   */
  router.get('/by-user/:username', (req: Request, res: Response) => {
    const results = getResults();
    const agents = results.filter(
      (r) => r.user.username.toLowerCase() === req.params.username.toLowerCase()
    );

    res.json({
      agents,
      count: agents.length,
    });
  });

  /**
   * GET /api/agents/by-species/:species - Get agents by species
   */
  router.get('/by-species/:species', (req: Request, res: Response) => {
    const results = getResults();
    const agents = results.filter(
      (r) => r.agent.species.toLowerCase() === req.params.species.toLowerCase()
    );

    res.json({
      agents,
      count: agents.length,
    });
  });

  return router;
}
