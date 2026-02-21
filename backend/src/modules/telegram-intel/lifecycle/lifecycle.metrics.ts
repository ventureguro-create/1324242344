/**
 * Lifecycle Metrics (U-7)
 * Channel lifecycle classification based on objective metrics
 */

export type LifecycleStage = 
  | 'EMERGING'    // New, starting to grow
  | 'EXPANDING'   // Active growth, accelerating
  | 'MATURE'      // Stable, high utility
  | 'SATURATED'   // Growth slowing
  | 'DECLINING'   // Losing momentum
  | 'STABLE';     // Default state

export type LifecycleInput = {
  growth30: number;
  growth7: number;
  acceleration: number;
  utilityScore: number;
  stability: number;
  subscribers?: number | null;
};

/**
 * Classify channel lifecycle stage
 * Uses transparent, rule-based logic (no ML)
 */
export function classifyLifecycle(m: LifecycleInput): LifecycleStage {
  const subs = m.subscribers ?? 0;
  
  // EXPANDING: Strong growth + accelerating
  if (m.growth30 > 15 && m.acceleration > 3) {
    return 'EXPANDING';
  }
  
  // EMERGING: Good growth + small channel
  if (m.growth30 > 8 && subs < 20000 && subs > 0) {
    return 'EMERGING';
  }
  
  // Also EMERGING: Very high acceleration on smaller channels
  if (m.acceleration > 5 && m.utilityScore < 60) {
    return 'EMERGING';
  }
  
  // MATURE: Stable, high quality
  if (m.growth30 >= -3 && m.growth30 <= 5 && m.utilityScore > 70 && m.stability > 0.6) {
    return 'MATURE';
  }
  
  // SATURATED: Low growth + decelerating
  if (m.growth30 < 3 && m.acceleration < -2 && m.utilityScore > 50) {
    return 'SATURATED';
  }
  
  // DECLINING: Negative growth
  if (m.growth30 < -5 || (m.growth30 < -3 && m.acceleration < -3)) {
    return 'DECLINING';
  }
  
  // STABLE: Everything else
  return 'STABLE';
}

/**
 * Get lifecycle description
 */
export function getLifecycleDescription(stage: LifecycleStage): string {
  const descriptions: Record<LifecycleStage, string> = {
    EMERGING: 'New channel with early growth momentum',
    EXPANDING: 'Channel is actively growing and accelerating',
    MATURE: 'Established channel with stable high quality',
    SATURATED: 'Growth is slowing, may have peaked',
    DECLINING: 'Channel is losing momentum',
    STABLE: 'Channel is maintaining steady performance',
  };
  return descriptions[stage];
}

/**
 * Get lifecycle emoji
 */
export function getLifecycleEmoji(stage: LifecycleStage): string {
  const emojis: Record<LifecycleStage, string> = {
    EMERGING: '🌱',
    EXPANDING: '🚀',
    MATURE: '🏛',
    SATURATED: '⚖️',
    DECLINING: '📉',
    STABLE: '➖',
  };
  return emojis[stage];
}
