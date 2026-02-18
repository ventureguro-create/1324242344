/**
 * Leaderboard Daily Model (PATCH-3)
 * Materialized daily snapshot for fast queries
 */
import mongoose from 'mongoose';

const LeaderboardItemSchema = new mongoose.Schema({
  username: { type: String, required: true },
  tier: { type: String, default: '—' },

  intelScore: { type: Number, default: 0 },
  alphaScore: { type: Number, default: 0 },
  credibilityScore: { type: Number, default: 0 },
  networkAlphaScore: { type: Number, default: 0 },
  fraudRisk: { type: Number, default: 0 },

  // Momentum fields
  momentumScore: { type: Number, default: null },
  v7: { type: Number, default: null },
  a7: { type: Number, default: null },
  trend: { type: String, default: null },
  newRiser: { type: Boolean, default: false },
}, { _id: false });

const TgLeaderboardDailySchema = new mongoose.Schema({
  day: { type: String, required: true, index: true },
  mode: { type: String, enum: ['intel', 'momentum'], required: true, index: true },

  configVersion: { type: Number, default: 1 },

  stats: {
    trackedChannels: { type: Number, default: 0 },
    avgIntel: { type: Number, default: 0 },
    avgMomentum: { type: Number, default: 0 },
    highAlphaCount: { type: Number, default: 0 },
    highFraudCount: { type: Number, default: 0 },
    newRisersCount: { type: Number, default: 0 },
    tierCounts: {
      S: { type: Number, default: 0 },
      A: { type: Number, default: 0 },
      B: { type: Number, default: 0 },
      C: { type: Number, default: 0 },
      D: { type: Number, default: 0 },
    },
  },

  items: { type: [LeaderboardItemSchema], default: [] },

  computedAt: { type: Date, default: Date.now },
  expireAt: { type: Date, default: () => new Date(Date.now() + 180 * 24 * 3600 * 1000) },
}, { timestamps: false });

TgLeaderboardDailySchema.index({ day: 1, mode: 1 }, { unique: true });
TgLeaderboardDailySchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export const TgLeaderboardDailyModel = mongoose.models.TgLeaderboardDaily ||
  mongoose.model('TgLeaderboardDaily', TgLeaderboardDailySchema, 'tg_leaderboard_daily');
