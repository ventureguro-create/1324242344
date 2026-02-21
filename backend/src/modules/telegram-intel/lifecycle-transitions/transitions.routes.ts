/**
 * Lifecycle Transitions Routes (U-9)
 * 
 * API:
 * - GET /api/telegram-intel/lifecycle/transitions
 * - POST /api/admin/telegram-intel/lifecycle/transitions/run
 */

import { FastifyPluginAsync } from 'fastify';
import { LifecycleTransitionsService } from './transitions.service.js';

export const lifecycleTransitionsRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new LifecycleTransitionsService();

  /**
   * GET /api/telegram-intel/lifecycle/transitions
   * 
   * List lifecycle transitions
   * 
   * Query params:
   * - days: number (default 7, max 30)
   * - limit: number (default 50, max 200)
   * - filter: string (e.g., "EMERGING_TO_EXPANDING")
   */
  fastify.get('/api/telegram-intel/lifecycle/transitions', async (req, reply) => {
    const { days, limit, filter } = req.query as { 
      days?: string; 
      limit?: string; 
      filter?: string;
    };

    const parsedDays = Math.min(30, Math.max(1, Number(days ?? 7)));
    const parsedLimit = Math.min(200, Math.max(10, Number(limit ?? 50)));

    try {
      // First try to get from database
      const result = await service.list({ 
        days: parsedDays, 
        limit: parsedLimit, 
        filter 
      });

      // If no results, return mock data for demo
      if (result.items.length === 0) {
        const mockItems = await service.getMockTransitions(parsedDays, parsedLimit);
        return {
          ok: true,
          days: parsedDays,
          limit: parsedLimit,
          filter,
          items: mockItems,
          source: 'mock',
        };
      }

      return result;
    } catch (error: any) {
      fastify.log.error(error, '[U-9] transitions list error');
      
      // Return mock data on error
      const mockItems = await service.getMockTransitions(parsedDays, parsedLimit);
      return {
        ok: true,
        days: parsedDays,
        limit: parsedLimit,
        filter,
        items: mockItems,
        source: 'mock',
      };
    }
  });

  /**
   * POST /api/admin/telegram-intel/lifecycle/transitions/run
   * 
   * Run transition computation
   * 
   * Query params:
   * - days: number (default 7, max 30)
   */
  fastify.post('/api/admin/telegram-intel/lifecycle/transitions/run', async (req, reply) => {
    const { days } = req.query as { days?: string };
    const parsedDays = Math.min(30, Math.max(1, Number(days ?? 7)));

    try {
      const result = await service.run(parsedDays);
      return result;
    } catch (error: any) {
      fastify.log.error(error, '[U-9] transitions run error');
      return reply.status(500).send({
        ok: false,
        error: 'TRANSITIONS_RUN_ERROR',
        message: error?.message || 'Failed to run transitions computation',
      });
    }
  });

  fastify.log.info('[U-9] Lifecycle Transitions routes registered');
};
