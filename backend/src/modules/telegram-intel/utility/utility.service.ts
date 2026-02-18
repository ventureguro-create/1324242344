/**
 * Utility Service (BLOCK U-1)
 * Main service for utility-based channel intelligence
 */

import type { UtilityListQuery, UtilityListResponse, UtilityScoreResult } from './utility.types.js';
import type { UtilityDataAdapter } from './utility.data.js';
import { computeUtilityScore } from './utility.scoring.js';

export class UtilityService {
  constructor(private data: UtilityDataAdapter) {}

  /**
   * List channels sorted by utility score
   */
  async list(q: UtilityListQuery): Promise<UtilityListResponse> {
    const { total, rows } = await this.data.listUtilityMetrics(q);

    // Compute utility scores
    const scored = rows.map(computeUtilityScore);

    // Sort by requested field
    const sort = q.sort ?? 'utility';
    scored.sort((a, b) => {
      switch (sort) {
        case 'growth30':
          return b.growth30 - a.growth30;
        case 'growth7':
          return b.growth7 - a.growth7;
        case 'engagement':
          return b.engagementRate - a.engagementRate;
        case 'stability':
          return b.stability - a.stability;
        case 'fraud':
          return a.fraudRisk - b.fraudRisk; // Lower fraud = better
        case 'activity':
          return b.postsPerDay - a.postsPerDay;
        case 'utility':
        default:
          return b.utilityScore - a.utilityScore;
      }
    });

    // Calculate stats
    const stats = this.calculateStats(scored);

    return {
      ok: true,
      mode: 'utility',
      total,
      limit: q.limit,
      offset: q.offset,
      items: scored,
      stats,
    };
  }

  /**
   * Get single channel utility score
   */
  async getChannel(username: string): Promise<UtilityScoreResult | null> {
    const { rows } = await this.data.listUtilityMetrics({
      search: username,
      limit: 1,
      offset: 0,
    });

    if (rows.length === 0) return null;

    // Find exact match
    const exact = rows.find(r => r.username.toLowerCase() === username.toLowerCase());
    if (!exact) return null;

    return computeUtilityScore(exact);
  }

  /**
   * Calculate aggregate stats
   */
  private calculateStats(scored: UtilityScoreResult[]) {
    if (scored.length === 0) {
      return {
        avgUtility: 0,
        avgGrowth30: 0,
        avgEngagement: 0,
        totalChannels: 0,
      };
    }

    const sum = scored.reduce(
      (acc, s) => ({
        utility: acc.utility + s.utilityScore,
        growth: acc.growth + s.growth30,
        engagement: acc.engagement + s.engagementRate,
      }),
      { utility: 0, growth: 0, engagement: 0 }
    );

    const n = scored.length;

    return {
      avgUtility: Math.round(sum.utility / n),
      avgGrowth30: Number((sum.growth / n).toFixed(2)),
      avgEngagement: Number((sum.engagement / n).toFixed(4)),
      totalChannels: n,
    };
  }
}
