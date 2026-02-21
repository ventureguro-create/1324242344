/**
 * Telegram Entities Overview Page (UI-FREEZE-1)
 * Exact match to Figma reference design
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Star, 
  ThumbsUp, 
  Flag, 
  ChevronLeft, 
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import * as telegramApi from '../api/telegramIntel.api';

// Mock data matching Figma exactly
const MOCK_ENTITIES = [
  { username: 'tradingview', title: 'TradingView', type: 'Channel', members: 128000, avgReach: 128000, growth7: 3.8, activity: 'High', redFlags: 0, fomoScore: 94, engagement: 654, avatarColor: '#1976D2' },
  { username: 'cinderpoint_ventures', title: 'CinderPoint Ventures', type: 'Group', members: 42000, avgReach: 42000, growth7: 2.2, activity: 'Medium', redFlags: 2, fomoScore: 78, engagement: 98, avatarColor: '#E53935' },
  { username: 'elara_kim', title: 'Elara Kim', type: 'Group', members: 9300, avgReach: 9300, growth7: 1.4, activity: 'Low', redFlags: 1, fomoScore: 94, engagement: 1200, avatarColor: '#8E24AA' },
  { username: 'metaforge_dao', title: 'MetaForge DAO', type: 'Channel', members: 23500, avgReach: 23500, growth7: 4.1, activity: 'Medium', redFlags: 0, fomoScore: 100, engagement: 1400, avatarColor: '#43A047' },
  { username: 'delta_arc_fund', title: 'Delta Arc Fund', type: 'Channel', members: 12000, avgReach: 12000, growth7: 2.9, activity: 'High', redFlags: 0, fomoScore: 89, engagement: 976, avatarColor: '#1E88E5' },
  { username: 'ivan_ghostnode', title: 'Ivan "GhostNode" Sav...', type: 'Channel', members: 11000, avgReach: 11000, growth7: -1.1, activity: 'Low', redFlags: 4, fomoScore: 76, engagement: 29, avatarColor: '#546E7A' },
  { username: 'echomint', title: 'EchoMint', type: 'Channel', members: 25000, avgReach: 25000, growth7: 2.5, activity: 'Medium', redFlags: 1, fomoScore: 86, engagement: 46, avatarColor: '#00897B' },
  { username: 'arcanapay', title: 'ArcanaPay', type: 'Group', members: 3300, avgReach: 3300, growth7: 3.4, activity: 'Low', redFlags: 0, fomoScore: 79, engagement: 54, avatarColor: '#F4511E' },
  { username: 'helixnine_capital', title: 'HelixNine Capital', type: 'Group', members: 9000, avgReach: 9000, growth7: 9.0, activity: 'Medium', redFlags: 6, fomoScore: 54, engagement: null, avatarColor: '#3949AB' },
  { username: 'tara_voss', title: 'Tara Voss', type: 'Channel', members: 1200, avgReach: 1200, growth7: 4.5, activity: 'High', redFlags: 0, fomoScore: 91, engagement: 273, avatarColor: '#D81B60' },
];

export default function TelegramEntitiesPage() {
  const [entities, setEntities] = useState(MOCK_ENTITIES);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('fomoScore');
  const [page, setPage] = useState(1);
  const [showCompare, setShowCompare] = useState(false);
  const [compareChannels, setCompareChannels] = useState([]);

  const stats = {
    funds: 200,
    projects: 200,
    tracked: entities.length,
    avgScore: 83.1,
    highGrowth: entities.filter(e => e.growth7 >= 10).length,
    highRisk: entities.filter(e => e.redFlags >= 3).length,
  };

  // Filter and sort entities
  const filteredEntities = entities
    .filter(e => {
      if (searchQuery && !e.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (typeFilter !== 'all' && e.type.toLowerCase() !== typeFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'fomoScore') return b.fomoScore - a.fomoScore;
      if (sortBy === 'growth7') return b.growth7 - a.growth7;
      if (sortBy === 'members') return b.members - a.members;
      return 0;
    });

  const totalPages = Math.ceil(filteredEntities.length / 20);
  const paginatedEntities = filteredEntities.slice((page - 1) * 20, page * 20);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        {/* Top Stats Bar */}
        <div className="flex items-center justify-between mb-6">
          {/* Search */}
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search for a project, fund or person..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              data-testid="entity-search"
            />
          </div>

          {/* Stats Cards */}
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-xs text-gray-500">Funds:</div>
              <div className="text-lg font-semibold text-teal-600">{stats.funds}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Projects:</div>
              <div className="text-lg font-semibold text-teal-600">{stats.projects}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Funds:</div>
              <div className="text-lg font-semibold text-teal-600">{stats.funds}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Projects:</div>
              <div className="text-lg font-semibold text-teal-600">{stats.projects}</div>
            </div>
          </div>
        </div>

        {/* Title Row with Icons and Buttons */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Entities Overview</h1>

          <div className="flex items-center gap-4">
            {/* Social Platform Icons */}
            <div className="flex items-center gap-2">
              <SocialIcon name="twitter" />
              <SocialIcon name="discord" />
              <SocialIcon name="instagram" />
              <SocialIcon name="linkedin" />
              <SocialIcon name="tiktok" />
              <SocialIcon name="youtube" />
            </div>

            {/* Ad Mode Button */}
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white hover:bg-gray-50">
              <span className="w-4 h-4 text-gray-500">📊</span>
              <span>Ad Mode</span>
            </button>

            {/* Filter Button */}
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white hover:bg-gray-50">
              <Filter className="w-4 h-4 text-gray-500" />
              <span>Filter</span>
            </button>
          </div>
        </div>

        {/* Entities Table */}
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
              {paginatedEntities.map((entity, idx) => (
                <EntityRow key={entity.username} entity={entity} />
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            >
              <ChevronLeft className="w-5 h-5 text-gray-500" />
            </button>

            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                    page === p 
                      ? 'bg-teal-500 text-white' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {p}
                </button>
              ))}
              <span className="text-gray-400">...</span>
              <button className="w-8 h-8 rounded-full text-sm font-medium text-gray-600 hover:bg-gray-100">
                10
              </button>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                Showing {(page - 1) * 20 + 1} – {Math.min(page * 20, filteredEntities.length)} out of {filteredEntities.length}
              </span>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
              >
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EntityRow({ entity }) {
  return (
    <tr 
      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
      data-testid={`entity-row-${entity.username}`}
    >
      {/* Channel/Group */}
      <td className="px-6 py-4">
        <Link to={`/telegram/${entity.username}`} className="flex items-center gap-3">
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
            style={{ backgroundColor: entity.avatarColor }}
          >
            {entity.title.substring(0, 2).toUpperCase()}
          </div>
          <span className="font-medium text-gray-900 hover:text-teal-600 transition-colors">
            {entity.title}
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
        {entity.growth7 >= 0 ? '+' : ''}{entity.growth7}%
      </td>

      {/* Activity Badge */}
      <td className="px-4 py-4 text-center">
        <ActivityBadge level={entity.activity} />
      </td>

      {/* Red Flags */}
      <td className="px-4 py-4 text-center">
        <div className="flex items-center justify-center gap-1">
          <span className="text-sm text-gray-700">{entity.redFlags}</span>
          <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 2v20h2v-8h12l-2-4 2-4H6V2H4z"/>
          </svg>
        </div>
      </td>

      {/* FOMO Score */}
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm font-semibold text-gray-900">{entity.fomoScore}</span>
          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
          {entity.engagement !== null && (
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
      {level}
    </span>
  );
}

function SocialIcon({ name }) {
  const icons = {
    twitter: '𝕏',
    discord: '🎮',
    instagram: '📷',
    linkedin: '💼',
    tiktok: '🎵',
    youtube: '▶️',
  };

  return (
    <button className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors text-sm">
      {icons[name] || '?'}
    </button>
  );
}

function formatNumber(num) {
  if (num === null || num === undefined) return '—';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(num >= 10000 ? 0 : 1) + 'k';
  return num.toString();
}
