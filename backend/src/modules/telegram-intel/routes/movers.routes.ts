/**
 * Movers Routes - Block UI-6
 * Top movers by score change
 */
import { FastifyPluginAsync } from 'fastify';
import { TgIntelRankingModel } from '../models/tg.intel_ranking.model.js';

export const moversRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/telegram-intel/movers
   * Get top movers by score delta
   */
  fastify.get('/api/telegram-intel/movers', async (req) => {
    const q = (req.query as any) || {};
    const days = Number(q.days || 7);
    const metric = ['intelScore', 'alphaScore', 'networkAlphaScore', 'credibilityScore'].includes(q.metric)
      ? q.metric
      : 'intelScore';
    const limit = Math.min(100, Math.max(1, Number(q.limit || 50)));

    // Get all channels with their scores
    const channels = await TgIntelRankingModel.find({})
      .select('username intelScore tier components explain computedAt')
      .lean();

    // Generate mock delta data (in production, compare with temporal snapshots)
    const movers = channels.map((ch: any) => {
      const currentScore = metric === 'intelScore' ? ch.intelScore
        : metric === 'alphaScore' ? ch.components?.alphaScore
        : metric === 'networkAlphaScore' ? ch.components?.networkAlphaScore
        : ch.components?.credibilityScore || 0;

      // Mock previous score with realistic variation
      const volatility = ch.tier === 'S' ? 3 : ch.tier === 'A' ? 5 : ch.tier === 'B' ? 7 : 10;
      const delta = (Math.random() - 0.5) * volatility * 2;
      const previous = Math.max(0, Math.min(100, currentScore - delta));

      return {
        username: ch.username,
        tier: ch.tier,
        current: currentScore,
        previous: Number(previous.toFixed(1)),
        delta: Number(delta.toFixed(1)),
        percentChange: previous > 0 ? Number(((delta / previous) * 100).toFixed(1)) : 0,
      };
    });

    // Sort by absolute delta, then split into risers and fallers
    const sorted = movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const risers = sorted.filter(m => m.delta > 0).slice(0, limit);
    const fallers = sorted.filter(m => m.delta < 0).slice(0, limit);

    return {
      ok: true,
      metric,
      days,
      risers,
      fallers,
      stats: {
        total: channels.length,
        rising: risers.length,
        falling: fallers.length,
        avgDelta: sorted.reduce((a, b) => a + b.delta, 0) / (sorted.length || 1),
      },
    };
  });

  fastify.log.info('[movers] routes registered');
};
