import React, { useState, useEffect, useRef } from 'react';
import { Popover, Portal } from '@headlessui/react';
import { FunnelIcon as FunnelIconOutline, ChevronUpIcon, ChevronDownIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
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
  const [legendOpen, setLegendOpen] = useState(false);
  const userNameBtnRef = useRef(null);
  const rankBtnRef = useRef(null);
  const winPctBtnRef = useRef(null);
  const legendBtnRef = useRef(null);
  const [userNamePopoverPosition, setUserNamePopoverPosition] = useState({ top: 0, left: 0 });
  const [rankPopoverPosition, setRankPopoverPosition] = useState({ top: 0, left: 0 });
  const [winPctPopoverPosition, setWinPctPopoverPosition] = useState({ top: 0, left: 0 });
  const [legendPopoverPosition, setLegendPopoverPosition] = useState({ top: 0, left: 0 });
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

  if (loading) return <div className="text-center p-8">Loading standings...</div>;
  if (error) return <div className="text-center p-8 text-red-500">Error: {error}</div>;

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-2">
        <div className="text-center sm:text-left">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Overall Standings - {activeYear}</h1>
          <p className="text-gray-600">Complete season performance rankings</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            className="border border-gray-300 text-gray-700 bg-white px-4 py-2 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors duration-200 font-medium"
            onClick={handleResetFilters}
            type="button"
          >
            Reset Filters
          </button>
          
          <Popover as="span" className="relative">
            {({ open, close }) => {
              return (
                <>
                  <Popover.Button
                    ref={legendBtnRef}
                    className="flex items-center gap-2 border border-gray-300 text-gray-700 bg-white px-3 py-2 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors duration-200 font-medium"
                    onClick={e => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setLegendPopoverPosition({
                        top: rect.bottom + window.scrollY + 4,
                        left: rect.left + window.scrollX,
                      });
                    }}
                  >
                    <QuestionMarkCircleIcon className="h-4 w-4" />
                    Legend
                  </Popover.Button>
                  <Portal>
                    {open && (
                      <Popover.Panel static className="z-50 w-80 bg-white border border-gray-300 rounded-lg shadow-lg p-4" style={{ position: 'fixed', top: legendPopoverPosition.top, left: legendPopoverPosition.left }}>
                        <div className="font-semibold text-gray-800 mb-3 text-sm">Legend</div>
                        <div className="grid grid-cols-1 gap-3 text-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 bg-yellow-400 rounded-full flex-shrink-0"></div>
                            <span className="text-gray-700">Top 3 Finishers</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                            <span className="text-gray-700">Prize Winner</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 bg-red-400 rounded-full flex-shrink-0"></div>
                            <span className="text-gray-700">Last Place</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs flex-shrink-0">+2</span>
                            <span className="text-gray-700">Rank Improved</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs flex-shrink-0">-1</span>
                            <span className="text-gray-700">Rank Declined</span>
                          </div>
                        </div>
                      </Popover.Panel>
                    )}
                  </Portal>
                </>
              );
            }}
          </Popover>
          <div className="flex items-center gap-2">
            <label htmlFor="week-select" className="font-medium text-gray-700">View as of week:</label>
            <select
              id="week-select"
              value={selectedWeek || ''}
              onChange={e => setSelectedWeek(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 bg-white hover:border-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors duration-200"
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
      <>
        <div className="overflow-x-auto shadow-lg rounded-xl border border-gray-200">
        <table className="min-w-full bg-white">
          <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200">
            <tr>
              <th className="px-4 py-4 text-left border-r border-gray-200">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">Rank</span>
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
              <th className="px-4 py-4 text-left border-r border-gray-200">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">User Name</span>
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
              <th className="px-4 py-4 text-left border-r border-gray-200">
                <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">W-L-T</span>
              </th>
              <th className="px-4 py-4 text-left border-r border-gray-200">
                <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">Week</span>
              </th>
              <th className="px-4 py-4 text-left border-r border-gray-200">
                <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">Total</span>
              </th>
              <th className="px-4 py-4 text-left border-r border-gray-200">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">Win %</span>
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
              <th className="px-4 py-4 text-left border-r border-gray-200">
                <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">WB</span>
              </th>
              <th className="px-4 py-4 text-left border-r border-gray-200">
                <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">Projected Payout</span>
              </th>
              <th className="px-4 py-4 text-left">
                <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">Rank Δ</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedStandings.map((user, idx) => {
              const winPct = getWinPct(user);
              const weekRecord = `${user.weekWins}-${user.weekLosses}-${user.weekTies}`;
              const totalLocks = user.wins + user.losses + user.ties;
              const isTopThree = user.rank <= 3;
              const isWinner = user.payout > 0;
              const isLastPlace = user.rank === standings.length;
              
              // Determine row styling based on performance
              let rowClassName = 'hover:bg-blue-50 transition-colors duration-200';
              if (isTopThree) {
                rowClassName += ' bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-l-yellow-400';
              } else if (isLastPlace) {
                rowClassName += ' bg-gradient-to-r from-red-50 to-pink-50 border-l-4 border-l-red-400';
              } else if (idx % 2 === 0) {
                rowClassName += ' bg-white';
              } else {
                rowClassName += ' bg-gray-50';
              }
              
              return (
                <tr key={user._id} className={rowClassName}>
                  <td className="px-4 py-4 border-r border-gray-200">
                    <div className="flex items-center">
                      {isTopThree && (
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2 ${
                          user.rank === 1 ? 'bg-yellow-500' : user.rank === 2 ? 'bg-gray-400' : 'bg-amber-600'
                        }`}>
                          {user.rank}
                        </div>
                      )}
                      <span className={`font-bold text-lg ${isTopThree ? 'text-gray-800' : 'text-gray-600'}`}>
                        {!isTopThree && user.rank}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 border-r border-gray-200">
                    <span className={`font-medium ${isTopThree ? 'text-gray-800 text-lg' : 'text-gray-700'}`}>
                      {user.name}
                    </span>
                  </td>
                  <td className="px-4 py-4 border-r border-gray-200">
                    <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                      {`${user.wins}-${user.losses}-${user.ties}`}
                    </span>
                  </td>
                  <td className="px-4 py-4 border-r border-gray-200">
                    <span className="font-mono text-sm text-gray-600">
                      {weekRecord}
                    </span>
                  </td>
                  <td className="px-4 py-4 border-r border-gray-200">
                    <span className="font-semibold text-gray-700">
                      {totalLocks}
                    </span>
                  </td>
                  <td className="px-4 py-4 border-r border-gray-200">
                    <span className={`font-bold text-lg ${
                      parseFloat(winPct.replace('%', '')) >= 60 ? 'text-green-600' :
                      parseFloat(winPct.replace('%', '')) >= 50 ? 'text-blue-600' :
                      'text-red-500'
                    }`}>
                      {winPct}
                    </span>
                  </td>
                  <td className="px-4 py-4 border-r border-gray-200">
                    <span className="text-gray-600 font-medium">
                      {user.gamesBack === '0.0' ? '-' : user.gamesBack}
                    </span>
                  </td>
                  <td className="px-4 py-4 border-r border-gray-200">
                    {isWinner ? (
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                        <span className="font-bold text-green-700 text-lg bg-green-100 px-3 py-1 rounded-full">
                          ${user.payout.toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400 font-medium">-</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`font-bold text-sm px-2 py-1 rounded-full ${
                      user.rankChange.startsWith('+')
                        ? 'text-green-700 bg-green-100'
                        : user.rankChange.startsWith('-')
                          ? 'text-red-700 bg-red-100'
                          : 'text-gray-600 bg-gray-100'
                    }`}>
                      {user.rankChange}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </>
      )}
    </div>
  );
};

export default Standings; 