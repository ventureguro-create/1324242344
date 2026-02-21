/**
 * Telegram Channel Overview Page (Production)
 * Connected to real backend API
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  ExternalLink, 
  GitCompare,
  Eye,
  Star,
  Heart,
  MessageCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

export default function TelegramChannelOverviewPage() {
  const { username } = useParams();
  const [channel, setChannel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('24H');
  const [showCompare, setShowCompare] = useState(false);

  // Fetch channel data from backend
  const fetchChannel = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`${API_BASE}/api/telegram-intel/channel/${username}/overview`);
      
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Channel not found');
        }
        throw new Error(`API error: ${res.status}`);
      }
      
      const data = await res.json();
      
      if (!data.ok) {
        throw new Error(data.message || 'Failed to load channel');
      }
      
      setChannel(data);
    } catch (err) {
      console.error('[ChannelOverview] Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    if (username) {
      fetchChannel();
    }
  }, [username, fetchChannel]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-[1400px] mx-auto px-6 py-6">
          <Link to="/telegram" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Entities
          </Link>
          <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button 
              onClick={fetchChannel}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No data
  if (!channel) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-[1400px] mx-auto px-6 py-6">
          <Link to="/telegram" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Entities
          </Link>
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            Channel not found
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <Link to="/telegram" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Entities
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Overview • Telegram Group/Channel</h1>
              <p className="text-sm text-gray-500 mt-1">
                High-level analytics for a single Telegram channel or group. Metrics are based on native Telegram stats and recent activity.
              </p>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - 8 cols */}
          <div className="col-span-8 space-y-6">
            {/* Channel Header Card */}
            <ChannelHeaderCard channel={channel} onCompare={() => setShowCompare(true)} />
            
            {/* Three Column Cards */}
            <div className="grid grid-cols-3 gap-4">
              <ActivityOverviewCard data={channel.activityOverview} />
              <AudienceSnapshotCard data={channel.audienceSnapshot} />
              <ProductOverviewCard data={channel.productOverview} />
            </div>

            {/* Engagement Timeline */}
            <EngagementTimelineCard 
              data={channel.timeline} 
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
            />

            {/* Recent Posts */}
            <RecentPostsCard posts={channel.recentPosts} />
          </div>

          {/* Right Column - 4 cols */}
          <div className="col-span-4 space-y-6">
            {/* AI Summary */}
            <AISummaryCard data={channel.aiSummary} />
            
            {/* Channel Snapshot */}
            <ChannelSnapshotCard data={channel.channelSnapshot} />
            
            {/* Health & Safety */}
            <HealthSafetyCard data={channel.healthSafety} />
            
            {/* Related Channels */}
            <RelatedChannelsCard channels={channel.relatedChannels} />
          </div>
        </div>
      </div>

      {/* Compare Modal */}
      {showCompare && (
        <CompareModal 
          channel1={channel} 
          onClose={() => setShowCompare(false)} 
        />
      )}
    </div>
  );
}

