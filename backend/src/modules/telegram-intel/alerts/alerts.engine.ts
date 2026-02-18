/**
 * Personalized Alerts Engine (BLOCK 5.2)
 * Generates alerts for users based on their watchlist
 */
import { TgUserAlertModel } from '../models/tg_user_alerts.model.js';
import { TgWatchlistModel } from '../models/tg_watchlist.model.js';
import { TgIntelRankingModel } from '../models/tg.intel_ranking.model.js';
import { TgMomentumDailyModel } from '../models/tg_momentum_daily.model.js';
import { TgScoreSnapshotModel } from '../models/tg.score_snapshot.model.js';
import { toDayStr } from '../momentum/momentum.utils.js';

interface AlertConfig {
  intelSpikeThreshold: number;   // +10 points
  intelDumpThreshold: number;    // -10 points
  momentumSpikeThreshold: number; // +15 points
  momentumDumpThreshold: number;  // -15 points
  fraudSpikeThreshold: number;    // +0.15
}

const DEFAULT_CONFIG: AlertConfig = {
  intelSpikeThreshold: 10,
  intelDumpThreshold: -10,
  momentumSpikeThreshold: 15,
  momentumDumpThreshold: -15,
  fraudSpikeThreshold: 0.15,
};

function getSeverity(delta: number, threshold: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  const absRatio = Math.abs(delta / threshold);
  if (absRatio >= 2) return 'HIGH';
  if (absRatio >= 1.5) return 'MEDIUM';
  return 'LOW';
}

function formatDelta(delta: number, isPercent = false): string {
  const sign = delta >= 0 ? '+' : '';
  if (isPercent) {
    return `${sign}${(delta * 100).toFixed(1)}%`;
  }
  return `${sign}${delta.toFixed(1)}`;
}

/**
 * Run personalized alerts engine
 * Checks watchlisted channels and generates user-specific alerts
 */
