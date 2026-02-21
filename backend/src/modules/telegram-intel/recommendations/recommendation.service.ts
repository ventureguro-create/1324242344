/**
 * Recommendation Service (BLOCK U-8)
 * 
 * Recommendation Engine - structured relevance, no ML
 * 
 * Similarity scoring based on:
 * - Category (same category required)
 * - Lifecycle proximity
 * - Utility distance
 * - Engagement distance
 * - Growth distance
 * - Stability distance
 * - Size distance (subscribers)
 */

import type { SimilarChannelRow, SimilarResponse } from './recommendation.types.js';
import type { LifecycleStage } from '../lifecycle/lifecycle.metrics.js';
import { classifyLifecycle } from '../lifecycle/lifecycle.metrics.js';
import { UtilityService } from '../utility/utility.service.js';
import { MongoUtilityDataAdapter, MockUtilityDataAdapter } from '../utility/utility.data.js';
import { computeUtilityScore } from '../utility/utility.scoring.js';

function abs(a: number, b: number): number {
  return Math.abs((a ?? 0) - (b ?? 0));
}

function log10(x: number): number {
  return Math.log10(Math.max(1, x || 1));
}

/**
 * Calculate lifecycle distance
 * Same = 0, neighbor = 0.25, 2 apart = 0.6, farther = 1
 */
function lifecycleDistance(a?: string, b?: string): number {
  if (!a || !b) return 1;
  if (a === b) return 0;

  const order = ['EMERGING', 'EXPANDING', 'MATURE', 'SATURATED', 'DECLINING', 'STABLE'];
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  
  if (ia === -1 || ib === -1) return 1;

  const d = Math.abs(ia - ib);
  return d === 1 ? 0.25 : d === 2 ? 0.6 : 1;
}

/**
 * Generate human-readable reasons for similarity
 */
function generateReasons(target: any, candidate: any): string[] {
  const out: string[] = [];

  // Category match
  if (target.category && candidate.category === target.category) {
    out.push(`Same category: ${candidate.category}`);
  }

  // Lifecycle similarity
  if (target.lifecycle && candidate.lifecycle) {
    const d = lifecycleDistance(target.lifecycle, candidate.lifecycle);
    if (d === 0) out.push(`Same lifecycle: ${candidate.lifecycle}`);
    else if (d <= 0.25) out.push(`Similar lifecycle: ${candidate.lifecycle}`);
  }

  // Utility proximity
  const du = abs(candidate.utilityScore, target.utilityScore);
  if (du <= 7) out.push(`Utility close (Δ${du.toFixed(0)})`);

  // Engagement proximity
  const der = abs((candidate.engagementRate ?? 0) * 100, (target.engagementRate ?? 0) * 100);
  if (der <= 3) out.push(`Engagement close (Δ${der.toFixed(1)}pp)`);

  // Growth proximity
  const dg = abs(candidate.growth30, target.growth30);
  if (dg <= 5) out.push(`Growth close (Δ${dg.toFixed(1)}%)`);

  // Stability proximity
  const ds = abs((candidate.stability ?? 0) * 100, (target.stability ?? 0) * 100);
  if (ds <= 10) out.push(`Stability close (Δ${ds.toFixed(0)})`);

  return out.slice(0, 4);
}

/**
 * Compute acceleration from growth metrics
 */
function computeAcceleration(growth7: number, growth30: number): number {
  const expectedWeekly = growth30 / 4;
  return Number((growth7 - expectedWeekly).toFixed(2));
}

export class RecommendationService {
  private utilityService: UtilityService;

  constructor() {
    const useMock = process.env.TG_UTILITY_MOCK === '1';
    const dataAdapter = useMock ? new MockUtilityDataAdapter() : new MongoUtilityDataAdapter();
    this.utilityService = new UtilityService(dataAdapter);
  }

