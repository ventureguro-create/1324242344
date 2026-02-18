/**
 * TelegramWatchlistPage (BLOCK 5.1 UI)
 * User's watchlist page with tracked channels
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Star, RefreshCw, ArrowLeft, Bell, Filter } from 'lucide-react';
import { Button } from '../components/ui/button';
import { WatchlistTable } from '../components/telegram/WatchlistTable';
import { getWatchlist, removeFromWatchlist, getWatchlistTags } from '../api/telegramIntel.api';

export default function TelegramWatchlistPage() {
  const [items, setItems] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  
  // Filters
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [sortBy, setSortBy] = useState('addedAt');
  const [sortOrder, setSortOrder] = useState('desc');

  const fetchWatchlist = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        search: search || undefined,
        tags: selectedTags.length > 0 ? selectedTags.join(',') : undefined,
        sortBy,
        sortOrder,
        limit: 100,
      };
      
      const [watchlistRes, tagsRes] = await Promise.all([
        getWatchlist(params),
        getWatchlistTags(),
      ]);
      
      if (watchlistRes.ok) {
        setItems(watchlistRes.items);
        setTotal(watchlistRes.total);
      }
      
      if (tagsRes.ok) {
        setTags(tagsRes.tags);
      }
    } catch (err) {
      console.error('Error fetching watchlist:', err);
    } finally {
      setLoading(false);
    }
  }, [search, selectedTags, sortBy, sortOrder]);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  const handleRemove = async (username) => {
    try {
      const res = await removeFromWatchlist(username);
      if (res.ok) {
        setItems((prev) => prev.filter((item) => item.username !== username));
        setTotal((prev) => prev - 1);
      }
    } catch (err) {
      console.error('Error removing from watchlist:', err);
    }
  };

  const handleTagToggle = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white" data-testid="watchlist-page">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/telegram" className="text-gray-400 hover:text-white">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="flex items-center gap-3">
                <Star className="h-6 w-6 text-amber-500" />
                <div>
                  <h1 className="text-xl font-bold">Мой Watchlist</h1>
                  <p className="text-sm text-gray-400">
                    {total} каналов в отслеживании
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/telegram/alerts">
                <Button variant="outline" size="sm">
                  <Bell className="h-4 w-4 mr-2" />
                  Мои алерты
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchWatchlist}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Обновить
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Поиск по каналам..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              data-testid="watchlist-search"
            />
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Теги:</span>
              {tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleTagToggle(tag)}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    selectedTags.includes(tag)
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Sort */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-gray-400">Сортировка:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
            >
              <option value="addedAt">По дате добавления</option>
              <option value="username">По имени</option>
              <option value="intelScore">По Intel Score</option>
              <option value="momentumScore">По Momentum</option>
            </select>
            <button
              onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
              className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
            >
              {sortOrder === 'desc' ? '↓' : '↑'}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-gray-800/50 rounded-xl p-6">
          <WatchlistTable
            items={items}
            loading={loading}
            onRemove={handleRemove}
          />
        </div>

        {/* Quick Actions */}
        {items.length === 0 && !loading && (
          <div className="mt-8 text-center">
            <Link to="/telegram">
              <Button variant="default" className="bg-amber-500 hover:bg-amber-600">
                <Star className="h-4 w-4 mr-2" />
                Перейти к лидерборду
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
