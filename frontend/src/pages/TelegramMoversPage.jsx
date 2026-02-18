/**
 * Telegram Movers Page (Block UI-6)
 * Top movers by score change
 */
import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { RefreshCw, TrendingUp, TrendingDown, ArrowLeft } from 'lucide-react';
import * as telegramApi from '../api/telegramIntel.api';

export default function TelegramMoversPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const days = Number(searchParams.get('days') || 7);
  const metric = searchParams.get('metric') || 'intelScore';

  useEffect(() => {
    loadData();
  }, [days, metric]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Use momentum movers endpoint for momentum metric
      const result = metric === 'momentumScore'
        ? await telegramApi.getMomentumMovers({ days, limit: 50 })
        : await telegramApi.getMovers({ days, metric, limit: 50 });
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDaysChange = (d) => {
    const params = new URLSearchParams(searchParams);
    params.set('days', d);
    setSearchParams(params);
  };

  const handleMetricChange = (m) => {
    const params = new URLSearchParams(searchParams);
    params.set('metric', m);
    setSearchParams(params);
  };

  return (
    <div className="px-6 py-6 space-y-6" data-testid="telegram-movers-page">
      {/* Back Link */}
      <Link to="/telegram" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" /> Back to Leaderboard
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Top Movers</h1>
          <p className="text-sm text-gray-500 mt-1">
            Channels with biggest score changes over {days} days
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          <RefreshCw className={`w-5 h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Period</label>
            <select
              value={days}
              onChange={(e) => handleDaysChange(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="7">7 Days</option>
              <option value="30">30 Days</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Metric</label>
            <select
              value={metric}
              onChange={(e) => handleMetricChange(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="intelScore">Intel Score</option>
              <option value="momentumScore">Momentum Score</option>
              <option value="alphaScore">Alpha Score</option>
              <option value="networkAlphaScore">Network Alpha</option>
              <option value="credibilityScore">Credibility</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      {data?.stats && (
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Total Channels" value={data.stats.total} />
          <StatCard label="Rising" value={data.stats.rising} color="emerald" icon={<TrendingUp className="w-4 h-4" />} />
          <StatCard label="Falling" value={data.stats.falling} color="red" icon={<TrendingDown className="w-4 h-4" />} />
          <StatCard label="Avg Delta" value={data.stats.avgDelta?.toFixed(1)} />
        </div>
      )}

      {/* Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Risers */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <span className="font-semibold text-emerald-700">Rising Channels</span>
            </div>
          </div>
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
            </div>
          ) : (
            <MoversTable items={data?.risers || []} type="rise" />
          )}
        </div>

        {/* Fallers */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-red-50 border-b border-red-100">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-600" />
              <span className="font-semibold text-red-700">Falling Channels</span>
            </div>
          </div>
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
            </div>
          ) : (
            <MoversTable items={data?.fallers || []} type="fall" />
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, icon }) {
  const textColor = color === 'emerald' ? 'text-emerald-600' : color === 'red' ? 'text-red-600' : 'text-gray-900';
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 text-gray-500 mb-1">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${textColor}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function MoversTable({ items, type }) {
  if (!items.length) {
    return (
      <div className="p-8 text-center text-gray-500">
        No {type === 'rise' ? 'rising' : 'falling'} channels found
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 border-b">
        <tr>
          <th className="px-4 py-2 text-left">Channel</th>
          <th className="px-4 py-2 text-center">Prev</th>
          <th className="px-4 py-2 text-center">Now</th>
          <th className="px-4 py-2 text-center">Δ</th>
        </tr>
      </thead>
      <tbody>
        {items.slice(0, 15).map((row, i) => (
          <tr key={i} className="border-b hover:bg-gray-50">
            <td className="px-4 py-2">
              <Link to={`/telegram/${row.username}`} className="font-medium text-blue-600 hover:text-blue-800">
                @{row.username}
              </Link>
              {row.tier && (
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                  row.tier === 'S' ? 'bg-violet-100 text-violet-700' :
                  row.tier === 'A' ? 'bg-emerald-100 text-emerald-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {row.tier}
                </span>
              )}
            </td>
            <td className="px-4 py-2 text-center text-gray-600">{row.previous}</td>
            <td className="px-4 py-2 text-center font-medium">{row.current}</td>
            <td className={`px-4 py-2 text-center font-semibold ${
              type === 'rise' ? 'text-emerald-600' : 'text-red-600'
            }`}>
              {row.delta > 0 ? '+' : ''}{row.delta}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
