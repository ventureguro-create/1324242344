/**
 * Telegram Channel Detail Page (Block UI-2 + M-3)
 * Unified channel view with all data in one fetch + Momentum
 */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Shield, AlertTriangle, Award, ExternalLink } from 'lucide-react';
import * as telegramApi from '../api/telegramIntel.api';
import MomentumCard from '../components/telegram/MomentumCard';
import MomentumSparkline from '../components/telegram/MomentumSparkline';
import { WatchlistButton } from '../components/telegram/WatchlistButton';
import SimilarChannelsPanel from '../components/telegram/SimilarChannelsPanel';

export default function TelegramChannelPage() {
  const { username } = useParams();
  const [data, setData] = useState(null);
  const [momentum, setMomentum] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (username) loadData();
  }, [username]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [channelResult, momentumResult] = await Promise.all([
        telegramApi.getChannelFull(username),
        telegramApi.getChannelMomentum(username, { days: 90 }).catch(() => null),
      ]);
      setData(channelResult);
      setMomentum(momentumResult);
    } catch (err) {
      setError('Failed to load channel data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="px-6 py-6 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !data?.ok) {
    return (
      <div className="px-6 py-6">
        <Link to="/telegram" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Leaderboard
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
          {error || 'Channel not found'}
        </div>
      </div>
    );
  }

  const { intel, compare, evidence, mentions, explain } = data;

  return (
    <div className="px-6 py-6 space-y-6" data-testid="telegram-channel-page">
      {/* Back Link */}
      <Link to="/telegram" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" /> Back to Leaderboard
      </Link>

      {/* Header */}
      <ChannelHeader username={username} intel={intel} onRefresh={loadData} />

      {/* Compare Panel */}
      {compare && <ComparePanel data={compare} />}

      {/* Score Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ScoreCard
          title="Alpha Score"
          value={intel?.components?.alphaScore}
          icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
          color="emerald"
        />
        <ScoreCard
          title="Network Alpha"
          value={intel?.components?.networkAlphaScore}
          icon={<Award className="w-5 h-5 text-violet-500" />}
          color="violet"
        />
        <ScoreCard
          title="Fraud Risk"
          value={(intel?.components?.fraudRisk * 100)?.toFixed(1) + '%'}
          icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
          color={intel?.components?.fraudRisk > 0.4 ? 'red' : 'gray'}
          isPercentage
        />
      </div>

      {/* Momentum Section (M-3 UI) */}
      {momentum && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <MomentumCard data={momentum} />
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="text-sm text-gray-500 font-medium mb-3">Momentum Trend (90d)</div>
            <MomentumSparkline points={momentum?.items || []} metric="momentumScore" />
          </div>
        </div>
      )}

      {/* Similar Channels (U-8) */}
      <SimilarChannelsPanel username={username} />

      {/* Network Evidence */}
      {evidence?.items?.length > 0 && <NetworkEvidenceSection data={evidence} />}

      {/* Token Mentions */}
      {mentions?.length > 0 && <TokenMentionsSection items={mentions} />}

      {/* Explain */}
      {explain && <ExplainSection data={explain} />}
    </div>
  );
}

// Sub-components

function ChannelHeader({ username, intel, onRefresh }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">@{username}</h1>
            {intel?.tier && <TierBadge tier={intel.tier} />}
          </div>
          <p className="text-gray-500 mt-1">Telegram Intelligence Channel</p>
        </div>
        <div className="flex items-center gap-3">
          <WatchlistButton username={username} />
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-600">{intel?.intelScore?.toFixed(1) || '—'}</div>
            <div className="text-sm text-gray-500">Intel Score</div>
          </div>
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg hover:bg-gray-100"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Score breakdown */}
      <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
        <MiniStat label="Alpha" value={intel?.components?.alphaScore?.toFixed(1)} />
        <MiniStat label="Credibility" value={intel?.components?.credibilityScore?.toFixed(1)} />
        <MiniStat label="Network" value={intel?.components?.networkAlphaScore?.toFixed(1)} />
        <MiniStat label="Fraud" value={(intel?.components?.fraudRisk * 100)?.toFixed(1) + '%'} warn={intel?.components?.fraudRisk > 0.4} />
      </div>
    </div>
  );
}

