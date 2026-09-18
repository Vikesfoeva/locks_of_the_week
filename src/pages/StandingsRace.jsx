import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config';
import { formatSeasonLabel } from '../utils/seasonFormatter';
import RankRaceChart from '../components/RankRaceChart';
import RacePlayerPicker from '../components/RacePlayerPicker';
import { plottablePlayers, SPARSE_MAX } from '../utils/rankRace';

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
  // Players the viewer chose not to draw. Render-only (ranks never change) and
  // deliberately not persisted: every visit opens with everyone shown.
  const [hiddenIds, setHiddenIds] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;

    const fetchHistory = async () => {
      try {
        setLoading(true);
        const yearResponse = await fetch(`${API_URL}/active-year`);
        if (!yearResponse.ok) throw new Error('Failed to fetch active year');
        const yearData = await yearResponse.json();
        const year = yearData.year || new Date().getFullYear();

        const response = await fetch(`${API_URL}/standings/history?year=${encodeURIComponent(year)}`);
        if (!response.ok) throw new Error('Failed to fetch standings history');
        const history = await response.json();
        if (cancelled) return;

        setActiveYear(year);
        setData(history);
        // Open with the signed-in user's own line isolated (when they are in the race).
        setHiddenIds(new Set());
        setPinnedId(viewerId && plottablePlayers(history).some(p => p.id === viewerId) ? viewerId : null);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchHistory();
    return () => { cancelled = true; };
  }, [viewerId]);

  // Already in final-rank order (the API sorts by final rank, then name).
  const roster = useMemo(
    () => plottablePlayers(data).map(p => ({ id: p.id, name: p.name, finalRank: p.ranks[p.ranks.length - 1] })),
    [data],
  );
  const viewerInRace = Boolean(viewerId) && roster.some(p => p.id === viewerId);

  // On desktop the click that dismisses the open picker also lands on the chart, where
  // it would clear the pin (touch never sends that click). Swallow just that one click.
  const dismissingPicker = useRef(false);
  const notePickerOpen = useCallback(e => {
    dismissingPicker.current = Boolean(document.querySelector('[data-race-picker]'))
      && !e.target.closest('[data-role="race-empty"]'); // its "show all" button must still work
  }, []);
  const swallowDismissClick = useCallback(e => {
    if (!dismissingPicker.current) return;
    dismissingPicker.current = false;
    e.stopPropagation();
  }, []);

  // Any picker change drops the pin, otherwise freshly chosen lines render faded
  // behind whoever was pinned.
  const changeHidden = useCallback(next => {
    setHiddenIds(next);
    setPinnedId(null);
  }, []);
  // Back to the opening state: everyone shown, pinned to the viewer.
  const showAll = useCallback(() => {
    setHiddenIds(new Set());
    setPinnedId(viewerInRace ? viewerId : null);
  }, [viewerInRace, viewerId]);

  if (loading) return <div className="text-center p-8">Loading standings race...</div>;
  if (error) return <div className="text-center p-8 text-red-500">Error: {error}</div>;

  const weeks = Array.isArray(data?.weeks) ? data.weeks : [];
  const weekCount = weeks.length;
  const playerCount = data?.playerCount ?? roster.length;
  const visibleCount = roster.filter(p => !hiddenIds.has(p.id)).length;
  const filtered = visibleCount < roster.length;
  const sparse = filtered && visibleCount <= SPARSE_MAX;
  const pinnedPlayer = pinnedId && !hiddenIds.has(pinnedId) ? roster.find(p => p.id === pinnedId) : null;
  const viewerShown = viewerInRace && !hiddenIds.has(viewerId);
  const hasChart = weekCount > 0 && roster.length > 0;

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
            {weekCount > 1 ? `Week 1 → Week ${weekCount}` : 'Week 1'} · {filtered ? `${visibleCount} of ${roster.length}` : playerCount} Players ·{' '}
            <Link to="/standings" className="font-bold text-blue-600 hover:text-blue-800">View full standings →</Link>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-b border-gray-100 px-4 py-2.5 text-xs font-medium text-gray-600">
          {hasChart && (
            <span className="inline-flex items-center gap-2">
              <RacePlayerPicker roster={roster} hiddenIds={hiddenIds} onChange={changeHidden} viewerId={viewerId} />
              {filtered && (
                <button type="button" className="px-1 py-2 text-blue-600 hover:text-blue-800 md:py-0" onClick={showAll}>
                  Show all {roster.length}
                </button>
              )}
            </span>
          )}
          {viewerShown && (
            <LegendKey swatch={<span className="inline-block h-[3px] w-3 rounded-[1px] bg-gray-900" />}>You</LegendKey>
          )}
          <LegendKey swatch={<span className="inline-block h-0.5 w-3 rounded-[1px] bg-primary-600" />}>Top 5 — prize zone</LegendKey>
          <LegendKey swatch={<span className="inline-block h-0.5 w-3 rounded-[1px] bg-red-500" />}>Last place</LegendKey>
          <LegendKey swatch={<span className="inline-block h-1.5 w-1.5 rounded-full bg-green-600" />}>3-0 Week</LegendKey>
          {/* A small selection is direct-labeled and may use compare colors, so the gray key would mislead */}
          {!sparse && (
            <LegendKey swatch={<span className="inline-block h-0.5 w-3 rounded-[1px] bg-gray-300" />}>Rest of the pack</LegendKey>
          )}
          <span className="ml-auto text-gray-400">
            {pinnedPlayer ? (
              <>
                Showing <span className="text-gray-600">{pinnedPlayer.name}</span> ·{' '}
                <button type="button" className="text-blue-600 hover:text-blue-800" onClick={() => setPinnedId(null)}>
                  Clear
                </button>
              </>
            ) : (
              <span className="hidden md:inline">Hover a line to isolate · Click to pin</span>
            )}
          </span>
        </div>

        <div className="overflow-x-auto p-2 md:overflow-visible">
          {hasChart ? (
            <div
              className="relative min-w-[1000px] md:min-w-0 md:h-[calc(100vh-370px)] md:min-h-[480px]"
              onPointerDownCapture={notePickerOpen}
              onClickCapture={swallowDismissClick}
            >
              <RankRaceChart data={data} viewerId={viewerId} pinnedId={pinnedId} onPinChange={setPinnedId} hiddenIds={hiddenIds} />
              {/* A sibling of the chart, not a child: the chart's own click handler clears the pin */}
              {visibleCount === 0 && (
                <div data-role="race-empty" className="absolute inset-0 flex items-start justify-start p-6 [pointer-events:none] md:items-center md:justify-center">
                  {/* sticky: stays in view when the phone scroller has been swiped sideways */}
                  <div className="sticky left-4 rounded-lg border border-gray-200 bg-white px-5 py-4 text-sm text-gray-600 shadow-md [pointer-events:auto]">
                    <p className="font-semibold text-gray-900">No players selected</p>
                    <p className="mt-1">
                      Tick names in Players, or{' '}
                      <button type="button" className="font-medium text-blue-600 hover:text-blue-800" onClick={showAll}>
                        show all {roster.length}
                      </button>
                      .
                    </p>
                  </div>
                </div>
              )}
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
