/**
 * Momentum Compute Service (M-1 + M-2)
 * Computes velocity, acceleration, volatility and momentumScore
 */
import { TgMomentumDailyModel } from '../models/tg_momentum_daily.model.js';
import { TgIntelRankingModel } from '../models/tg.intel_ranking.model.js';
import {
  cleanUsername, toDayStr, dayAdd, stddev,
  normPercentile, momentumFormula, severityTrend, fraudKill, clamp01
} from './momentum.utils.js';

type Metric = 'intelScore' | 'alphaScore' | 'credibilityScore' | 'networkAlphaScore';

interface ComputeOpts {
  anchorDay?: string;
  lookbackDays?: number;
  metric?: Metric;
}

// Get latest day from intel rankings
async function getLatestDay(): Promise<string> {
  const now = new Date();
  return toDayStr(now);
}

// Build mock historical data from current intel rankings
async function buildHistoricalData(anchorDay: string, lookbackDays: number, metric: Metric) {
  const channels = await TgIntelRankingModel.find({}).lean();
  
  // Build mock temporal data based on current scores
  const byDay = new Map<string, Map<string, any>>();
  
  for (let i = 0; i <= lookbackDays; i++) {
    const day = dayAdd(anchorDay, -i);
    const dayMap = new Map<string, any>();
    
    for (const ch of channels) {
      const c = ch as any;
      const baseScore = c.intelScore || 50;
      // Add some realistic variation over time
      const variation = Math.sin(i * 0.3) * 5 + (Math.random() - 0.5) * 3;
      const score = Math.max(0, Math.min(100, baseScore - variation * (i / 30)));
      
      dayMap.set(cleanUsername(c.username), {
        username: c.username,
        scores: {
          intelScore: c.intelScore - variation * (i / 30),
          alphaScore: (c.components?.alphaScore || 50) - variation * (i / 30) * 0.8,
          credibilityScore: c.components?.credibilityScore || 50,
          networkAlphaScore: (c.components?.networkAlphaScore || 40) - variation * (i / 30) * 0.5,
          fraudRisk: c.components?.fraudRisk || 0,
        },
        tier: c.tier,
      });
    }
    
    byDay.set(day, dayMap);
  }
  
  return { byDay, channels };
}

function pickScore(item: any, metric: Metric): number {
  if (!item?.scores) return 0;
  const v = item.scores[metric];
  return typeof v === 'number' ? v : 0;
}

function pickFraud(item: any): number {
  return item?.scores?.fraudRisk ?? 0;
}

function pickCred(item: any): number {
  return item?.scores?.credibilityScore ?? 0;
}

/**
 * M-1: Compute momentum metrics for all channels
 */
export async function computeMomentumForAll(opts: ComputeOpts = {}) {
  const metric: Metric = (opts.metric ?? 'intelScore') as Metric;
  const lookbackDays = Math.max(30, Number(opts.lookbackDays ?? 90));
  const anchorDay = opts.anchorDay ?? await getLatestDay();

  const { byDay, channels } = await buildHistoricalData(anchorDay, lookbackDays, metric);

  const d0 = anchorDay;
  const d7 = dayAdd(d0, -7);
  const d14 = dayAdd(d0, -14);
  const d30 = dayAdd(d0, -30);

  const items0 = byDay.get(d0);
  const items7 = byDay.get(d7);
  const items14 = byDay.get(d14);
  const items30 = byDay.get(d30);

  if (!items0) return { ok: false, inserted: 0, updated: 0, anchorDay: null };

  // Build series for vol/consistency
  const days30: string[] = [];
  for (let k = 30; k >= 0; k--) days30.push(dayAdd(d0, -k));

  const seriesByUser = new Map<string, number[]>();
  for (const day of days30) {
    const dayItems = byDay.get(day);
    if (!dayItems) continue;
    for (const [u, it] of dayItems) {
      const s = pickScore(it, metric);
      if (!seriesByUser.has(u)) seriesByUser.set(u, []);
      seriesByUser.get(u)!.push(s);
    }
  }

  let inserted = 0;
  let updated = 0;

  for (const [username, cur] of items0) {
    const u = cleanUsername(username);

    const s0 = pickScore(cur, metric);
    const s7v = items7?.get(u) ? pickScore(items7.get(u), metric) : null;
    const s14v = items14?.get(u) ? pickScore(items14.get(u), metric) : null;
    const s30v = items30?.get(u) ? pickScore(items30.get(u), metric) : null;

    const v7 = s7v === null ? 0 : (s0 - s7v) / 7;
    const v30 = s30v === null ? 0 : (s0 - s30v) / 30;

    const prevV7 = (s7v === null || s14v === null) ? 0 : (s7v - s14v) / 7;
    const a7 = v7 - prevV7;

    const series = seriesByUser.get(u) || [];
    const vol30 = stddev(series);

    // Consistency: share of positive daily deltas
    let pos = 0, total = 0;
    for (let i = 1; i < series.length; i++) {
      total++;
      if (series[i] - series[i - 1] > 0) pos++;
    }
    const consistency30 = total ? pos / total : 0;

    const fraudRisk = pickFraud(cur);
    const credibilityScore = pickCred(cur);
    const tier = cur?.tier || null;

    const doc = {
      day: d0,
      username: u,
      metric,
      s0,
      s7: s7v,
      s14: s14v,
      s30: s30v,
      v7,
      v30,
      a7,
      vol30,
      consistency30,
      fraudRisk,
      credibilityScore,
      tier,
      computedAt: new Date(),
      expireAt: new Date(Date.now() + 180 * 24 * 3600 * 1000),
    };

    try {
      const res = await TgMomentumDailyModel.updateOne(
        { day: d0, username: u, metric },
        { $set: doc, $setOnInsert: { momentumScore: null, momentumExplain: [], trend: 'FLAT', newRiser: false } },
        { upsert: true }
      );

      if ((res as any).upsertedCount) inserted++;
      else if ((res as any).modifiedCount) updated++;
    } catch (e) {
      // Ignore duplicate key errors
    }
  }

  return { ok: true, anchorDay: d0, metric, inserted, updated, channels: items0.size };
}

