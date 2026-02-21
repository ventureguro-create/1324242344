/**
 * Telegram Sectors Page (U-5)
 * Macro market view with sector heatmap
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Minus, Flame, Zap, Snowflake } from 'lucide-react';
import { api } from '../api/client';

// Sector trend indicator
function SectorTrend({ acceleration }) {
  if (acceleration > 5) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs font-medium">
        <Flame className="w-3 h-3" /> Expanding
      </span>
    );
  }
  if (acceleration > 2) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium">
        <Zap className="w-3 h-3" /> Growing
      </span>
    );
  }
  if (acceleration > -2) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">
        <Minus className="w-3 h-3" /> Stable
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-600 rounded-lg text-xs font-medium">
      <Snowflake className="w-3 h-3" /> Cooling
    </span>
  );
}

// Progress bar for metrics
function MetricBar({ value, max = 100, color = 'blue' }) {
  const pct = Math.min(100, (value / max) * 100);
  const colors = {
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  };
  
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div 
          className={`h-full ${colors[color]} rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-medium text-gray-700 w-12 text-right">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

export default function TelegramSectorsPage() {
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSectors = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/telegram-intel/sector/overview');
      setSectors(res.data.sectors || res.data || []);
    } catch (err) {
      console.error('Failed to load sectors:', err);
      setError('Failed to load sector data');
      // Use mock data for demo
      setSectors([
        { category: 'TRADING', channelsCount: 48, avgUtility: 62, avgGrowth30: 9.4, avgAcceleration: 3.2, avgER: 0.085, avgFraud: 0.18, explodingCount: 5, acceleratingCount: 12 },
        { category: 'NEWS', channelsCount: 35, avgUtility: 58, avgGrowth30: 5.2, avgAcceleration: 1.1, avgER: 0.12, avgFraud: 0.12, explodingCount: 2, acceleratingCount: 8 },
        { category: 'NFT', channelsCount: 22, avgUtility: 45, avgGrowth30: -2.5, avgAcceleration: -4.2, avgER: 0.065, avgFraud: 0.32, explodingCount: 1, acceleratingCount: 3 },
        { category: 'EARLY', channelsCount: 18, avgUtility: 71, avgGrowth30: 18.5, avgAcceleration: 6.8, avgER: 0.14, avgFraud: 0.22, explodingCount: 8, acceleratingCount: 6 },
        { category: 'VC', channelsCount: 15, avgUtility: 68, avgGrowth30: 4.2, avgAcceleration: 0.5, avgER: 0.095, avgFraud: 0.08, explodingCount: 0, acceleratingCount: 4 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSectors();
  }, []);

  // Calculate market summary
  const marketSummary = sectors.length > 0 ? {
    totalChannels: sectors.reduce((sum, s) => sum + (s.channelsCount || 0), 0),
    avgUtility: sectors.reduce((sum, s) => sum + (s.avgUtility || 0), 0) / sectors.length,
    avgGrowth: sectors.reduce((sum, s) => sum + (s.avgGrowth30 || 0), 0) / sectors.length,
    hotSectors: sectors.filter(s => (s.avgAcceleration || 0) > 3).length,
  } : null;

  return (
    <div className="px-6 py-6 space-y-6" data-testid="telegram-sectors-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            to="/telegram" 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sector Heatmap</h1>
            <p className="text-sm text-gray-500 mt-1">
              Telegram market overview by category
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/telegram/rotation"
            className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            data-testid="rotation-link"
          >
            <TrendingUp className="w-4 h-4 inline mr-1" />
            Rotation
          </Link>
          <button
            onClick={loadSectors}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            data-testid="refresh-sectors-btn"
          >
            <RefreshCw className={`w-5 h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Market Summary */}
      {marketSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-sm text-gray-500">Total Channels</div>
            <div className="text-2xl font-bold text-gray-900">{marketSummary.totalChannels}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-sm text-gray-500">Market Avg Utility</div>
            <div className="text-2xl font-bold text-blue-600">{marketSummary.avgUtility.toFixed(0)}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-sm text-gray-500">Market Avg Growth</div>
            <div className={`text-2xl font-bold ${marketSummary.avgGrowth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {marketSummary.avgGrowth >= 0 ? '+' : ''}{marketSummary.avgGrowth.toFixed(1)}%
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-sm text-gray-500">Hot Sectors</div>
            <div className="text-2xl font-bold text-orange-600">{marketSummary.hotSectors}</div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl">
          {error} - showing demo data
        </div>
      )}

      {/* Sectors Table */}
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden" data-testid="sectors-table">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Category</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Channels</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Avg Utility</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Growth 30d</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Avg ER</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Fraud Risk</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Trend</th>
              </tr>
            </thead>
            <tbody>
              {sectors.map((sector, i) => (
                <tr 
                  key={sector.category || i}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  data-testid={`sector-row-${sector.category}`}
                >
                  <td className="px-4 py-4">
                    <Link 
                      to={`/telegram?category=${sector.category}`}
                      className="font-medium text-gray-900 hover:text-blue-600"
                    >
                      {sector.category}
                    </Link>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {sector.explodingCount || 0} hot, {sector.acceleratingCount || 0} rising
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-medium text-gray-700">{sector.channelsCount || 0}</span>
                  </td>
                  <td className="px-4 py-4">
                    <MetricBar value={sector.avgUtility || 0} max={100} color="blue" />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`font-medium ${(sector.avgGrowth30 || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {(sector.avgGrowth30 || 0) >= 0 ? '+' : ''}{(sector.avgGrowth30 || 0).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-medium text-gray-700">
                      {((sector.avgER || 0) * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`font-medium ${
                      (sector.avgFraud || 0) > 0.3 ? 'text-red-600' : 
                      (sector.avgFraud || 0) > 0.15 ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                      {((sector.avgFraud || 0) * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <SectorTrend acceleration={sector.avgAcceleration || 0} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="text-sm font-medium text-gray-700 mb-2">Trend Legend</div>
        <div className="flex flex-wrap gap-4 text-xs">
          <span className="flex items-center gap-1">
            <Flame className="w-3 h-3 text-orange-500" /> Expanding (+5% acceleration)
          </span>
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-emerald-500" /> Growing (+2-5%)
          </span>
          <span className="flex items-center gap-1">
            <Minus className="w-3 h-3 text-gray-500" /> Stable (-2 to +2%)
          </span>
          <span className="flex items-center gap-1">
            <Snowflake className="w-3 h-3 text-blue-500" /> Cooling (&lt;-2%)
          </span>
        </div>
      </div>
    </div>
  );
}
