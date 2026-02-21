/**
 * Telegram Signals Page (U-10)
 * Actionable intelligence signals
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, AlertTriangle, TrendingUp, Zap, Shield, Star } from 'lucide-react';
import * as telegramApi from '../api/telegramIntel.api';

const SIGNAL_TYPES = [
  { key: '', label: 'All signals' },
  { key: 'SUBSCRIBE_CANDIDATE', label: 'Subscribe candidates' },
  { key: 'RISING_UTILITY', label: 'Rising utility' },
  { key: 'LIFECYCLE_PROMOTION', label: 'Lifecycle promotions' },
  { key: 'QUALITY_ALERT', label: 'Quality alerts' },
];

const SEVERITIES = [
  { key: '', label: 'All severities' },
  { key: 'HIGH', label: 'HIGH' },
  { key: 'MED', label: 'MED' },
  { key: 'LOW', label: 'LOW' },
];

const SEVERITY_COLORS = {
  HIGH: 'bg-red-100 text-red-700 border-red-200',
  MED: 'bg-amber-100 text-amber-700 border-amber-200',
  LOW: 'bg-gray-100 text-gray-600 border-gray-200',
};

const TYPE_ICONS = {
  SUBSCRIBE_CANDIDATE: Star,
  RISING_UTILITY: TrendingUp,
  LIFECYCLE_PROMOTION: Zap,
  QUALITY_ALERT: AlertTriangle,
  ROTATION_IN_OPPORTUNITY: TrendingUp,
};

const TYPE_COLORS = {
  SUBSCRIBE_CANDIDATE: 'text-blue-500',
  RISING_UTILITY: 'text-emerald-500',
  LIFECYCLE_PROMOTION: 'text-violet-500',
  QUALITY_ALERT: 'text-red-500',
  ROTATION_IN_OPPORTUNITY: 'text-teal-500',
};

export default function TelegramSignalsPage() {
  const [days, setDays] = useState(7);
  const [type, setType] = useState('');
  const [severity, setSeverity] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [days, type, severity]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = { days, limit: 80 };
      if (type) params.type = type;
      if (severity) params.severity = severity;
      const result = await telegramApi.getSignals(params);
      setItems(result.items || []);
    } catch (err) {
      console.error('[U-10] Failed to load signals:', err);
    } finally {
      setLoading(false);
    }
  };

  // Group by type for summary
  const typeCounts = items.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});

  const severityCounts = items.reduce((acc, item) => {
    acc[item.severity] = (acc[item.severity] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="px-6 py-6 space-y-6" data-testid="telegram-signals-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Signals</h1>
          <p className="text-gray-500 mt-1">
            Actionable insights from utility, rotation, lifecycle
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

          {/* Type filter */}
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            data-testid="type-select"
          >
            {SIGNAL_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>

          {/* Severity filter */}
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            data-testid="severity-select"
          >
            {SEVERITIES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
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

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard 
          label="Total Signals" 
          value={items.length} 
          color="blue" 
        />
        <SummaryCard 
          label="HIGH Severity" 
          value={severityCounts.HIGH || 0} 
          color="red" 
        />
        <SummaryCard 
          label="Subscribe Candidates" 
          value={typeCounts.SUBSCRIBE_CANDIDATE || 0} 
          color="emerald" 
        />
        <SummaryCard 
          label="Lifecycle Promotions" 
          value={typeCounts.LIFECYCLE_PROMOTION || 0} 
          color="violet" 
        />
        <SummaryCard 
          label="Quality Alerts" 
          value={typeCounts.QUALITY_ALERT || 0} 
          color="amber" 
        />
      </div>

      {/* Signals Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No signals found. Run the generator to create signals.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="signals-table">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Signal</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Score</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Confidence</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Type</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Category</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Channel</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Why</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <SignalRow key={`${item._id || item.username}-${idx}`} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    violet: 'bg-violet-50 border-violet-200 text-violet-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
  };

  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color] || colorClasses.blue}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs opacity-75">{label}</div>
    </div>
  );
}

function SignalRow({ item }) {
  const severityColor = SEVERITY_COLORS[item.severity] || SEVERITY_COLORS.LOW;
  const TypeIcon = TYPE_ICONS[item.type] || Zap;
  const typeColor = TYPE_COLORS[item.type] || 'text-gray-500';

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors" data-testid={`signal-${item.username || item._id}`}>
      <td className="px-4 py-3">
        <div className="flex items-start gap-2">
          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${severityColor}`}>
            {item.severity}
          </span>
          <span className="font-medium text-gray-900">{item.title}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-center font-semibold text-gray-900">
        {item.score?.toFixed(1) || '—'}
      </td>
      <td className="px-4 py-3 text-center text-gray-600">
        {((item.confidence || 0) * 100).toFixed(0)}%
      </td>
      <td className="px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-1">
          <TypeIcon className={`w-4 h-4 ${typeColor}`} />
          <span className="text-xs text-gray-500 hidden md:inline">
            {item.type?.replace(/_/g, ' ')}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-center text-gray-600">
        {item.category || '—'}
      </td>
      <td className="px-4 py-3">
        {item.username ? (
          <Link 
            to={`/telegram/${item.username}`}
            className="font-semibold text-blue-600 hover:text-blue-800 transition-colors"
          >
            @{item.username}
          </Link>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
        {(item.reasons || []).slice(0, 3).join(' · ')}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
        {item.day || '—'}
      </td>
    </tr>
  );
}
