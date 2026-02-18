/**
 * Watchlist Routes (BLOCK 5.1)
 * API endpoints for managing user watchlists
 */
import { FastifyPluginAsync } from 'fastify';
import { resolveActor } from './actor.resolver.js';
import * as WatchlistService from './watchlist.service.js';

export const watchlistRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/telegram-intel/watchlist
   * Get user's watchlist with current scores
   */
  fastify.get('/api/telegram-intel/watchlist', async (req) => {
    const actor = resolveActor(req);
    const q = (req.query as any) || {};

    const filters = {
      search: q.search,
      tags: q.tags ? String(q.tags).split(',').filter(Boolean) : undefined,
      limit: Math.min(100, Math.max(1, Number(q.limit || 50))),
      offset: Math.max(0, Number(q.offset || 0)),
      sortBy: q.sortBy || 'addedAt',
      sortOrder: q.sortOrder || 'desc',
    };

    return WatchlistService.getWatchlist(actor, filters);
  });

  /**
   * POST /api/telegram-intel/watchlist
   * Add channel to watchlist
   */
  fastify.post('/api/telegram-intel/watchlist', async (req, reply) => {
    const actor = resolveActor(req);
    const body = (req.body as any) || {};

    const username = String(body.username || '').trim();
    if (!username) {
      return reply.status(400).send({ ok: false, error: 'username_required' });
    }

    return WatchlistService.addToWatchlist(actor, {
      username,
      note: body.note,
      tags: body.tags,
      alertSettings: body.alertSettings,
    });
  });

  /**
   * DELETE /api/telegram-intel/watchlist/:username
   * Remove channel from watchlist
   */
  fastify.delete('/api/telegram-intel/watchlist/:username', async (req) => {
    const actor = resolveActor(req);
    const { username } = req.params as any;

    return WatchlistService.removeFromWatchlist(actor, username);
  });

  /**
   * PATCH /api/telegram-intel/watchlist/:username
   * Update watchlist item settings
   */
  fastify.patch('/api/telegram-intel/watchlist/:username', async (req, reply) => {
    const actor = resolveActor(req);
    const { username } = req.params as any;
    const body = (req.body as any) || {};

    const result = await WatchlistService.updateWatchlistItem(actor, username, {
      note: body.note,
      tags: body.tags,
      alertSettings: body.alertSettings,
    });

    if (!result.ok) {
      return reply.status(404).send(result);
    }

    return result;
  });

  /**
   * GET /api/telegram-intel/watchlist/check/:username
   * Check if channel is in watchlist
   */
  fastify.get('/api/telegram-intel/watchlist/check/:username', async (req) => {
    const actor = resolveActor(req);
    const { username } = req.params as any;

    const inWatchlist = await WatchlistService.isInWatchlist(actor, username);

    return { ok: true, username, inWatchlist };
  });

  /**
   * POST /api/telegram-intel/watchlist/check-bulk
   * Bulk check watchlist status
   */
  fastify.post('/api/telegram-intel/watchlist/check-bulk', async (req, reply) => {
    const actor = resolveActor(req);
    const body = (req.body as any) || {};
    const usernames = body.usernames;

    if (!Array.isArray(usernames) || usernames.length === 0) {
      return reply.status(400).send({ ok: false, error: 'usernames_array_required' });
    }

    if (usernames.length > 100) {
      return reply.status(400).send({ ok: false, error: 'max_100_usernames' });
    }

    const statuses = await WatchlistService.bulkCheckWatchlist(actor, usernames);

    return { ok: true, statuses };
  });

  /**
   * GET /api/telegram-intel/watchlist/tags
   * Get all tags used by user
   */
  fastify.get('/api/telegram-intel/watchlist/tags', async (req) => {
    const actor = resolveActor(req);
    const tags = await WatchlistService.getWatchlistTags(actor);
    return { ok: true, tags };
  });

  /**
   * GET /api/telegram-intel/watchlist/count
   * Get watchlist count
   */
  fastify.get('/api/telegram-intel/watchlist/count', async (req) => {
    const actor = resolveActor(req);
    const count = await WatchlistService.getWatchlistCount(actor);
    return { ok: true, count };
  });

  fastify.log.info('[watchlist] routes registered');
};
