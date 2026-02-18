/**
 * Channel Full Routes - Block UI-2
 * Unified data fetch for Channel Detail Page
 */
import { FastifyPluginAsync } from 'fastify';
import { TgIntelRankingModel } from '../models/tg.intel_ranking.model.js';
import { TgAlphaScoreModel } from '../models/tg.alpha_score.model.js';
import { TgCredibilityModel } from '../models/tg.credibility.model.js';
import { TgFraudSignalModel } from '../models/tg.fraud_signal.model.js';
import { TgNetworkAlphaChannelModel } from '../models/tg.network_alpha_channel.model.js';
import { TgTokenMentionModel } from '../models/tg.token_mention.model.js';

export const channelFullRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/telegram-intel/channel/:username/full
   * Unified endpoint - all channel data in one request
   */
  fastify.get('/api/telegram-intel/channel/:username/full', async (req, reply) => {
    const { username } = req.params as any;
    const u = String(username).replace(/^@/, '').toLowerCase().trim();

    if (!u) {
      return reply.status(400).send({ ok: false, error: 'username_required' });
    }

    // Fetch all data in parallel
    const [intel, alpha, credibility, fraud, networkAlpha, mentions] = await Promise.all([
      TgIntelRankingModel.findOne({ username: u }).select('-_id -__v').lean(),
      TgAlphaScoreModel.findOne({ username: u }).select('-_id -__v').lean(),
      TgCredibilityModel.findOne({ username: u }).select('-_id -__v').lean(),
      TgFraudSignalModel.findOne({ username: u }).select('-_id -__v').lean(),
      TgNetworkAlphaChannelModel.findOne({ username: u }).select('-_id -__v').lean(),
      TgTokenMentionModel.find({ username: u })
        .sort({ mentionedAt: -1 })
        .limit(50)
        .select('-_id -__v')
        .lean(),
    ]);

    // Generate mock temporal data for sparkline (in production, fetch from TgScoreSnapshotModel)
    const temporal = generateMockTemporal(intel);

    // Generate compare data
    const compare = await generateCompareData(u, intel);

    // Generate network evidence
    const evidence = await generateNetworkEvidence(u, networkAlpha);

    // Generate explain
    const explain = generateExplain(intel, alpha, credibility, fraud, networkAlpha);

    return {
      ok: true,
      username: u,
      intel: intel || null,
      alpha: alpha || null,
      credibility: credibility || null,
      fraud: fraud || null,
      networkAlpha: networkAlpha || null,
      temporal,
      compare,
      evidence,
      mentions: mentions || [],
      explain,
    };
  });

  fastify.log.info('[channel-full] routes registered');
};

// Helper functions

function generateMockTemporal(intel: any) {
  if (!intel) return { items: [], days: 90 };
  
  const baseScore = intel.intelScore || 50;
  const items = [];
  const now = new Date();
  
  for (let i = 90; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const variation = (Math.random() - 0.5) * 10;
    items.push({
      day: date.toISOString().slice(0, 10),
      intelScore: Math.max(0, Math.min(100, baseScore + variation)),
      alphaScore: (intel.components?.alphaScore || 50) + (Math.random() - 0.5) * 8,
      networkAlphaScore: (intel.components?.networkAlphaScore || 40) + (Math.random() - 0.5) * 6,
    });
  }
  
  return { items, days: 90 };
}

async function generateCompareData(username: string, intel: any) {
  if (!intel) return null;
  
  // Get rank position
  const higherCount = await TgIntelRankingModel.countDocuments({
    intelScore: { $gt: intel.intelScore }
  });
  const total = await TgIntelRankingModel.countDocuments({});
  
  const rank = higherCount + 1;
  const percentile = total > 0 ? ((total - rank) / total) * 100 : 0;
  
  // Get neighbors
  const [above, below] = await Promise.all([
    TgIntelRankingModel.findOne({ intelScore: { $gt: intel.intelScore } })
      .sort({ intelScore: 1 })
      .select('username intelScore tier')
      .lean(),
    TgIntelRankingModel.findOne({ intelScore: { $lt: intel.intelScore } })
      .sort({ intelScore: -1 })
      .select('username intelScore tier')
      .lean(),
  ]);
  
  // Tier stats
  const tierCount = await TgIntelRankingModel.countDocuments({ tier: intel.tier });
  const tierAvg = await TgIntelRankingModel.aggregate([
    { $match: { tier: intel.tier } },
    { $group: { _id: null, avg: { $avg: '$intelScore' } } }
  ]);
  
  return {
    position: { rank, total, percentile: percentile.toFixed(1) },
    gaps: {
      up: above ? (above as any).intelScore - intel.intelScore : null,
      down: below ? intel.intelScore - (below as any).intelScore : null,
      toTierS: intel.tier !== 'S' ? 90 - intel.intelScore : 0,
    },
    neighbors: {
      above: above ? { username: (above as any).username, score: (above as any).intelScore } : null,
      below: below ? { username: (below as any).username, score: (below as any).intelScore } : null,
    },
    peerContext: {
      tierCount,
      tierAvg: tierAvg[0]?.avg || 0,
      vsAvg: intel.intelScore - (tierAvg[0]?.avg || 0),
    },
  };
}

async function generateNetworkEvidence(username: string, networkAlpha: any) {
  if (!networkAlpha) return { items: [], summary: null };
  
  // Mock network evidence based on networkAlphaScore
  const score = networkAlpha.networkAlphaScore || 0;
  const items = [];
  
  const tokens = ['SOL', 'ETH', 'BTC', 'PEPE', 'WIF', 'BONK', 'JUP', 'RENDER'];
  const numTokens = Math.floor(score / 15) + 1;
  
  for (let i = 0; i < Math.min(numTokens, 8); i++) {
    items.push({
      token: tokens[i],
      earlyRank: Math.floor(Math.random() * 5) + 1,
      cohortSize: Math.floor(Math.random() * 20) + 5,
      delayHours: Math.random() * 48,
      percentile: Math.random() * 0.3,
      return7d: (Math.random() - 0.3) * 100,
      isHit: Math.random() > 0.4,
    });
  }
  
  return {
    items,
    summary: {
      totalTokens: items.length,
      firstPlaces: items.filter(i => i.earlyRank === 1).length,
      avgPercentile: items.reduce((a, b) => a + b.percentile, 0) / (items.length || 1),
    },
  };
}

function generateExplain(intel: any, alpha: any, cred: any, fraud: any, net: any) {
  if (!intel) return null;
  
  const factors = [];
  
  if (intel.components?.alphaScore > 70) {
    factors.push({ factor: 'Strong Alpha Track Record', impact: 'positive', weight: 0.25 });
  }
  if (intel.components?.credibilityScore > 70) {
    factors.push({ factor: 'High Credibility Score', impact: 'positive', weight: 0.25 });
  }
  if (intel.components?.networkAlphaScore > 50) {
    factors.push({ factor: 'Early Network Alpha', impact: 'positive', weight: 0.10 });
  }
  if (intel.components?.fraudRisk > 0.4) {
    factors.push({ factor: 'Elevated Fraud Risk', impact: 'negative', weight: -0.15 });
  }
  if (intel.components?.fraudRisk < 0.2) {
    factors.push({ factor: 'Low Fraud Risk', impact: 'positive', weight: 0.05 });
  }
  
  return {
    factors,
    penalties: intel.penalties || {},
    configVersion: intel.explain?.configVersion || 1,
    computedAt: intel.computedAt,
  };
}
