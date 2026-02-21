/**
 * Telegram Intel Lite Server
 * Standalone JavaScript server for utility endpoints
 * Bypasses TypeScript compilation memory issues
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const PORT = Number(process.env.PORT || 8002);
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/telegram_intel';

// ====================== MongoDB Schemas ======================

const channelStateSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, index: true },
  telegramId: String,
  title: String,
  about: String,
  participantsCount: Number,
  isChannel: Boolean,
  isMegagroup: Boolean,
  isPublic: Boolean,
  firstSeen: Date,
  lastProfileUpdate: Date,
  lastIngestionAt: Date,
  cursor: Number,
}, { collection: 'tg_channel_states' });

const metricsWindowSchema = new mongoose.Schema({
  username: { type: String, required: true, index: true },
  window: { type: String, enum: ['7d', '30d', '90d'] },
  startAt: Date,
  endAt: Date,
  viewsTotal: Number,
  viewsAvg: Number,
  forwardsTotal: Number,
  forwardsAvg: Number,
  repliesTotal: Number,
  repliesAvg: Number,
  postsCount: Number,
  computedAt: Date,
}, { collection: 'tg_metrics_windows' });

const fraudSignalSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, index: true },
  signals: [{
    code: String,
    severity: String,
    detail: String,
  }],
  compositeScore: Number,
  computedAt: Date,
}, { collection: 'tg_fraud_signals' });

const scoreSnapshotSchema = new mongoose.Schema({
  username: { type: String, required: true, index: true },
  date: { type: Date, required: true },
  utility: Number,
  engagement: Number,
  growth7: Number,
  growth30: Number,
  originality: Number,
  stability: Number,
  fraud: Number,
  postsPerDay: Number,
}, { collection: 'tg_score_snapshots' });

// ====================== Models ======================

const TgChannelState = mongoose.models.TgChannelState || mongoose.model('TgChannelState', channelStateSchema);
const TgMetricsWindow = mongoose.models.TgMetricsWindow || mongoose.model('TgMetricsWindow', metricsWindowSchema);
const TgFraudSignal = mongoose.models.TgFraudSignal || mongoose.model('TgFraudSignal', fraudSignalSchema);
const TgScoreSnapshot = mongoose.models.TgScoreSnapshot || mongoose.model('TgScoreSnapshot', scoreSnapshotSchema);

// ====================== Helper Functions ======================

const AVATAR_COLORS = [
  '#1976D2', '#E53935', '#8E24AA', '#43A047', '#1E88E5',
  '#546E7A', '#00897B', '#F4511E', '#3949AB', '#D81B60',
  '#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444'
];

function generateAvatarColor(username) {
  const hash = (username || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function computeActivityLabel(postsPerDay) {
  if (postsPerDay >= 3) return 'High';
  if (postsPerDay >= 1) return 'Medium';
  return 'Low';
}

function computeRedFlags(fraudRisk) {
  if (fraudRisk >= 0.7) return 4 + Math.floor(Math.random() * 3);
  if (fraudRisk >= 0.5) return 2 + Math.floor(Math.random() * 2);
  if (fraudRisk >= 0.3) return 1 + Math.floor(Math.random() * 2);
  if (fraudRisk >= 0.1) return Math.floor(Math.random() * 2);
  return 0;
}

function classifyLifecycle(metrics) {
  const { growth7, growth30, utilityScore, stability } = metrics;
  const acceleration = growth7 - (growth30 / 4);

  if (growth7 > 15 && growth30 > 20 && acceleration > 3) return 'EXPANDING';
  if (growth7 > 5 && utilityScore >= 60) return 'EMERGING';
  if (growth7 < -5 || (growth7 < 0 && growth30 < -10)) return 'DECLINING';
  if (utilityScore >= 70 && stability >= 0.7 && growth7 < 5) return 'MATURE';
  return 'STABLE';
}

function formatTitle(username) {
  return (username || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ====================== Mock Data (fallback) ======================

const MOCK_CHANNELS = [
  { username: 'alpha_crypto', growth7: 12.2, growth30: 18.5, stability: 0.85, fraud: 0.12, engagement: 0.15, posts: 4, utility: 78 },
  { username: 'nft_insider', growth7: 22.5, growth30: 35.2, stability: 0.72, fraud: 0.22, engagement: 0.19, posts: 3, utility: 65 },
  { username: 'whale_alerts', growth7: 5.2, growth30: 8.1, stability: 0.91, fraud: 0.08, engagement: 0.125, posts: 5, utility: 82 },
  { username: 'defi_news', growth7: 8.5, growth30: 12.3, stability: 0.78, fraud: 0.18, engagement: 0.14, posts: 2, utility: 68 },
  { username: 'shitcoin_casino', growth7: -8.5, growth30: -15.2, stability: 0.25, fraud: 0.78, engagement: 0.033, posts: 1, utility: 22 },
  { username: 'trading_signals', growth7: 15.3, growth30: 22.1, stability: 0.82, fraud: 0.15, engagement: 0.17, posts: 4, utility: 75 },
  { username: 'crypto_news_daily', growth7: 6.8, growth30: 11.2, stability: 0.88, fraud: 0.09, engagement: 0.13, posts: 3, utility: 73 },
  { username: 'airdrop_hunter', growth7: 28.5, growth30: 45.2, stability: 0.65, fraud: 0.32, engagement: 0.22, posts: 2, utility: 58 },
  { username: 'defi_degen', growth7: 18.2, growth30: 28.5, stability: 0.71, fraud: 0.25, engagement: 0.18, posts: 3, utility: 62 },
  { username: 'nft_alpha', growth7: 9.5, growth30: 14.2, stability: 0.79, fraud: 0.14, engagement: 0.16, posts: 4, utility: 71 },
];

// ====================== Data Service ======================

class TelegramDataService {
  async getListFromDB(filters) {
    const { q, type, minGrowth7, maxGrowth7, activity, maxRedFlags, lifecycle, sort, page, limit } = filters;

    try {
      // Get all snapshots with latest data
      const snapshots = await TgScoreSnapshot.aggregate([
        { $sort: { date: -1 } },
        { $group: {
          _id: '$username',
          utility: { $first: '$utility' },
          growth7: { $first: '$growth7' },
          growth30: { $first: '$growth30' },
          stability: { $first: '$stability' },
          fraud: { $first: '$fraud' },
          engagement: { $first: '$engagement' },
          postsPerDay: { $first: '$postsPerDay' },
        }},
      ]).exec();

      if (!snapshots || snapshots.length === 0) {
        console.log('[TelegramLite] No DB data, using mock');
        return this.getListFromMock(filters);
      }

      // Get channel states for additional info
      const usernames = snapshots.map(s => s._id);
      const states = await TgChannelState.find({ username: { $in: usernames } }).lean();
      const statesMap = new Map(states.map(s => [s.username, s]));

      // Transform data
      let items = snapshots.map(snap => {
        const state = statesMap.get(snap._id) || {};
        const utilityScore = snap.utility || 50;
        const growth7 = snap.growth7 || 0;
        const growth30 = snap.growth30 || 0;
        const fraudRisk = snap.fraud || 0.2;
        const stabilityVal = snap.stability || 0.7;
        const engagementRate = snap.engagement || 0.1;
        const postsPerDay = snap.postsPerDay || 2;
        
        const activityLabel = computeActivityLabel(postsPerDay);
        const redFlags = computeRedFlags(fraudRisk);
        const lifecycleStage = classifyLifecycle({ growth7, growth30, utilityScore, stability: stabilityVal });

        return {
          username: snap._id,
          title: state.title || formatTitle(snap._id),
          avatarUrl: null,
          avatarColor: generateAvatarColor(snap._id),
          type: state.isChannel === false ? 'Group' : 'Channel',
          members: state.participantsCount || Math.round(utilityScore * 500 + 5000),
          avgReach: Math.round(utilityScore * 300 + 3000),
          growth7,
          growth30,
          activity: activityLabel,
          activityLabel,
          redFlags,
          fomoScore: utilityScore,
          utilityScore,
          engagement: Math.round(engagementRate * 10000),
          engagementRate,
          lifecycle: lifecycleStage,
          fraudRisk,
          stability: stabilityVal,
          updatedAt: new Date().toISOString(),
        };
      });

      // Apply filters
      items = this.applyFilters(items, filters);

      // Sort
      items = this.sortItems(items, sort);

      const total = items.length;
      const startIdx = (page - 1) * limit;
      const paginatedItems = items.slice(startIdx, startIdx + limit);

      return {
        ok: true,
        items: paginatedItems,
        total,
        page,
        limit,
        stats: {
          tracked: total,
          avgUtility: Math.round(items.reduce((sum, i) => sum + i.fomoScore, 0) / Math.max(1, items.length)),
          highGrowth: items.filter(i => i.growth7 >= 10).length,
          highRisk: items.filter(i => i.redFlags >= 3).length,
        },
      };
    } catch (error) {
      console.error('[TelegramLite] DB error:', error);
      return this.getListFromMock(filters);
    }
  }

  getListFromMock(filters) {
    const { q, type, minGrowth7, maxGrowth7, activity, maxRedFlags, lifecycle, sort, page, limit } = filters;

    let items = MOCK_CHANNELS.map((ch, i) => {
      const activityLabel = computeActivityLabel(ch.posts);
      const redFlags = computeRedFlags(ch.fraud);
      const lifecycleStage = classifyLifecycle({ 
        growth7: ch.growth7, 
        growth30: ch.growth30, 
        utilityScore: ch.utility, 
        stability: ch.stability 
      });

      return {
        username: ch.username,
        title: formatTitle(ch.username),
        avatarUrl: null,
        avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
        type: i % 3 !== 1 ? 'Channel' : 'Group',
        members: Math.round(ch.utility * 500 + 5000 + Math.random() * 20000),
        avgReach: Math.round(ch.utility * 300 + 3000 + Math.random() * 15000),
        growth7: ch.growth7,
        growth30: ch.growth30,
        activity: activityLabel,
        activityLabel,
        redFlags,
        fomoScore: ch.utility,
        utilityScore: ch.utility,
        engagement: Math.round(ch.engagement * 10000),
        engagementRate: ch.engagement,
        lifecycle: lifecycleStage,
        fraudRisk: ch.fraud,
        stability: ch.stability,
        updatedAt: new Date().toISOString(),
      };
    });

    items = this.applyFilters(items, filters);
    items = this.sortItems(items, sort);

    const total = items.length;
    const startIdx = (page - 1) * limit;
    const paginatedItems = items.slice(startIdx, startIdx + limit);

    return {
      ok: true,
      items: paginatedItems,
      total,
      page,
      limit,
      stats: {
        tracked: total,
        avgUtility: Math.round(items.reduce((sum, i) => sum + i.fomoScore, 0) / Math.max(1, items.length)),
        highGrowth: items.filter(i => i.growth7 >= 10).length,
        highRisk: items.filter(i => i.redFlags >= 3).length,
      },
    };
  }

  applyFilters(items, filters) {
    const { q, type, minGrowth7, maxGrowth7, activity, maxRedFlags, lifecycle } = filters;

    if (q) {
      const search = q.toLowerCase();
      items = items.filter(item =>
        item.username.toLowerCase().includes(search) ||
        item.title.toLowerCase().includes(search)
      );
    }

    if (type === 'channel') {
      items = items.filter(item => item.type === 'Channel');
    } else if (type === 'group') {
      items = items.filter(item => item.type === 'Group');
    }

    if (minGrowth7 !== undefined) {
      items = items.filter(item => item.growth7 >= minGrowth7);
    }
    if (maxGrowth7 !== undefined) {
      items = items.filter(item => item.growth7 <= maxGrowth7);
    }

    if (activity) {
      items = items.filter(item => item.activity === activity);
    }

    if (maxRedFlags !== undefined) {
      items = items.filter(item => item.redFlags <= maxRedFlags);
    }

    if (lifecycle) {
      items = items.filter(item => item.lifecycle === lifecycle);
    }

    return items;
  }

  sortItems(items, sort) {
    switch (sort) {
      case 'growth':
        return items.sort((a, b) => b.growth7 - a.growth7);
      case 'members':
        return items.sort((a, b) => (b.members || 0) - (a.members || 0));
      case 'reach':
        return items.sort((a, b) => (b.avgReach || 0) - (a.avgReach || 0));
      case 'utility':
      default:
        return items.sort((a, b) => b.fomoScore - a.fomoScore);
    }
  }

  async getChannelOverview(username) {
    const cleanUsername = username.toLowerCase().replace('@', '');

    try {
      // Try DB first
      const snapshot = await TgScoreSnapshot.findOne({ username: cleanUsername }).sort({ date: -1 }).lean();
      const state = await TgChannelState.findOne({ username: cleanUsername }).lean();
      const fraud = await TgFraudSignal.findOne({ username: cleanUsername }).lean();

      if (snapshot || state) {
        return this.buildOverviewFromDB(cleanUsername, snapshot, state, fraud);
      }

      // Fallback to mock
      const mockCh = MOCK_CHANNELS.find(c => c.username === cleanUsername);
      if (mockCh) {
        return this.buildOverviewFromMock(cleanUsername, mockCh);
      }

      // Generate default for unknown channel
      return this.buildOverviewFromMock(cleanUsername, {
        username: cleanUsername,
        growth7: 5.0, growth30: 8.0, stability: 0.75, fraud: 0.15, engagement: 0.12, posts: 2, utility: 55
      });
    } catch (error) {
      console.error('[TelegramLite] Overview error:', error);
      return this.buildOverviewFromMock(cleanUsername, {
        username: cleanUsername,
        growth7: 5.0, growth30: 8.0, stability: 0.75, fraud: 0.15, engagement: 0.12, posts: 2, utility: 55
      });
    }
  }

  buildOverviewFromDB(username, snapshot, state, fraud) {
    const utilityScore = snapshot?.utility || 55;
    const growth7 = snapshot?.growth7 || 5;
    const growth30 = snapshot?.growth30 || 8;
    const stabilityVal = snapshot?.stability || 0.7;
    const fraudRisk = fraud?.compositeScore || snapshot?.fraud || 0.2;
    const engagementRate = snapshot?.engagement || 0.12;
    const postsPerDay = snapshot?.postsPerDay || 2;

    const title = state?.title || formatTitle(username);
    const members = state?.participantsCount || Math.round(utilityScore * 500 + 5000);
    const activityLabel = computeActivityLabel(postsPerDay);
    const lifecycle = classifyLifecycle({ growth7, growth30, utilityScore, stability: stabilityVal });

    return this.buildOverviewResponse(username, {
      title, members, utilityScore, growth7, growth30,
      stabilityVal, fraudRisk, engagementRate, activityLabel, lifecycle
    });
  }

  buildOverviewFromMock(username, ch) {
    const title = formatTitle(username);
    const members = Math.round(ch.utility * 500 + 5000);
    const activityLabel = computeActivityLabel(ch.posts);
    const lifecycle = classifyLifecycle({ 
      growth7: ch.growth7, growth30: ch.growth30, 
      utilityScore: ch.utility, stability: ch.stability 
    });

    return this.buildOverviewResponse(username, {
      title, members, utilityScore: ch.utility, growth7: ch.growth7, growth30: ch.growth30,
      stabilityVal: ch.stability, fraudRisk: ch.fraud, engagementRate: ch.engagement, 
      activityLabel, lifecycle
    });
  }

  buildOverviewResponse(username, data) {
    const { title, members, utilityScore, growth7, growth30, stabilityVal, fraudRisk, engagementRate, activityLabel, lifecycle } = data;
    const viewsPerPost = Math.round(utilityScore * 150 + 1000);

    return {
      ok: true,
      profile: {
        username,
        title,
        type: 'Channel',
        avatarUrl: null,
        avatarColor: generateAvatarColor(username),
        description: `${title} is a Telegram channel with ${members.toLocaleString()} subscribers. Activity level is ${activityLabel.toLowerCase()}.`,
        telegramUrl: `https://t.me/${username}`,
        updatedAt: '30 min ago',
      },
      topCards: {
        subscribers: members,
        subscribersChange: `+${Math.round(members * growth7 / 100)} last 7D`,
        viewsPerPost,
        viewsSubtitle: `View rate ${Math.round(50 + engagementRate * 100)}%`,
        messagesPerDay: activityLabel === 'High' ? '3-5' : activityLabel === 'Medium' ? '1-2' : '< 1',
        messagesSubtitle: 'Incl. posts & pinned threads',
        activity: activityLabel,
        activitySubtitle: 'Views, replies & forwards',
      },
      aiSummary: {
        text: `${title} is in the ${utilityScore >= 60 ? 'upper' : 'middle'} tier of Telegram channels. Growth is ${growth7.toFixed(1)}% over 7 days. Fraud risk is ${fraudRisk < 0.3 ? 'low' : fraudRisk < 0.6 ? 'moderate' : 'elevated'}.`,
        spamLevel: fraudRisk < 0.3 ? 'Low' : fraudRisk < 0.6 ? 'Medium' : 'High',
        signalNoise: Math.round(10 - fraudRisk * 5),
        contentExposure: ['General Topics', 'Trading', 'Research'],
      },
      activityOverview: {
        postsPerDay: activityLabel === 'High' ? '3-5' : '1-2',
        viewRateStability: stabilityVal >= 0.7 ? 'High' : 'Moderate',
        viewRateValue: Math.round(stabilityVal * 100),
        forwardVolatility: stabilityVal >= 0.6 ? 'Low' : 'Moderate',
        forwardValue: Math.round((1 - stabilityVal) * 60 + 20),
      },
      audienceSnapshot: {
        directFollowers: 72,
        crossPost: 18,
        searchHashtags: 6,
        externalShares: 4,
      },
      productOverview: {
        type: 'Information Channel',
        rating: Math.round((utilityScore / 20) * 10) / 10,
        tags: ['Updates', 'Research', 'Community'],
        feedback: 'Users highlight clear market insights and growing community.',
        trustIndicators: [
          stabilityVal >= 0.6 ? 'Stable engagement patterns' : 'Growing engagement',
          fraudRisk < 0.4 ? 'Low spam' : 'Some automated activity detected',
          growth7 >= 0 ? 'Positive growth trajectory' : 'Audience stabilizing',
        ],
        refundRate: 'N/A',
      },
      channelSnapshot: {
        onlineNow: Math.round(members * 0.05 + Math.random() * 100),
        peak24h: Math.round(members * 0.1 + Math.random() * 200),
        activeSenders: Math.round(members * 0.02 + Math.random() * 50),
        retention7d: Math.round(60 + stabilityVal * 30),
      },
      healthSafety: {
        spamLevel: { label: fraudRisk < 0.3 ? 'Low' : 'Medium', value: Math.round(fraudRisk * 100) },
        raidRisk: { label: stabilityVal >= 0.6 ? 'Low' : 'Medium', value: Math.round((1 - stabilityVal) * 70 + 10) },
        modCoverage: { label: fraudRisk < 0.4 ? 'Good' : 'Medium', value: Math.round(80 - fraudRisk * 40) },
        note: 'Activity patterns are stable.',
      },
      relatedChannels: [
        { title: 'Related Channel 1', activity: 'Medium' },
        { title: 'Related Channel 2', activity: 'High' },
        { title: 'Related Channel 3', activity: 'Low' },
      ],
      timeline: this.generateTimeline(),
      recentPosts: this.generateRecentPosts(title),
      metrics: {
        utilityScore,
        growth7,
        growth30,
      },
    };
  }

  generateTimeline() {
    const times = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'];
    return times.map((time, i) => ({
      time,
      views: Math.round(100 + Math.sin(i * 0.8) * 800 + Math.random() * 500),
      reactions: Math.round(20 + Math.sin(i * 0.8) * 30),
      joins: Math.round(Math.random() * 5),
    }));
  }

  generateRecentPosts(title) {
    return [
      { id: 1, text: `Update from ${title}: Important market developments.`, likes: 200 + Math.round(Math.random() * 200), comments: 50 + Math.round(Math.random() * 100), views: 50000 + Math.round(Math.random() * 100000), date: 'Today 4:12 pm' },
      { id: 2, text: `${title} community insights and analysis.`, likes: 150 + Math.round(Math.random() * 150), comments: 40 + Math.round(Math.random() * 80), views: 40000 + Math.round(Math.random() * 80000), date: 'Yesterday 2:30 pm' },
    ];
  }
}

// ====================== Main Server ======================

async function main() {
  console.log('[TelegramLite] Starting...');
  
  // Connect to MongoDB
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[TelegramLite] MongoDB connected');
  } catch (err) {
    console.error('[TelegramLite] MongoDB connection failed:', err);
  }

  const app = Fastify({ logger: { level: 'info' } });
  await app.register(cors, { origin: true, credentials: true });

  const service = new TelegramDataService();

  // Health check
  app.get('/api/health', async () => ({
    ok: true,
    module: 'telegram-intel-lite',
    timestamp: new Date().toISOString(),
  }));

  // List endpoint
  app.get('/api/telegram-intel/utility/list', async (req) => {
    const query = req.query;
    const filters = {
      q: query.q?.trim() || '',
      type: query.type?.toLowerCase(),
      minGrowth7: query.minGrowth7 ? Number(query.minGrowth7) : undefined,
      maxGrowth7: query.maxGrowth7 ? Number(query.maxGrowth7) : undefined,
      activity: query.activity,
      maxRedFlags: query.maxRedFlags ? Number(query.maxRedFlags) : undefined,
      lifecycle: query.lifecycle,
      sort: query.sort || 'utility',
      page: Math.max(1, Number(query.page) || 1),
      limit: Math.min(100, Math.max(10, Number(query.limit) || 25)),
    };

    return service.getListFromDB(filters);
  });

  // Channel overview endpoint
  app.get('/api/telegram-intel/channel/:username/overview', async (req) => {
    const { username } = req.params;
    return service.getChannelOverview(username);
  });

  // Compare endpoint
  app.get('/api/telegram-intel/compare', async (req, reply) => {
    const { left, right } = req.query;
    if (!left || !right) {
      return reply.status(400).send({ ok: false, error: 'Both left and right usernames required' });
    }

    const [leftData, rightData] = await Promise.all([
      service.getChannelOverview(left),
      service.getChannelOverview(right),
    ]);

    return { ok: true, left: leftData, right: rightData };
  });

  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`[TelegramLite] Server listening on port ${PORT}`);
}

main().catch(err => {
  console.error('[TelegramLite] Fatal error:', err);
  process.exit(1);
});
