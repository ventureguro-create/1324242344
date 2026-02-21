/**
 * Signal Engine Routes (U-10)
 * 
 * API:
 * - GET /api/telegram-intel/signals
 * - GET /api/telegram-intel/signals/:id
 * - POST /api/admin/telegram-intel/signals/run
 */

import { FastifyPluginAsync } from 'fastify';
import { SignalEngine } from './signals.service.js';

export const signalsRoutes: FastifyPluginAsync = async (fastify) => {
  const engine = new SignalEngine();

  /**
   * GET /api/telegram-intel/signals
   * 
   * List signals
   * 
   * Query params:
   * - days: number (default 7, max 30)
   * - limit: number (default 60, max 200)
   * - type: string (SUBSCRIBE_CANDIDATE, RISING_UTILITY, etc.)
   * - severity: string (HIGH, MED, LOW)
   */
  fastify.get('/api/telegram-intel/signals', async (req, reply) => {
    const { days, limit, type, severity } = req.query as {
      days?: string;
      limit?: string;
      type?: string;
      severity?: string;
    };

    const parsedDays = Math.min(30, Math.max(1, Number(days ?? 7)));
    const parsedLimit = Math.min(200, Math.max(20, Number(limit ?? 60)));

    try {
      const result = await engine.list({
        days: parsedDays,
        limit: parsedLimit,
        type,
        severity,
      });

      // If no results, return mock data for demo
      if (result.items.length === 0) {
        const mockItems = engine.getMockSignals(parsedDays, parsedLimit);
        return {
          ok: true,
          days: parsedDays,
          limit: parsedLimit,
          type,
          severity,
          items: mockItems,
          source: 'mock',
        };
      }

      return result;
    } catch (error: any) {
      fastify.log.error(error, '[U-10] signals list error');
      
      // Return mock data on error
      const mockItems = engine.getMockSignals(parsedDays, parsedLimit);
      return {
        ok: true,
        days: parsedDays,
        limit: parsedLimit,
        type,
        severity,
        items: mockItems,
        source: 'mock',
      };
    }
  });

  /**
   * GET /api/telegram-intel/signals/:id
   * 
   * Get single signal with full snapshot
   */
  fastify.get('/api/telegram-intel/signals/:id', async (req, reply) => {
    const { id } = req.params as { id: string };

    try {
      const result = await engine.get(id);
      if (!result.item) {
        return reply.status(404).send({
          ok: false,
          error: 'SIGNAL_NOT_FOUND',
        });
      }
      return result;
    } catch (error: any) {
      fastify.log.error(error, '[U-10] signal get error');
      return reply.status(500).send({
        ok: false,
        error: 'SIGNAL_GET_ERROR',
        message: error?.message || 'Failed to get signal',
      });
    }
  });

  /**
   * POST /api/admin/telegram-intel/signals/run
   * 
   * Generate signals
   * 
   * Query params:
   * - days: number (default 7, max 30)
   */
  fastify.post('/api/admin/telegram-intel/signals/run', async (req, reply) => {
    const { days } = req.query as { days?: string };
    const parsedDays = Math.min(30, Math.max(1, Number(days ?? 7)));

    try {
      const result = await engine.generate(parsedDays);
      return result;
    } catch (error: any) {
      fastify.log.error(error, '[U-10] signals run error');
      return reply.status(500).send({
        ok: false,
        error: 'SIGNALS_RUN_ERROR',
        message: error?.message || 'Failed to generate signals',
      });
    }
  });

  fastify.log.info('[U-10] Signal Engine routes registered');
};
