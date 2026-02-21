/**
 * Signal Engine Service (U-10)
 * Generates actionable intelligence signals
 */

import { TgSignalModel } from './signals.model.js';
import { clamp01, score01, severityFromScore, Signal } from './signals.rules.js';
import { TgLifecycleTransitionModel } from '../lifecycle-transitions/transitions.model.js';
import { UtilityService } from '../utility/utility.service.js';
import { MongoUtilityDataAdapter, MockUtilityDataAdapter } from '../utility/utility.data.js';
import { classifyLifecycle } from '../lifecycle/lifecycle.metrics.js';

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function computeAcceleration(growth7: number, growth30: number): number {
  const expectedWeekly = growth30 / 4;
  return Number((growth7 - expectedWeekly).toFixed(2));
}

function inferCategory(ch: any): string {
  if (ch.utilityTier === 'A+' || ch.utilityTier === 'A') {
    return ch.growth30 > 15 ? 'ALPHA' : 'ESTABLISHED';
  }
  if (ch.growth30 > 10) return 'GROWTH';
  if (ch.engagementRate > 0.15) return 'ENGAGED';
  if (ch.fraudRisk > 0.4) return 'RISKY';
  return 'GENERAL';
}

export class SignalEngine {
  private utilityService: UtilityService;

  constructor() {
    const useMock = process.env.TG_UTILITY_MOCK === '1';
    const dataAdapter = useMock ? new MockUtilityDataAdapter() : new MongoUtilityDataAdapter();
    this.utilityService = new UtilityService(dataAdapter);
  }

