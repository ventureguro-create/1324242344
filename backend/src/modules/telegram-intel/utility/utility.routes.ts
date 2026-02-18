/**
 * Utility API Routes (BLOCK U-1)
 * REST endpoints for utility-based channel intelligence
 */

import { FastifyPluginAsync } from 'fastify';
import { UtilityService } from './utility.service.js';
import { MongoUtilityDataAdapter, MockUtilityDataAdapter } from './utility.data.js';

export const utilityRoutes: FastifyPluginAsync = async (fastify) => {
  // Initialize data adapter
  const useMock = process.env.TG_UTILITY_MOCK === '1';
  const dataAdapter = useMock ? new MockUtilityDataAdapter() : new MongoUtilityDataAdapter();
  const utilityService = new UtilityService(dataAdapter);

  /**
   * GET /api/telegram-intel/utility/list
   * List channels by utility score (standalone endpoint)
   */
  fastify.get('/api/telegram-intel/utility/list', async (req) => {
    const q = (req.query as any) || {};

    const limit = Math.min(200, Math.max(1, Number(q.limit ?? 50)));
    const offset = Math.max(0, Number(q.offset ?? 0));

    return utilityService.list({
      search: q.search,
      limit,
      offset,
      sort: q.sort,
      maxFraud: q.maxFraud ? Number(q.maxFraud) : undefined,
      tier: q.tier,
    });
  });

  /**
   * GET /api/telegram-intel/utility/channel/:username
   * Get single channel utility score
   */
  fastify.get('/api/telegram-intel/utility/channel/:username', async (req, reply) => {
    const { username } = req.params as any;

    const result = await utilityService.getChannel(username);

    if (!result) {
      return reply.status(404).send({ ok: false, error: 'not_found' });
    }

    return { ok: true, channel: result };
  });

  /**
   * GET /api/telegram-intel/utility/explain
   * Explain utility scoring formula
   */
  fastify.get('/api/telegram-intel/utility/explain', async () => {
    return {
      ok: true,
      formula: {
        description: 'Utility Score = weighted combination of objective metrics',
        weights: {
          engagement: 0.25,
          growth: 0.20,
          stability: 0.15,
          originality: 0.15,
          activity: 0.15,
          fraudInverse: 0.10,
        },
        tiers: {
          'A+': '85-100',
          A: '75-84',
          B: '60-74',
          C: '40-59',
          D: '0-39',
        },
        metrics: {
          engagement: 'Views / Subscribers ratio (2%-25% range)',
          growth: '30-day score change (-5% to +40% range)',
          stability: 'View consistency (lower dispersion = better)',
          originality: '1 - forward ratio (less reposts = better)',
          activity: 'Posts per day (0.2-6 optimal range)',
          fraudInverse: '1 - fraud risk (cleaner = better)',
        },
      },
    };
  });

  fastify.log.info('[utility] routes registered');
};

/**
 * Patch existing /intel/list to support mode=utility
 * Call this in telegram_intel.plugin.ts
 */
export function createUtilityModeHandler(useMock = false) {
  const dataAdapter = useMock ? new MockUtilityDataAdapter() : new MongoUtilityDataAdapter();
  const utilityService = new UtilityService(dataAdapter);

  return async function handleUtilityMode(q: any) {
    const limit = Math.min(200, Math.max(1, Number(q.limit ?? 50)));
    const offset = Math.max(0, Number(q.offset ?? 0));

    return utilityService.list({
      search: q.search,
      limit,
      offset,
      sort: q.sort,
      maxFraud: q.maxFraud ? Number(q.maxFraud) : undefined,
      tier: q.tier,
    });
  };
}
