/**
 * Governance Admin Routes - Block GOV-1
 * Override management for channel scoring
 */
import { FastifyPluginAsync } from 'fastify';
import mongoose from 'mongoose';

// Governance Override Schema
const TgGovernanceOverrideSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, index: true },
  mode: { type: String, enum: ['NONE', 'ALLOWLIST', 'BLOCKLIST'], default: 'NONE' },
  forcedTier: { type: String, enum: ['S', 'A', 'B', 'C', 'D', null], default: null },
  forcedScore: { type: Number, min: 0, max: 100, default: null },
  floorScore: { type: Number, min: 0, max: 100, default: null },
  note: { type: String },
  updatedBy: { type: String },
}, { timestamps: true });

const TgGovernanceOverrideModel = mongoose.models.TgGovernanceOverride ||
  mongoose.model('TgGovernanceOverride', TgGovernanceOverrideSchema, 'tg_governance_overrides');

// Alert Config Schema
const TgAlertConfigSchema = new mongoose.Schema({
  version: { type: Number, required: true },
  thresholds: {
    intelSpike: { type: Number, default: 8 },
    intelDump: { type: Number, default: -8 },
    netAlphaJump: { type: Number, default: 10 },
    fraudSpike: { type: Number, default: 0.15 },
  },
  severityLevels: {
    high: { type: Number, default: 15 },
    medium: { type: Number, default: 10 },
  },
  updatedBy: { type: String },
  comment: { type: String },
}, { timestamps: true });

const TgAlertConfigModel = mongoose.models.TgAlertConfig ||
  mongoose.model('TgAlertConfig', TgAlertConfigSchema, 'tg_alert_config');

export const governanceAdminRoutes: FastifyPluginAsync = async (fastify) => {
  // Get override for channel
  fastify.get('/api/admin/telegram-intel/governance/:username', async (req) => {
    const { username } = req.params as any;
    const u = String(username).replace(/^@/, '').toLowerCase().trim();
    
    const override = await TgGovernanceOverrideModel.findOne({ username: u }).lean();
    
    return { ok: true, override: override || { mode: 'NONE' } };
  });

  // Apply override
  fastify.post('/api/admin/telegram-intel/governance/:username/override', async (req, reply) => {
    const { username } = req.params as any;
    const u = String(username).replace(/^@/, '').toLowerCase().trim();
    const body = (req.body as any) || {};
    
    const { mode, forcedTier, forcedScore, floorScore, note } = body;
    
    // Validation
    if (forcedScore !== null && forcedScore !== undefined && (forcedScore < 0 || forcedScore > 100)) {
      return reply.status(400).send({ ok: false, error: 'forcedScore must be 0-100' });
    }
    if (floorScore !== null && floorScore !== undefined && (floorScore < 0 || floorScore > 100)) {
      return reply.status(400).send({ ok: false, error: 'floorScore must be 0-100' });
    }
    
    const updated = await TgGovernanceOverrideModel.findOneAndUpdate(
      { username: u },
      {
        username: u,
        mode: mode || 'NONE',
        forcedTier: forcedTier || null,
        forcedScore: forcedScore ?? null,
        floorScore: floorScore ?? null,
        note: note || '',
        updatedBy: 'admin',
      },
      { upsert: true, new: true }
    );
    
    return { ok: true, override: updated };
  });

  // Get current config
  fastify.get('/api/admin/telegram-intel/config/current', async () => {
    let config = await TgAlertConfigModel.findOne().sort({ version: -1 }).lean();
    
    // Create default config if none exists
    if (!config) {
      config = await TgAlertConfigModel.create({
        version: 1,
        thresholds: {
          intelSpike: 8,
          intelDump: -8,
          netAlphaJump: 10,
          fraudSpike: 0.15,
        },
        severityLevels: { high: 15, medium: 10 },
        updatedBy: 'system',
        comment: 'Initial config',
      });
    }
    
    return { ok: true, config };
  });

  // Update config
  fastify.post('/api/admin/telegram-intel/config', async (req) => {
    const body = (req.body as any) || {};
    const last = await TgAlertConfigModel.findOne().sort({ version: -1 });
    const nextVersion = (last?.version ?? 0) + 1;
    
    const doc = await TgAlertConfigModel.create({
      version: nextVersion,
      thresholds: body.thresholds || last?.thresholds,
      severityLevels: body.severityLevels || last?.severityLevels,
      updatedBy: 'admin',
      comment: body.comment || '',
    });
    
    return { ok: true, version: doc.version };
  });

  fastify.log.info('[governance-admin] routes registered');
};
