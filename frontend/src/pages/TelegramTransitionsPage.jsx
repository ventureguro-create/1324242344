/**
 * Telegram Lifecycle Transitions Page (U-9)
 * Shows lifecycle stage changes over time
 */
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, TrendingUp, TrendingDown, ArrowRight, Filter } from 'lucide-react';
import * as telegramApi from '../api/telegramIntel.api';

const FILTERS = [
  { key: '', label: 'All transitions' },
  { key: 'EMERGING_TO_EXPANDING', label: 'Emerging → Expanding' },
  { key: 'EXPANDING_TO_MATURE', label: 'Expanding → Mature' },
  { key: 'MATURE_TO_SATURATED', label: 'Mature → Saturated' },
  { key: 'STABLE_TO_DECLINING', label: 'Stable → Declining' },
  { key: 'SATURATED_TO_DECLINING', label: 'Saturated → Declining' },
];

const LIFECYCLE_COLORS = {
  EMERGING: 'bg-emerald-100 text-emerald-700',
  EXPANDING: 'bg-blue-100 text-blue-700',
  MATURE: 'bg-violet-100 text-violet-700',
  SATURATED: 'bg-amber-100 text-amber-700',
  DECLINING: 'bg-red-100 text-red-700',
  STABLE: 'bg-gray-100 text-gray-600',
};

export default function TelegramTransitionsPage() {
  const [days, setDays] = useState(7);
  const [filter, setFilter] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [days, filter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = { days, limit: 60 };
      if (filter) params.filter = filter;
      const result = await telegramApi.getLifecycleTransitions(params);
      setItems(result.items || []);
    } catch (err) {
      console.error('[U-9] Failed to load transitions:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-6 py-6 space-y-6" data-testid="telegram-transitions-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lifecycle Transitions</h1>
          <p className="text-gray-500 mt-1">
            Stage changes over time — highest impact first
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Days selector */}
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            data-testid="days-select"
          >
            <option value={7}>7 Days</option>
            <option value={14}>14 Days</option>
            <option value={30}>30 Days</option>
          </select>

          {/* Filter selector */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            data-testid="filter-select"
          >
            {FILTERS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>

          <button
            onClick={loadData}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Transitions Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No transitions found for this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="transitions-table">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Channel</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">From</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600"></th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">To</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600" title="Impact Score">Impact</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600" title="Utility Change">ΔUtil</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600" title="Acceleration Change">ΔAcc</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600" title="Growth Change">ΔGrowth</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Current</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <TransitionRow key={`${item.username}-${item.toDay}-${idx}`} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-sm font-medium text-gray-700 mb-3">Transition Signals</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            <span>EMERGING → EXPANDING = Strong signal</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            <span>EXPANDING → MATURE = Confirmed growth</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            <span>MATURE → SATURATED = Caution</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            <span>ANY → DECLINING = Risk</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TransitionRow({ item }) {
  const fromColor = LIFECYCLE_COLORS[item.from] || LIFECYCLE_COLORS.STABLE;
  const toColor = LIFECYCLE_COLORS[item.to] || LIFECYCLE_COLORS.STABLE;

  const isPositive = item.to === 'EXPANDING' || item.to === 'MATURE';
  const isNegative = item.to === 'DECLINING' || item.to === 'SATURATED';

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors" data-testid={`transition-${item.username}`}>
      <td className="px-4 py-3">
        <Link 
          to={`/telegram/${item.username}`}
          className="font-semibold text-gray-900 hover:text-blue-600 transition-colors"
        >
          @{item.username}
        </Link>
        <div className="text-xs text-gray-500">{item.category || '—'}</div>
      </td>
      <td className="px-4 py-3 text-center">
        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${fromColor}`}>
          {item.from}
        </span>
      </td>
      <td className="px-4 py-3 text-center text-gray-400">
        <ArrowRight className="w-4 h-4 inline" />
      </td>
      <td className="px-4 py-3 text-center">
        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${toColor}`}>
          {item.to}
        </span>
      </td>
      <td className={`px-4 py-3 text-center font-medium ${
        item.impactScore >= 5 ? 'text-emerald-600' : 
        item.impactScore <= -5 ? 'text-red-600' : 'text-gray-600'
      }`}>
        {item.impactScore >= 0 ? '+' : ''}{item.impactScore?.toFixed(1) || '0.0'}
      </td>
      <td className={`px-4 py-3 text-center ${
        item.deltaUtility > 0 ? 'text-emerald-600' : 
        item.deltaUtility < 0 ? 'text-red-600' : 'text-gray-600'
      }`}>
        {item.deltaUtility >= 0 ? '+' : ''}{item.deltaUtility?.toFixed(1) || '0.0'}
      </td>
      <td className={`px-4 py-3 text-center ${
        item.deltaAcceleration > 0 ? 'text-emerald-600' : 
        item.deltaAcceleration < 0 ? 'text-red-600' : 'text-gray-600'
      }`}>
        {item.deltaAcceleration >= 0 ? '+' : ''}{item.deltaAcceleration?.toFixed(1) || '0.0'}%
      </td>
      <td className={`px-4 py-3 text-center ${
        item.deltaGrowth30 > 0 ? 'text-emerald-600' : 
        item.deltaGrowth30 < 0 ? 'text-red-600' : 'text-gray-600'
      }`}>
        {item.deltaGrowth30 >= 0 ? '+' : ''}{item.deltaGrowth30?.toFixed(1) || '0.0'}%
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
        U {item.utilityNow?.toFixed(0) || '—'} · 
        Acc {item.accelerationNow?.toFixed(1) || '0.0'}% · 
        ER {((item.erNow || 0) * 100).toFixed(1)}%
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
        {item.toDay || '—'}
      </td>
    </tr>
  );
}
