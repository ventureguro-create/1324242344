/**
 * Recommendation Routes (BLOCK U-8)
 * 
 * API: GET /api/telegram-intel/channel/:username/similar
 */

import { FastifyPluginAsync } from 'fastify';
import { RecommendationService } from './recommendation.service.js';

export const recommendationRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new RecommendationService();

  /**
   * GET /api/telegram-intel/health
   * Health check for telegram-intel module
   */
  fastify.get('/api/telegram-intel/health', async () => {
    return {
      ok: true,
      module: 'telegram-intel',
      version: '1.0.0',
      features: ['utility', 'lifecycle', 'sector', 'recommendations'],
      timestamp: new Date().toISOString(),
    };
  });

  /**
   * GET /api/telegram-intel/channel/:username/similar
   * 
   * Get similar channels based on utility metrics
   * 
   * Query params:
   * - limit: number (default 6, max 12)
   */
  fastify.get('/api/telegram-intel/channel/:username/similar', async (req, reply) => {
    const { username } = req.params as { username: string };
    const { limit } = req.query as { limit?: string };

    const parsedLimit = Math.min(12, Math.max(3, Number(limit ?? 6)));

    try {
      const result = await service.getSimilar(
        String(username).toLowerCase().replace('@', ''),
        parsedLimit
      );
      return result;
    } catch (error: any) {
      fastify.log.error(error, '[U-8] getSimilar error');
      return reply.status(500).send({
        ok: false,
        error: 'RECOMMENDATION_ERROR',
        message: error?.message || 'Failed to get similar channels',
      });
    }
  });

  fastify.log.info('[U-8] Recommendation routes registered');
};