  /**
   * Generate signals from current data
   */
  async generate(days = 7): Promise<{
    ok: boolean;
    day: string;
    days: number;
    generated: number;
    inserted: number;
  }> {
    const day = isoDay(new Date());

    // Get utility data
    const result = await this.utilityService.list({
      limit: 500,
      offset: 0,
    });

    const channels = (result.items || []).filter(ch => ch.fraudRisk < 0.7);

    // Get recent transitions
    const transitions = await TgLifecycleTransitionModel.find({ days })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean()
      .catch(() => []);

    const transitionSet = new Map<string, any>();
    for (const t of transitions) {
      transitionSet.set((t as any).username, t);
    }

    const signals: Signal[] = [];

    for (const ch of channels) {
      const cat = inferCategory(ch);
      const acceleration = computeAcceleration(ch.growth7, ch.growth30);
      
      const lifecycle = classifyLifecycle({
        growth30: ch.growth30,
        growth7: ch.growth7,
        acceleration,
        utilityScore: ch.utilityScore,
        stability: ch.stability,
        subscribers: null,
      });

      // ---------- SIGNAL 1: SUBSCRIBE_CANDIDATE ----------
      // High utility + low fraud + decent ER + not saturated/declining
      const subscribeScore =
        100 *
        (0.45 * score01(ch.utilityScore, 50, 85) +
          0.25 * score01(ch.engagementRate * 100, 2, 12) +
          0.20 * score01(acceleration, -2, 6) +
          0.10 * (1 - clamp01(ch.fraudRisk)));

      if (subscribeScore >= 55 && !['SATURATED', 'DECLINING'].includes(lifecycle)) {
        signals.push({
          type: 'SUBSCRIBE_CANDIDATE',
          scope: 'CHANNEL',
          username: ch.username,
          category: cat,
          days,
          day,
          score: +subscribeScore.toFixed(2),
          confidence: +clamp01(0.55 + 0.35 * (1 - ch.fraudRisk)).toFixed(3),
          severity: severityFromScore(subscribeScore),
          title: `Subscribe candidate: @${ch.username}`,
          reasons: [
            `Utility ${ch.utilityScore}`,
            `ER ${(ch.engagementRate * 100).toFixed(1)}%`,
            `Acceleration ${acceleration.toFixed(1)}%`,
            `Fraud ${ch.fraudRisk.toFixed(2)}`,
            `Lifecycle: ${lifecycle}`,
          ],
          snapshot: { 
            utilityScore: ch.utilityScore,
            engagementRate: ch.engagementRate,
            acceleration,
            fraudRisk: ch.fraudRisk,
            lifecycle,
          },
        });
      }

      // ---------- SIGNAL 2: RISING_UTILITY ----------
      // Strong utility + positive acceleration
      if (ch.utilityScore >= 60 && acceleration > 1) {
        const risingScore =
          100 *
          (0.50 * score01(ch.utilityScore, 50, 90) +
            0.35 * score01(acceleration, 0, 5) +
            0.15 * (1 - clamp01(ch.fraudRisk)));

        if (risingScore >= 60) {
          signals.push({
            type: 'RISING_UTILITY',
            scope: 'CHANNEL',
            username: ch.username,
            category: cat,
            days,
            day,
            score: +risingScore.toFixed(2),
            confidence: +clamp01(0.6 + 0.3 * score01(acceleration, 0, 5)).toFixed(3),
            severity: severityFromScore(risingScore),
            title: `Rising utility: @${ch.username}`,
            reasons: [
              `Utility ${ch.utilityScore}`,
              `Acceleration ${acceleration.toFixed(1)}%`,
              `Growth30 ${ch.growth30.toFixed(1)}%`,
            ],
            snapshot: {
              utilityScore: ch.utilityScore,
              acceleration,
              growth30: ch.growth30,
            },
          });
        }
      }

      // ---------- SIGNAL 3: LIFECYCLE_PROMOTION ----------
      const t = transitionSet.get(ch.username);
      if (t && ['EMERGING', 'EXPANDING', 'STABLE'].includes(t.from) && 
          ['EXPANDING', 'MATURE'].includes(t.to)) {
        const promoScore =
          100 *
          (0.50 * score01(t.impactScore || 0, 0, 25) +
            0.30 * score01(t.deltaAcceleration || 0, -1, 5) +
            0.20 * (1 - clamp01(ch.fraudRisk)));

        signals.push({
          type: 'LIFECYCLE_PROMOTION',
          scope: 'CHANNEL',
          username: ch.username,
          category: cat,
          days,
          day,
          score: +promoScore.toFixed(2),
          confidence: +clamp01(0.55 + 0.35 * score01(t.impactScore || 0, 0, 25)).toFixed(3),
          severity: severityFromScore(promoScore),
          title: `Lifecycle promotion: ${t.from} → ${t.to} (@${ch.username})`,
          reasons: [
            `Impact ${(t.impactScore || 0).toFixed(1)}`,
            `ΔUtility ${(t.deltaUtility || 0).toFixed(1)}`,
            `ΔAcc ${(t.deltaAcceleration || 0).toFixed(1)}%`,
          ],
          snapshot: { transition: t },
        });
      }

      // ---------- SIGNAL 4: QUALITY_ALERT (negative) ----------
      if (ch.fraudRisk > 0.4 || lifecycle === 'DECLINING' || acceleration < -3) {
        const alertScore =
          100 *
          (0.40 * clamp01(ch.fraudRisk) +
            0.30 * (lifecycle === 'DECLINING' ? 1 : 0) +
            0.30 * score01(-acceleration, 0, 5));

        if (alertScore >= 40) {
          signals.push({
            type: 'QUALITY_ALERT',
            scope: 'CHANNEL',
            username: ch.username,
            category: cat,
            days,
            day,
            score: +alertScore.toFixed(2),
            confidence: +clamp01(0.6 + 0.3 * clamp01(ch.fraudRisk)).toFixed(3),
            severity: severityFromScore(alertScore),
            title: `Quality alert: @${ch.username}`,
            reasons: [
              ch.fraudRisk > 0.4 ? `High fraud risk: ${ch.fraudRisk.toFixed(2)}` : null,
              lifecycle === 'DECLINING' ? `Lifecycle: DECLINING` : null,
              acceleration < -3 ? `Strong deceleration: ${acceleration.toFixed(1)}%` : null,
            ].filter(Boolean) as string[],
            snapshot: {
              fraudRisk: ch.fraudRisk,
              lifecycle,
              acceleration,
            },
          });
        }
      }
    }

    // Write idempotently
    let inserted = 0;
    for (const s of signals) {
      try {
        await TgSignalModel.updateOne(
          { type: s.type, username: s.username, day: s.day, days: s.days },
          { $setOnInsert: { ...s, createdAt: new Date() } },
          { upsert: true }
        );
        inserted += 1;
      } catch {
        // ignore dupes
      }
    }

    return { ok: true, day, days, generated: signals.length, inserted };
  }