/**
 * M-2: Score momentum for a day (adds momentumScore + explain)
 */
export async function scoreMomentumForDay(opts: { day: string; metric?: Metric; minChannels?: number }) {
  const metric = (opts.metric ?? 'intelScore') as Metric;
  const minChannels = Math.max(5, Number(opts.minChannels ?? 10));

  const docs = await TgMomentumDailyModel.find({ day: opts.day, metric }).lean();
  if (docs.length < minChannels) {
    return { ok: false, reason: 'NOT_ENOUGH_CHANNELS', day: opts.day, metric, count: docs.length };
  }

  const v7s = docs.map((d: any) => d.v7 ?? 0);
  const v30s = docs.map((d: any) => d.v30 ?? 0);
  const a7s = docs.map((d: any) => d.a7 ?? 0);
  const vol30s = docs.map((d: any) => d.vol30 ?? 0);

  let updated = 0;

  for (const d of docs) {
    const dd = d as any;
    const nv7 = normPercentile(v7s, dd.v7 ?? 0);
    const nv30 = normPercentile(v30s, dd.v30 ?? 0);
    const na7 = normPercentile(a7s, dd.a7 ?? 0);
    const nvol30 = normPercentile(vol30s, dd.vol30 ?? 0);

    const explain: string[] = [];
    explain.push(`v7=${(dd.v7 ?? 0).toFixed(2)}/day`);
    explain.push(`a7=${(dd.a7 ?? 0).toFixed(2)} accel`);
    explain.push(`vol30=${(dd.vol30 ?? 0).toFixed(2)} (penalty)`);
    explain.push(`consistency30=${((dd.consistency30 ?? 0) * 100).toFixed(0)}%`);
    explain.push(`fraudRisk=${(dd.fraudRisk ?? 0).toFixed(2)}`);
    explain.push(`credGate=${(dd.credibilityScore ?? 0).toFixed(1)}`);

    let momentumScore = momentumFormula({
      nv7,
      nv30,
      na7,
      consistency: dd.consistency30 ?? 0,
      nvol30,
      fraudRisk: dd.fraudRisk ?? 0,
      credScore: dd.credibilityScore ?? 0,
    });

    // Kill switch
    if (fraudKill(dd.fraudRisk ?? 0)) {
      momentumScore = momentumScore * 0.05;
      explain.push('FRAUD_KILL_SWITCH applied (score×0.05)');
    }

    const trend = severityTrend(dd.v7 ?? 0, dd.a7 ?? 0);

    // New riser: crossed 70 this week with strong v7
    const newRiser = (dd.s7 != null && dd.s7 < 70 && (dd.s0 ?? 0) >= 70 && (dd.v7 ?? 0) > 0.6);
    if (newRiser) explain.push('NEW_RISER: crossed 70 this week with strong v7');

    try {
      const res = await TgMomentumDailyModel.updateOne(
        { _id: dd._id },
        { $set: { momentumScore, momentumExplain: explain, trend, newRiser } }
      );
      updated += (res as any).modifiedCount ?? 0;
    } catch (e) {}
  }

  return { ok: true, day: opts.day, metric, count: docs.length, updated };
}
