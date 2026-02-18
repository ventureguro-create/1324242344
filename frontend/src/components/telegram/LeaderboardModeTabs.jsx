/**
 * Leaderboard Mode Tabs (M-3 UI)
 * Toggle between Intel and Momentum views
 */
import { useSearchParams } from 'react-router-dom';

export default function LeaderboardModeTabs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'intel';

  const setMode = (next) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set('mode', next);
    p.delete('page');
    setSearchParams(p);
  };

  const Tab = ({ value, label }) => {
    const active = mode === value;
    return (
      <button
        onClick={() => setMode(value)}
        data-testid={`mode-tab-${value}`}
        className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
          active
            ? 'bg-white border-gray-300 text-gray-900 shadow-sm'
            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex gap-2" data-testid="leaderboard-mode-tabs">
      <Tab value="intel" label="Intel" />
      <Tab value="momentum" label="Momentum" />
    </div>
  );
}
