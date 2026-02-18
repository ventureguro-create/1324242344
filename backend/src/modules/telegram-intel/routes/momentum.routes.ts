/**
 * Momentum Routes (M-1 + M-2)
 */
import { FastifyPluginAsync } from 'fastify';
import { computeMomentumForAll, scoreMomentumForDay } from '../momentum/momentum.compute.js';
import { getMomentumTop, getChannelMomentumHistory, getMomentumMovers } from '../momentum/momentum.query.js';
import { toDayStr } from '../momentum/momentum.utils.js';

export const momentumRoutes: FastifyPluginAsync = async (fastify) => {
  // PUBLIC: top momentum
  fastify.get('/api/telegram-intel/momentum/top', async (req) => {
    const q = (req.query as any) || {};
    const items = await getMomentumTop({
      day: q.day,
      metric: q.metric || 'intelScore',
      days: Number(q.days) === 30 ? 30 : 7,
      limit: Number(q.limit || 50),
      maxFraud: Number(q.maxFraud || 0.75),
      sort: q.sort || 'momentumScore',
    });

    return {
      ok: true,
      metric: q.metric || 'intelScore',
      days: Number(q.days) === 30 ? 30 : 7,
      sort: q.sort || 'momentumScore',
      count: items.length,
      items,
    };
  });

  // PUBLIC: channel momentum history
  fastify.get('/api/telegram-intel/channel/:username/momentum', async (req) => {
    const { username } = req.params as any;
    const q = (req.query as any) || {};

    const items = await getChannelMomentumHistory({
      username,
      metric: q.metric || 'intelScore',
      days: Number(q.days || 90),
    });

    const latest = items[items.length - 1] || null;

    return {
      ok: true,
      username: username.replace('@', '').toLowerCase(),
      metric: q.metric || 'intelScore',
      days: Number(q.days || 90),
      count: items.length,
      latest,
      items,
    };
  });

  // PUBLIC: momentum movers (PATCH-2)
  fastify.get('/api/telegram-intel/momentum/movers', async (req) => {
    const q = (req.query as any) || {};
    const result = await getMomentumMovers({
      days: Number(q.days) === 30 ? 30 : 7,
      limit: Number(q.limit || 50),
      maxFraud: Number(q.maxFraud || 0.75),
    });

    return { ok: true, ...result };
  });

  // ADMIN: run momentum compute (M-1)
  fastify.post('/api/admin/telegram-intel/momentum/run', async (req) => {
    const body = (req.body as any) || {};
    const anchorDay = body.anchorDay || toDayStr(new Date());

    const res = await computeMomentumForAll({
      anchorDay,
      lookbackDays: Number(body.lookbackDays || 90),
      metric: body.metric || 'intelScore',
    });

    return { ok: true, ...res };
  });

  // ADMIN: score momentum (M-2)
  fastify.post('/api/admin/telegram-intel/momentum/score', async (req) => {
    const body = (req.body as any) || {};
    const day = body.day || toDayStr(new Date());

    const res = await scoreMomentumForDay({
      day,
      metric: body.metric || 'intelScore',
      minChannels: Number(body.minChannels || 5),
    });

    return { ok: true, ...res };
  });

  // ADMIN: full pipeline (compute + score)
  fastify.post('/api/admin/telegram-intel/momentum/pipeline', async (req) => {
    const body = (req.body as any) || {};
    const day = body.day || toDayStr(new Date());
    const metric = body.metric || 'intelScore';

    // Step 1: Compute metrics
    const computeRes = await computeMomentumForAll({
      anchorDay: day,
      lookbackDays: Number(body.lookbackDays || 90),
      metric,
    });

    if (!computeRes.ok) {
      return { ok: false, step: 'compute', ...computeRes };
    }

    // Step 2: Score
    const scoreRes = await scoreMomentumForDay({
      day,
      metric,
      minChannels: 5,
    });

    return {
      ok: true,
      day,
      metric,
      compute: computeRes,
      score: scoreRes,
    };
  });

  fastify.log.info('[momentum] routes registered');
};
