/**
 * Lifecycle Transitions Service (U-9)
 * Computes weekly lifecycle stage changes
 */

import { TgLifecycleTransitionModel } from './transitions.model.js';
import { classifyLifecycle } from '../lifecycle/lifecycle.metrics.js';
import { UtilityService } from '../utility/utility.service.js';
import { MongoUtilityDataAdapter, MockUtilityDataAdapter } from '../utility/utility.data.js';

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Calculate impact score for ranking transitions
 * Higher = more significant change
 */
function impactScore(d: {
  deltaUtility: number;
  deltaAcceleration: number;
  deltaER: number;
  deltaFraud: number;
}): number {
  // Transparent formula: utility + acceleration + ER, but fraud worsens
  const s =
    0.45 * d.deltaUtility +
    0.35 * d.deltaAcceleration +
    0.20 * (d.deltaER * 100) -
    0.30 * (d.deltaFraud * 100);

  return +s.toFixed(3);
}

/**
 * Compute acceleration from growth metrics
 */
function computeAcceleration(growth7: number, growth30: number): number {
  const expectedWeekly = growth30 / 4;
  return Number((growth7 - expectedWeekly).toFixed(2));
}

/**
 * Infer category from utility metrics (simplified for demo)
 */
function inferCategory(ch: any): string {
  if (ch.utilityTier === 'A+' || ch.utilityTier === 'A') {
    return ch.growth30 > 15 ? 'ALPHA' : 'ESTABLISHED';
  }
  if (ch.growth30 > 10) return 'GROWTH';
  if (ch.engagementRate > 0.15) return 'ENGAGED';
  if (ch.fraudRisk > 0.4) return 'RISKY';
  return 'GENERAL';
}

export type TransitionItem = {
  username: string;
  category?: string;
  from: string;
  to: string;
  days: number;
  fromDay: string;
  toDay: string;
  utilityNow: number;
  growth30Now: number;
  accelerationNow: number;
  erNow: number;
  fraudNow: number;
  deltaUtility: number;
  deltaGrowth30: number;
  deltaAcceleration: number;
  deltaER: number;
  deltaFraud: number;
  impactScore: number;
};

export class LifecycleTransitionsService {
  private utilityService: UtilityService;

  constructor() {
    const useMock = process.env.TG_UTILITY_MOCK === '1';
    const dataAdapter = useMock ? new MockUtilityDataAdapter() : new MongoUtilityDataAdapter();
    this.utilityService = new UtilityService(dataAdapter);
  }

  /**
   * Generate transitions by comparing current state with simulated past state
   * In production, this would compare actual daily snapshots
   */
  async run(days = 7): Promise<{
    ok: boolean;
    days: number;
    fromDay: string;
    toDay: string;
    inserted: number;
    scannedNow: number;
  }> {
    const today = new Date();
    const from = new Date(today.getTime() - days * 24 * 3600 * 1000);

    const toDay = isoDay(today);
    const fromDay = isoDay(from);

    // Get current utility data
    const result = await this.utilityService.list({
      limit: 500,
      offset: 0,
    });

    const channels = result.items || [];
    const events: TransitionItem[] = [];

    // Since we're in mock mode, simulate transitions by creating synthetic "past" state
    // In production, this would pull from actual daily snapshots
    for (const ch of channels) {
      const acceleration = computeAcceleration(ch.growth7, ch.growth30);
      const category = inferCategory(ch);

      // Current lifecycle
      const currentLifecycle = classifyLifecycle({
        growth30: ch.growth30,
        growth7: ch.growth7,
        acceleration,
        utilityScore: ch.utilityScore,
        stability: ch.stability,
        subscribers: null,
      });

      // Simulate past state with some variation for demo
      // In production: pull from TgUtilitySnapshotModel.find({ day: fromDay })
      const pastGrowth30 = ch.growth30 - (Math.random() * 8 - 2); // Simulate past growth
      const pastGrowth7 = ch.growth7 - (Math.random() * 3 - 1);
      const pastAcceleration = computeAcceleration(pastGrowth7, pastGrowth30);
      const pastUtility = ch.utilityScore - (Math.random() * 10 - 3);

      const pastLifecycle = classifyLifecycle({
        growth30: pastGrowth30,
        growth7: pastGrowth7,
        acceleration: pastAcceleration,
        utilityScore: pastUtility,
        stability: ch.stability + (Math.random() * 0.1 - 0.05),
        subscribers: null,
      });

      // Only record if lifecycle changed
      if (pastLifecycle !== currentLifecycle) {
        const dUtility = +(ch.utilityScore - pastUtility).toFixed(2);
        const dGrowth = +(ch.growth30 - pastGrowth30).toFixed(2);
        const dAcc = +(acceleration - pastAcceleration).toFixed(2);
        const dER = 0; // Would come from snapshots
        const dFraud = 0; // Would come from snapshots

        // Filter noise: tiny deltas + meaningless stage flips
        const meaningful =
          Math.abs(dUtility) >= 2 ||
          Math.abs(dAcc) >= 1;

        if (!meaningful) continue;

        const imp = impactScore({
          deltaUtility: dUtility,
          deltaAcceleration: dAcc,
          deltaER: dER,
          deltaFraud: dFraud,
        });

        events.push({
          username: ch.username,
          category,
          from: pastLifecycle,
          to: currentLifecycle,
          days,
          fromDay,
          toDay,
          utilityNow: ch.utilityScore,
          growth30Now: ch.growth30,
          accelerationNow: acceleration,
          erNow: ch.engagementRate,
          fraudNow: ch.fraudRisk,
          deltaUtility: dUtility,
          deltaGrowth30: dGrowth,
          deltaAcceleration: dAcc,
          deltaER: dER,
          deltaFraud: dFraud,
          impactScore: imp,
        });
      }
    }

    // Upsert idempotently
    let inserted = 0;
    for (const ev of events) {
      try {
        await TgLifecycleTransitionModel.updateOne(
          { username: ev.username, toDay: ev.toDay, days: ev.days },
          { $setOnInsert: { ...ev, createdAt: new Date() } },
          { upsert: true }
        );
        inserted += 1;
      } catch {
        // ignore dupes
      }
    }

    return { ok: true, days, fromDay, toDay, inserted, scannedNow: channels.length };
  }

