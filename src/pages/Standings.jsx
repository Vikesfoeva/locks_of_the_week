import React, { useState, useEffect, useRef } from 'react';
import { Popover, Portal } from '@headlessui/react';
import { FunnelIcon as FunnelIconOutline, ChevronUpIcon, ChevronDownIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { FunnelIcon as FunnelIconSolid } from '@heroicons/react/24/solid';
import FilterModal from '../components/FilterModal';
import { useFilterModal, createFilterButtonProps, createFilterModalProps } from '../hooks/useFilterModal';

const Standings = () => {
  const [standings, setStandings] = useState([]);
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [activeYear, setActiveYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isInitialMount = useRef(true);
  
  // 3-0 Week standings state
  const [viewMode, setViewMode] = useState('regular'); // 'regular' or 'threeZero'
  const [threeZeroStandings, setThreeZeroStandings] = useState([]);
  const [threeZeroData, setThreeZeroData] = useState({
    totalThreeZeroWeeks: 0,
    prizePool: 0
  });

  // Filtering state
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
  
  // Initialize filter modals using the new hook system
  const userNameModal = useFilterModal([], []);
  const rankModal = useFilterModal([], []);
  const winPctModal = useFilterModal([], []);

  // Extract current filter values for compatibility with existing logic
  const userNameFilter = userNameModal.selectedItems;
  const rankFilter = rankModal.selectedItems;
  const winPctFilter = winPctModal.selectedItems;

  // Legend state (keeping this as is since it's not a filter)
  const [legendOpen, setLegendOpen] = useState(false);
  const legendBtnRef = useRef(null);
  const [legendPopoverPosition, setLegendPopoverPosition] = useState({ top: 0, left: 0 });

  const fetchThreeZeroStandings = async (year) => {
    try {
      const response = await fetch(`/api/three-zero-standings?year=${year}`);
      if (!response.ok) throw new Error('Failed to fetch 3-0 week standings');
      const data = await response.json();
      setThreeZeroStandings(data.standings);
      setThreeZeroData({
        totalThreeZeroWeeks: data.totalThreeZeroWeeks,
        prizePool: data.prizePool
      });
    } catch (err) {
      console.error('Error fetching 3-0 week standings:', err);
      setError(err.message);
    }
  };

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

        // 3. Fetch 3-0 week standings
        await fetchThreeZeroStandings(year);
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
    
    const uniqueValues = Array.from(new Set(values)).filter(Boolean);
    
    // Sort numerically for win percentages (highest first), alphabetically for others
    if (key === 'winPct') {
      return uniqueValues.sort((a, b) => {
        const aNum = parseFloat(a.replace('%', ''));
        const bNum = parseFloat(b.replace('%', ''));
        return bNum - aNum; // Reverse order: highest first
      });
    }
    
    return uniqueValues.sort();
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
    // Reset all modal system filters
    userNameModal.handleSelectionChange([]);
    rankModal.handleSelectionChange([]);
    winPctModal.handleSelectionChange([]);
    // Reset sort configuration to default
    setSortConfig({ key: '', direction: 'asc' });
  };

  // Get current data based on view mode
  const currentStandings = viewMode === 'regular' ? standings : threeZeroStandings;

  // Enhance regular standings with 3-0 week data
  const enhancedStandings = viewMode === 'regular' 
    ? standings.map(user => {
        const threeZeroUser = threeZeroStandings.find(tz => tz._id === user._id);
        return {
          ...user,
          threeZeroWeeks: threeZeroUser?.threeZeroWeeks || 0,
          threeZeroPayout: threeZeroUser?.payout || 0
        };
      })
    : threeZeroStandings;

  // Helper function to detect if users are tied
  const getTiedUsers = (standings) => {
    const tieGroups = {};
    standings.forEach(user => {
      if (user.rank !== '-') {
        if (!tieGroups[user.rank]) {
          tieGroups[user.rank] = [];
        }
        tieGroups[user.rank].push(user);
      }
    });
    
    // Return only groups with more than 1 user (actual ties)
    const actualTies = {};
    Object.keys(tieGroups).forEach(rank => {
      if (tieGroups[rank].length > 1) {
        actualTies[rank] = tieGroups[rank];
      }
    });
    
    return actualTies;
  };

  const tiedUsers = getTiedUsers(viewMode === 'regular' ? enhancedStandings : currentStandings);

  // Create filtered datasets for each filter to show only available options
  const baseStandings = viewMode === 'regular' ? enhancedStandings : currentStandings;
  
  const filteredStandingsForUserName = baseStandings.filter(user => {
    const rank = String(user.rank || '');
    const winPct = viewMode === 'regular' ? getWinPct(user) : `${user.percentage || 0}%`;
    
    return (
      (rankFilter.length === 0 || rankFilter.includes(rank)) &&
      (winPctFilter.length === 0 || winPctFilter.includes(winPct))
    );
  });
  
  const filteredStandingsForRank = baseStandings.filter(user => {
    const userName = String(user.name || '');
    const winPct = viewMode === 'regular' ? getWinPct(user) : `${user.percentage || 0}%`;
    
    return (
      (userNameFilter.length === 0 || userNameFilter.includes(userName)) &&
      (winPctFilter.length === 0 || winPctFilter.includes(winPct))
    );
  });
  
  const filteredStandingsForWinPct = baseStandings.filter(user => {
    const userName = String(user.name || '');
    const rank = String(user.rank || '');
    
    return (
      (userNameFilter.length === 0 || userNameFilter.includes(userName)) &&
      (rankFilter.length === 0 || rankFilter.includes(rank))
    );
  });

  // Filter logic for all columns
  const filteredStandings = baseStandings.filter(user => {
    const userName = String(user.name || '');
    const rank = String(user.rank || '');
    const winPct = viewMode === 'regular' ? getWinPct(user) : `${user.percentage || 0}%`;
    
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
      if (viewMode === 'regular') {
        aValue = parseFloat(getWinPct(a).replace('%', ''));
        bValue = parseFloat(getWinPct(b).replace('%', ''));
      } else {
        aValue = a.percentage || 0;
        bValue = b.percentage || 0;
      }
    } else if (key === 'rank') {
      aValue = parseInt(a.rank) || 0;
      bValue = parseInt(b.rank) || 0;
    } else if (key === 'threeZeroWeeks') {
      aValue = a.threeZeroWeeks || 0;
      bValue = b.threeZeroWeeks || 0;
    } else if (key === 'payout') {
      aValue = a.payout || 0;
      bValue = b.payout || 0;
    } else {
      aValue = a[key] ? a[key].toString().toLowerCase() : '';
      bValue = b[key] ? b[key].toString().toLowerCase() : '';
    }
    
    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  // Get unique values for filters based on filtered datasets to show only available options
  const uniqueUserNames = getUniqueValues(filteredStandingsForUserName, 'name');
  const uniqueRanks = viewMode === 'regular' 
    ? getUniqueValues(filteredStandingsForRank, 'rank')
    : filteredStandingsForRank.map((_, index) => String(index + 1)); // Generate ranks for 3-0 view
  const uniqueWinPcts = viewMode === 'regular' 
    ? getUniqueValues(filteredStandingsForWinPct, 'winPct')
    : filteredStandingsForWinPct.map(user => `${user.percentage || 0}%`);



  // Determine if filters are active
  const isUserNameFiltered = userNameModal.isFiltered;
  const isRankFiltered = rankModal.isFiltered;
  const isWinPctFiltered = winPctModal.isFiltered;

  if (loading) return <div className="text-center p-8">Loading standings...</div>;
  if (error) return <div className="text-center p-8 text-red-500">Error: {error}</div>;

  return (
    <div className="max-w-7xl mx-auto p-4">
      {/* Title and Description */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          {viewMode === 'regular' ? 'Overall Standings' : '3-0 Week Standings'} - {activeYear}
        </h1>
        <p className="text-gray-600">
          {viewMode === 'regular' 
            ? 'Complete season performance rankings'
            : `Perfect week achievements (${threeZeroData.totalThreeZeroWeeks} total 3-0 weeks)`
          }
        </p>
      </div>

      {/* Controls Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        {/* Left side - View Mode Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                viewMode === 'regular'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setViewMode('regular')}
            >
              Regular Standings
            </button>
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                viewMode === 'threeZero'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setViewMode('threeZero')}
            >
              3-0 Weeks
            </button>
          </div>
          
          <button
            className="border border-gray-300 text-gray-700 bg-white px-4 py-2 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors duration-200 font-medium"
            onClick={handleResetFilters}
            type="button"
          >
            Reset Filters
          </button>
        </div>

        {/* Right side - Week Selector and Legend */}
        <div className="flex items-center gap-3">
          {viewMode === 'regular' && (
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
          )}
          
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
                            <span className="text-gray-700">Top 5 Finishers</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 bg-purple-400 rounded-full flex-shrink-0"></div>
                            <span className="text-gray-700">Tied Users (prize split)</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                            <span className="text-gray-700">Season Prize Winner</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                            <span className="text-gray-700">3-0 Week Prize Winner</span>
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
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-purple-600 font-medium flex-shrink-0">T3</span>
                            <span className="text-gray-700">Tied with 3 users</span>
                          </div>
                        </div>
                      </Popover.Panel>
                    )}
                  </Portal>
                </>
              );
            }}
          </Popover>
        </div>
      </div>
      {currentStandings.length === 0 ? (
        <div className="text-center p-8">
          {viewMode === 'regular' ? 'No standings data available for this week.' : 'No 3-0 week data available.'}
        </div>
      ) : (
      <>
        {viewMode === 'regular' ? (
          // Regular standings table
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
                  <button
                    {...createFilterButtonProps(rankModal, uniqueRanks, (selectedRanks) => {
                      rankModal.handleSelectionChange(selectedRanks);
                    }, {
                      IconComponent: FunnelIconOutline,
                      IconComponentSolid: FunnelIconSolid,
                    })}
                  />
                </div>
              </th>
              <th className="px-4 py-4 text-left border-r border-gray-200">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">Name</span>
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
                  <button
                    {...createFilterButtonProps(userNameModal, uniqueUserNames, (selectedUserNames) => {
                      userNameModal.handleSelectionChange(selectedUserNames);
                    }, {
                      IconComponent: FunnelIconOutline,
                      IconComponentSolid: FunnelIconSolid,
                    })}
                  />
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
                  <button
                    {...createFilterButtonProps(winPctModal, uniqueWinPcts, (selectedWinPcts) => {
                      winPctModal.handleSelectionChange(selectedWinPcts);
                    }, {
                      IconComponent: FunnelIconOutline,
                      IconComponentSolid: FunnelIconSolid,
                    })}
                  />
                </div>
              </th>
              <th className="px-4 py-4 text-left border-r border-gray-200">
                <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">WB</span>
              </th>
              <th className="px-4 py-4 text-left border-r border-gray-200">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">3-0 Weeks</span>
                  <div className="flex flex-col ml-1">
                    <ChevronUpIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'threeZeroWeeks' && sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); handleSort('threeZeroWeeks'); }}
                    />
                    <ChevronDownIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'threeZeroWeeks' && sortConfig.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); handleSort('threeZeroWeeks'); }}
                    />
                  </div>
                </div>
              </th>
              <th className="px-4 py-4 text-left border-r border-gray-200">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">3-0 Payout</span>
                  <div className="flex flex-col ml-1">
                    <ChevronUpIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'threeZeroPayout' && sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); handleSort('threeZeroPayout'); }}
                    />
                    <ChevronDownIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'threeZeroPayout' && sortConfig.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); handleSort('threeZeroPayout'); }}
                    />
                  </div>
                </div>
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
              const isTopFive = user.rank <= 5;
              const isWinner = user.payout > 0;
              const isLastPlace = user.rank === standings.length;
              const isTied = tiedUsers[user.rank] && tiedUsers[user.rank].length > 1;
              const tiedCount = isTied ? tiedUsers[user.rank].length : 0;
              
              // Determine row styling based on performance
              let rowClassName = 'hover:bg-blue-50 transition-colors duration-200';
              if (isTopFive) {
                rowClassName += ' bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-l-yellow-400';
              } else if (isLastPlace) {
                rowClassName += ' bg-gradient-to-r from-red-50 to-pink-50 border-l-4 border-l-red-400';
              } else if (isTied) {
                rowClassName += ' bg-gradient-to-r from-purple-50 to-indigo-50 border-l-4 border-l-purple-400';
              } else if (idx % 2 === 0) {
                rowClassName += ' bg-white';
              } else {
                rowClassName += ' bg-gray-50';
              }
              
              return (
                <tr key={user._id} className={rowClassName}>
                  <td className="px-4 py-4 border-r border-gray-200">
                    <div className="flex items-center">
                      {isTopFive && (
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2 ${
                          user.rank === 1 ? 'bg-yellow-500' : 
                          user.rank === 2 ? 'bg-gray-400' : 
                          user.rank === 3 ? 'bg-amber-600' :
                          user.rank === 4 ? 'bg-blue-500' :
                          'bg-green-500'
                        }`}>
                          {user.rank}
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className={`font-bold text-lg ${isTopFive ? 'text-gray-800' : 'text-gray-600'}`}>
                          {!isTopFive && user.rank}
                        </span>
                        {isTied && (
                          <span className="text-xs text-purple-600 font-medium">
                            T{tiedCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 border-r border-gray-200">
                    <span className={`font-medium ${isTopFive ? 'text-gray-800 text-lg' : 'text-gray-700'}`}>
                      {user.name}
                    </span>
                  </td>
                  <td className="px-4 py-4 border-r border-gray-200">
                    <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded whitespace-nowrap">
                      {`${user.wins}-${user.losses}-${user.ties}`}
                    </span>
                  </td>
                  <td className="px-4 py-4 border-r border-gray-200">
                    <span className="font-mono text-xs text-gray-600 whitespace-nowrap">
                      {weekRecord}
                    </span>
                  </td>
                  <td className="px-4 py-4 border-r border-gray-200">
                    <span className="font-semibold text-sm text-gray-700">
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
                    <span className="text-gray-600 font-medium text-sm">
                      {user.gamesBack === '0.0' ? '-' : user.gamesBack}
                    </span>
                  </td>
                  <td className="px-4 py-4 border-r border-gray-200">
                    <span className={`font-bold text-base ${
                      user.threeZeroWeeks > 0 ? 'text-blue-600' : 'text-gray-400'
                    }`}>
                      {user.threeZeroWeeks || 0}
                    </span>
                  </td>
                  <td className="px-4 py-4 border-r border-gray-200">
                    {user.threeZeroPayout > 0 ? (
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                        <span className="font-bold text-blue-700 text-base bg-blue-100 px-2 py-1 rounded-full">
                          ${user.threeZeroPayout.toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400 font-medium">-</span>
                    )}
                  </td>
                  <td className="px-4 py-4 border-r border-gray-200">
                    {isWinner ? (
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                        <div className="flex flex-col">
                          <span className="font-bold text-green-700 text-base bg-green-100 px-2 py-1 rounded-full">
                            ${user.payout.toFixed(2)}
                          </span>
                          {isTied && (
                            <span className="text-xs text-purple-600 font-medium mt-1">
                              Split {tiedCount} ways
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 font-medium">-</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`font-bold text-xs px-2 py-1 rounded-full ${
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
        ) : (
          // 3-0 Week standings table
          <div className="overflow-x-auto shadow-lg rounded-xl border border-gray-200">
            <table className="min-w-full bg-white">
              <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200">
                <tr>
                  <th className="px-4 py-4 text-left border-r border-gray-200">
                    <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">Rank</span>
                  </th>
                  <th className="px-4 py-4 text-left border-r border-gray-200">
                    <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">Name</span>
                  </th>
                  <th className="px-4 py-4 text-left border-r border-gray-200">
                    <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">3-0 Weeks</span>
                  </th>
                  <th className="px-4 py-4 text-left border-r border-gray-200">
                    <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">Percentage</span>
                  </th>
                  <th className="px-4 py-4 text-left">
                    <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">Payout</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedStandings.map((user, idx) => {
                  const rank = idx + 1;
                  const isTopFive = rank <= 5;
                  const hasEarnings = user.payout > 0;
                  
                  // Determine row styling
                  let rowClassName = 'hover:bg-blue-50 transition-colors duration-200';
                  if (isTopFive && user.threeZeroWeeks > 0) {
                    rowClassName += ' bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-l-yellow-400';
                  } else if (idx % 2 === 0) {
                    rowClassName += ' bg-white';
                  } else {
                    rowClassName += ' bg-gray-50';
                  }
                  
                  return (
                    <tr key={user._id} className={rowClassName}>
                      <td className="px-4 py-4 border-r border-gray-200">
                        <div className="flex items-center">
                          {isTopFive && user.threeZeroWeeks > 0 && (
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2 ${
                              rank === 1 ? 'bg-yellow-500' : 
                              rank === 2 ? 'bg-gray-400' : 
                              rank === 3 ? 'bg-amber-600' :
                              rank === 4 ? 'bg-blue-500' :
                              'bg-green-500'
                            }`}>
                              {rank}
                            </div>
                          )}
                          <span className={`font-bold text-lg ${isTopFive && user.threeZeroWeeks > 0 ? 'text-gray-800' : 'text-gray-600'}`}>
                            {(!isTopFive || user.threeZeroWeeks === 0) && rank}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 border-r border-gray-200">
                        <span className={`font-medium ${isTopFive && user.threeZeroWeeks > 0 ? 'text-gray-800 text-lg' : 'text-gray-700'}`}>
                          {user.name}
                        </span>
                      </td>
                      <td className="px-4 py-4 border-r border-gray-200">
                        <span className="font-bold text-lg text-blue-600">
                          {user.threeZeroWeeks || 0}
                        </span>
                      </td>
                      <td className="px-4 py-4 border-r border-gray-200">
                        <span className={`font-bold text-lg ${
                          user.percentage >= 20 ? 'text-green-600' :
                          user.percentage >= 10 ? 'text-blue-600' :
                          'text-gray-500'
                        }`}>
                          {user.percentage?.toFixed(1) || '0.0'}%
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {hasEarnings ? (
                          <div className="flex items-center">
                            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                            <span className="font-bold text-green-700 text-lg bg-green-100 px-3 py-1 rounded-full">
                              ${user.payout?.toFixed(2) || '0.00'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 font-medium">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Summary info for 3-0 weeks */}
        {viewMode === 'threeZero' && (
          <div className="mt-4 bg-blue-50 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{threeZeroData.totalThreeZeroWeeks}</div>
                <div className="text-sm text-gray-600">Total 3-0 Weeks</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">${threeZeroData.prizePool.toFixed(2)}</div>
                <div className="text-sm text-gray-600">Total Prize Pool</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {threeZeroStandings.filter(user => user.threeZeroWeeks > 0).length}
                </div>
                <div className="text-sm text-gray-600">Users with 3-0 Weeks</div>
              </div>
            </div>
          </div>
        )}
      </>
      )}

      {/* Filter Modals */}
      <FilterModal
        {...createFilterModalProps(rankModal, uniqueRanks, (selectedRanks) => {
          rankModal.handleSelectionChange(selectedRanks);
        }, {
          title: 'Filter Rank',
          placement: 'bottom-start',
        })}
      />

      <FilterModal
        {...createFilterModalProps(userNameModal, uniqueUserNames, (selectedUserNames) => {
          userNameModal.handleSelectionChange(selectedUserNames);
        }, {
          title: 'Filter Name',
          placement: 'bottom-start',
        })}
      />

      <FilterModal
        {...createFilterModalProps(winPctModal, uniqueWinPcts, (selectedWinPcts) => {
          winPctModal.handleSelectionChange(selectedWinPcts);
        }, {
          title: 'Filter Win %',
          placement: 'bottom-start',
        })}
      />
    </div>
  );
};

export default Standings; 