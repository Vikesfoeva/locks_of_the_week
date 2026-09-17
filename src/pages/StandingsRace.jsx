import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { formatSeasonLabel } from '../utils/seasonFormatter';
import RankRaceChart from '../components/RankRaceChart';

const LegendKey = ({ swatch, children }) => (
  <span className="inline-flex items-center gap-1.5">
    {swatch}
    {children}
  </span>
);

const StandingsRace = () => {
  const { currentUser } = useAuth();
  const viewerId = currentUser?.firebaseUid || currentUser?.uid || null;

  const [activeYear, setActiveYear] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pinnedId, setPinnedId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchHistory = async () => {
      try {
        setLoading(true);
        const yearResponse = await fetch('/api/active-year');
        if (!yearResponse.ok) throw new Error('Failed to fetch active year');
        const yearData = await yearResponse.json();
        const year = yearData.year || new Date().getFullYear();

        const response = await fetch(`/api/standings/history?year=${encodeURIComponent(year)}`);
        if (!response.ok) throw new Error('Failed to fetch standings history');
        const history = await response.json();
        if (cancelled) return;

        setActiveYear(year);
        setData(history);
        // Open with the signed-in user's own line isolated (when they are in the race).
        const players = Array.isArray(history.players) ? history.players : [];
        setPinnedId(viewerId && players.some(p => p.id === viewerId) ? viewerId : null);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchHistory();
    return () => { cancelled = true; };
  }, [viewerId]);

  if (loading) return <div className="text-center p-8">Loading standings race...</div>;
  if (error) return <div className="text-center p-8 text-red-500">Error: {error}</div>;

  const weeks = Array.isArray(data?.weeks) ? data.weeks : [];
  const players = Array.isArray(data?.players) ? data.players : [];
  const weekCount = weeks.length;
  const playerCount = data?.playerCount ?? players.length;
  const pinnedPlayer = pinnedId ? players.find(p => p.id === pinnedId) : null;
  const viewerInRace = Boolean(viewerId) && players.some(p => p.id === viewerId);
  const hasChart = weekCount > 0 && players.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-2 py-2 md:p-4">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold leading-tight tracking-tight text-gray-900">Standings Race</h1>
          <p className="mt-1 text-sm text-gray-500">
            How the league has moved week over week · {formatSeasonLabel(activeYear)} · Through Week {weekCount}
          </p>
        </div>
        <div className="inline-flex self-start rounded-md border border-gray-200 bg-white p-[3px] shadow-sm">
          <Link
            to="/standings"
            className="rounded px-3.5 py-1.5 text-sm font-medium text-gray-600 transition-colors duration-200 hover:text-gray-900"
          >
            Table
          </Link>
          <span aria-current="page" className="rounded bg-primary-600 px-3.5 py-1.5 text-sm font-medium text-white">
            Race
          </span>
        </div>
      </div>

      {/* Chart card */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
        <div className="flex flex-col gap-1 border-b-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-5 md:py-4">
          <h2 className="text-base font-bold leading-tight text-gray-900 md:text-lg">Rank Over Time</h2>
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {weekCount > 1 ? `Week 1 → Week ${weekCount}` : 'Week 1'} · {playerCount} Players ·{' '}
            <Link to="/standings" className="font-bold text-blue-600 hover:text-blue-800">View full standings →</Link>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-b border-gray-100 px-4 py-2.5 text-xs font-medium text-gray-600">
          {viewerInRace && (
            <LegendKey swatch={<span className="inline-block h-[3px] w-3 rounded-[1px] bg-gray-900" />}>You</LegendKey>
          )}
          <LegendKey swatch={<span className="inline-block h-0.5 w-3 rounded-[1px] bg-primary-600" />}>Top 5 — prize zone</LegendKey>
          <LegendKey swatch={<span className="inline-block h-0.5 w-3 rounded-[1px] bg-red-500" />}>Last place</LegendKey>
          <LegendKey swatch={<span className="inline-block h-1.5 w-1.5 rounded-full bg-green-600" />}>3-0 Week</LegendKey>
          <LegendKey swatch={<span className="inline-block h-0.5 w-3 rounded-[1px] bg-gray-300" />}>Rest of the pack</LegendKey>
          <span className="ml-auto text-gray-400">
            {pinnedPlayer ? (
              <>
                Showing <span className="text-gray-600">{pinnedPlayer.name}</span> ·{' '}
                <button type="button" className="text-blue-600 hover:text-blue-800" onClick={() => setPinnedId(null)}>
                  Clear
                </button>
              </>
            ) : (
              'Hover a line to isolate · Click to pin'
            )}
          </span>
        </div>

        <div className="overflow-x-auto p-2 md:overflow-visible">
          {hasChart ? (
            <div className="min-w-[1000px] md:min-w-0 md:h-[calc(100vh-370px)] md:min-h-[480px]">
              <RankRaceChart data={data} viewerId={viewerId} pinnedId={pinnedId} onPinChange={setPinnedId} />
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              {weekCount === 0 ? 'The race starts once the first week is in the books.' : 'No players to show yet.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StandingsRace;
