/**
 * Watchlist Service (BLOCK 5.1)
 * Business logic for managing user watchlists
 */
import { TgWatchlistModel } from '../models/tg_watchlist.model.js';
import { TgIntelRankingModel } from '../models/tg.intel_ranking.model.js';
import { TgMomentumDailyModel } from '../models/tg_momentum_daily.model.js';
import { Actor } from './actor.resolver.js';
import { cleanUsername, toDayStr } from '../momentum/momentum.utils.js';

export interface AddToWatchlistParams {
  username: string;
  note?: string;
  tags?: string[];
  alertSettings?: {
    enabled?: boolean;
    minSeverity?: 'LOW' | 'MEDIUM' | 'HIGH';
    alertTypes?: string[];
  };
}

export interface UpdateWatchlistParams {
  note?: string;
  tags?: string[];
  alertSettings?: {
    enabled?: boolean;
    minSeverity?: 'LOW' | 'MEDIUM' | 'HIGH';
    alertTypes?: string[];
  };
}

export interface WatchlistFilters {
  search?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: 'addedAt' | 'username' | 'intelScore' | 'momentumScore';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Add channel to watchlist
 */
export async function addToWatchlist(actor: Actor, params: AddToWatchlistParams) {
  const username = cleanUsername(params.username);

  // Get current scores for snapshot
  const [ranking, momentum] = await Promise.all([
    TgIntelRankingModel.findOne({ username }).lean(),
    TgMomentumDailyModel.findOne({ 
      username, 
      metric: 'intelScore' 
    }).sort({ day: -1 }).lean(),
  ]);

  const snapshot = {
    intelScore: (ranking as any)?.intelScore ?? null,
    momentumScore: (momentum as any)?.momentumScore ?? null,
    tier: (ranking as any)?.tier ?? null,
  };

  const result = await TgWatchlistModel.findOneAndUpdate(
    { actorId: actor.actorId, username },
    {
      $set: {
        actorType: actor.actorType,
        username,
        note: params.note || '',
        tags: params.tags || [],
        alertSettings: {
          enabled: params.alertSettings?.enabled ?? true,
          minSeverity: params.alertSettings?.minSeverity ?? 'MEDIUM',
          alertTypes: params.alertSettings?.alertTypes ?? [
            'INTEL_SPIKE', 'INTEL_DUMP', 'MOMENTUM_SPIKE', 'TIER_CHANGE'
          ],
        },
        addedSnapshot: snapshot,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        actorId: actor.actorId,
        addedAt: new Date(),
      },
    },
    { upsert: true, new: true, projection: { _id: 0, __v: 0 } }
  );

  return { ok: true, item: result, isNew: !result };
}

/**
 * Remove channel from watchlist
 */
export async function removeFromWatchlist(actor: Actor, username: string) {
  const cleanedUsername = cleanUsername(username);
  
  const result = await TgWatchlistModel.deleteOne({
    actorId: actor.actorId,
    username: cleanedUsername,
  });

  return { 
    ok: true, 
    removed: result.deletedCount > 0,
    username: cleanedUsername,
  };
}

/**
 * Check if channel is in watchlist
 */
export async function isInWatchlist(actor: Actor, username: string): Promise<boolean> {
  const cleanedUsername = cleanUsername(username);
  const exists = await TgWatchlistModel.exists({
    actorId: actor.actorId,
    username: cleanedUsername,
  });
  return !!exists;
}

/**
 * Get user's watchlist with current scores
 */
export async function getWatchlist(actor: Actor, filters: WatchlistFilters = {}) {
  const {
    search,
    tags,
    limit = 50,
    offset = 0,
    sortBy = 'addedAt',
    sortOrder = 'desc',
  } = filters;

  // Build filter
  const filter: any = { actorId: actor.actorId };
  if (search) {
    filter.username = { $regex: search, $options: 'i' };
  }
  if (tags && tags.length > 0) {
    filter.tags = { $in: tags };
  }

  // Get watchlist items
  const [items, total] = await Promise.all([
    TgWatchlistModel.find(filter)
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(offset)
      .limit(limit)
      .lean(),
    TgWatchlistModel.countDocuments(filter),
  ]);

  // Enrich with current scores
  const usernames = items.map((i: any) => i.username);
  
  const [rankings, momentums] = await Promise.all([
    TgIntelRankingModel.find({ username: { $in: usernames } })
      .select({ username: 1, intelScore: 1, tier: 1, components: 1 })
      .lean(),
    TgMomentumDailyModel.find({ 
      username: { $in: usernames }, 
      metric: 'intelScore',
      day: toDayStr(new Date()),
    }).lean(),
  ]);

  const rankingMap = new Map(rankings.map((r: any) => [r.username, r]));
  const momentumMap = new Map(momentums.map((m: any) => [m.username, m]));

  const enrichedItems = items.map((item: any) => {
    const ranking = rankingMap.get(item.username) as any;
    const momentum = momentumMap.get(item.username) as any;

    const currentScores = {
      intelScore: ranking?.intelScore ?? null,
      momentumScore: momentum?.momentumScore ?? null,
      tier: ranking?.tier ?? null,
      alphaScore: ranking?.components?.alphaScore ?? null,
      credibilityScore: ranking?.components?.credibilityScore ?? null,
      fraudRisk: ranking?.components?.fraudRisk ?? null,
      v7: momentum?.v7 ?? null,
      a7: momentum?.a7 ?? null,
      trend: momentum?.trend ?? null,
    };

    // Calculate changes since added
    const changes = {
      intelDelta: currentScores.intelScore != null && item.addedSnapshot?.intelScore != null
        ? currentScores.intelScore - item.addedSnapshot.intelScore
        : null,
      momentumDelta: currentScores.momentumScore != null && item.addedSnapshot?.momentumScore != null
        ? currentScores.momentumScore - item.addedSnapshot.momentumScore
        : null,
      tierChanged: item.addedSnapshot?.tier !== currentScores.tier,
    };

    return {
      ...item,
      _id: undefined,
      __v: undefined,
      currentScores,
      changes,
    };
  });

  return {
    ok: true,
    total,
    count: enrichedItems.length,
    offset,
    limit,
    items: enrichedItems,
  };
}

/**
 * Update watchlist item
 */
export async function updateWatchlistItem(
  actor: Actor, 
  username: string, 
  params: UpdateWatchlistParams
) {
  const cleanedUsername = cleanUsername(username);

  const updateFields: any = { updatedAt: new Date() };
  if (params.note !== undefined) updateFields.note = params.note;
  if (params.tags !== undefined) updateFields.tags = params.tags;
  if (params.alertSettings) {
    if (params.alertSettings.enabled !== undefined) {
      updateFields['alertSettings.enabled'] = params.alertSettings.enabled;
    }
    if (params.alertSettings.minSeverity !== undefined) {
      updateFields['alertSettings.minSeverity'] = params.alertSettings.minSeverity;
    }
    if (params.alertSettings.alertTypes !== undefined) {
      updateFields['alertSettings.alertTypes'] = params.alertSettings.alertTypes;
    }
  }

  const result = await TgWatchlistModel.findOneAndUpdate(
    { actorId: actor.actorId, username: cleanedUsername },
    { $set: updateFields },
    { new: true, projection: { _id: 0, __v: 0 } }
  );

  if (!result) {
    return { ok: false, error: 'not_found' };
  }

  return { ok: true, item: result };
}

/**
 * Get all unique tags used by actor
 */
export async function getWatchlistTags(actor: Actor): Promise<string[]> {
  const result = await TgWatchlistModel.distinct('tags', { actorId: actor.actorId });
  return result.filter((t: any) => t && typeof t === 'string');
}

/**
 * Get watchlist count for actor
 */
export async function getWatchlistCount(actor: Actor): Promise<number> {
  return TgWatchlistModel.countDocuments({ actorId: actor.actorId });
}

/**
 * Get all watchlists for a channel (admin use)
 */
export async function getWatchlistsForChannel(username: string) {
  const cleanedUsername = cleanUsername(username);
  return TgWatchlistModel.find({ username: cleanedUsername })
    .select({ actorId: 1, actorType: 1, alertSettings: 1 })
    .lean();
}

/**
 * Bulk check watchlist status
 */
export async function bulkCheckWatchlist(actor: Actor, usernames: string[]) {
  const cleanedUsernames = usernames.map(cleanUsername);
  const items = await TgWatchlistModel.find({
    actorId: actor.actorId,
    username: { $in: cleanedUsernames },
  }).select({ username: 1 }).lean();

  const watchedSet = new Set(items.map((i: any) => i.username));
  
  return cleanedUsernames.reduce((acc, u) => {
    acc[u] = watchedSet.has(u);
    return acc;
  }, {} as Record<string, boolean>);
}
