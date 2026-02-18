/**
 * Sector Service (U-3, U-4, U-5)
 * Aggregates utility metrics by category
 */

import type { Category, SectorMetrics, SectorOverviewResponse } from './sector.types.js';
import { UtilityService } from '../utility/utility.service.js';
import { MongoUtilityDataAdapter, MockUtilityDataAdapter } from '../utility/utility.data.js';
import { computeUtilityScore } from '../utility/utility.scoring.js';

// Compute acceleration from growth rates
function computeAcceleration(growth7: number, growth30: number): number {
  const expectedWeekly = growth30 / 4;
  const acceleration = growth7 - expectedWeekly;
  return Number.isFinite(acceleration) ? Number(acceleration.toFixed(2)) : 0;
}

// Map acceleration to tier
function mapAccelerationTier(acc: number): 'EXPLODING' | 'ACCELERATING' | 'STABLE' | 'DECELERATING' {
  if (acc > 5) return 'EXPLODING';
  if (acc > 2) return 'ACCELERATING';
  if (acc > -2) return 'STABLE';
  return 'DECELERATING';
}

export class SectorService {
  private utilityService: UtilityService;

  constructor() {
    const useMock = process.env.TG_UTILITY_MOCK === '1';
    const dataAdapter = useMock ? new MockUtilityDataAdapter() : new MongoUtilityDataAdapter();
    this.utilityService = new UtilityService(dataAdapter);
  }

  /**
   * Get sector overview with aggregated metrics
   */
  async getOverview(): Promise<SectorOverviewResponse> {
    // Load all channels with utility data
    const result = await this.utilityService.list({
      limit: 1000,
      offset: 0,
    });

    const channels = result.items;

    // Mock category assignment (in production this would come from DB)
    const categories: Category[] = ['TRADING', 'NEWS', 'NFT', 'VC', 'EARLY', 'MEDIA'];
    
    // Simple deterministic category assignment based on username hash
    const getCategory = (username: string): Category => {
      const hash = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return categories[hash % categories.length];
    };

    // Group by category
    const byCategory: Record<string, typeof channels> = {};
    
    for (const ch of channels) {
      const cat = getCategory(ch.username);
      if (!byCategory[cat]) byCategory[cat] = [];
      
      // Add acceleration
      const acceleration = computeAcceleration(ch.growth7, ch.growth30);
      byCategory[cat].push({ ...ch, acceleration });
    }

    // Aggregate each sector
    const sectors: SectorMetrics[] = [];
    
    for (const cat of Object.keys(byCategory)) {
      const items = byCategory[cat];
      if (!items.length) continue;

      const n = items.length;
      const sum = (key: string) => items.reduce((acc, c) => acc + (Number((c as any)[key]) || 0), 0);
      
      const avgAcceleration = sum('acceleration') / n;

      sectors.push({
        category: cat as Category,
        channelsCount: n,
        avgUtility: Math.round(sum('utilityScore') / n),
        avgGrowth30: Number((sum('growth30') / n).toFixed(2)),
        avgGrowth7: Number((sum('growth7') / n).toFixed(2)),
        avgEngagement: Number((sum('engagementRate') / n).toFixed(4)),
        avgStability: Number((sum('stability') / n).toFixed(3)),
        avgFraud: Number((sum('fraudRisk') / n).toFixed(3)),
        avgAcceleration: Number(avgAcceleration.toFixed(2)),
        explodingCount: items.filter((c: any) => c.acceleration > 5).length,
        acceleratingCount: items.filter((c: any) => c.acceleration > 2 && c.acceleration <= 5).length,
        deceleratingCount: items.filter((c: any) => c.acceleration < -2).length,
        topChannels: items
          .sort((a, b) => b.utilityScore - a.utilityScore)
          .slice(0, 3)
          .map(c => c.username),
      });
    }

    // Sort by acceleration (hottest first)
    sectors.sort((a, b) => b.avgAcceleration - a.avgAcceleration);

    // Market summary
    const totalChannels = channels.length;
    const market = {
      totalChannels,
      avgUtility: totalChannels > 0 
        ? Math.round(channels.reduce((acc, c) => acc + c.utilityScore, 0) / totalChannels)
        : 0,
      avgGrowth: totalChannels > 0
        ? Number((channels.reduce((acc, c) => acc + c.growth30, 0) / totalChannels).toFixed(2))
        : 0,
      avgAcceleration: totalChannels > 0
        ? Number((channels.reduce((acc, c) => acc + computeAcceleration(c.growth7, c.growth30), 0) / totalChannels).toFixed(2))
        : 0,
    };

    return {
      ok: true,
      sectors,
      market,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get single sector metrics
   */
  async getSector(category: Category): Promise<SectorMetrics | null> {
    const overview = await this.getOverview();
    return overview.sectors.find(s => s.category === category) || null;
  }
}
