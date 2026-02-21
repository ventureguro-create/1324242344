/**
 * Sector Routes (U-3, U-4, U-5, U-6)
 * API endpoints for sector heatmap, market intelligence, and rotation tracking
 */

import { FastifyPluginAsync } from 'fastify';
import { SectorService } from './sector.service.js';
import { RotationService } from './rotation.service.js';

export const sectorRoutes: FastifyPluginAsync = async (fastify) => {
  const sectorService = new SectorService();
  const rotationService = new RotationService();

  /**
   * GET /api/telegram-intel/sector/overview
   * Get complete sector heatmap with all metrics
   */
  fastify.get('/api/telegram-intel/sector/overview', async () => {
    return sectorService.getOverview();
  });

  /**
   * GET /api/telegram-intel/sector/rotation
   * Get sector rotation data (U-6)
   */
  fastify.get('/api/telegram-intel/sector/rotation', async (req) => {
    const q = (req.query as any) || {};
    const days = Math.min(30, Math.max(1, Number(q.days ?? 7)));
    return rotationService.getRotation(days);
  });

  /**
   * POST /api/admin/telegram-intel/sector/snapshot
   * Write daily sector snapshot (admin)
   */
  fastify.post('/api/admin/telegram-intel/sector/snapshot', async (req) => {
    const body = (req.body as any) || {};
    return rotationService.writeDailySnapshot(body.day);
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

  fastify.log.info('[sector] routes registered (including rotation)');
};
