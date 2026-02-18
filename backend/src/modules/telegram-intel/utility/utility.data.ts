/**
 * Utility Data Adapter (BLOCK U-1)
 * Loads metrics from existing MongoDB collections
 * 
 * Sources:
 * - TgIntelRankingModel: fraudRisk, engagement, reach
 * - TgMetricsWindowModel: postsPerDay, viewDispersion, forwardRate, originalityScore
 * - TgScoreSnapshotModel: growth calculation (today vs 30d ago)
 * - TgFraudSignalModel: detailed fraud signals
 */

import type { UtilityMetrics, UtilityListQuery } from './utility.types.js';
import { TgIntelRankingModel } from '../models/tg.intel_ranking.model.js';
import { TgMetricsWindowModel } from '../models/tg.metrics_window.model.js';
import { TgFraudSignalModel } from '../models/tg.fraud_signal.model.js';
import { TgScoreSnapshotModel } from '../models/tg.score_snapshot.model.js';

export interface UtilityDataAdapter {
  listUtilityMetrics(q: UtilityListQuery): Promise<{ total: number; rows: UtilityMetrics[] }>;
}

/**
 * Real MongoDB implementation
 * Aggregates data from existing collections
 */
export class MongoUtilityDataAdapter implements UtilityDataAdapter {
  
