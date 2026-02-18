/**
 * Leaderboard Stats Row (Block UI-1)
 * Institutional-style stats cards
 */
export default function LeaderboardStats({ stats, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="leaderboard-stats">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
            <div className="h-4 bg-gray-100 rounded w-24 mb-2"></div>
            <div className="h-8 bg-gray-100 rounded w-16"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="leaderboard-stats">
      <StatCard
        label="Tracked Channels"
        value={stats.total || 0}
        color="blue"
      />
      <StatCard
        label="Avg Intel Score"
        value={stats.avgIntel?.toFixed(1) || '0'}
        color="emerald"
      />
      <StatCard
        label="High Alpha (≥80)"
        value={stats.highAlpha || 0}
        color="violet"
      />
      <StatCard
        label="High Fraud (>0.6)"
        value={stats.highFraud || 0}
        color="red"
      />
    </div>
  );
}

function StatCard({ label, value, color = 'gray' }) {
  const colors = {
    blue: 'bg-blue-50 border-blue-100 text-blue-600',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-600',
    violet: 'bg-violet-50 border-violet-100 text-violet-600',
    red: 'bg-red-50 border-red-100 text-red-600',
    gray: 'bg-gray-50 border-gray-100 text-gray-600',
  };

  return (
    <div className={`rounded-xl border p-4 ${colors[color]?.split(' ').slice(0, 2).join(' ')} border-gray-200 bg-white`}>
      <div className="text-sm text-gray-500 font-medium">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${colors[color]?.split(' ').slice(2).join(' ') || 'text-gray-900'}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
}
