/**
 * Telegram Rotation Page (U-6)
 * Sector rotation tracker - shows which sectors are rotating in/out
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { api } from '../api/client';

// Rotation status badge
function RotationStatus({ status }) {
  if (status === 'ROTATING_IN') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
        <ArrowUpRight className="w-3 h-3" /> ROTATING IN
      </span>
    );
  }
  if (status === 'ROTATING_OUT') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
        <ArrowDownRight className="w-3 h-3" /> ROTATING OUT
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">
      <Minus className="w-3 h-3" /> STABLE
    </span>
  );
}

// Delta cell with color coding
function DeltaCell({ value, suffix = '', inverse = false }) {
  const num = Number(value) || 0;
  const isPositive = inverse ? num < 0 : num > 0;
  const isStrong = Math.abs(num) >= 3;
  
  let colorClass = 'text-gray-500';
  if (isPositive) {
    colorClass = isStrong ? 'text-emerald-600 font-semibold' : 'text-emerald-500';
  } else if (num !== 0) {
    colorClass = isStrong ? 'text-red-600 font-semibold' : 'text-red-500';
  }

  const sign = num > 0 ? '+' : '';
  
  return (
    <span className={colorClass}>
      {sign}{num.toFixed(2)}{suffix}
    </span>
  );
}

export default function TelegramRotationPage() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState({ rows: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadRotation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/telegram-intel/sector/rotation?days=${days}`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load rotation:', err);
      setError('Failed to load rotation data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRotation();
  }, [days]);

  // Calculate summary stats
  const rotatingIn = data.rows?.filter(r => r.status === 'ROTATING_IN').length || 0;
  const rotatingOut = data.rows?.filter(r => r.status === 'ROTATING_OUT').length || 0;
  const stable = data.rows?.filter(r => r.status === 'STABLE').length || 0;

  return (
    <div className="px-6 py-6 space-y-6" data-testid="telegram-rotation-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            to="/telegram/sectors" 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sector Rotation</h1>
            <p className="text-sm text-gray-500 mt-1">
              Track which sectors are gaining or losing momentum
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Period selector */}
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            data-testid="rotation-period-select"
          >
            <option value={7}>7 Days</option>
            <option value={14}>14 Days</option>
            <option value={30}>30 Days</option>
          </select>
          <button
            onClick={loadRotation}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            data-testid="refresh-rotation-btn"
          >
            <RefreshCw className={`w-5 h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="text-sm text-emerald-600 font-medium">Rotating In</div>
          <div className="text-3xl font-bold text-emerald-700">{rotatingIn}</div>
          <div className="text-xs text-emerald-600 mt-1">Gaining momentum</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="text-sm text-red-600 font-medium">Rotating Out</div>
          <div className="text-3xl font-bold text-red-700">{rotatingOut}</div>
          <div className="text-xs text-red-600 mt-1">Losing momentum</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="text-sm text-gray-600 font-medium">Stable</div>
          <div className="text-3xl font-bold text-gray-700">{stable}</div>
          <div className="text-xs text-gray-500 mt-1">No significant change</div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Note if present */}
      {data.note && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl text-sm">
          {data.note}
        </div>
      )}

      {/* Rotation Table */}
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden" data-testid="rotation-table">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Category</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600" title="Change in acceleration">ΔAcc</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600" title="Change in utility">ΔUtil</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600" title="Change in growth">ΔGrowth</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600" title="Change in fraud (lower is better)">ΔFraud</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Acc</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Utility</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Channels</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.rows?.map((row, i) => (
                <tr 
                  key={row.category || i}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  data-testid={`rotation-row-${row.category}`}
                >
                  <td className="px-4 py-4">
                    <Link 
                      to={`/telegram?category=${row.category}`}
                      className="font-semibold text-gray-900 hover:text-blue-600"
                    >
                      {row.category}
                    </Link>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <DeltaCell value={row.deltaAcceleration} suffix="%" />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <DeltaCell value={row.deltaUtility} />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <DeltaCell value={row.deltaGrowth} suffix="%" />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <DeltaCell value={row.deltaFraud} suffix="%" inverse />
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700">
                    {row.avgAcceleration}%
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700">
                    {row.avgUtility}
                  </td>
                  <td className="px-4 py-4 text-center text-gray-500">
                    {row.channelsCount}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <RotationStatus status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {(!data.rows || data.rows.length === 0) && (
            <div className="p-8 text-center text-gray-500">
              No rotation data available. Run sector snapshots first.
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="text-sm font-medium text-gray-700 mb-2">Rotation Status</div>
        <div className="flex flex-wrap gap-6 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            ROTATING IN: ΔAcceleration ≥ +3%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            ROTATING OUT: ΔAcceleration ≤ -3%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-400"></span>
            STABLE: ΔAcceleration between -3% and +3%
          </span>
        </div>
      </div>
    </div>
  );
}
