/**
 * Lifecycle Transition Model (U-9)
 * Tracks lifecycle stage changes over time
 */
import { Schema, model } from 'mongoose';

const TgLifecycleTransitionSchema = new Schema(
  {
    username: { type: String, required: true, index: true },
    category: { type: String, index: true },

    from: { type: String, required: true, index: true },
    to: { type: String, required: true, index: true },

    // comparison window
    days: { type: Number, required: true, index: true },
    fromDay: { type: String, required: true, index: true }, // YYYY-MM-DD
    toDay: { type: String, required: true, index: true },   // YYYY-MM-DD

    // current snapshot key metrics
    utilityNow: { type: Number, required: true },
    growth30Now: { type: Number, required: true },
    accelerationNow: { type: Number, required: true },
    erNow: { type: Number, required: true },
    fraudNow: { type: Number, required: true },

    // deltas
    deltaUtility: { type: Number, required: true },
    deltaGrowth30: { type: Number, required: true },
    deltaAcceleration: { type: Number, required: true },
    deltaER: { type: Number, required: true },
    deltaFraud: { type: Number, required: true },

    // for sorting - composite impact score
    impactScore: { type: Number, required: true, index: true },

    createdAt: { type: Date, default: () => new Date(), index: true },
  },
  { collection: 'tg_lifecycle_transitions' }
);

// idempotency: one transition event per (username, toDay, days)
TgLifecycleTransitionSchema.index({ username: 1, toDay: 1, days: 1 }, { unique: true });

export const TgLifecycleTransitionModel = model('TgLifecycleTransition', TgLifecycleTransitionSchema);
