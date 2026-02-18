/**
 * Sector Types (U-3, U-4, U-5)
 * Category-level aggregation for market intelligence
 */

export type Category = 
  | 'TRADING' 
  | 'NEWS' 
  | 'NFT' 
  | 'VC' 
  | 'EARLY' 
  | 'MEDIA' 
  | 'MACRO'
  | 'UNCATEGORIZED';

export type SectorMetrics = {
  category: Category;
  channelsCount: number;
  
  // Utility metrics (averages)
  avgUtility: number;
  avgGrowth30: number;
  avgGrowth7: number;
  avgEngagement: number;
  avgStability: number;
  avgFraud: number;
  
  // Acceleration (U-4)
  avgAcceleration: number;
  
  // Counts by tier
  explodingCount: number;  // acceleration > 5
  acceleratingCount: number;  // acceleration 2-5
  deceleratingCount: number;  // acceleration < -2
  
  // Top performers
  topChannels?: string[];
};

export type SectorOverviewResponse = {
  ok: true;
  sectors: SectorMetrics[];
  market: {
    totalChannels: number;
    avgUtility: number;
    avgGrowth: number;
    avgAcceleration: number;
  };
  updatedAt: string;
};
