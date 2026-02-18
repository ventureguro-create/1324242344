/**
 * Telegram Leaderboard Page (Block UI-1 + M-3 UI)
 * Production-ready channel ranking dashboard with Intel/Momentum toggle
 */
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { RefreshCw, TrendingUp, AlertTriangle } from 'lucide-react';
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

  // Parse URL params into filters
  const filters = {
    mode: searchParams.get('mode') || 'intel',
    page: Number(searchParams.get('page') || 1),
    limit: Number(searchParams.get('limit') || 25),
    search: searchParams.get('search') || '',
    tier: searchParams.get('tier') || '',
    sort: searchParams.get('sort') || (searchParams.get('mode') === 'momentum' ? 'momentumScore' : 'intelScore'),
    minAlpha: searchParams.get('minAlpha') ? Number(searchParams.get('minAlpha')) : undefined,
    maxFraud: searchParams.get('maxFraud') ? Number(searchParams.get('maxFraud')) : undefined,
  };

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
    if (newFilters.mode && newFilters.mode !== 'intel') params.set('mode', newFilters.mode);
    if (newFilters.page && newFilters.page !== 1) params.set('page', newFilters.page);
    if (newFilters.limit && newFilters.limit !== 25) params.set('limit', newFilters.limit);
    if (newFilters.search) params.set('search', newFilters.search);
    if (newFilters.tier) params.set('tier', newFilters.tier);
    const defaultSort = newFilters.mode === 'momentum' ? 'momentumScore' : 'intelScore';
    if (newFilters.sort && newFilters.sort !== defaultSort) params.set('sort', newFilters.sort);
    if (newFilters.minAlpha) params.set('minAlpha', newFilters.minAlpha);
    if (newFilters.maxFraud) params.set('maxFraud', newFilters.maxFraud);
    setSearchParams(params);
  };

  const handlePageChange = (page) => {
    handleFiltersChange({ ...filters, page });
  };

  return (
    <div className="px-6 py-6 space-y-6" data-testid="telegram-leaderboard-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Telegram Leaderboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filters.mode === 'momentum' 
              ? 'Top channels by momentum score (velocity + acceleration)'
              : 'Top Telegram intelligence sources ranked by Intel Score'}
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
          page={data.page}
          pages={data.pages}
          total={data.total}
          limit={data.limit}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
