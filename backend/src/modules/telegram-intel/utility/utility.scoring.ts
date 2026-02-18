/**
 * Utility Scoring Engine (BLOCK U-1)
 * 
 * Simple, transparent, objective scoring based on:
 * - Engagement (views/subs)
 * - Growth (30d change)
 * - Stability (view consistency)
 * - Originality (non-forwarded content)
 * - Activity (posting frequency)
 * - Fraud inverse (clean channels rank higher)
 */

import type { UtilityMetrics, UtilityScoreResult } from './utility.types.js';

function clamp01(x: number): number {
  if (Number.isNaN(x) || !Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function normalize(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= min) return 0;
  if (value >= max) return 1;
  return (value - min) / (max - min);
}

/**
 * Map utility score to tier
 */
export function mapUtilityTier(score: number): UtilityScoreResult['utilityTier'] {
  if (score >= 85) return 'A+';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

/**
 * Compute Utility Score from raw metrics
 * 
 * Formula:
 *   Utility = 
 *     0.25 * engagement +
 *     0.20 * growth +
 *     0.15 * stability +
 *     0.15 * originality +
 *     0.15 * activity +
 *     0.10 * fraudInverse
 */
export function computeUtilityScore(m: UtilityMetrics): UtilityScoreResult {
  // Engagement: ER ~ 2%..25% typical range
  // Below 2% = very low engagement
  // Above 25% = excellent (rare)
  const engagementScore = clamp01(normalize(m.engagementRate, 0.02, 0.25));

  // Growth: -5%..+40% in 30d reasonable range
  // Negative growth still gets some score (stable channels)
  // Above 40% is exceptional
  const growthScore = clamp01(normalize(m.growth30, -5, 40));

  // Stability: viewDispersion 0.1..1.2 (lower = better)
  // Very consistent channels have dispersion ~0.2-0.3
  // Erratic channels can have dispersion >1
  const stabilityScore = clamp01(1 - normalize(m.viewDispersion, 0.1, 1.2));

  // Originality: forwardRatio 0..1 (lower = more original content)
  // Pure original content = forwardRatio 0
  // Pure reposts = forwardRatio 1
  const originalityScore = clamp01(1 - m.forwardRatio);

  // Activity: posts per day 0.2..6
  // Less than 1 post per 5 days = low activity
  // More than 6 posts/day = very active
  const activityScore = clamp01(normalize(m.postsPerDay, 0.2, 6));

  // Fraud inverse: clean channels rank higher
  const fraudInverseScore = clamp01(1 - m.fraudRisk);

  // Weighted combination
  const weighted =
    0.25 * engagementScore +
    0.20 * growthScore +
    0.15 * stabilityScore +
    0.15 * originalityScore +
    0.15 * activityScore +
    0.10 * fraudInverseScore;

  // Soft kill-switch for extremely fraudulent channels
  // fraudRisk >= 0.85 → reduce score to 25%
  // fraudRisk >= 0.75 → reduce score to 50%
  const fraudKill = m.fraudRisk >= 0.85 ? 0.25 : m.fraudRisk >= 0.75 ? 0.5 : 1;

  const utilityScore = Math.round(clamp01(weighted) * 100 * fraudKill);
  const utilityTier = mapUtilityTier(utilityScore);

  return {
    username: m.username,
    utilityScore,
    utilityTier,

    growth30: Number(m.growth30.toFixed(2)),
    growth7: Number(m.growth7.toFixed(2)),
    engagementRate: Number(m.engagementRate.toFixed(4)),
    postsPerDay: Number(m.postsPerDay.toFixed(2)),
    stability: Number(stabilityScore.toFixed(3)),
    forwardRatio: Number(m.forwardRatio.toFixed(3)),
    fraudRisk: Number(m.fraudRisk.toFixed(3)),

    explain: {
      engagementScore: Number(engagementScore.toFixed(3)),
      growthScore: Number(growthScore.toFixed(3)),
      stabilityScore: Number(stabilityScore.toFixed(3)),
      originalityScore: Number(originalityScore.toFixed(3)),
      activityScore: Number(activityScore.toFixed(3)),
      fraudInverseScore: Number(fraudInverseScore.toFixed(3)),
    },
  };
}

/**
 * Batch compute utility scores
 */
export function computeUtilityScores(metrics: UtilityMetrics[]): UtilityScoreResult[] {
  return metrics.map(computeUtilityScore);
}
