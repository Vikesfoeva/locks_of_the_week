import React, { useState, useEffect, useRef } from 'react';
import { Popover, Portal } from '@headlessui/react';
import { FunnelIcon as FunnelIconOutline, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { FunnelIcon as FunnelIconSolid } from '@heroicons/react/24/solid';

const Standings = () => {
  const [standings, setStandings] = useState([]);
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [activeYear, setActiveYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isInitialMount = useRef(true);

  // Filtering state
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
  const [userNameFilter, setUserNameFilter] = useState([]);
  const [userNameFilterDraft, setUserNameFilterDraft] = useState([]);
  const [userNameSearch, setUserNameSearch] = useState('');
  const [rankFilter, setRankFilter] = useState([]);
  const [rankFilterDraft, setRankFilterDraft] = useState([]);
  const [rankSearch, setRankSearch] = useState('');
  const [winPctFilter, setWinPctFilter] = useState([]);
  const [winPctFilterDraft, setWinPctFilterDraft] = useState([]);
  const [winPctSearch, setWinPctSearch] = useState('');

  // Popover state
  const [userNameFilterOpen, setUserNameFilterOpen] = useState(false);
  const [rankFilterOpen, setRankFilterOpen] = useState(false);
  const [winPctFilterOpen, setWinPctFilterOpen] = useState(false);
  const userNameBtnRef = useRef(null);
  const rankBtnRef = useRef(null);
  const winPctBtnRef = useRef(null);
  const [userNamePopoverPosition, setUserNamePopoverPosition] = useState({ top: 0, left: 0 });
  const [rankPopoverPosition, setRankPopoverPosition] = useState({ top: 0, left: 0 });
  const [winPctPopoverPosition, setWinPctPopoverPosition] = useState({ top: 0, left: 0 });
  const userNamePopoverOpenRef = useRef(false);
  const rankPopoverOpenRef = useRef(false);
  const winPctPopoverOpenRef = useRef(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch active year
        const yearResponse = await fetch('/api/active-year');
        if (!yearResponse.ok) throw new Error('Failed to fetch active year');
        const yearData = await yearResponse.json();
        const year = yearData.year || new Date().getFullYear();
        setActiveYear(year);

        // 2. Fetch standings for the latest week of that year
        const standingsResponse = await fetch(`/api/standings?year=${year}`);
        if (!standingsResponse.ok) throw new Error('Failed to fetch standings');
        const standingsData = await standingsResponse.json();
        
        setStandings(standingsData.standings);
        setAvailableWeeks(standingsData.availableWeeks);
        setSelectedWeek(standingsData.selectedWeek);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []); // Empty dependency array means this runs only once on mount

  // This effect handles updates when the user selects a new week
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return; // Skip the first run to avoid double-fetching
    }
    if (!selectedWeek || !activeYear) return;

    const fetchStandings = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `/api/standings?year=${activeYear}&week=${selectedWeek}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch standings');
        }
        const data = await response.json();
        setStandings(data.standings);
        // availableWeeks should not change when week changes, so no need to set it again
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStandings();
  }, [selectedWeek]); // Re-run only when selectedWeek changes

  // Helper functions for filtering
  const getWinPct = (user) => {
    const totalGames = user.wins + user.losses + user.ties;
    if (totalGames === 0) return '0.0%';
    const winPoints = user.wins + 0.5 * user.ties;
    return ((winPoints / totalGames) * 100).toFixed(1) + '%';
  };

  const getUniqueValues = (arr, key) => {
    const values = arr.map(item => {
      if (key === 'winPct') {
        return getWinPct(item);
      }
      // Convert all values to strings for consistent handling
      return String(item[key] || '');
    });
    return Array.from(new Set(values)).filter(Boolean).sort();
  };

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const handleResetFilters = () => {
    setUserNameFilter([]);
    setRankFilter([]);
    setWinPctFilter([]);
  };

  // Filter logic
  const filteredStandings = standings.filter(user => {
    const userName = String(user.name || '');
    const rank = String(user.rank || '');
    const winPct = getWinPct(user);
    
    return (
      (userNameFilter.length === 0 || userNameFilter.includes(userName)) &&
      (rankFilter.length === 0 || rankFilter.includes(rank)) &&
      (winPctFilter.length === 0 || winPctFilter.includes(winPct))
    );
  });

  const sortedStandings = [...filteredStandings].sort((a, b) => {
    const { key, direction } = sortConfig;
    if (!key) return 0;
    
    let aValue, bValue;
    
    if (key === 'winPct') {
      aValue = parseFloat(getWinPct(a).replace('%', ''));
      bValue = parseFloat(getWinPct(b).replace('%', ''));
    } else if (key === 'rank') {
      aValue = parseInt(a.rank) || 0;
      bValue = parseInt(b.rank) || 0;
    } else {
      aValue = a[key] ? a[key].toString().toLowerCase() : '';
      bValue = b[key] ? b[key].toString().toLowerCase() : '';
    }
    
    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  // Get unique values for filters
  const uniqueUserNames = getUniqueValues(standings, 'name');
  const uniqueRanks = getUniqueValues(standings, 'rank');
  const uniqueWinPcts = getUniqueValues(standings, 'winPct');

  // Filtered values for search
  const filteredUserNames = uniqueUserNames.filter(val => String(val).toLowerCase().includes(userNameSearch.toLowerCase()));
  const filteredRanks = uniqueRanks.filter(val => String(val).toLowerCase().includes(rankSearch.toLowerCase()));
  const filteredWinPcts = uniqueWinPcts.filter(val => String(val).toLowerCase().includes(winPctSearch.toLowerCase()));

  // Determine if filters are active
  const isUserNameFiltered = userNameFilter.length > 0 && userNameFilter.length < uniqueUserNames.length;
  const isRankFiltered = rankFilter.length > 0 && rankFilter.length < uniqueRanks.length;
  const isWinPctFiltered = winPctFilter.length > 0 && winPctFilter.length < uniqueWinPcts.length;
  
  const firstPlaceWins = standings.length > 0 ? standings[0].wins : 0;

  if (loading) return <div className="text-center p-8">Loading standings...</div>;
  if (error) return <div className="text-center p-8 text-red-500">Error: {error}</div>;

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
        <h1 className="text-2xl font-bold">Overall Standings - {activeYear}</h1>
        <div className="flex items-center gap-2">
          <button
            className="border border-gray-400 text-gray-700 bg-white px-4 py-2 rounded hover:bg-gray-100"
            onClick={handleResetFilters}
            type="button"
          >
            Reset Filters
          </button>
          <div>
            <label htmlFor="week-select" className="mr-2 font-medium">View as of week:</label>
            <select
              id="week-select"
              value={selectedWeek || ''}
              onChange={e => setSelectedWeek(e.target.value)}
              className="border rounded px-2 py-1"
              disabled={availableWeeks.length === 0}
            >
              {availableWeeks.map((week, index) => {
                const parts = week.split('_');
                // parts[1] is year, parts[2] is month, parts[3] is day
                const date = new Date(parts[1], parts[2] - 1, parts[3]);
                const formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(2)}`;
                return (
                  <option key={week} value={week}>
                    Week {index + 1} - {formattedDate}
                  </option>
                );
              }).reverse()}
            </select>
          </div>
        </div>
      </div>
      {standings.length === 0 ? (
        <div className="text-center p-8">No standings data available for this week.</div>
      ) : (
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300 bg-white shadow-sm rounded-lg">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 text-left border-r border-gray-300">
                <div className="flex items-center gap-1">
                  <span>Rank</span>
                  <div className="flex flex-col ml-1">
                    <ChevronUpIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'rank' && sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); handleSort('rank'); }}
                    />
                    <ChevronDownIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'rank' && sortConfig.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); handleSort('rank'); }}
                    />
                  </div>
                  <Popover as="span" className="relative">
                    {({ open, close }) => {
                      rankPopoverOpenRef.current = open;
                      return (
                        <>
                          <Popover.Button
                            ref={rankBtnRef}
                            className="ml-1 p-1 rounded hover:bg-gray-200"
                            onClick={e => {
                              setRankFilterDraft(rankFilter.length ? rankFilter : [...uniqueRanks]);
                              const rect = e.currentTarget.getBoundingClientRect();
                              setRankPopoverPosition({
                                top: rect.bottom + window.scrollY + 4,
                                left: rect.left + window.scrollX,
                              });
                            }}
                          >
                            {isRankFiltered
                              ? <FunnelIconSolid className="h-4 w-4 text-blue-600" />
                              : <FunnelIconOutline className="h-4 w-4 text-gray-500" />}
                          </Popover.Button>
                          <Portal>
                            {open && (
                              <Popover.Panel static className="z-50 w-64 bg-white border border-gray-300 rounded shadow-lg p-3" style={{ position: 'fixed', top: rankPopoverPosition.top, left: rankPopoverPosition.left }}>
                                <div className="font-semibold mb-2">Filter Rank</div>
                                <div className="flex items-center mb-2 gap-2 text-xs">
                                  <button className="underline" onClick={() => setRankFilterDraft([...uniqueRanks])} type="button">Select all</button>
                                  <span>-</span>
                                  <button className="underline" onClick={() => setRankFilterDraft([])} type="button">Clear</button>
                                </div>
                                <input
                                  className="w-full mb-2 px-2 py-1 border border-gray-300 rounded"
                                  placeholder="Search..."
                                  value={rankSearch}
                                  onChange={e => setRankSearch(e.target.value)}
                                />
                                <div className="max-h-40 overflow-y-auto mb-2">
                                  {filteredRanks.map(val => (
                                    <label key={val} className="flex items-center gap-2 px-1 py-0.5 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={rankFilterDraft.includes(val)}
                                        onChange={() => setRankFilterDraft(draft => draft.includes(val) ? draft.filter(v => v !== val) : [...draft, val])}
                                      />
                                      <span>{val}</span>
                                    </label>
                                  ))}
                                </div>
                                <div className="flex justify-end gap-2 mt-2">
                                  <button
                                    className="px-3 py-1 rounded border border-gray-300 bg-gray-100"
                                    onClick={e => { e.stopPropagation(); setRankFilterDraft(rankFilter); close(); }}
                                    type="button"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    className="px-3 py-1 rounded bg-green-600 text-white"
                                    onClick={e => { e.stopPropagation(); setRankFilter(rankFilterDraft); close(); }}
                                    type="button"
                                  >
                                    OK
                                  </button>
                                </div>
                              </Popover.Panel>
                            )}
                          </Portal>
                        </>
                      );
                    }}
                  </Popover>
                </div>
              </th>
              <th className="px-3 py-2 text-left border-r border-gray-300">
                <div className="flex items-center gap-1">
                  <span>User Name</span>
                  <div className="flex flex-col ml-1">
                    <ChevronUpIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'name' && sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); handleSort('name'); }}
                    />
                    <ChevronDownIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'name' && sortConfig.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); handleSort('name'); }}
                    />
                  </div>
                  <Popover as="span" className="relative">
                    {({ open, close }) => {
                      userNamePopoverOpenRef.current = open;
                      return (
                        <>
                          <Popover.Button
                            ref={userNameBtnRef}
                            className="ml-1 p-1 rounded hover:bg-gray-200"
                            onClick={e => {
                              setUserNameFilterDraft(userNameFilter.length ? userNameFilter : [...uniqueUserNames]);
                              const rect = e.currentTarget.getBoundingClientRect();
                              setUserNamePopoverPosition({
                                top: rect.bottom + window.scrollY + 4,
                                left: rect.left + window.scrollX,
                              });
                            }}
                          >
                            {isUserNameFiltered
                              ? <FunnelIconSolid className="h-4 w-4 text-blue-600" />
                              : <FunnelIconOutline className="h-4 w-4 text-gray-500" />}
                          </Popover.Button>
                          <Portal>
                            {open && (
                              <Popover.Panel static className="z-50 w-64 bg-white border border-gray-300 rounded shadow-lg p-3" style={{ position: 'fixed', top: userNamePopoverPosition.top, left: userNamePopoverPosition.left }}>
                                <div className="font-semibold mb-2">Filter User Name</div>
                                <div className="flex items-center mb-2 gap-2 text-xs">
                                  <button className="underline" onClick={() => setUserNameFilterDraft([...uniqueUserNames])} type="button">Select all</button>
                                  <span>-</span>
                                  <button className="underline" onClick={() => setUserNameFilterDraft([])} type="button">Clear</button>
                                </div>
                                <input
                                  className="w-full mb-2 px-2 py-1 border border-gray-300 rounded"
                                  placeholder="Search..."
                                  value={userNameSearch}
                                  onChange={e => setUserNameSearch(e.target.value)}
                                />
                                <div className="max-h-40 overflow-y-auto mb-2">
                                  {filteredUserNames.map(val => (
                                    <label key={val} className="flex items-center gap-2 px-1 py-0.5 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={userNameFilterDraft.includes(val)}
                                        onChange={() => setUserNameFilterDraft(draft => draft.includes(val) ? draft.filter(v => v !== val) : [...draft, val])}
                                      />
                                      <span>{val}</span>
                                    </label>
                                  ))}
                                </div>
                                <div className="flex justify-end gap-2 mt-2">
                                  <button
                                    className="px-3 py-1 rounded border border-gray-300 bg-gray-100"
                                    onClick={e => { e.stopPropagation(); setUserNameFilterDraft(userNameFilter); close(); }}
                                    type="button"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    className="px-3 py-1 rounded bg-green-600 text-white"
                                    onClick={e => { e.stopPropagation(); setUserNameFilter(userNameFilterDraft); close(); }}
                                    type="button"
                                  >
                                    OK
                                  </button>
                                </div>
                              </Popover.Panel>
                            )}
                          </Portal>
                        </>
                      );
                    }}
                  </Popover>
                </div>
              </th>
              <th className="px-3 py-2 text-left border-r border-gray-300">W-L-T</th>
              <th className="px-3 py-2 text-left border-r border-gray-300">Week</th>
              <th className="px-3 py-2 text-left border-r border-gray-300">Total</th>
              <th className="px-3 py-2 text-left border-r border-gray-300">
                <div className="flex items-center gap-1">
                  <span>Win %</span>
                  <div className="flex flex-col ml-1">
                    <ChevronUpIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'winPct' && sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); handleSort('winPct'); }}
                    />
                    <ChevronDownIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'winPct' && sortConfig.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); handleSort('winPct'); }}
                    />
                  </div>
                  <Popover as="span" className="relative">
                    {({ open, close }) => {
                      winPctPopoverOpenRef.current = open;
                      return (
                        <>
                          <Popover.Button
                            ref={winPctBtnRef}
                            className="ml-1 p-1 rounded hover:bg-gray-200"
                            onClick={e => {
                              setWinPctFilterDraft(winPctFilter.length ? winPctFilter : [...uniqueWinPcts]);
                              const rect = e.currentTarget.getBoundingClientRect();
                              setWinPctPopoverPosition({
                                top: rect.bottom + window.scrollY + 4,
                                left: rect.left + window.scrollX,
                              });
                            }}
                          >
                            {isWinPctFiltered
                              ? <FunnelIconSolid className="h-4 w-4 text-blue-600" />
                              : <FunnelIconOutline className="h-4 w-4 text-gray-500" />}
                          </Popover.Button>
                          <Portal>
                            {open && (
                              <Popover.Panel static className="z-50 w-64 bg-white border border-gray-300 rounded shadow-lg p-3" style={{ position: 'fixed', top: winPctPopoverPosition.top, left: winPctPopoverPosition.left }}>
                                <div className="font-semibold mb-2">Filter Win %</div>
                                <div className="flex items-center mb-2 gap-2 text-xs">
                                  <button className="underline" onClick={() => setWinPctFilterDraft([...uniqueWinPcts])} type="button">Select all</button>
                                  <span>-</span>
                                  <button className="underline" onClick={() => setWinPctFilterDraft([])} type="button">Clear</button>
                                </div>
                                <input
                                  className="w-full mb-2 px-2 py-1 border border-gray-300 rounded"
                                  placeholder="Search..."
                                  value={winPctSearch}
                                  onChange={e => setWinPctSearch(e.target.value)}
                                />
                                <div className="max-h-40 overflow-y-auto mb-2">
                                  {filteredWinPcts.map(val => (
                                    <label key={val} className="flex items-center gap-2 px-1 py-0.5 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={winPctFilterDraft.includes(val)}
                                        onChange={() => setWinPctFilterDraft(draft => draft.includes(val) ? draft.filter(v => v !== val) : [...draft, val])}
                                      />
                                      <span>{val}</span>
                                    </label>
                                  ))}
                                </div>
                                <div className="flex justify-end gap-2 mt-2">
                                  <button
                                    className="px-3 py-1 rounded border border-gray-300 bg-gray-100"
                                    onClick={e => { e.stopPropagation(); setWinPctFilterDraft(winPctFilter); close(); }}
                                    type="button"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    className="px-3 py-1 rounded bg-green-600 text-white"
                                    onClick={e => { e.stopPropagation(); setWinPctFilter(winPctFilterDraft); close(); }}
                                    type="button"
                                  >
                                    OK
                                  </button>
                                </div>
                              </Popover.Panel>
                            )}
                          </Portal>
                        </>
                      );
                    }}
                  </Popover>
                </div>
              </th>
              <th className="px-3 py-2 text-left border-r border-gray-300">WB</th>
              <th className="px-3 py-2 text-left border-r border-gray-300">Project Payout</th>
              <th className="px-3 py-2 text-left">Rank Δ</th>
            </tr>
          </thead>
          <tbody>
            {sortedStandings.map((user, idx) => {
              const winPct = getWinPct(user);
              const weekRecord = `${user.weekWins}-${user.weekLosses}-${user.weekTies}`;
              const totalLocks = user.wins + user.losses + user.ties;
              const wb = firstPlaceWins - user.wins;
              return (
                <tr key={user._id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 font-semibold border-r border-gray-300">{user.rank}</td>
                  <td className="px-3 py-2 border-r border-gray-300">{user.name}</td>
                  <td className="px-3 py-2 border-r border-gray-300">{`${user.wins}-${user.losses}-${user.ties}`}</td>
                  <td className="px-3 py-2 border-r border-gray-300">{weekRecord}</td>
                  <td className="px-3 py-2 border-r border-gray-300">{totalLocks}</td>
                  <td className="px-3 py-2 border-r border-gray-300">{winPct}</td>
                  <td className="px-3 py-2 border-r border-gray-300">{wb === 0 ? '-' : wb}</td>
                  <td className="px-3 py-2 border-r border-gray-300">
                    <span className={`font-semibold ${
                      user.payout > 0 ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {user.payout > 0 ? `$${user.payout.toFixed(2)}` : '-'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={
                      user.rankChange.startsWith('+')
                        ? 'text-green-600 font-bold'
                        : user.rankChange.startsWith('-')
                          ? 'text-red-600 font-bold'
                          : 'text-gray-600 font-bold'
                    }>
                      {user.rankChange}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
};

export default Standings; 