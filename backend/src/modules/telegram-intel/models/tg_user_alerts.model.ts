/**
 * User Alerts Model (BLOCK 5.2)
 * Personalized alerts for users based on their watchlist
 */
import mongoose from 'mongoose';

const TgUserAlertSchema = new mongoose.Schema({
  // User identification (actor pattern)
  actorId: { type: String, required: true, index: true },
  actorType: { 
    type: String, 
    enum: ['anonymous', 'telegram', 'email', 'wallet'],
    default: 'anonymous',
    index: true 
  },

  // Alert source
  username: { type: String, required: true, index: true },
  day: { type: String, required: true, index: true }, // YYYY-MM-DD

  // Alert details
  type: {
    type: String,
    enum: [
      'INTEL_SPIKE', 'INTEL_DUMP', 
      'MOMENTUM_SPIKE', 'MOMENTUM_DUMP',
      'NET_ALPHA_JUMP', 'FRAUD_SPIKE', 
      'TIER_CHANGE', 'NEW_RISER'
    ],
    required: true,
    index: true,
  },
  severity: { 
    type: String, 
    enum: ['LOW', 'MEDIUM', 'HIGH'], 
    required: true,
    index: true 
  },

  // Metric details
  metric: { type: String },
  prev: { type: mongoose.Schema.Types.Mixed },
  next: { type: mongoose.Schema.Types.Mixed },
  delta: { type: Number },
  deltaPercent: { type: Number },

  // Human-readable message
  message: { type: String },
  
  // Additional context
  meta: { type: mongoose.Schema.Types.Mixed },

  // Read status
  read: { type: Boolean, default: false, index: true },
  readAt: { type: Date },

  // Delivery tracking
  delivered: {
    inApp: { type: Boolean, default: true },
    telegram: { type: Boolean, default: false },
    email: { type: Boolean, default: false },
  },

  createdAt: { type: Date, default: Date.now, index: true },
  expireAt: { type: Date, default: () => new Date(Date.now() + 90 * 24 * 3600 * 1000) },
}, { timestamps: false });

// Unique per user+channel+day+type
TgUserAlertSchema.index({ actorId: 1, username: 1, day: 1, type: 1 }, { unique: true });
TgUserAlertSchema.index({ actorId: 1, createdAt: -1 });
TgUserAlertSchema.index({ actorId: 1, read: 1, createdAt: -1 });
TgUserAlertSchema.index({ actorId: 1, severity: 1, createdAt: -1 });
// TTL - auto-delete after 90 days
TgUserAlertSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export const TgUserAlertModel = mongoose.models.TgUserAlert ||
  mongoose.model('TgUserAlert', TgUserAlertSchema, 'tg_user_alerts');

export type TgUserAlertDoc = mongoose.InferSchemaType<typeof TgUserAlertSchema>;