export async function runPersonalizedAlerts(opts?: {
  day?: string;
  config?: Partial<AlertConfig>;
  dryRun?: boolean;
}) {
  const day = opts?.day ?? toDayStr(new Date());
  const config = { ...DEFAULT_CONFIG, ...opts?.config };
  const dryRun = opts?.dryRun ?? false;

  const prevDay = toDayStr(new Date(new Date(day).getTime() - 24 * 3600 * 1000));

  // Get all watchlist entries grouped by channel
  const watchlists = await TgWatchlistModel.find({ 'alertSettings.enabled': true }).lean();

  // Group by channel
  const channelWatchers = new Map<string, any[]>();
  for (const w of watchlists) {
    const username = (w as any).username;
    if (!channelWatchers.has(username)) {
      channelWatchers.set(username, []);
    }
    channelWatchers.get(username)!.push(w);
  }

  const channels = Array.from(channelWatchers.keys());
  if (channels.length === 0) {
    return { ok: true, day, processed: 0, generated: 0, skipped: 0 };
  }

  // Load current and previous data for watched channels
  const [currentRankings, currentMomentum, prevSnapshots] = await Promise.all([
    TgIntelRankingModel.find({ username: { $in: channels } }).lean(),
    TgMomentumDailyModel.find({ 
      username: { $in: channels }, 
      metric: 'intelScore',
      day 
    }).lean(),
    TgScoreSnapshotModel.find({ 
      username: { $in: channels }, 
      day: prevDay 
    }).lean(),
  ]);

  const currentMap = new Map(currentRankings.map((r: any) => [r.username, r]));
  const momentumMap = new Map(currentMomentum.map((m: any) => [m.username, m]));
  const prevMap = new Map(prevSnapshots.map((s: any) => [s.username, s]));

  let generated = 0;
  let skipped = 0;
  const alerts: any[] = [];

  for (const [username, watchers] of channelWatchers) {
    const current = currentMap.get(username) as any;
    const momentum = momentumMap.get(username) as any;
    const prev = prevMap.get(username) as any;

    if (!current) {
      skipped++;
      continue;
    }

    const currentIntel = current.intelScore ?? 0;
    const prevIntel = prev?.scores?.intelScore ?? current.intelScore ?? 0;
    const intelDelta = currentIntel - prevIntel;

    const currentMom = momentum?.momentumScore ?? null;
    const prevMom = momentum?.s7 != null ? (momentum.s7 * 0.8) : null; // Approximate previous
    const momDelta = currentMom != null && prevMom != null ? currentMom - prevMom : null;

    const currentFraud = current.components?.fraudRisk ?? 0;
    const prevFraud = prev?.scores?.fraudRisk ?? 0;
    const fraudDelta = currentFraud - prevFraud;

    const currentTier = current.tier;
    const prevTier = prev?.tiers?.intelTier;

    // Generate alerts for each watcher based on their settings
    for (const watcher of watchers) {
      const actor = {
        actorId: (watcher as any).actorId,
        actorType: (watcher as any).actorType,
      };
      const settings = (watcher as any).alertSettings || {};
      const minSeverity = settings.minSeverity || 'MEDIUM';
      const alertTypes = new Set(settings.alertTypes || [
        'INTEL_SPIKE', 'INTEL_DUMP', 'MOMENTUM_SPIKE', 'TIER_CHANGE'
      ]);

      const severityOrder = { LOW: 1, MEDIUM: 2, HIGH: 3 };
      const minSeverityNum = severityOrder[minSeverity as keyof typeof severityOrder] || 2;

      // Intel Spike
      if (alertTypes.has('INTEL_SPIKE') && intelDelta >= config.intelSpikeThreshold) {
        const severity = getSeverity(intelDelta, config.intelSpikeThreshold);
        if (severityOrder[severity] >= minSeverityNum) {
          alerts.push({
            ...actor,
            username,
            day,
            type: 'INTEL_SPIKE',
            severity,
            metric: 'intelScore',
            prev: prevIntel,
            next: currentIntel,
            delta: intelDelta,
            deltaPercent: prevIntel > 0 ? intelDelta / prevIntel : null,
            message: `📈 ${username}: Intel Score ${formatDelta(intelDelta)} (${prevIntel.toFixed(1)} → ${currentIntel.toFixed(1)})`,
          });
          generated++;
        }
      }

      // Intel Dump
      if (alertTypes.has('INTEL_DUMP') && intelDelta <= config.intelDumpThreshold) {
        const severity = getSeverity(intelDelta, config.intelDumpThreshold);
        if (severityOrder[severity] >= minSeverityNum) {
          alerts.push({
            ...actor,
            username,
            day,
            type: 'INTEL_DUMP',
            severity,
            metric: 'intelScore',
            prev: prevIntel,
            next: currentIntel,
            delta: intelDelta,
            deltaPercent: prevIntel > 0 ? intelDelta / prevIntel : null,
            message: `📉 ${username}: Intel Score ${formatDelta(intelDelta)} (${prevIntel.toFixed(1)} → ${currentIntel.toFixed(1)})`,
          });
          generated++;
        }
      }

      // Momentum Spike
      if (alertTypes.has('MOMENTUM_SPIKE') && momDelta != null && momDelta >= config.momentumSpikeThreshold) {
        const severity = getSeverity(momDelta, config.momentumSpikeThreshold);
        if (severityOrder[severity] >= minSeverityNum) {
          alerts.push({
            ...actor,
            username,
            day,
            type: 'MOMENTUM_SPIKE',
            severity,
            metric: 'momentumScore',
            prev: prevMom,
            next: currentMom,
            delta: momDelta,
            message: `🚀 ${username}: Momentum ${formatDelta(momDelta)} → ${currentMom?.toFixed(1)}`,
          });
          generated++;
        }
      }

      // Momentum Dump
      if (alertTypes.has('MOMENTUM_DUMP') && momDelta != null && momDelta <= config.momentumDumpThreshold) {
        const severity = getSeverity(momDelta, config.momentumDumpThreshold);
        if (severityOrder[severity] >= minSeverityNum) {
          alerts.push({
            ...actor,
            username,
            day,
            type: 'MOMENTUM_DUMP',
            severity,
            metric: 'momentumScore',
            prev: prevMom,
            next: currentMom,
            delta: momDelta,
            message: `⚠️ ${username}: Momentum ${formatDelta(momDelta)} → ${currentMom?.toFixed(1)}`,
          });
          generated++;
        }
      }

      // Fraud Spike
      if (alertTypes.has('FRAUD_SPIKE') && fraudDelta >= config.fraudSpikeThreshold) {
        alerts.push({
          ...actor,
          username,
          day,
          type: 'FRAUD_SPIKE',
          severity: 'HIGH',
          metric: 'fraudRisk',
          prev: prevFraud,
          next: currentFraud,
          delta: fraudDelta,
          message: `🚨 ${username}: Fraud Risk ${formatDelta(fraudDelta, true)} → ${(currentFraud * 100).toFixed(0)}%`,
        });
        generated++;
      }

      // Tier Change
      if (alertTypes.has('TIER_CHANGE') && prevTier && currentTier && prevTier !== currentTier) {
        const isUpgrade = ['D', 'C', 'B', 'A', 'S'].indexOf(currentTier) > 
                         ['D', 'C', 'B', 'A', 'S'].indexOf(prevTier);
        alerts.push({
          ...actor,
          username,
          day,
          type: 'TIER_CHANGE',
          severity: 'MEDIUM',
          metric: 'tier',
          prev: prevTier,
          next: currentTier,
          message: isUpgrade 
            ? `⬆️ ${username}: Upgraded ${prevTier} → ${currentTier}`
            : `⬇️ ${username}: Downgraded ${prevTier} → ${currentTier}`,
          meta: { isUpgrade },
        });
        generated++;
      }

      // New Riser
      if (alertTypes.has('NEW_RISER') && momentum?.newRiser) {
        alerts.push({
          ...actor,
          username,
          day,
          type: 'NEW_RISER',
          severity: 'HIGH',
          metric: 'momentumScore',
          next: currentMom,
          message: `🌟 ${username}: New Rising Star! Momentum ${currentMom?.toFixed(1)}`,
        });
        generated++;
      }
    }
  }

  // Bulk upsert alerts
  if (!dryRun && alerts.length > 0) {
    const bulkOps = alerts.map(alert => ({
      updateOne: {
        filter: {
          actorId: alert.actorId,
          username: alert.username,
          day: alert.day,
          type: alert.type,
        },
        update: { $set: alert },
        upsert: true,
      },
    }));

    await TgUserAlertModel.bulkWrite(bulkOps);
  }

  return {
    ok: true,
    day,
    dryRun,
    processed: channels.length,
    watchers: watchlists.length,
    generated,
    skipped,
    alerts: dryRun ? alerts : undefined,
  };
}

/**
 * Get unread alert count for user
 */
export async function getUnreadAlertCount(actorId: string): Promise<number> {
  return TgUserAlertModel.countDocuments({ actorId, read: false });
}

/**
 * Mark alerts as read
 */
export async function markAlertsRead(actorId: string, alertIds?: string[]) {
  const filter: any = { actorId };
  if (alertIds && alertIds.length > 0) {
    filter._id = { $in: alertIds };
  }

  const result = await TgUserAlertModel.updateMany(
    filter,
    { $set: { read: true, readAt: new Date() } }
  );

  return { ok: true, modified: result.modifiedCount };
}