function TierBadge({ tier }) {
  const colors = {
    S: 'bg-violet-100 text-violet-700 border-violet-200',
    A: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    B: 'bg-blue-100 text-blue-700 border-blue-200',
    C: 'bg-amber-100 text-amber-700 border-amber-200',
    D: 'bg-gray-100 text-gray-500 border-gray-200',
  };
  return (
    <span className={`px-3 py-1 rounded-lg text-sm font-semibold border ${colors[tier] || colors.D}`}>
      Tier {tier}
    </span>
  );
}

function MiniStat({ label, value, warn }) {
  return (
    <div className="text-center">
      <div className={`text-lg font-semibold ${warn ? 'text-red-600' : 'text-gray-900'}`}>{value || '—'}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function ComparePanel({ data }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Position in Network</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-900">#{data.position?.rank}</div>
          <div className="text-xs text-gray-500">Global Rank</div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{data.position?.percentile}%</div>
          <div className="text-xs text-gray-500">Percentile</div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-emerald-600">+{data.gaps?.toTierS?.toFixed(1)}</div>
          <div className="text-xs text-gray-500">To Tier S</div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-700">{data.peerContext?.tierCount}</div>
          <div className="text-xs text-gray-500">Tier Peers</div>
        </div>
      </div>

      {/* Neighbors */}
      {(data.neighbors?.above || data.neighbors?.below) && (
        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-sm">
          {data.neighbors?.above && (
            <div className="text-gray-600">
              ↑ @{data.neighbors.above.username} ({data.neighbors.above.score?.toFixed(1)})
            </div>
          )}
          {data.neighbors?.below && (
            <div className="text-gray-600">
              ↓ @{data.neighbors.below.username} ({data.neighbors.below.score?.toFixed(1)})
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreCard({ title, value, icon, color, isPercentage }) {
  const colorClasses = {
    emerald: 'border-emerald-200 bg-emerald-50',
    violet: 'border-violet-200 bg-violet-50',
    red: 'border-red-200 bg-red-50',
    gray: 'border-gray-200 bg-gray-50',
  };

  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color] || colorClasses.gray}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium text-gray-700">{title}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">
        {isPercentage ? value : (typeof value === 'number' ? value.toFixed(1) : value || '—')}
      </div>
    </div>
  );
}

function NetworkEvidenceSection({ data }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Network Alpha Evidence</h3>
        <div className="text-sm text-gray-500">
          {data.summary?.totalTokens} tokens, {data.summary?.firstPlaces} first places
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-3 py-2 text-left">Token</th>
              <th className="px-3 py-2 text-center">Early Rank</th>
              <th className="px-3 py-2 text-center">Delay (h)</th>
              <th className="px-3 py-2 text-center">7d ROI</th>
              <th className="px-3 py-2 text-center">Hit</th>
            </tr>
          </thead>
          <tbody>
            {data.items?.slice(0, 10).map((item, i) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">${item.token}</td>
                <td className="px-3 py-2 text-center">
                  {item.earlyRank === 1 ? (
                    <span className="text-amber-500">🥇 1st</span>
                  ) : (
                    `#${item.earlyRank}`
                  )}
                </td>
                <td className="px-3 py-2 text-center text-gray-600">{item.delayHours?.toFixed(1)}h</td>
                <td className={`px-3 py-2 text-center font-medium ${item.return7d > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {item.return7d > 0 ? '+' : ''}{item.return7d?.toFixed(1)}%
                </td>
                <td className="px-3 py-2 text-center">
                  {item.isHit ? '✓' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TokenMentionsSection({ items }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Recent Token Mentions</h3>
      <div className="flex flex-wrap gap-2">
        {items.slice(0, 20).map((m, i) => (
          <span key={i} className="px-3 py-1 bg-gray-100 rounded-lg text-sm font-medium">
            ${m.token}
          </span>
        ))}
      </div>
    </div>
  );
}

function ExplainSection({ data }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Score Explanation</h3>
      <div className="space-y-3">
        {data.factors?.map((f, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="text-gray-700">{f.factor}</span>
            <span className={`font-medium ${f.impact === 'positive' ? 'text-emerald-600' : 'text-red-600'}`}>
              {f.impact === 'positive' ? '+' : ''}{(f.weight * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
      {data.penalties && Object.keys(data.penalties).length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="text-xs text-gray-500 mb-2">Applied Penalties</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(data.penalties).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-gray-600">{k}</span>
                <span className="text-red-600">{typeof v === 'number' ? v.toFixed(3) : v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
