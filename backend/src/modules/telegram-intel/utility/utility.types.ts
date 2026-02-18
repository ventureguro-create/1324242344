/**
 * Utility Types (BLOCK U-1)
 * Objective metrics for Telegram channel health & quality
 */

export type UtilityMetrics = {
  username: string;

  // Base data
  subscribers?: number | null;
  avgViews?: number | null;

  // Computed/derived
  engagementRate: number;   // avgViews / subscribers
  growth30: number;         // % change subs/views in 30d
  growth7: number;          // % change in 7d

  postsPerDay: number;
  forwardRatio: number;     // forwarded posts share (0..1)
  viewDispersion: number;   // stdev/mean (0..inf, lower = more stable)
  fraudRisk: number;        // 0..1

  // Optional extras
  originalityScore?: number;   // from metrics window
  diversityScore?: number;
};

export type UtilityScoreResult = {
  username: string;

  utilityScore: number; // 0..100
  utilityTier: 'A+' | 'A' | 'B' | 'C' | 'D';

  growth30: number;
  growth7: number;
  engagementRate: number;
  postsPerDay: number;
  stability: number;      // 0..1 (derived from dispersion)
  forwardRatio: number;
  fraudRisk: number;

  // Explain breakdown
  explain: {
    engagementScore: number;
    growthScore: number;
    stabilityScore: number;
    originalityScore: number;
    activityScore: number;
    fraudInverseScore: number;
  };
};

export type UtilityListQuery = {
  search?: string;
  limit: number;
  offset: number;
  sort?: 'utility' | 'growth30' | 'growth7' | 'engagement' | 'stability' | 'fraud' | 'activity';
  minSubs?: number;
  maxFraud?: number;
  tier?: string;
};

export type UtilityListResponse = {
  ok: true;
  mode: 'utility';
  total: number;
  limit: number;
  offset: number;
  items: UtilityScoreResult[];
  stats?: {
    avgUtility: number;
    avgGrowth30: number;
    avgEngagement: number;
    totalChannels: number;
  };
};
