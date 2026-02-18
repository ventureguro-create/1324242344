/**
 * Telegram Bot Connections Model (PHASE 6)
 * Stores user connections to Telegram bot for push notifications
 */
import mongoose from 'mongoose';

const TgBotConnectionSchema = new mongoose.Schema({
  // User identification (actor pattern)
  actorId: { type: String, required: true, index: true },
  actorType: { 
    type: String, 
    enum: ['anonymous', 'telegram', 'email', 'wallet'],
    default: 'anonymous',
    index: true 
  },

  // Telegram user data  
  telegramUserId: { type: Number, sparse: true, index: true },
  telegramUsername: { type: String, sparse: true },
  telegramFirstName: { type: String },
  telegramLastName: { type: String },

  // Connection status
  status: { 
    type: String, 
    enum: ['pending', 'active', 'paused', 'blocked'],
    default: 'active',
    index: true 
  },

  // Notification preferences
  preferences: {
    enabled: { type: Boolean, default: true },
    minSeverity: { 
      type: String, 
      enum: ['LOW', 'MEDIUM', 'HIGH'],
      default: 'MEDIUM' 
    },
    alertTypes: [{
      type: String,
      enum: [
        'INTEL_SPIKE', 'INTEL_DUMP', 
        'MOMENTUM_SPIKE', 'MOMENTUM_DUMP',
        'NET_ALPHA_JUMP', 'FRAUD_SPIKE', 
        'TIER_CHANGE', 'NEW_RISER'
      ]
    }],
    quietHours: {
      enabled: { type: Boolean, default: false },
      start: { type: Number, default: 22 }, // Hour 0-23
      end: { type: Number, default: 8 },
    },
    language: { type: String, default: 'ru' },
  },

  // Linking token (for connecting web account to telegram)
  linkToken: { type: String, sparse: true, index: true },
  linkTokenExpires: { type: Date },

  // Stats
  stats: {
    alertsSent: { type: Number, default: 0 },
    lastAlertAt: { type: Date },
    errorCount: { type: Number, default: 0 },
    lastErrorAt: { type: Date },
    lastErrorMessage: { type: String },
  },

  connectedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: false });

// Indexes
TgBotConnectionSchema.index({ actorId: 1, telegramUserId: 1 });
TgBotConnectionSchema.index({ status: 1, 'preferences.enabled': 1 });
TgBotConnectionSchema.index({ telegramUserId: 1 }, { unique: true, sparse: true });

// Pre-save hook to update timestamp
TgBotConnectionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const TgBotConnectionModel = mongoose.models.TgBotConnection ||
  mongoose.model('TgBotConnection', TgBotConnectionSchema, 'tg_bot_connections');

export type TgBotConnectionDoc = mongoose.InferSchemaType<typeof TgBotConnectionSchema>;
