/**
 * Signal Model (U-10)
 * Actionable intelligence signals
 */
import { Schema, model } from 'mongoose';

const TgSignalSchema = new Schema(
  {
    type: { type: String, required: true, index: true }, // SUBSCRIBE_CANDIDATE, ROTATION_IN_OPPORTUNITY, etc.
    scope: { type: String, required: true, index: true }, // CHANNEL | SECTOR

    username: { type: String, index: true }, // for channel signals
    category: { type: String, index: true }, // for sector signals too

    severity: { type: String, required: true, index: true }, // HIGH/MED/LOW
    confidence: { type: Number, required: true, index: true }, // 0..1
    score: { type: Number, required: true, index: true }, // 0..100

    days: { type: Number, required: true, index: true },
    day: { type: String, required: true, index: true }, // YYYY-MM-DD

    title: { type: String, required: true },
    reasons: { type: [String], default: [] },

    // snapshot payload for explain
    snapshot: { type: Schema.Types.Mixed },

    createdAt: { type: Date, default: () => new Date(), index: true },
  },
  { collection: 'tg_signals' }
);

TgSignalSchema.index({ type: 1, username: 1, day: 1, days: 1 }, { unique: true, sparse: true });

export const TgSignalModel = model('TgSignal', TgSignalSchema);