  /**
   * List transitions with optional filtering
   */
  async list(opts: { 
    days: number; 
    limit: number; 
    filter?: string;
  }): Promise<{
    ok: boolean;
    days: number;
    limit: number;
    filter?: string;
    items: any[];
  }> {
    const q: any = { days: opts.days };

    if (opts.filter) {
      // filter format: EMERGING_TO_EXPANDING
      const parts = opts.filter.split('_TO_');
      if (parts.length === 2) {
        q.from = parts[0];
        q.to = parts[1];
      }
    }

    const items = await TgLifecycleTransitionModel.find(q)
      .sort({ impactScore: -1, createdAt: -1 })
      .limit(opts.limit)
      .lean();

    // Remove MongoDB _id from response
    const cleanItems = items.map((item: any) => ({
      ...item,
      _id: undefined,
    }));

    return { ok: true, ...opts, items: cleanItems };
  }

  /**
   * Get mock transitions for demo (when no real data exists)
   */
  async getMockTransitions(days: number, limit: number): Promise<TransitionItem[]> {
    const toDay = isoDay(new Date());
    const fromDay = isoDay(new Date(Date.now() - days * 24 * 3600 * 1000));

    // Create realistic mock transitions
    const mockTransitions: TransitionItem[] = [
      {
        username: 'alpha_crypto',
        category: 'GROWTH',
        from: 'EMERGING',
        to: 'EXPANDING',
        days,
        fromDay,
        toDay,
        utilityNow: 61,
        growth30Now: 12.2,
        accelerationNow: 3.1,
        erNow: 0.15,
        fraudNow: 0.12,
        deltaUtility: 6.2,
        deltaGrowth30: 4.1,
        deltaAcceleration: 2.8,
        deltaER: 0.02,
        deltaFraud: -0.03,
        impactScore: 8.5,
      },
      {
        username: 'nft_insider',
        category: 'GROWTH',
        from: 'STABLE',
        to: 'EXPANDING',
        days,
        fromDay,
        toDay,
        utilityNow: 67,
        growth30Now: 22.5,
        accelerationNow: 2.57,
        erNow: 0.19,
        fraudNow: 0.22,
        deltaUtility: 8.1,
        deltaGrowth30: 12.3,
        deltaAcceleration: 4.2,
        deltaER: 0.04,
        deltaFraud: 0.01,
        impactScore: 12.3,
      },
      {
        username: 'whale_alerts',
        category: 'ESTABLISHED',
        from: 'EXPANDING',
        to: 'MATURE',
        days,
        fromDay,
        toDay,
        utilityNow: 65,
        growth30Now: 5.2,
        accelerationNow: 0.5,
        erNow: 0.125,
        fraudNow: 0.08,
        deltaUtility: 3.2,
        deltaGrowth30: -2.1,
        deltaAcceleration: -1.8,
        deltaER: 0.01,
        deltaFraud: -0.02,
        impactScore: 4.2,
      },
      {
        username: 'shitcoin_casino',
        category: 'RISKY',
        from: 'SATURATED',
        to: 'DECLINING',
        days,
        fromDay,
        toDay,
        utilityNow: 22,
        growth30Now: -8.5,
        accelerationNow: -3.2,
        erNow: 0.033,
        fraudNow: 0.78,
        deltaUtility: -12.1,
        deltaGrowth30: -15.2,
        deltaAcceleration: -5.1,
        deltaER: -0.02,
        deltaFraud: 0.15,
        impactScore: -18.5,
      },
    ];

    return mockTransitions.slice(0, limit);
  }
}