function ChannelHeaderCard({ channel, onCompare }) {
  const { profile, topCards } = channel;
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6" data-testid="channel-header">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div 
            className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold"
            style={{ backgroundColor: profile.avatarColor }}
          >
            {profile.title.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{profile.title}</h2>
            <span className="text-sm text-teal-600">{profile.type}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a 
            href={profile.telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors flex items-center gap-2"
          >
            View on Telegram
          </a>
          <button 
            onClick={onCompare}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <GitCompare className="w-4 h-4" />
            Compare
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        {profile.description} <span className="text-teal-600 cursor-pointer">See More</span>
      </p>

      <div className="flex items-center justify-between text-xs text-gray-500 mb-6">
        <span>Snapshot updated {profile.updatedAt}</span>
      </div>

      {/* Top Cards Row */}
      <div className="grid grid-cols-4 gap-4">
        <TopMetricCard 
          label="Subscribers"
          value={topCards.subscribers.toLocaleString()}
          subtitle={topCards.subscribersChange}
          subtitleColor="text-teal-600"
        />
        <TopMetricCard 
          label="Views/Post"
          value={topCards.viewsPerPost.toLocaleString()}
          subtitle={topCards.viewsSubtitle}
          subtitleColor="text-teal-600"
        />
        <TopMetricCard 
          label="Messages/Day"
          value={topCards.messagesPerDay}
          subtitle={topCards.messagesSubtitle}
        />
        <TopMetricCard 
          label="Activity"
          value={null}
          badge={topCards.activity}
          subtitle={topCards.activitySubtitle}
        />
      </div>
    </div>
  );
}

function TopMetricCard({ label, value, subtitle, subtitleColor, badge }) {
  return (
    <div className="text-center">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      {value && <div className="text-2xl font-semibold text-gray-900">{value}</div>}
      {badge && (
        <span className="inline-block px-3 py-1 bg-teal-100 text-teal-700 text-sm font-medium rounded-full">
          {badge}
        </span>
      )}
      {subtitle && (
        <div className={`text-xs mt-1 ${subtitleColor || 'text-gray-500'}`}>{subtitle}</div>
      )}
    </div>
  );
}

function ActivityOverviewCard({ data }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5" data-testid="activity-overview">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Activity Overview</h3>
        <span className="text-xs text-gray-400 px-2 py-1 bg-gray-100 rounded">Last 30 Days</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">Posting rhythm & engagement patterns.</p>
      
      <div className="space-y-4">
        <MetricRow label="Posts/day" value={data.postsPerDay} />
        <MetricRowProgress label="View-rate stability" value={data.viewRateStability} progress={data.viewRateValue} />
        <MetricRowProgress label="Forward volatility" value={data.forwardVolatility} progress={data.forwardValue} />
      </div>
    </div>
  );
}

function AudienceSnapshotCard({ data }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5" data-testid="audience-snapshot">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Audience Snapshot</h3>
        <span className="text-xs text-gray-400 px-2 py-1 bg-gray-100 rounded">Last 30D</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">Where engagement comes from.</p>
      
      <div className="space-y-3">
        <MetricRow label="Direct channel followers" value={`${data.directFollowers}%`} />
        <MetricRow label="Cross-post traffic (other groups/channels)" value={`${data.crossPost}%`} />
        <MetricRow label="Search & hashtags" value={`${data.searchHashtags}%`} />
        <MetricRow label="External shares" value={`${data.externalShares}%`} />
      </div>
    </div>
  );
}

function ProductOverviewCard({ data }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5" data-testid="product-overview">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Product Overview</h3>
        <span className="text-xs text-gray-400 px-2 py-1 bg-gray-100 rounded">User-Rated • Last 30D</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">What this channel offers and how users perceive its value.</p>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Product type</span>
          <div className="flex items-center gap-1">
            {[1,2,3,4].map(i => <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />)}
            <Star className="w-3 h-3 text-gray-300" />
            <span className="text-sm font-medium ml-1">{data.rating}/5</span>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-1">
          {data.tags.map(tag => (
            <span key={tag} className="px-2 py-1 bg-teal-50 text-teal-700 text-xs rounded">
              {tag}
            </span>
          ))}
        </div>
        
        <div>
          <div className="text-xs font-medium text-gray-700 mb-1">User feedback summary</div>
          <p className="text-xs text-gray-500 leading-relaxed">{data.feedback}</p>
        </div>
        
        <div>
          <div className="text-xs font-medium text-gray-700 mb-1">Trust indicators</div>
          <ul className="space-y-1">
            {data.trustIndicators.map((item, i) => (
              <li key={i} className="text-xs text-gray-500 flex items-start gap-1">
                <span>•</span> {item}
              </li>
            ))}
          </ul>
        </div>
        
        <MetricRow label="Refund & complaint rate" value={data.refundRate} />
      </div>
    </div>
  );
}

function AISummaryCard({ data }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5" data-testid="ai-summary">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">AI Summary</h3>
        <span className="text-xs text-gray-400 px-2 py-1 bg-gray-100 rounded">Auto-generated</span>
      </div>
      
      <p className="text-sm text-gray-600 leading-relaxed mb-4">
        {data.text} <span className="text-teal-600 cursor-pointer">See More</span>
      </p>
      
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="px-2 py-1 bg-teal-50 text-teal-700 text-xs rounded">
          Spam level: {data.spamLevel}
        </span>
        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
          Signal/noise: {data.signalNoise}/10
        </span>
      </div>
      
      <div className="text-xs text-gray-500">
        Content exposure: {data.contentExposure.join(', ')}
      </div>
    </div>
  );
}