  /**
   * Get similar channels for a given username
   */
  async getSimilar(username: string, limit = 6): Promise<SimilarResponse> {
    // Get all channels with utility scores
    const result = await this.utilityService.list({
      limit: 500,
      offset: 0,
    });

    if (!result.items || result.items.length === 0) {
      return {
        ok: true,
        username,
        limit,
        items: [],
        targetChannel: {
          username,
          utilityScore: 0,
        },
      };
    }

    // Find target channel
    const target = result.items.find(
      ch => ch.username.toLowerCase() === username.toLowerCase()
    );

    if (!target) {
      return {
        ok: true,
        username,
        limit,
        items: [],
        targetChannel: {
          username,
          utilityScore: 0,
        },
      };
    }

    // Enrich target with lifecycle
    const targetAcceleration = computeAcceleration(target.growth7, target.growth30);
    const targetLifecycle = classifyLifecycle({
      growth30: target.growth30,
      growth7: target.growth7,
      acceleration: targetAcceleration,
      utilityScore: target.utilityScore,
      stability: target.stability,
      subscribers: null,
    });

    // Calculate category for target (mock category based on tier for demo)
    const targetCategory = this.inferCategory(target);

    const enrichedTarget = {
      ...target,
      lifecycle: targetLifecycle,
      category: targetCategory,
      acceleration: targetAcceleration,
    };

    // Filter and score candidates
    const candidates = result.items
      .filter(ch => {
        // Exclude target
        if (ch.username.toLowerCase() === username.toLowerCase()) return false;
        // Filter high fraud
        if (ch.fraudRisk >= 0.5) return false;
        return true;
      })
      .map(ch => {
        const acceleration = computeAcceleration(ch.growth7, ch.growth30);
        const lifecycle = classifyLifecycle({
          growth30: ch.growth30,
          growth7: ch.growth7,
          acceleration,
          utilityScore: ch.utilityScore,
          stability: ch.stability,
          subscribers: null,
        });
        const category = this.inferCategory(ch);

        // Calculate similarity score (lower = more similar)
        const score =
          // Utility distance (35%)
          0.35 * abs(ch.utilityScore, target.utilityScore) +
          // ER distance in percentage points (25%)
          0.25 * abs((ch.engagementRate ?? 0) * 100, (target.engagementRate ?? 0) * 100) +
          // Growth distance (15%)
          0.15 * abs(ch.growth30, target.growth30) +
          // Stability distance (15%)
          0.15 * abs((ch.stability ?? 0) * 100, (target.stability ?? 0) * 100) +
          // Size distance in log-space (10%) - using utility score as proxy for size
          0.10 * abs(ch.utilityScore / 10, target.utilityScore / 10) +
          // Lifecycle penalty (8 points for different lifecycle)
          8 * lifecycleDistance(targetLifecycle, lifecycle);

        return {
          username: ch.username,
          title: ch.username, // Use username as title in mock

          category,
          lifecycle,

          utilityScore: ch.utilityScore,
          growth30: ch.growth30,
          growth7: ch.growth7,
          acceleration,

          engagementRate: ch.engagementRate,
          stability: ch.stability,
          fraudRisk: ch.fraudRisk,

          subscribers: undefined,

          similarityScore: +score.toFixed(3),
          reasons: generateReasons(enrichedTarget, {
            ...ch,
            lifecycle,
            category,
          }),
        } as SimilarChannelRow;
      });

    // Sort by similarity score (lower = more similar)
    candidates.sort((a, b) => a.similarityScore - b.similarityScore);

    // Diversity: try to include different lifecycles
    const picked: SimilarChannelRow[] = [];
    const lifecycleSeen = new Set<string>();

    for (const candidate of candidates) {
      if (picked.length >= limit) break;
      
      const key = candidate.lifecycle || 'NA';
      // First 3 picks: allow any, after that prefer different lifecycle
      if (picked.length < 3 || !lifecycleSeen.has(key)) {
        picked.push(candidate);
        lifecycleSeen.add(key);
      }
    }

    // Fill remaining slots
    if (picked.length < limit) {
      for (const candidate of candidates) {
        if (picked.length >= limit) break;
        if (!picked.find(p => p.username === candidate.username)) {
          picked.push(candidate);
        }
      }
    }

    return {
      ok: true,
      username,
      limit,
      items: picked.slice(0, limit),
      targetChannel: {
        username: target.username,
        category: targetCategory,
        lifecycle: targetLifecycle,
        utilityScore: target.utilityScore,
      },
    };
  }

  /**
   * Infer category from utility metrics (simplified for demo)
   * In production, this would come from actual category data
   */
  private inferCategory(ch: any): string {
    // Simple heuristic based on metrics
    if (ch.utilityTier === 'A+' || ch.utilityTier === 'A') {
      return ch.growth30 > 15 ? 'ALPHA' : 'ESTABLISHED';
    }
    if (ch.growth30 > 10) return 'GROWTH';
    if (ch.engagementRate > 0.15) return 'ENGAGED';
    if (ch.fraudRisk > 0.4) return 'RISKY';
    return 'GENERAL';
  }
}
