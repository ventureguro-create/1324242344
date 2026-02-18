/**
 * Momentum Query Service (M-1 + M-2)
 * Query top momentum channels and history
 */
import { TgMomentumDailyModel } from '../models/tg_momentum_daily.model.js';
import { cleanUsername, dayAdd } from './momentum.utils.js';

type Metric = 'intelScore' | 'alphaScore' | 'credibilityScore' | 'networkAlphaScore';

/**
 * Get top momentum channels
 */
export async function getMomentumTop(opts: {
  day?: string;
  metric?: Metric;
  days?: 7 | 30;
  limit?: number;
  maxFraud?: number;
  sort?: 'v7' | 'v30' | 'momentumScore';
}) {
  const metric = (opts.metric ?? 'intelScore') as Metric;
  const limit = Math.min(200, Math.max(1, Number(opts.limit ?? 50)));
  const maxFraud = Number.isFinite(opts.maxFraud as any) ? Number(opts.maxFraud) : 0.75;
  const sortKey = opts.sort ?? 'momentumScore';

  const sort: any =
    sortKey === 'momentumScore'
      ? { momentumScore: -1, v7: -1, a7: -1 }
      : (opts.days ?? 7) === 7
        ? { v7: -1, a7: -1, consistency30: -1, vol30: 1 }
        : { v30: -1, v7: -1, a7: -1, vol30: 1 };

  const q: any = { metric, fraudRisk: { $lt: maxFraud } };
  if (opts.day) q.day = opts.day;

  // Get latest day if not specified
  if (!opts.day) {
    const latest = await TgMomentumDailyModel.findOne({ metric }).sort({ day: -1 }).lean();
    if (latest) q.day = (latest as any).day;
  }

  const items = await TgMomentumDailyModel.find(q)
    .sort(sort)
    .limit(limit)
    .lean();

  return items.map((x: any) => ({
    username: cleanUsername(x.username),
    day: x.day,
    metric: x.metric,
    tier: x.tier,
    s0: x.s0,
    s7: x.s7,
    s30: x.s30,
    v7: x.v7,
    v30: x.v30,
    a7: x.a7,
    vol30: x.vol30,
    consistency30: x.consistency30,
    fraudRisk: x.fraudRisk,
    credibilityScore: x.credibilityScore,
    momentumScore: x.momentumScore,
    momentumExplain: x.momentumExplain,
    trend: x.trend,
    newRiser: x.newRiser,
  }));
}

/**
 * Get channel momentum history
 */
export async function getChannelMomentumHistory(opts: {
  username: string;
  metric?: Metric;
  days?: number;
}) {
  const metric = (opts.metric ?? 'intelScore') as Metric;
  const days = Math.min(365, Math.max(7, Number(opts.days ?? 90)));
  const u = cleanUsername(opts.username);

  const items = await TgMomentumDailyModel.find({ username: u, metric })
    .sort({ day: -1 })
    .limit(days)
    .lean();

  return items.reverse().map((x: any) => ({
    day: x.day,
    s0: x.s0,
    v7: x.v7,
    v30: x.v30,
    a7: x.a7,
    vol30: x.vol30,
    consistency30: x.consistency30,
    fraudRisk: x.fraudRisk,
    credibilityScore: x.credibilityScore,
    momentumScore: x.momentumScore,
    momentumExplain: x.momentumExplain,
    trend: x.trend,
    newRiser: x.newRiser,
  }));
}

/**
 * Get momentum movers (for PATCH-2)
 */
export async function getMomentumMovers(opts: {
  days: 7 | 30;
  limit: number;
  maxFraud: number;
}) {
  const latest = await TgMomentumDailyModel.findOne({ metric: 'intelScore' }).sort({ day: -1 }).lean();
  if (!latest) return { metric: 'momentumScore', days: opts.days, day: null, risers: [], fallers: [] };

  const d0 = (latest as any).day;
  const dPrev = dayAdd(d0, -opts.days);

  const curDocs = await TgMomentumDailyModel.find({
    day: d0,
    metric: 'intelScore',
    fraudRisk: { $lt: opts.maxFraud },
  })
    .select({ username: 1, momentumScore: 1, fraudRisk: 1, tier: 1 })
    .lean();

  const prevDocs = await TgMomentumDailyModel.find({
    day: dPrev,
    metric: 'intelScore',
  })
    .select({ username: 1, momentumScore: 1 })
    .lean();

  const prevMap = new Map<string, number>();
  for (const p of prevDocs) prevMap.set(cleanUsername((p as any).username), Number((p as any).momentumScore ?? 0));

  const rows = curDocs.map((c: any) => {
    const u = cleanUsername(c.username);
    const curV = Number(c.momentumScore ?? 0);
    const prevV = prevMap.get(u) ?? curV;
    return {
      username: u,
      tier: c.tier,
      cur: curV,
      prev: prevV,
      delta: curV - prevV,
      fraudRisk: Number(c.fraudRisk ?? 0),
    };
  });

  const risers = [...rows].sort((a, b) => b.delta - a.delta).slice(0, opts.limit);
  const fallers = [...rows].sort((a, b) => a.delta - b.delta).slice(0, opts.limit);

  return { metric: 'momentumScore', days: opts.days, day: d0, risers, fallers };
}