function ChannelSnapshotCard({ data }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5" data-testid="channel-snapshot">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Channel Snapshot</h3>
        <span className="text-xs text-teal-600 px-2 py-1 bg-teal-50 rounded">Live</span>
      </div>
      
      <div className="space-y-3">
        <MetricRow label="Online now" value={data.onlineNow.toLocaleString()} />
        <MetricRow label="24h peak online" value={data.peak24h.toLocaleString()} />
        <MetricRow label="Active senders (24h)" value={data.activeSenders.toLocaleString()} />
        <MetricRow label="Retention (7d returning viewers)" value={`${data.retention7d}%`} />
      </div>
      
      <p className="text-xs text-gray-500 mt-4 leading-relaxed">
        Online & active sender stats are estimated from Telegram's native analytics (views, forwards, reactions) and updated every few minutes.
      </p>
    </div>
  );
}

function HealthSafetyCard({ data }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5" data-testid="health-safety">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Health & Safety</h3>
        <span className="text-xs text-gray-400 px-2 py-1 bg-gray-100 rounded">Live Snapshot</span>
      </div>
      
      <div className="space-y-4">
        <MetricRowProgress label="Spam Level" value={data.spamLevel.label} progress={data.spamLevel.value} color="teal" />
        <MetricRowProgress label="Raid risk" value={data.raidRisk.label} progress={data.raidRisk.value} color="amber" />
        <MetricRowProgress label="Mod coverage" value={data.modCoverage.label} progress={data.modCoverage.value} color="teal" />
      </div>
      
      <p className="text-xs text-gray-500 mt-4 leading-relaxed">{data.note}</p>
    </div>
  );
}

