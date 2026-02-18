/**
 * Telegram Alerts Page (Block ALERTS + BLOCK 5.2 + PHASE 6)
 * System alerts and personalized user alerts with Telegram Bot connection
 */
import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { RefreshCw, ArrowLeft, AlertTriangle, TrendingUp, TrendingDown, Shield, Bell, Star, User } from 'lucide-react';
import * as telegramApi from '../api/telegramIntel.api';
import { UserAlertsPanel } from '../components/telegram/UserAlertsPanel';
import { TelegramBotConnect } from '../components/telegram/TelegramBotConnect';

const alertTypeConfig = {
  INTEL_SPIKE: { icon: TrendingUp, color: 'emerald', label: 'Intel Spike' },
  INTEL_DUMP: { icon: TrendingDown, color: 'red', label: 'Intel Dump' },
  MOMENTUM_SPIKE: { icon: TrendingUp, color: 'violet', label: 'Momentum Spike' },
  MOMENTUM_DUMP: { icon: TrendingDown, color: 'orange', label: 'Momentum Dump' },
  NET_ALPHA_JUMP: { icon: TrendingUp, color: 'violet', label: 'Network Alpha Jump' },
  FRAUD_SPIKE: { icon: AlertTriangle, color: 'red', label: 'Fraud Spike' },
  TIER_CHANGE: { icon: Shield, color: 'blue', label: 'Tier Change' },
  NEW_RISER: { icon: Star, color: 'amber', label: 'New Riser' },
};

const severityColors = {
  HIGH: 'bg-red-100 text-red-700 border-red-200',
  MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200',
  LOW: 'bg-gray-100 text-gray-600 border-gray-200',
};

export default function TelegramAlertsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState(searchParams.get('mode') || 'personal'); // 'personal' | 'system'
  const [data, setData] = useState(null);
  const [userAlerts, setUserAlerts] = useState(null);
  const [loading, setLoading] = useState(true);

  const type = searchParams.get('type') || '';
  const severity = searchParams.get('severity') || '';

  useEffect(() => {
    loadData();
  }, [mode, type, severity]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (mode === 'personal') {
        const params = { limit: 100 };
        if (type) params.type = type;
        if (severity) params.severity = severity;
        const result = await telegramApi.getUserAlerts(params);
        setUserAlerts(result);
      } else {
        const params = { limit: 100 };
        if (type) params.type = type;
        if (severity) params.severity = severity;
        const result = await telegramApi.getAlerts(params);
        setData(result);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = (m) => {
    setMode(m);
    const params = new URLSearchParams(searchParams);
    params.set('mode', m);
    setSearchParams(params);
  };

  const handleTypeChange = (t) => {
    const params = new URLSearchParams(searchParams);
    if (t) params.set('type', t);
    else params.delete('type');
    setSearchParams(params);
  };

  const handleSeverityChange = (s) => {
    const params = new URLSearchParams(searchParams);
    if (s) params.set('severity', s);
    else params.delete('severity');
    setSearchParams(params);
  };

  const handleMarkRead = async (alertIds) => {
    try {
      await telegramApi.markAlertsRead(alertIds);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await telegramApi.markAllAlertsRead();
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAlert = async (id) => {
    try {
      await telegramApi.deleteUserAlert(id);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="px-6 py-6 space-y-6" data-testid="telegram-alerts-page">
      {/* Back Link */}
      <Link to="/telegram" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" /> Back to Leaderboard
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alerts</h1>
          <p className="text-sm text-gray-500 mt-1">
            {mode === 'personal' ? 'Персональные уведомления из вашего Watchlist' : 'Системные события для всех каналов'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/telegram/watchlist" className="px-3 py-2 text-sm bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 flex items-center gap-2">
            <Star className="w-4 h-4" />
            Мой Watchlist
          </Link>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <RefreshCw className={`w-5 h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => handleModeChange('personal')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
            mode === 'personal'
              ? 'bg-white shadow text-gray-900'
              : 'text-gray-500 hover:text-gray-900'
          }`}
          data-testid="mode-personal"
        >
          <User className="w-4 h-4" />
          Мои алерты
          {userAlerts?.unreadCount > 0 && (
            <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              {userAlerts.unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => handleModeChange('system')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
            mode === 'system'
              ? 'bg-white shadow text-gray-900'
              : 'text-gray-500 hover:text-gray-900'
          }`}
          data-testid="mode-system"
        >
          <Bell className="w-4 h-4" />
          Системные
        </button>
      </div>

      {/* Personal Alerts View */}
      {mode === 'personal' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <UserAlertsPanel
            alerts={userAlerts?.items || []}
            stats={userAlerts?.stats}
            loading={loading}
            onMarkRead={handleMarkRead}
            onMarkAllRead={handleMarkAllRead}
            onDelete={handleDeleteAlert}
          />
        </div>
      )}

      {/* System Alerts View */}
      {mode === 'system' && (
        <>
          {/* Stats */}
          {data?.stats && (
            <div className="grid grid-cols-4 gap-4">
              <StatCard label="Total Alerts" value={data.stats.total} />
              <StatCard label="High Severity" value={data.stats.high} color="red" />
              <StatCard label="Medium" value={data.stats.medium} color="amber" />
              <StatCard label="Low" value={data.stats.low} color="gray" />
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Alert Type</label>
                <select
                  value={type}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">All Types</option>
                  <option value="INTEL_SPIKE">Intel Spike</option>
                  <option value="INTEL_DUMP">Intel Dump</option>
                  <option value="NET_ALPHA_JUMP">Network Alpha Jump</option>
                  <option value="FRAUD_SPIKE">Fraud Spike</option>
                  <option value="TIER_CHANGE">Tier Change</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Severity</label>
                <select
                  value={severity}
                  onChange={(e) => handleSeverityChange(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">All</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
            </div>
          </div>

          {/* Alerts Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center">
                <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
              </div>
            ) : !data?.items?.length ? (
              <div className="p-12 text-center text-gray-500">
                <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p>No alerts found</p>
                <p className="text-sm mt-1">Run the alerts watcher to generate events</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left">Time</th>
                    <th className="px-4 py-3 text-left">Channel</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-center">Delta</th>
                    <th className="px-4 py-3 text-center">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((alert, i) => {
                    const cfg = alertTypeConfig[alert.type] || { icon: Bell, color: 'gray', label: alert.type };
                    const Icon = cfg.icon;
                    return (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600">
                          {new Date(alert.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/telegram/${alert.username}`} className="font-medium text-blue-600 hover:text-blue-800">
                            @{alert.username}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 text-${cfg.color}-500`} />
                            <span className="font-medium">{cfg.label}</span>
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-center font-semibold ${
                          alert.delta > 0 ? 'text-emerald-600' : alert.delta < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {typeof alert.delta === 'number' ? (
                            `${alert.delta > 0 ? '+' : ''}${alert.delta.toFixed(1)}`
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium border ${severityColors[alert.severity]}`}>
                            {alert.severity}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  const textColor = color === 'red' ? 'text-red-600' : color === 'amber' ? 'text-amber-600' : 'text-gray-900';
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${textColor}`}>{value || 0}</div>
    </div>
  );
}
