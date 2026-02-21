/**
 * Recommendation Types (BLOCK U-8)
 * Similar channel recommendations based on utility metrics
 */

import type { LifecycleStage } from '../lifecycle/lifecycle.metrics.js';

export type SimilarChannelRow = {
  username: string;
  title?: string;

  category?: string;
  lifecycle?: LifecycleStage;

  utilityScore: number;
  growth30: number;
  growth7?: number;
  acceleration?: number;

  engagementRate: number; // 0..1
  stability: number;      // 0..1
  fraudRisk: number;      // 0..1

  subscribers?: number;

  similarityScore: number; // smaller = closer (more similar)
  reasons: string[];       // human readable explanations
};

export type SimilarResponse = {
  ok: true;
  username: string;
  limit: number;
  items: SimilarChannelRow[];
  targetChannel: {
    username: string;
    category?: string;
    lifecycle?: string;
    utilityScore: number;
  };
};
