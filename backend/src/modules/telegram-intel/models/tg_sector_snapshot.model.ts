/**
 * Sector Snapshot Model (U-6)
 * Daily snapshots for rotation tracking
 */
import mongoose from 'mongoose';

const SectorRowSchema = new mongoose.Schema({
  category: { type: String, required: true },
  
  avgUtility: { type: Number, required: true },
  avgGrowth30: { type: Number, required: true },
  avgGrowth7: { type: Number, required: true },
  avgAcceleration: { type: Number, required: true },
  avgER: { type: Number, required: true },
  avgFraud: { type: Number, required: true },
  
  channelsCount: { type: Number, required: true },
  explodingCount: { type: Number, default: 0 },
  acceleratingCount: { type: Number, default: 0 },
}, { _id: false });

const TgSectorSnapshotSchema = new mongoose.Schema({
  day: { type: String, required: true, unique: true, index: true }, // YYYY-MM-DD
  rows: { type: [SectorRowSchema], default: [] },
  market: {
    totalChannels: { type: Number, default: 0 },
    avgUtility: { type: Number, default: 0 },
    avgGrowth: { type: Number, default: 0 },
    avgAcceleration: { type: Number, default: 0 },
  },
  createdAt: { type: Date, default: Date.now },
}, { collection: 'tg_sector_snapshots' });

export const TgSectorSnapshotModel = mongoose.models.TgSectorSnapshot ||
  mongoose.model('TgSectorSnapshot', TgSectorSnapshotSchema);
