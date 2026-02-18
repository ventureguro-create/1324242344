/**
 * Momentum Daily Model (M-1)
 * Stores velocity, acceleration, volatility metrics per channel per day
 */
import mongoose from 'mongoose';

const TgMomentumDailySchema = new mongoose.Schema({
  day: { type: String, required: true, index: true }, // YYYY-MM-DD
  username: { type: String, required: true, index: true },
  metric: {
    type: String,
    enum: ['intelScore', 'alphaScore', 'credibilityScore', 'networkAlphaScore'],
    default: 'intelScore',
    index: true,
  },

  // Raw score timepoints
  s0: { type: Number, default: 0 },    // score at day
  s7: { type: Number, default: null }, // score at day-7
  s14: { type: Number, default: null },
  s30: { type: Number, default: null },

  // Velocities
  v7: { type: Number, default: 0 },    // (s0 - s7)/7
  v30: { type: Number, default: 0 },   // (s0 - s30)/30

  // Acceleration
  a7: { type: Number, default: 0 },    // v7 - ((s7 - s14)/7)

  // Stability/volatility
  vol30: { type: Number, default: 0 },       // stddev over 30d
  consistency30: { type: Number, default: 0 }, // share of positive deltas [0..1]

  // Gates
  fraudRisk: { type: Number, default: 0 },
  credibilityScore: { type: Number, default: 0 },
  tier: { type: String, default: null },

  // M-2 computed
  momentumScore: { type: Number, default: null },
  momentumExplain: { type: [String], default: [] },
  trend: { type: String, enum: ['RISING', 'FLAT', 'FALLING'], default: 'FLAT' },
  newRiser: { type: Boolean, default: false },

  computedAt: { type: Date, default: Date.now },
  expireAt: { type: Date, default: () => new Date(Date.now() + 180 * 24 * 3600 * 1000) },
}, { timestamps: false });

// Idempotency per day+user+metric
TgMomentumDailySchema.index({ day: 1, username: 1, metric: 1 }, { unique: true });
TgMomentumDailySchema.index({ metric: 1, day: -1 });
TgMomentumDailySchema.index({ metric: 1, day: -1, fraudRisk: 1 });
TgMomentumDailySchema.index({ username: 1, metric: 1, day: -1 });
// TTL
TgMomentumDailySchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export const TgMomentumDailyModel = mongoose.models.TgMomentumDaily ||
  mongoose.model('TgMomentumDaily', TgMomentumDailySchema, 'tg_momentum_daily');
