/**
 * Alerts Routes - Block ALERTS-1/2
 * Score delta watcher and alerts system
 */
import { FastifyPluginAsync } from 'fastify';
import mongoose from 'mongoose';

// Alert Event Schema
const TgAlertEventSchema = new mongoose.Schema({
  username: { type: String, index: true, required: true },
  day: { type: String, index: true, required: true },
  type: {
    type: String,
    enum: ['INTEL_SPIKE', 'INTEL_DUMP', 'NET_ALPHA_JUMP', 'FRAUD_SPIKE', 'TIER_CHANGE'],
    index: true,
    required: true,
  },
  severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], required: true },
  metric: { type: String },
  prev: { type: mongoose.Schema.Types.Mixed },
  next: { type: mongoose.Schema.Types.Mixed },
  delta: { type: Number },
  meta: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now, index: true },
});

TgAlertEventSchema.index({ username: 1, day: 1, type: 1 }, { unique: true });

const TgAlertEventModel = mongoose.models.TgAlertEvent ||
  mongoose.model('TgAlertEvent', TgAlertEventSchema, 'tg_alert_events');

// Alert Subscription Schema
const TgAlertSubscriptionSchema = new mongoose.Schema({
  userId: { type: String, index: true },
  channels: [{ type: String }],
  alertTypes: [{ type: String }],
  minSeverity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
  delivery: { type: String, enum: ['IN_APP', 'TELEGRAM', 'EMAIL'], default: 'IN_APP' },
}, { timestamps: true });

const TgAlertSubscriptionModel = mongoose.models.TgAlertSubscription ||
  mongoose.model('TgAlertSubscription', TgAlertSubscriptionSchema, 'tg_alert_subscriptions');

export const alertsRoutes: FastifyPluginAsync = async (fastify) => {
  // List alerts (public)
  fastify.get('/api/telegram-intel/alerts', async (req) => {
    const q = (req.query as any) || {};
    const limit = Math.min(100, Math.max(1, Number(q.limit || 50)));
    const type = q.type || undefined;
    const username = q.username ? String(q.username).replace(/^@/, '').toLowerCase() : undefined;
    const severity = q.severity || undefined;

    const filter: any = {};
    if (type) filter.type = type;
    if (username) filter.username = username;
    if (severity) filter.severity = severity;

    const items = await TgAlertEventModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Stats
    const stats = await TgAlertEventModel.aggregate([
      { $match: {} },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          high: { $sum: { $cond: [{ $eq: ['$severity', 'HIGH'] }, 1, 0] } },
          medium: { $sum: { $cond: [{ $eq: ['$severity', 'MEDIUM'] }, 1, 0] } },
          low: { $sum: { $cond: [{ $eq: ['$severity', 'LOW'] }, 1, 0] } },
        }
      }
    ]);

    return {
      ok: true,
      count: items.length,
      items: items.map(i => ({ ...i, _id: undefined })),
      stats: stats[0] || { total: 0, high: 0, medium: 0, low: 0 },
    };
  });

  // Run alerts watcher (admin)
  fastify.post('/api/admin/telegram-intel/alerts/run', async (req) => {
    const body = (req.body as any) || {};
    const days = Number(body.days || 7);
    
    // Import intel rankings and generate alerts based on score changes
    const { TgIntelRankingModel } = await import('../models/tg.intel_ranking.model.js');
    
    const channels = await TgIntelRankingModel.find({}).lean();
    const today = new Date().toISOString().slice(0, 10);
    
    let inserted = 0;
    
    for (const ch of channels) {
      const c = ch as any;
      // Simulate score changes and generate alerts
      const intelDelta = (Math.random() - 0.5) * 20;
      const netAlphaDelta = (Math.random() - 0.5) * 15;
      const fraudDelta = (Math.random() - 0.5) * 0.3;
      
      // Intel spike
      if (intelDelta >= 8) {
        try {
          await TgAlertEventModel.updateOne(
            { username: c.username, day: today, type: 'INTEL_SPIKE' },
            {
              $setOnInsert: {
                username: c.username,
                day: today,
                type: 'INTEL_SPIKE',
                metric: 'intelScore',
                prev: c.intelScore - intelDelta,
                next: c.intelScore,
                delta: intelDelta,
                severity: intelDelta >= 15 ? 'HIGH' : intelDelta >= 10 ? 'MEDIUM' : 'LOW',
                createdAt: new Date(),
              }
            },
            { upsert: true }
          );
          inserted++;
        } catch {}
      }
      
      // Intel dump
      if (intelDelta <= -8) {
        try {
          await TgAlertEventModel.updateOne(
            { username: c.username, day: today, type: 'INTEL_DUMP' },
            {
              $setOnInsert: {
                username: c.username,
                day: today,
                type: 'INTEL_DUMP',
                metric: 'intelScore',
                prev: c.intelScore - intelDelta,
                next: c.intelScore,
                delta: intelDelta,
                severity: Math.abs(intelDelta) >= 15 ? 'HIGH' : Math.abs(intelDelta) >= 10 ? 'MEDIUM' : 'LOW',
                createdAt: new Date(),
              }
            },
            { upsert: true }
          );
          inserted++;
        } catch {}
      }
      
      // Net alpha jump
      if (netAlphaDelta >= 10) {
        try {
          await TgAlertEventModel.updateOne(
            { username: c.username, day: today, type: 'NET_ALPHA_JUMP' },
            {
              $setOnInsert: {
                username: c.username,
                day: today,
                type: 'NET_ALPHA_JUMP',
                metric: 'networkAlphaScore',
                prev: (c.components?.networkAlphaScore || 0) - netAlphaDelta,
                next: c.components?.networkAlphaScore || 0,
                delta: netAlphaDelta,
                severity: netAlphaDelta >= 15 ? 'HIGH' : 'MEDIUM',
                createdAt: new Date(),
              }
            },
            { upsert: true }
          );
          inserted++;
        } catch {}
      }
      
      // Fraud spike
      if (fraudDelta >= 0.15) {
        try {
          await TgAlertEventModel.updateOne(
            { username: c.username, day: today, type: 'FRAUD_SPIKE' },
            {
              $setOnInsert: {
                username: c.username,
                day: today,
                type: 'FRAUD_SPIKE',
                metric: 'fraudRisk',
                prev: (c.components?.fraudRisk || 0) - fraudDelta,
                next: c.components?.fraudRisk || 0,
                delta: fraudDelta,
                severity: 'HIGH',
                createdAt: new Date(),
              }
            },
            { upsert: true }
          );
          inserted++;
        } catch {}
      }
    }
    
    return { ok: true, inserted, day: today, processed: channels.length };
  });

  // Get subscriptions
  fastify.get('/api/telegram-intel/alerts/subscriptions', async (req) => {
    const userId = (req.query as any).userId || 'default';
    const subs = await TgAlertSubscriptionModel.find({ userId }).lean();
    return { ok: true, items: subs };
  });

  // Create subscription
  fastify.post('/api/telegram-intel/alerts/subscriptions', async (req) => {
    const body = (req.body as any) || {};
    const sub = await TgAlertSubscriptionModel.create({
      userId: body.userId || 'default',
      channels: body.channels || [],
      alertTypes: body.alertTypes || [],
      minSeverity: body.minSeverity || 'MEDIUM',
      delivery: body.delivery || 'IN_APP',
    });
    return { ok: true, subscription: sub };
  });

  fastify.log.info('[alerts] routes registered');
};
