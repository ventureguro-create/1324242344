/**
 * Telegram Entities Overview Page (Production)
 * Connected to real backend with URL-driven filters
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Star, 
  ThumbsUp,
  ChevronLeft, 
  ChevronRight,
  RefreshCw,
  Loader2
} from 'lucide-react';
import TelegramFilterDrawer from '../components/telegram/TelegramFilterDrawer';

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

export default function TelegramEntitiesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');

  // Build API URL from search params
  const buildApiUrl = useCallback(() => {
    const params = new URLSearchParams();
    
    // Transfer all search params to API
    searchParams.forEach((value, key) => {
      params.set(key, value);
    });
    
    // Ensure defaults
    if (!params.has('limit')) params.set('limit', '20');
    if (!params.has('page')) params.set('page', '1');
    
    return `${API_BASE}/api/telegram-intel/utility/list?${params.toString()}`;
  }, [searchParams]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const url = buildApiUrl();
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }
      
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('[Entities] Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [buildApiUrl]);

  // Fetch on mount and when params change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle search submit
  const handleSearch = (e) => {
    e.preventDefault();
    const newParams = new URLSearchParams(searchParams);
    if (searchInput.trim()) {
      newParams.set('q', searchInput.trim());
    } else {
      newParams.delete('q');
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  // Handle pagination
  const goToPage = (page) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', String(page));
    setSearchParams(newParams);
  };

  const currentPage = Number(searchParams.get('page')) || 1;
  const limit = Number(searchParams.get('limit')) || 20;
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);
  const items = data?.items || [];
  const stats = data?.stats || { tracked: 0, avgUtility: 0, highGrowth: 0, highRisk: 0 };

  // Count active filters
  const activeFilters = Array.from(searchParams.entries()).filter(
    ([key]) => !['page', 'limit', 'q'].includes(key)
  ).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        {/* Top Row: Search + Stats */}
        <div className="flex items-center justify-between mb-6">
          {/* Search Form */}
          <form onSubmit={handleSearch} className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search for a project, fund or person..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-400"
              data-testid="entity-search"
            />
          </form>

          {/* Stats Cards */}
          <div className="flex items-center gap-6">
            <StatCard label="Tracked" value={stats.tracked} color="teal" />
            <StatCard label="Avg Score" value={stats.avgUtility} color="teal" />
            <StatCard label="High Growth" value={stats.highGrowth} color="emerald" />
            <StatCard label="High Risk" value={stats.highRisk} color="rose" />
          </div>
        </div>

        {/* Title Row with Filter Button */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Entities Overview</h1>

          <div className="flex items-center gap-3">
            {/* Social Icons - placeholder */}
            <div className="flex items-center gap-1">
              {['X', '💬', '📷', '💼', '🎵', '▶️'].map((icon, i) => (
                <button 
                  key={i}
                  className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-xs"
                >
                  {icon}
                </button>
              ))}
            </div>

            {/* Ad Mode */}
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white hover:bg-gray-50">
              📊 Ad Mode
            </button>

            {/* Filter Button */}
            <button 
              onClick={() => setFilterOpen(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white hover:bg-gray-50 relative"
              data-testid="filter-button"
            >
              <Filter className="w-4 h-4 text-gray-500" />
              <span>Filter</span>
              {activeFilters > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-teal-500 text-white text-xs rounded-full flex items-center justify-center">
                  {activeFilters}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button 
              onClick={fetchData}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200"
            >
              Retry
            </button>
          </div>
        )}

        {/* Table */}
        {!loading && !error && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" data-testid="entities-table">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Channel/Group
                  </th>
                  <th className="text-left px-4 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-right px-4 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Members
                  </th>
                  <th className="text-right px-4 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Reach
                  </th>
                  <th className="text-right px-4 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Growth (7D)
                  </th>
                  <th className="text-center px-4 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Activity
                  </th>
                  <th className="text-center px-4 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Red Flags
                  </th>
                  <th className="text-right px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    FOMO Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      No entities found matching your filters.
                    </td>
                  </tr>
                ) : (
                  items.map((entity) => (
                    <EntityRow key={entity.username} entity={entity} />
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                <button 
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-500" />
                </button>

                <div className="flex items-center gap-2">
                  {generatePageNumbers(currentPage, totalPages).map((p, i) => (
                    p === '...' ? (
                      <span key={`ellipsis-${i}`} className="text-gray-400">...</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => goToPage(p)}
                        className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                          currentPage === p 
                            ? 'bg-teal-500 text-white' 
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  ))}
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">
                    Showing {(currentPage - 1) * limit + 1} – {Math.min(currentPage * limit, total)} of {total}
                  </span>
                  <button 
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter Drawer */}
      <TelegramFilterDrawer 
        open={filterOpen} 
        onClose={() => setFilterOpen(false)} 
      />
    </div>
  );
}

function StatCard({ label, value, color }) {
  const colorMap = {
    teal: 'text-teal-600',
    emerald: 'text-emerald-600',
    rose: 'text-rose-600',
  };
  
  return (
    <div className="text-right">
      <div className="text-xs text-gray-500">{label}:</div>
      <div className={`text-lg font-semibold ${colorMap[color] || colorMap.teal}`}>
        {value}
      </div>
    </div>
  );
}

function EntityRow({ entity }) {
  return (
    <tr 
      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
      data-testid={`entity-row-${entity.username}`}
    >
      {/* Channel/Group */}
      <td className="px-6 py-4">
        <Link to={`/telegram/${entity.username}`} className="flex items-center gap-3">
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
            style={{ backgroundColor: entity.avatarColor }}
          >
            {entity.title?.substring(0, 2).toUpperCase() || entity.username.substring(0, 2).toUpperCase()}
          </div>
          <span className="font-medium text-gray-900 hover:text-teal-600 transition-colors">
            {entity.title || entity.username}
          </span>
        </Link>
      </td>

      {/* Type */}
      <td className="px-4 py-4 text-sm text-gray-600">
        {entity.type}
      </td>

      {/* Members */}
      <td className="px-4 py-4 text-sm text-gray-900 text-right font-medium">
        {formatNumber(entity.members)}
      </td>

      {/* Avg Reach */}
      <td className="px-4 py-4 text-sm text-gray-900 text-right font-medium">
        {formatNumber(entity.avgReach)}
      </td>

      {/* Growth (7D) */}
      <td className={`px-4 py-4 text-sm text-right font-medium ${
        entity.growth7 >= 0 ? 'text-emerald-600' : 'text-red-500'
      }`}>
        {entity.growth7 >= 0 ? '+' : ''}{entity.growth7?.toFixed(1) || '0.0'}%
      </td>

      {/* Activity Badge */}
      <td className="px-4 py-4 text-center">
        <ActivityBadge level={entity.activity || entity.activityLabel} />
      </td>

      {/* Red Flags */}
      <td className="px-4 py-4 text-center">
        <div className="flex items-center justify-center gap-1">
          <span className="text-sm text-gray-700">{entity.redFlags || 0}</span>
          <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 2v20h2v-8h12l-2-4 2-4H6V2H4z"/>
          </svg>
        </div>
      </td>

      {/* FOMO Score */}
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm font-semibold text-gray-900">{entity.fomoScore || entity.utilityScore}</span>
          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
          {entity.engagement !== null && entity.engagement !== undefined && (
            <>
              <span className="text-sm text-gray-500">{formatNumber(entity.engagement)}</span>
              <ThumbsUp className="w-4 h-4 text-teal-500" />
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function ActivityBadge({ level }) {
  const styles = {
    High: 'bg-teal-100 text-teal-700 border-teal-200',
    Medium: 'bg-amber-100 text-amber-700 border-amber-200',
    Low: 'bg-rose-100 text-rose-600 border-rose-200',
  };

  return (
    <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full border ${styles[level] || styles.Medium}`}>
      {level || 'Medium'}
    </span>
  );
}

function formatNumber(num) {
  if (num === null || num === undefined) return '—';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(num >= 10000 ? 0 : 1) + 'k';
  return num.toString();
}

function generatePageNumbers(current, total) {
  const pages = [];
  const delta = 2;

  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  return pages;
}
