/**
 * Leaderboard Routes (PATCH-1 + PATCH-3)
 * Unified /intel/list with mode support and materialized views
 */
import { FastifyPluginAsync } from 'fastify';
import { buildLeaderboardsForDay, readLeaderboard } from '../leaderboard/leaderboard.service.js';

export const leaderboardRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/telegram-intel/intel/list
   * Unified leaderboard with mode=intel|momentum (PATCH-1)
   * Uses materialized views when available (PATCH-3)
   */
  fastify.get('/api/telegram-intel/intel/list', async (req) => {
    const q = (req.query as any) || {};

    const mode = q.mode === 'momentum' ? 'momentum' : 'intel';
    const page = Math.max(1, Number(q.page || 1));
    const limit = Math.min(100, Math.max(1, Number(q.limit || 25)));
    const search = q.search ? String(q.search).toLowerCase().trim() : undefined;
    const tier = q.tier || undefined;
    const maxFraud = q.maxFraud ? Number(q.maxFraud) : undefined;
    const sort = q.sort || undefined;

    return readLeaderboard({
      mode,
      day: q.day,
      page,
      limit,
      search,
      tier,
      maxFraud,
      sort,
    });
  });

  // ADMIN: build leaderboard snapshots
  fastify.post('/api/admin/telegram-intel/leaderboard/build', async (req) => {
    const body = (req.body as any) || {};
    const res = await buildLeaderboardsForDay({
      day: body.day,
      configVersion: body.configVersion,
    });
    return { ok: true, ...res };
  });

  fastify.log.info('[leaderboard] routes registered');
};