  async listUtilityMetrics(q: UtilityListQuery): Promise<{ total: number; rows: UtilityMetrics[] }> {
    const { limit, offset, search, maxFraud, tier } = q;

    // Build base filter for intel rankings
    const baseFilter: any = {};
    
    if (search) {
      baseFilter.username = { $regex: search.toLowerCase(), $options: 'i' };
    }

    if (typeof maxFraud === 'number') {
      baseFilter['components.fraudRisk'] = { $lte: maxFraud };
    }

    if (tier) {
      baseFilter.tier = tier.toUpperCase();
    }

    // Get total count
    const total = await TgIntelRankingModel.countDocuments(baseFilter);

    // Load base rankings
    const rankings = await TgIntelRankingModel.find(baseFilter)
      .sort({ intelScore: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    if (rankings.length === 0) {
      return { total, rows: [] };
    }

    const usernames = rankings.map((r: any) => r.username);

    // Load metrics window (30d) for these channels
    const metricsPromise = TgMetricsWindowModel.find({
      username: { $in: usernames },
      window: '30d',
    }).lean();

    // Load fraud signals
    const fraudPromise = TgFraudSignalModel.find({
      username: { $in: usernames },
    }).lean();

    // Load snapshots for growth calculation (today and 30d ago)
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const days30Ago = new Date(today.getTime() - 30 * 24 * 3600 * 1000);
    const days30Str = days30Ago.toISOString().slice(0, 10);
    const days7Ago = new Date(today.getTime() - 7 * 24 * 3600 * 1000);
    const days7Str = days7Ago.toISOString().slice(0, 10);

    const snapshotsPromise = TgScoreSnapshotModel.find({
      username: { $in: usernames },
      day: { $in: [todayStr, days30Str, days7Str] },
    }).lean();

    const [metricsDocs, fraudDocs, snapshotsDocs] = await Promise.all([
      metricsPromise,
      fraudPromise,
      snapshotsPromise,
    ]);

    // Build lookup maps
    const metricsMap = new Map<string, any>();
    for (const m of metricsDocs) {
      metricsMap.set((m as any).username, m);
    }

    const fraudMap = new Map<string, any>();
    for (const f of fraudDocs) {
      fraudMap.set((f as any).username, f);
    }

    const snapshotMap = new Map<string, Map<string, any>>();
    for (const s of snapshotsDocs) {
      const u = (s as any).username;
      if (!snapshotMap.has(u)) {
        snapshotMap.set(u, new Map());
      }
      snapshotMap.get(u)!.set((s as any).day, s);
    }

    // Build utility metrics for each channel
    const rows: UtilityMetrics[] = rankings.map((r: any) => {
      const username = r.username;
      const metrics = metricsMap.get(username);
      const fraud = fraudMap.get(username);
      const snapshots = snapshotMap.get(username);

      // Extract base values
      const components = r.components || {};
      const reach = components.reach || 0;
      const engagement = components.engagement || 0;

      // Get views from metrics or estimate
      const avgViews = metrics?.medianViews || reach * 0.1 || 1000;
      const subscribers = reach || avgViews * 10;

      // Calculate engagement rate
      const engagementRate = subscribers > 0 
        ? avgViews / subscribers 
        : engagement || 0.05;

      // Calculate growth from snapshots
      let growth30 = 0;
      let growth7 = 0;

      if (snapshots) {
        const todaySnap = snapshots.get(todayStr);
        const snap30 = snapshots.get(days30Str);
        const snap7 = snapshots.get(days7Str);

        const currentScore = todaySnap?.scores?.intelScore ?? r.intelScore ?? 0;
        const score30 = snap30?.scores?.intelScore ?? currentScore;
        const score7 = snap7?.scores?.intelScore ?? currentScore;

        if (score30 > 0) {
          growth30 = ((currentScore - score30) / score30) * 100;
        }
        if (score7 > 0) {
          growth7 = ((currentScore - score7) / score7) * 100;
        }
      }

      // Get metrics window data
      const postsPerDay = metrics?.postsPerDay ?? 1;
      const viewDispersion = metrics?.viewDispersion ?? 0.5;
      const forwardRatio = metrics?.forwardRate ?? 0.3;
      const originalityScore = metrics?.originalityScore;

      // Get fraud risk
      const fraudRisk = fraud?.fraudRisk ?? components.fraudRisk ?? 0.2;

      return {
        username,
        subscribers,
        avgViews,
        engagementRate: Math.max(0, Math.min(1, engagementRate)),
        growth30: Number.isFinite(growth30) ? growth30 : 0,
        growth7: Number.isFinite(growth7) ? growth7 : 0,
        postsPerDay: Math.max(0, postsPerDay),
        forwardRatio: Math.max(0, Math.min(1, forwardRatio)),
        viewDispersion: Math.max(0, viewDispersion),
        fraudRisk: Math.max(0, Math.min(1, fraudRisk)),
        originalityScore,
      };
    });

    return { total, rows };
  }
}

/**
 * Mock implementation for testing
 */
export class MockUtilityDataAdapter implements UtilityDataAdapter {
  private mockData: UtilityMetrics[] = [
    {
      username: 'alpha_crypto',
      subscribers: 120000,
      avgViews: 18000,
      engagementRate: 0.15,
      growth30: 12.2,
      growth7: 3.1,
      postsPerDay: 3.2,
      forwardRatio: 0.22,
      viewDispersion: 0.38,
      fraudRisk: 0.12,
    },
    {
      username: 'defi_news',
      subscribers: 85000,
      avgViews: 12000,
      engagementRate: 0.14,
      growth30: 8.5,
      growth7: 2.1,
      postsPerDay: 4.5,
      forwardRatio: 0.45,
      viewDispersion: 0.52,
      fraudRisk: 0.18,
    },
    {
      username: 'whale_alerts',
      subscribers: 200000,
      avgViews: 25000,
      engagementRate: 0.125,
      growth30: 5.2,
      growth7: 1.8,
      postsPerDay: 8.2,
      forwardRatio: 0.15,
      viewDispersion: 0.28,
      fraudRisk: 0.08,
    },
    {
      username: 'nft_insider',
      subscribers: 45000,
      avgViews: 8500,
      engagementRate: 0.19,
      growth30: 22.5,
      growth7: 8.2,
      postsPerDay: 2.1,
      forwardRatio: 0.12,
      viewDispersion: 0.42,
      fraudRisk: 0.22,
    },
    {
      username: 'shitcoin_casino',
      subscribers: 150000,
      avgViews: 5000,
      engagementRate: 0.033,
      growth30: -8.5,
      growth7: -3.2,
      postsPerDay: 12.5,
      forwardRatio: 0.85,
      viewDispersion: 1.8,
      fraudRisk: 0.78,
    },
  ];

  async listUtilityMetrics(q: UtilityListQuery): Promise<{ total: number; rows: UtilityMetrics[] }> {
    let filtered = [...this.mockData];

    if (q.search) {
      const s = q.search.toLowerCase();
      filtered = filtered.filter(m => m.username.includes(s));
    }

    if (typeof q.maxFraud === 'number') {
      filtered = filtered.filter(m => m.fraudRisk <= q.maxFraud!);
    }

    const total = filtered.length;
    const rows = filtered.slice(q.offset, q.offset + q.limit);

    return { total, rows };
  }
}
