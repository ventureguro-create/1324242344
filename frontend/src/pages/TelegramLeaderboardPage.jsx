/**
 * Telegram Leaderboard Page (Block UI-1 + U-2 + M-3 UI)
 * Production-ready channel ranking dashboard with Utility/Intel/Momentum toggle
 */
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { RefreshCw, TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react';
import * as telegramApi from '../api/telegramIntel.api';
import LeaderboardStats from '../components/telegram/LeaderboardStats';
import FiltersBar from '../components/telegram/FiltersBar';
import LeaderboardTable from '../components/telegram/LeaderboardTable';
import LeaderboardPagination from '../components/telegram/LeaderboardPagination';
import LeaderboardModeTabs from '../components/telegram/LeaderboardModeTabs';

export default function TelegramLeaderboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Parse URL params into filters - utility is default
  const mode = searchParams.get('mode') || 'utility';
  
  const filters = {
    mode,
    page: Number(searchParams.get('page') || 1),
    limit: Number(searchParams.get('limit') || 25),
    search: searchParams.get('search') || '',
    tier: searchParams.get('tier') || '',
    sort: searchParams.get('sort') || getDefaultSort(mode),
    minAlpha: searchParams.get('minAlpha') ? Number(searchParams.get('minAlpha')) : undefined,
    maxFraud: searchParams.get('maxFraud') ? Number(searchParams.get('maxFraud')) : undefined,
  };

  function getDefaultSort(m) {
    if (m === 'utility') return 'utility';
    if (m === 'momentum') return 'momentumScore';
    return 'intelScore';
  }

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await telegramApi.getIntelLeaderboard({
        mode: filters.mode,
        page: filters.page,
        limit: filters.limit,
        search: filters.search || undefined,
        tier: filters.tier || undefined,
        sort: filters.sort,
        minAlpha: filters.minAlpha,
        maxFraud: filters.maxFraud,
      });
      setData(result);
    } catch (err) {
      setError('Failed to load leaderboard data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters.mode, filters.page, filters.limit, filters.search, filters.tier, filters.sort, filters.minAlpha, filters.maxFraud]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Update filters (sync to URL)
  const handleFiltersChange = (newFilters) => {
    const params = new URLSearchParams();
    // utility is default, don't add to URL
    if (newFilters.mode && newFilters.mode !== 'utility') params.set('mode', newFilters.mode);
    if (newFilters.page && newFilters.page !== 1) params.set('page', newFilters.page);
    if (newFilters.limit && newFilters.limit !== 25) params.set('limit', newFilters.limit);
    if (newFilters.search) params.set('search', newFilters.search);
    if (newFilters.tier) params.set('tier', newFilters.tier);
    const defaultSort = getDefaultSort(newFilters.mode || 'utility');
    if (newFilters.sort && newFilters.sort !== defaultSort) params.set('sort', newFilters.sort);
    if (newFilters.minAlpha) params.set('minAlpha', newFilters.minAlpha);
    if (newFilters.maxFraud) params.set('maxFraud', newFilters.maxFraud);
    setSearchParams(params);
  };

  const handlePageChange = (page) => {
    handleFiltersChange({ ...filters, page });
  };

  // Mode descriptions
  const modeDescriptions = {
    utility: 'Top channels by objective metrics: Growth, Engagement, Stability',
    intel: 'Full intelligence score: Alpha, Credibility, Network',
    momentum: 'Growth velocity and acceleration trends',
  };

  return (
    <div className="px-6 py-6 space-y-6" data-testid="telegram-leaderboard-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Telegram Leaderboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {modeDescriptions[filters.mode]}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LeaderboardModeTabs />
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Refresh"
            data-testid="refresh-btn"
          >
            <RefreshCw className={`w-5 h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sub Navigation */}
      <div className="flex items-center gap-3">
        <Link 
          to="/telegram/movers" 
          className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1"
        >
          <TrendingUp className="w-4 h-4" /> Movers
        </Link>
        <Link 
          to="/telegram/alerts" 
          className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1"
        >
          <AlertTriangle className="w-4 h-4" /> Alerts
        </Link>
        <Link 
          to="/telegram/sectors" 
          className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1"
        >
          <BarChart3 className="w-4 h-4" /> Sectors
        </Link>
      </div>

      {/* Stats Row */}
      <LeaderboardStats stats={data?.stats} loading={loading} mode={filters.mode} />

      {/* Filters */}
      <FiltersBar filters={filters} onChange={handleFiltersChange} />

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Table */}
      <LeaderboardTable items={data?.items || []} loading={loading} />

      {/* Pagination */}
      {data && (
        <LeaderboardPagination
          page={data.page || 1}
          pages={data.pages || 1}
          total={data.total || 0}
          limit={data.limit || 25}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
