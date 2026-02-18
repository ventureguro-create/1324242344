/**
 * User Alerts Routes (BLOCK 5.2)
 * API endpoints for personalized user alerts
 */
import { FastifyPluginAsync } from 'fastify';
import { TgUserAlertModel } from '../models/tg_user_alerts.model.js';
import { resolveActor } from '../watchlist/actor.resolver.js';
import * as AlertsEngine from './alerts.engine.js';

export const userAlertsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/telegram-intel/user/alerts
   * Get personalized alerts for current user
   */
  fastify.get('/api/telegram-intel/user/alerts', async (req) => {
    const actor = resolveActor(req);
    const q = (req.query as any) || {};

    const limit = Math.min(100, Math.max(1, Number(q.limit || 50)));
    const offset = Math.max(0, Number(q.offset || 0));
    const unreadOnly = q.unreadOnly === 'true' || q.unreadOnly === '1';
    const severity = q.severity;
    const type = q.type;
    const username = q.username ? String(q.username).replace(/^@/, '').toLowerCase() : undefined;

    // Build filter
    const filter: any = { actorId: actor.actorId };
    if (unreadOnly) filter.read = false;
    if (severity) filter.severity = severity;
    if (type) filter.type = type;
    if (username) filter.username = username;

    const [items, total, unreadCount] = await Promise.all([
      TgUserAlertModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      TgUserAlertModel.countDocuments(filter),
      TgUserAlertModel.countDocuments({ actorId: actor.actorId, read: false }),
    ]);

    // Stats by severity
    const stats = await TgUserAlertModel.aggregate([
      { $match: { actorId: actor.actorId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unread: { $sum: { $cond: [{ $eq: ['$read', false] }, 1, 0] } },
          high: { $sum: { $cond: [{ $eq: ['$severity', 'HIGH'] }, 1, 0] } },
          medium: { $sum: { $cond: [{ $eq: ['$severity', 'MEDIUM'] }, 1, 0] } },
          low: { $sum: { $cond: [{ $eq: ['$severity', 'LOW'] }, 1, 0] } },
        }
      }
    ]);

    return {
      ok: true,
      total,
      count: items.length,
      offset,
      limit,
      unreadCount,
      items: items.map(i => ({ ...i, _id: String((i as any)._id) })),
      stats: stats[0] || { total: 0, unread: 0, high: 0, medium: 0, low: 0 },
    };
  });

  /**
   * POST /api/telegram-intel/user/alerts/read
   * Mark alerts as read
   */
  fastify.post('/api/telegram-intel/user/alerts/read', async (req) => {
    const actor = resolveActor(req);
    const body = (req.body as any) || {};
    const alertIds = body.alertIds; // Optional: specific IDs to mark

    return AlertsEngine.markAlertsRead(actor.actorId, alertIds);
  });

  /**
   * POST /api/telegram-intel/user/alerts/read-all
   * Mark all alerts as read
   */
  fastify.post('/api/telegram-intel/user/alerts/read-all', async (req) => {
    const actor = resolveActor(req);
    return AlertsEngine.markAlertsRead(actor.actorId);
  });

  /**
   * GET /api/telegram-intel/user/alerts/unread-count
   * Get unread alert count
   */
  fastify.get('/api/telegram-intel/user/alerts/unread-count', async (req) => {
    const actor = resolveActor(req);
    const count = await AlertsEngine.getUnreadAlertCount(actor.actorId);
    return { ok: true, count };
  });

  /**
   * DELETE /api/telegram-intel/user/alerts/:id
   * Delete specific alert
   */
  fastify.delete('/api/telegram-intel/user/alerts/:id', async (req, reply) => {
    const actor = resolveActor(req);
    const { id } = req.params as any;

    const result = await TgUserAlertModel.deleteOne({
      _id: id,
      actorId: actor.actorId,
    });

    if (result.deletedCount === 0) {
      return reply.status(404).send({ ok: false, error: 'not_found' });
    }

    return { ok: true, deleted: true };
  });

  // ==================== Admin Routes ====================

  /**
   * POST /api/admin/telegram-intel/user-alerts/run
   * Run personalized alerts engine (admin)
   */
  fastify.post('/api/admin/telegram-intel/user-alerts/run', async (req) => {
    const body = (req.body as any) || {};
    return AlertsEngine.runPersonalizedAlerts({
      day: body.day,
      config: body.config,
      dryRun: body.dryRun,
    });
  });

  /**
   * GET /api/admin/telegram-intel/user-alerts/stats
   * Get alert statistics (admin)
   */
  fastify.get('/api/admin/telegram-intel/user-alerts/stats', async () => {
    const stats = await TgUserAlertModel.aggregate([
      {
        $group: {
          _id: null,
          totalAlerts: { $sum: 1 },
          uniqueUsers: { $addToSet: '$actorId' },
          unread: { $sum: { $cond: [{ $eq: ['$read', false] }, 1, 0] } },
          byType: {
            $push: '$type'
          },
          bySeverity: {
            $push: '$severity'
          },
        }
      },
      {
        $project: {
          totalAlerts: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          unread: 1,
        }
      }
    ]);

    const typeStats = await TgUserAlertModel.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const severityStats = await TgUserAlertModel.aggregate([
      { $group: { _id: '$severity', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    return {
      ok: true,
      summary: stats[0] || { totalAlerts: 0, uniqueUsers: 0, unread: 0 },
      byType: typeStats,
      bySeverity: severityStats,
    };
  });

  fastify.log.info('[user-alerts] routes registered');
};
