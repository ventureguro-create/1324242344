/**
 * Leaderboard Builder Service (PATCH-3)
 * Builds materialized leaderboard snapshots
 */
import { TgLeaderboardDailyModel } from '../models/tg_leaderboard_daily.model.js';
import { TgMomentumDailyModel } from '../models/tg_momentum_daily.model.js';
import { TgIntelRankingModel } from '../models/tg.intel_ranking.model.js';
import { toDayStr, cleanUsername } from '../momentum/momentum.utils.js';

function avg(xs: number[]) {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export async function buildLeaderboardsForDay(opts?: { day?: string; configVersion?: number }) {
  const day = opts?.day ?? toDayStr(new Date());
  const configVersion = opts?.configVersion ?? 1;

  // 1) Load base scores from intel ranking
  const base = await TgIntelRankingModel.find({})
    .select({
      username: 1,
      tier: 1,
      intelScore: 1,
      components: 1,
    })
    .lean();

  // 2) Load momentum for this day
  const mom = await TgMomentumDailyModel.find({ day, metric: 'intelScore' })
    .select({ username: 1, momentumScore: 1, v7: 1, a7: 1, trend: 1, newRiser: 1 })
    .lean();

  const momMap = new Map<string, any>();
  for (const m of mom) momMap.set(cleanUsername((m as any).username), m);

  const items = base.map((b: any) => {
    const u = cleanUsername(b.username);
    const m = momMap.get(u);

    return {
      username: u,
      tier: b.tier ?? '—',
      intelScore: Number(b.intelScore ?? 0),
      alphaScore: Number(b.components?.alphaScore ?? 0),
      credibilityScore: Number(b.components?.credibilityScore ?? 0),
      networkAlphaScore: Number(b.components?.networkAlphaScore ?? 0),
      fraudRisk: Number(b.components?.fraudRisk ?? 0),

      momentumScore: m?.momentumScore ?? null,
      v7: m?.v7 ?? null,
      a7: m?.a7 ?? null,
      trend: m?.trend ?? null,
      newRiser: Boolean(m?.newRiser ?? false),
    };
  });

  // Stats
  const trackedChannels = items.length;
  const avgIntel = avg(items.map(x => x.intelScore));
  const avgMomentum = avg(items.filter(x => x.momentumScore != null).map(x => x.momentumScore!));
  const highAlphaCount = items.filter(x => x.alphaScore >= 70).length;
  const highFraudCount = items.filter(x => x.fraudRisk >= 0.75).length;
  const newRisersCount = items.filter(x => x.newRiser).length;

  const tierCounts = {
    S: items.filter(x => x.tier === 'S').length,
    A: items.filter(x => x.tier === 'A').length,
    B: items.filter(x => x.tier === 'B').length,
    C: items.filter(x => x.tier === 'C').length,
    D: items.filter(x => x.tier === 'D').length,
  };

  const stats = { trackedChannels, avgIntel, avgMomentum, highAlphaCount, highFraudCount, newRisersCount, tierCounts };

  // 3) Build intel leaderboard (sorted by intelScore)
  const intelItems = [...items].sort((a, b) => b.intelScore - a.intelScore);

  await TgLeaderboardDailyModel.updateOne(
    { day, mode: 'intel' },
    { $set: { day, mode: 'intel', items: intelItems, stats, configVersion, computedAt: new Date() } },
    { upsert: true }
  );

  // 4) Build momentum leaderboard (sorted by momentumScore)
  const momentumItems = [...items].sort((a, b) => {
    const am = typeof a.momentumScore === 'number' ? a.momentumScore : -1e9;
    const bm = typeof b.momentumScore === 'number' ? b.momentumScore : -1e9;
    if (bm !== am) return bm - am;
    return b.intelScore - a.intelScore;
  });

  await TgLeaderboardDailyModel.updateOne(
    { day, mode: 'momentum' },
    { $set: { day, mode: 'momentum', items: momentumItems, stats, configVersion, computedAt: new Date() } },
    { upsert: true }
  );

  return { ok: true, day, stats, counts: { base: base.length, momentum: mom.length } };
}

/**
 * Read leaderboard from materialized snapshot
 */
export async function readLeaderboard(opts: {
  mode: 'intel' | 'momentum';
  day?: string;
  page: number;
  limit: number;
  search?: string;
  tier?: string;
  maxFraud?: number;
  sort?: string;
}) {
  // Find latest or specific day
  const dayDoc = opts.day
    ? await TgLeaderboardDailyModel.findOne({ day: opts.day, mode: opts.mode }).lean()
    : await TgLeaderboardDailyModel.findOne({ mode: opts.mode }).sort({ day: -1 }).lean();

  if (!dayDoc) {
    // Fallback: build on the fly from intel rankings
    return readLeaderboardFallback(opts);
  }

  let items = (dayDoc as any).items || [];

  // Apply filters
  if (opts.search) {
    const s = String(opts.search).toLowerCase();
    items = items.filter((x: any) => x.username.includes(s));
  }
  if (opts.tier) {
    items = items.filter((x: any) => x.tier === opts.tier);
  }
  if (opts.maxFraud !== undefined) {
    items = items.filter((x: any) => Number(x.fraudRisk ?? 0) <= opts.maxFraud!);
  }

  // Re-sort if needed
  if (opts.sort && opts.sort !== (opts.mode === 'momentum' ? 'momentumScore' : 'intelScore')) {
    items = [...items].sort((a, b) => (b[opts.sort!] ?? 0) - (a[opts.sort!] ?? 0));
  }

  const total = items.length;
  const skip = (opts.page - 1) * opts.limit;
  const pageItems = items.slice(skip, skip + opts.limit);

  return {
    ok: true,
    mode: opts.mode,
    day: (dayDoc as any).day,
    total,
    page: opts.page,
    pages: Math.ceil(total / opts.limit),
    items: pageItems,
    stats: (dayDoc as any).stats,
  };
}

/**
 * Fallback: read directly from intel rankings (no materialized view)
 */
async function readLeaderboardFallback(opts: {
  mode: 'intel' | 'momentum';
  page: number;
  limit: number;
  search?: string;
  tier?: string;
  maxFraud?: number;
  sort?: string;
}) {
  const filter: any = {};
  if (opts.search) {
    filter.username = { $regex: opts.search, $options: 'i' };
  }
  if (opts.tier) {
    filter.tier = opts.tier;
  }
  if (opts.maxFraud !== undefined) {
    filter['components.fraudRisk'] = { $lte: opts.maxFraud };
  }

  const sortKey = opts.sort || 'intelScore';
  const sort: any = { [sortKey]: -1 };

  const skip = (opts.page - 1) * opts.limit;

  const [items, total] = await Promise.all([
    TgIntelRankingModel.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(opts.limit)
      .select('-_id -__v')
      .lean(),
    TgIntelRankingModel.countDocuments(filter),
  ]);

  // Transform to leaderboard format
  const transformed = items.map((b: any) => ({
    username: b.username,
    tier: b.tier ?? '—',
    intelScore: Number(b.intelScore ?? 0),
    alphaScore: Number(b.components?.alphaScore ?? 0),
    credibilityScore: Number(b.components?.credibilityScore ?? 0),
    networkAlphaScore: Number(b.components?.networkAlphaScore ?? 0),
    fraudRisk: Number(b.components?.fraudRisk ?? 0),
    momentumScore: null,
    v7: null,
    a7: null,
    trend: null,
    newRiser: false,
  }));

  return {
    ok: true,
    mode: opts.mode,
    day: null,
    total,
    page: opts.page,
    pages: Math.ceil(total / opts.limit),
    items: transformed,
    stats: null,
  };
}
