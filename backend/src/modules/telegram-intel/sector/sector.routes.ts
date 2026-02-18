/**
 * Sector Routes (U-3, U-4, U-5)
 * API endpoints for sector heatmap and market intelligence
 */

import { FastifyPluginAsync } from 'fastify';
import { SectorService } from './sector.service.js';

export const sectorRoutes: FastifyPluginAsync = async (fastify) => {
  const sectorService = new SectorService();

  /**
   * GET /api/telegram-intel/sector/overview
   * Get complete sector heatmap with all metrics
   */
  fastify.get('/api/telegram-intel/sector/overview', async () => {
    return sectorService.getOverview();
  });

  /**
   * GET /api/telegram-intel/sector/:category
   * Get single sector metrics
   */
  fastify.get('/api/telegram-intel/sector/:category', async (req, reply) => {
    const { category } = req.params as any;
    const sector = await sectorService.getSector(category.toUpperCase());
    
    if (!sector) {
      return reply.status(404).send({ ok: false, error: 'sector_not_found' });
    }

    return { ok: true, sector };
  });

  fastify.log.info('[sector] routes registered');
};
