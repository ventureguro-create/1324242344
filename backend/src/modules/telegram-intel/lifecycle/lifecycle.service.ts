/**
 * Lifecycle Service (U-7)
 * Classifies channels by lifecycle stage
 */

import type { LifecycleStage } from './lifecycle.metrics.js';
import { classifyLifecycle, getLifecycleDescription, getLifecycleEmoji } from './lifecycle.metrics.js';
import { UtilityService } from '../utility/utility.service.js';
import { MongoUtilityDataAdapter, MockUtilityDataAdapter } from '../utility/utility.data.js';

// Compute acceleration
function computeAcceleration(growth7: number, growth30: number): number {
  const expectedWeekly = growth30 / 4;
  return Number((growth7 - expectedWeekly).toFixed(2));
}

export type LifecycleResult = {
  username: string;
  lifecycle: LifecycleStage;
  description: string;
  emoji: string;
  metrics: {
    utilityScore: number;
    growth30: number;
    acceleration: number;
    stability: number;
  };
};

export class LifecycleService {
  private utilityService: UtilityService;

  constructor() {
    const useMock = process.env.TG_UTILITY_MOCK === '1';
    const dataAdapter = useMock ? new MockUtilityDataAdapter() : new MongoUtilityDataAdapter();
    this.utilityService = new UtilityService(dataAdapter);
  }

  /**
   * Get lifecycle classification for all channels
   */
  async getLifecycleList(opts?: { 
    limit?: number; 
    stage?: LifecycleStage;
    sort?: 'utility' | 'growth' | 'acceleration';
  }): Promise<{
    ok: boolean;
    total: number;
    items: LifecycleResult[];
    summary: Record<LifecycleStage, number>;
  }> {
    const limit = opts?.limit ?? 200;
    
    const result = await this.utilityService.list({
      limit,
      offset: 0,
    });

    let items: LifecycleResult[] = result.items.map(ch => {
      const acceleration = computeAcceleration(ch.growth7, ch.growth30);
      
      const lifecycle = classifyLifecycle({
        growth30: ch.growth30,
        growth7: ch.growth7,
        acceleration,
        utilityScore: ch.utilityScore,
        stability: ch.stability,
        subscribers: null, // Not available in current data
      });

      return {
        username: ch.username,
        lifecycle,
        description: getLifecycleDescription(lifecycle),
        emoji: getLifecycleEmoji(lifecycle),
        metrics: {
          utilityScore: ch.utilityScore,
          growth30: ch.growth30,
          acceleration,
          stability: ch.stability,
        },
      };
    });

    // Filter by stage if requested
    if (opts?.stage) {
      items = items.filter(i => i.lifecycle === opts.stage);
    }

    // Sort
    const sort = opts?.sort ?? 'utility';
    items.sort((a, b) => {
      switch (sort) {
        case 'growth':
          return b.metrics.growth30 - a.metrics.growth30;
        case 'acceleration':
          return b.metrics.acceleration - a.metrics.acceleration;
        default:
          return b.metrics.utilityScore - a.metrics.utilityScore;
      }
    });

    // Calculate summary
    const summary: Record<LifecycleStage, number> = {
      EMERGING: 0,
      EXPANDING: 0,
      MATURE: 0,
      SATURATED: 0,
      DECLINING: 0,
      STABLE: 0,
    };
    
    for (const item of items) {
      summary[item.lifecycle]++;
    }

    return {
      ok: true,
      total: items.length,
      items,
      summary,
    };
  }

  /**
   * Get lifecycle for single channel
   */
  async getChannelLifecycle(username: string): Promise<LifecycleResult | null> {
    const result = await this.getLifecycleList({ limit: 500 });
    return result.items.find(i => i.username.toLowerCase() === username.toLowerCase()) || null;
  }
}
