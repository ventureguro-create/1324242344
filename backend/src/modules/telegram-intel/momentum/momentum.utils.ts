/**
 * Momentum Utils (M-1)
 */

export function cleanUsername(u: string) {
  return String(u || '').replace('@', '').trim().toLowerCase();
}

export function toDayStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function dayAdd(dayStr: string, deltaDays: number) {
  const d = new Date(dayStr + 'T00:00:00.000Z');
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return toDayStr(d);
}

export function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export function stddev(xs: number[]) {
  if (!xs.length) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
  return Math.sqrt(v);
}

// M-2 scoring utils
export function percentileRank(xs: number[], x: number) {
  if (!xs.length) return 0.5;
  let c = 0;
  for (const v of xs) if (v <= x) c++;
  return c / xs.length;
}

export function normPercentile(xs: number[], x: number) {
  const p = percentileRank(xs, x);
  return Math.pow(p, 0.8);
}

export function severityTrend(v7: number, a7: number): 'RISING' | 'FLAT' | 'FALLING' {
  if (v7 > 0.6 && a7 > 0.15) return 'RISING';
  if (v7 < -0.3) return 'FALLING';
  return 'FLAT';
}

export function credGate(credScore: number) {
  const c = Math.max(0, Math.min(100, credScore || 0));
  return 0.25 + 0.75 * (c / 100);
}

export function fraudKill(fraudRisk: number) {
  return (fraudRisk ?? 0) >= 0.75;
}

export function momentumFormula(opts: {
  nv7: number;
  nv30: number;
  na7: number;
  consistency: number;
  nvol30: number;
  fraudRisk: number;
  credScore: number;
}) {
  const raw =
    0.45 * opts.nv7 +
    0.20 * opts.nv30 +
    0.20 * opts.na7 +
    0.15 * clamp01(opts.consistency);

  const penalty =
    0.40 * opts.nvol30 +
    0.60 * clamp01(opts.fraudRisk);

  const gated = clamp01(raw * (1 - penalty)) * credGate(opts.credScore);
  return 100 * clamp01(gated);
}