  /**
   * List signals with optional filtering
   */
  async list(opts: { 
    days: number; 
    limit: number; 
    type?: string; 
    severity?: string;
  }): Promise<{
    ok: boolean;
    days: number;
    limit: number;
    type?: string;
    severity?: string;
    items: any[];
  }> {
    const q: any = { days: opts.days };
    if (opts.type) q.type = opts.type;
    if (opts.severity) q.severity = opts.severity;

    const items = await TgSignalModel.find(q)
      .sort({ day: -1, score: -1, createdAt: -1 })
      .limit(opts.limit)
      .lean();

    // Clean MongoDB _id
    const cleanItems = items.map((item: any) => ({
      ...item,
      _id: item._id?.toString(),
    }));

    return { ok: true, ...opts, items: cleanItems };
  }

  /**
   * Get single signal by ID
   */
  async get(id: string): Promise<{ ok: boolean; item: any | null }> {
    try {
      const item = await TgSignalModel.findById(id).lean();
      if (!item) {
        return { ok: true, item: null };
      }
      return { 
        ok: true, 
        item: { 
          ...item, 
          _id: (item as any)._id?.toString() 
        } 
      };
    } catch {
      return { ok: true, item: null };
    }
  }

  /**
   * Get mock signals for demo
   */
  getMockSignals(days: number, limit: number): Signal[] {
    const day = isoDay(new Date());

    const mockSignals: Signal[] = [
      {
        type: 'SUBSCRIBE_CANDIDATE',
        scope: 'CHANNEL',
        username: 'alpha_crypto',
        category: 'GROWTH',
        days,
        day,
        score: 78.5,
        confidence: 0.82,
        severity: 'MED',
        title: 'Subscribe candidate: @alpha_crypto',
        reasons: [
          'Utility 61',
          'ER 15.0%',
          'Acceleration 3.1%',
          'Fraud 0.12',
          'Lifecycle: STABLE',
        ],
      },
      {
        type: 'RISING_UTILITY',
        scope: 'CHANNEL',
        username: 'nft_insider',
        category: 'GROWTH',
        days,
        day,
        score: 85.2,
        confidence: 0.88,
        severity: 'HIGH',
        title: 'Rising utility: @nft_insider',
        reasons: [
          'Utility 67',
          'Acceleration 2.57%',
          'Growth30 22.5%',
        ],
      },
      {
        type: 'LIFECYCLE_PROMOTION',
        scope: 'CHANNEL',
        username: 'whale_alerts',
        category: 'ESTABLISHED',
        days,
        day,
        score: 72.1,
        confidence: 0.75,
        severity: 'MED',
        title: 'Lifecycle promotion: EXPANDING → MATURE (@whale_alerts)',
        reasons: [
          'Impact 4.2',
          'ΔUtility 3.2',
          'ΔAcc -1.8%',
        ],
      },
      {
        type: 'QUALITY_ALERT',
        scope: 'CHANNEL',
        username: 'shitcoin_casino',
        category: 'RISKY',
        days,
        day,
        score: 92.3,
        confidence: 0.95,
        severity: 'HIGH',
        title: 'Quality alert: @shitcoin_casino',
        reasons: [
          'High fraud risk: 0.78',
          'Lifecycle: DECLINING',
          'Strong deceleration: -3.2%',
        ],
      },
      {
        type: 'SUBSCRIBE_CANDIDATE',
        scope: 'CHANNEL',
        username: 'defi_news',
        category: 'GENERAL',
        days,
        day,
        score: 68.4,
        confidence: 0.72,
        severity: 'MED',
        title: 'Subscribe candidate: @defi_news',
        reasons: [
          'Utility 56',
          'ER 14.0%',
          'Acceleration -0.02%',
          'Fraud 0.18',
          'Lifecycle: STABLE',
        ],
      },
    ];

    return mockSignals.slice(0, limit);
  }
}
