/**
 * Signal Rules (U-10)
 * Transparent scoring functions
 */

export function severityFromScore(score: number): 'HIGH' | 'MED' | 'LOW' {
  if (score >= 80) return 'HIGH';
  if (score >= 60) return 'MED';
  return 'LOW';
}

export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function score01(x: number, lo: number, hi: number): number {
  if (hi === lo) return 0;
  return clamp01((x - lo) / (hi - lo));
}

/**
 * Signal type definitions
 */
export type SignalType =
  | 'SUBSCRIBE_CANDIDATE'      // New good channels to follow
  | 'ROTATION_IN_OPPORTUNITY'  // Sector growing + channel accelerating
  | 'QUALITY_ALERT'            // Fraud spike / engagement drop
  | 'LIFECYCLE_PROMOTION'      // Emerging→Expanding, Expanding→Mature
  | 'RISING_UTILITY';          // Utility + acceleration increase

export type SignalSeverity = 'HIGH' | 'MED' | 'LOW';
export type SignalScope = 'CHANNEL' | 'SECTOR';

export type Signal = {
  type: SignalType;
  scope: SignalScope;
  username?: string;
  category?: string;
  severity: SignalSeverity;
  confidence: number;
  score: number;
  days: number;
  day: string;
  title: string;
  reasons: string[];
  snapshot?: any;
};
