/**
 * Lifecycle Routes (U-7)
 * API endpoints for channel lifecycle classification
 */

import { FastifyPluginAsync } from 'fastify';
import { LifecycleService } from './lifecycle.service.js';

export const lifecycleRoutes: FastifyPluginAsync = async (fastify) => {
  const lifecycleService = new LifecycleService();

  /**
   * GET /api/telegram-intel/lifecycle
   * Get lifecycle classification for all channels
   */
  fastify.get('/api/telegram-intel/lifecycle', async (req) => {
    const q = (req.query as any) || {};
    
    return lifecycleService.getLifecycleList({
      limit: q.limit ? Number(q.limit) : 100,
      stage: q.stage?.toUpperCase(),
      sort: q.sort,
    });
  });

  /**
   * GET /api/telegram-intel/lifecycle/:username
   * Get lifecycle for single channel
   */
  fastify.get('/api/telegram-intel/lifecycle/:username', async (req, reply) => {
    const { username } = req.params as any;
    
    const result = await lifecycleService.getChannelLifecycle(username);
    
    if (!result) {
      return reply.status(404).send({ ok: false, error: 'channel_not_found' });
    }

    return { ok: true, channel: result };
  });

  /**
   * GET /api/telegram-intel/lifecycle/stage/:stage
   * Get channels by lifecycle stage
   */
  fastify.get('/api/telegram-intel/lifecycle/stage/:stage', async (req) => {
    const { stage } = req.params as any;
    const q = (req.query as any) || {};
    
    return lifecycleService.getLifecycleList({
      limit: q.limit ? Number(q.limit) : 50,
      stage: stage?.toUpperCase(),
      sort: q.sort,
    });
  });

  fastify.log.info('[lifecycle] routes registered');
};