function RelatedChannelsCard({ channels }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5" data-testid="related-channels">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Related Channels</h3>
        <span className="text-xs text-gray-400 px-2 py-1 bg-gray-100 rounded">You might track next</span>
      </div>
      
      <div className="space-y-3">
        {channels.map((ch, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-sm text-gray-700">{ch.title}</span>
            <span className="text-xs">
              Activity: <ActivityBadgeSmall level={ch.activity} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EngagementTimelineCard({ data, timeRange, onTimeRangeChange }) {
  const maxViews = Math.max(...data.map(d => d.views));
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6" data-testid="engagement-timeline">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Engagement Timeline</h3>
        <div className="flex items-center gap-2">
          {['24H', '7D', '30D', '90D'].map(range => (
            <button
              key={range}
              onClick={() => onTimeRangeChange(range)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                timeRange === range 
                  ? 'bg-teal-600 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-teal-500" />
          <span className="text-xs text-gray-600">Views</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-xs text-gray-600">Reactions</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-xs text-gray-600">Joins</span>
        </div>
      </div>
      
      {/* Simple Chart */}
      <div className="h-48 flex items-end gap-4">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2">
            <div 
              className="w-full bg-teal-500 rounded-t"
              style={{ height: `${(d.views / maxViews) * 100}%`, minHeight: 4 }}
            />
            <span className="text-xs text-gray-500">{d.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentPostsCard({ posts }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6" data-testid="recent-posts">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Recent Posts</h3>
        <span className="text-xs text-gray-400 px-2 py-1 bg-gray-100 rounded">Preview Only</span>
      </div>
      
      <div className="space-y-6">
        {posts.map(post => (
          <div key={post.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
            <p className="text-sm text-gray-700 leading-relaxed mb-3">{post.text}</p>
            
            {post.images && (
              <div className="flex gap-2 mb-3">
                {post.images.map((img, i) => (
                  <div key={i} className="w-16 h-16 bg-gray-200 rounded-lg" />
                ))}
              </div>
            )}
            
            {post.hasLink && (
              <div className="flex items-center gap-2 mb-3 p-2 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-gray-200 rounded" />
                <div>
                  <div className="text-xs font-medium">{post.hasLink.title}</div>
                  <div className="text-xs text-gray-500">{post.hasLink.url}</div>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Heart className="w-3 h-3" /> {post.likes}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" /> {post.comments}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3" /> {(post.views / 1000).toFixed(1)}k
                </span>
              </div>
              <span>{post.date}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

function MetricRowProgress({ label, value, progress, color = 'teal' }) {
  const colorMap = {
    teal: 'bg-teal-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  };
  
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-gray-600 flex-shrink-0">{label}</span>
      <div className="flex items-center gap-2 flex-1 max-w-[150px]">
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full ${colorMap[color]}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-sm font-medium text-gray-900 w-16 text-right">{value}</span>
      </div>
    </div>
  );
}

function ActivityBadgeSmall({ level }) {
  const styles = {
    High: 'bg-teal-100 text-teal-700',
    Medium: 'bg-amber-100 text-amber-700',
    Low: 'bg-rose-100 text-rose-600',
  };
  
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${styles[level] || styles.Medium}`}>
      {level}
    </span>
  );
}

function CompareModal({ channel1, onClose }) {
  const [channel2, setChannel2] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Search for channels to compare
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    
    setSearching(true);
    try {
      const res = await fetch(`${API_BASE}/api/telegram-intel/utility/list?q=${encodeURIComponent(searchTerm)}&limit=5`);
      const data = await res.json();
      setSearchResults(data.items || []);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  // Select a channel for comparison
  const selectChannel = async (username) => {
    if (username === channel1.profile.username) return; // Can't compare with itself
    
    setLoading(true);
    setSearchResults([]);
    setSearchTerm('');
    
    try {
      const res = await fetch(`${API_BASE}/api/telegram-intel/channel/${username}/overview`);
      const data = await res.json();
      if (data.ok) {
        setChannel2(data);
      }
    } catch (err) {
      console.error('Load channel error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate diff for metrics
  const getDiff = (val1, val2) => {
    if (!val2 || val1 === val2) return null;
    const diff = ((val1 - val2) / val2 * 100).toFixed(1);
    return diff > 0 ? `+${diff}%` : `${diff}%`;
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white rounded-xl w-[900px] max-h-[90vh] overflow-auto p-6"
        onClick={e => e.stopPropagation()}
        data-testid="compare-modal"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Comparison</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl" data-testid="close-compare">×</button>
        </div>
        
        <div className="grid grid-cols-2 gap-8">
          {/* Left Channel */}
          <CompareColumn channel={channel1} isLeft />
          
          {/* Right Channel - Search or Selected */}
          {channel2 ? (
            <div>
              <button 
                onClick={() => setChannel2(null)}
                className="text-xs text-gray-500 hover:text-gray-700 mb-4"
              >
                ← Change channel
              </button>
              <CompareColumn channel={channel2} compareWith={channel1} />
            </div>
          ) : (
            <div className="space-y-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search channel to compare..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-100"
                  data-testid="compare-search"
                />
                <button 
                  type="submit"
                  disabled={searching}
                  className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm hover:bg-teal-600 disabled:opacity-50"
                >
                  {searching ? '...' : 'Search'}
                </button>
              </form>
              
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
                </div>
              )}
              
              {searchResults.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {searchResults.map(ch => (
                    <button
                      key={ch.username}
                      onClick={() => selectChannel(ch.username)}
                      disabled={ch.username === channel1.profile.username}
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid={`compare-option-${ch.username}`}
                    >
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                        style={{ backgroundColor: ch.avatarColor }}
                      >
                        {ch.title?.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{ch.title}</div>
                        <div className="text-xs text-gray-500">{ch.type} • Score: {ch.fomoScore}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {!loading && searchResults.length === 0 && !searchTerm && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Search for a channel to compare
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CompareColumn({ channel, compareWith, isLeft }) {
  const { profile, topCards, aiSummary, activityOverview, audienceSnapshot, channelSnapshot, healthSafety, productOverview } = channel;
  
  // Calculate diff
  const getDiff = (val1, val2) => {
    if (!compareWith || !val2 || val1 === val2) return null;
    const diff = ((val1 - val2) / val2 * 100);
    const formatted = diff > 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;
    return { value: formatted, positive: diff > 0 };
  };
  
  const compareTo = compareWith?.topCards;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
          style={{ backgroundColor: profile.avatarColor }}
        >
          {profile.title.substring(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="font-semibold">{profile.title}</div>
          <div className="text-sm text-teal-600">{profile.type}</div>
        </div>
      </div>
      
      {/* Basics */}
      <CompareSection title="Basics">
        <MetricRow label="Members" value={topCards.subscribers.toLocaleString()} />
        <div className="text-xs text-teal-600 text-right mb-2">{topCards.subscribersChange}</div>
        <MetricRow label="Views/Post" value={topCards.viewsPerPost.toLocaleString()} />
        <MetricRow label="Messages/Day" value={topCards.messagesPerDay} />
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm text-gray-600">Activity</span>
          <ActivityBadgeSmall level={topCards.activity} />
        </div>
      </CompareSection>
      
      {/* AI Summary */}
      <CompareSection title="AI Summary">
        <MetricRow label="Spam level" value={<ActivityBadgeSmall level={aiSummary.spamLevel === 'Low' ? 'Low' : 'Medium'} />} />
        <MetricRow label="Signal/noise" value={`${aiSummary.signalNoise}/10`} />
        <div className="text-xs text-gray-500 mt-2">
          Content exposure: {aiSummary.contentExposure.join(', ')}
        </div>
      </CompareSection>
      
      {/* Activity Overview */}
      <CompareSection title="Activity Overview">
        <MetricRow label="Posts/Day" value={activityOverview.postsPerDay} />
        <MetricRowProgress label="View-rate stability" value={activityOverview.viewRateStability} progress={activityOverview.viewRateValue} />
        <MetricRowProgress label="Forward volatility" value={activityOverview.forwardVolatility} progress={activityOverview.forwardValue} />
      </CompareSection>
      
      {/* Audience Snapshot */}
      <CompareSection title="Audience Snapshot">
        <MetricRow label="Direct channel followers" value={`${audienceSnapshot.directFollowers}%`} />
        <MetricRow label="Cross-post traffic (other groups/channels)" value={`${audienceSnapshot.crossPost}%`} />
        <MetricRow label="Search & hashtags" value={`${audienceSnapshot.searchHashtags}%`} />
        <MetricRow label="External shares" value={`${audienceSnapshot.externalShares}%`} />
      </CompareSection>
      
      {/* Channel Snapshot */}
      <CompareSection title="Channel Snapshot">
        <MetricRow label="Online now" value={channelSnapshot.onlineNow} />
        <MetricRow label="24h peak online" value={channelSnapshot.peak24h.toLocaleString()} />
        <MetricRow label="Active senders (24h)" value={channelSnapshot.activeSenders} />
        <MetricRow label="Retention (7d returning viewers)" value={`${channelSnapshot.retention7d}%`} />
      </CompareSection>
      
      {/* Health & Safety */}
      <CompareSection title="Health & Safety">
        <MetricRowProgress label="Spam Level" value={healthSafety.spamLevel.label} progress={healthSafety.spamLevel.value} />
        <MetricRowProgress label="Raid risk" value={healthSafety.raidRisk.label} progress={healthSafety.raidRisk.value} color="amber" />
        <MetricRowProgress label="Mod coverage" value={healthSafety.modCoverage.label} progress={healthSafety.modCoverage.value} />
      </CompareSection>
      
      {/* Product Overview */}
      <CompareSection title="Product Overview">
        <div className="flex items-center gap-1 mb-2">
          {[1,2,3,4].map(i => <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />)}
          <Star className="w-3 h-3 text-gray-300" />
          <span className="text-sm font-medium ml-1">{productOverview.rating}/5</span>
        </div>
        <div className="flex flex-wrap gap-1 mb-2">
          {productOverview.tags.map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-teal-50 text-teal-700 text-xs rounded">
              {tag}
            </span>
          ))}
        </div>
      </CompareSection>
    </div>
  );
}

function CompareSection({ title, children }) {
  return (
    <div>
      <h4 className="font-semibold text-gray-900 mb-3">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
