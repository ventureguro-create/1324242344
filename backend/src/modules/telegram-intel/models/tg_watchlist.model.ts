/**
 * Watchlist Model (BLOCK 5.1)
 * User-specific watched channels with alert settings
 */
import mongoose from 'mongoose';

const TgWatchlistSchema = new mongoose.Schema({
  // User identification (actor pattern)
  actorId: { type: String, required: true, index: true },
  actorType: { 
    type: String, 
    enum: ['anonymous', 'telegram', 'email', 'wallet'],
    default: 'anonymous',
    index: true 
  },

  // Watched channel
  username: { type: String, required: true, index: true },

  // Alert settings for this channel
  alertSettings: {
    enabled: { type: Boolean, default: true },
    minSeverity: { 
      type: String, 
      enum: ['LOW', 'MEDIUM', 'HIGH'], 
      default: 'MEDIUM' 
    },
    alertTypes: {
      type: [String],
      default: ['INTEL_SPIKE', 'INTEL_DUMP', 'MOMENTUM_SPIKE', 'TIER_CHANGE'],
    },
  },

  // Optional metadata
  note: { type: String, maxlength: 500 },
  tags: { type: [String], default: [] },

  // Snapshot at add time (for comparing changes)
  addedSnapshot: {
    intelScore: { type: Number },
    momentumScore: { type: Number },
    tier: { type: String },
  },

  addedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: false });

// One entry per actor+channel
TgWatchlistSchema.index({ actorId: 1, username: 1 }, { unique: true });
TgWatchlistSchema.index({ actorId: 1, actorType: 1 });
TgWatchlistSchema.index({ username: 1 });
TgWatchlistSchema.index({ addedAt: -1 });

export const TgWatchlistModel = mongoose.models.TgWatchlist ||
  mongoose.model('TgWatchlist', TgWatchlistSchema, 'tg_user_watchlist');

export type TgWatchlistDoc = mongoose.InferSchemaType<typeof TgWatchlistSchema>;
