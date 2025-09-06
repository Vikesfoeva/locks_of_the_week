import React, { useState, useEffect, useRef } from 'react';
import { Popover, Portal } from '@headlessui/react';
import { FunnelIcon as FunnelIconOutline, ChevronUpIcon, ChevronDownIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { FunnelIcon as FunnelIconSolid } from '@heroicons/react/24/solid';
import FilterModal from '../components/FilterModal';
import { useFilterModal, createFilterButtonProps, createFilterModalProps } from '../hooks/useFilterModal';

// Component for user name buttons with conditional clickability
const UserNameButton = ({ user, isTopFive, onPicksClick, checkPicksComplete }) => {
  const [hasCompletePicks, setHasCompletePicks] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  const handleClick = async () => {
    if (isChecking) return;
    
    setIsChecking(true);
    try {
      const isComplete = await checkPicksComplete();
      setHasCompletePicks(isComplete);
      
      if (isComplete) {
        onPicksClick();
      }
    } catch (err) {
      console.error('Error checking picks completeness:', err);
      setHasCompletePicks(false);
    } finally {
      setIsChecking(false);
    }
  };

  const baseClasses = `font-medium text-left ${isTopFive ? 'text-gray-800 text-xs md:text-lg' : 'text-gray-700 text-xs md:text-base'}`;
  
  if (hasCompletePicks === null || hasCompletePicks) {
    // Clickable - either we haven't checked yet or user has complete picks
    return (
      <button
        onClick={handleClick}
        disabled={isChecking}
        className={`${baseClasses} hover:underline cursor-pointer hover:text-blue-600 ${isChecking ? 'opacity-50' : ''}`}
        title={hasCompletePicks === null ? "Click to view picks" : "View picks"}
      >
        {user.name}
      </button>
    );
  } else {
    // Not clickable - user hasn't submitted all picks
    return (
      <span 
        className={`${baseClasses} opacity-60 cursor-not-allowed`}
        title="User hasn't submitted all picks for this week"
      >
        {user.name}
      </span>
    );
  }
};

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
  const [sortConfig, setSortConfig] = useState({ key: 'rank', direction: 'asc' });
  
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

  // User picks popup state
  const [picksPopupOpen, setPicksPopupOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPicks, setUserPicks] = useState([]);
  const [picksLoading, setPicksLoading] = useState(false);



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

  // Check if user has completed their picks (3 picks) for the week
  const checkUserPicksComplete = async (userId) => {
    if (!selectedWeek || !activeYear) return false;
    
    try {
      const response = await fetch(`/api/picks?userId=${userId}&collectionName=${selectedWeek}&year=${activeYear}`);
      if (!response.ok) return false;
      const data = await response.json();
      return data.length >= 3; // User has submitted all required picks
    } catch (err) {
      console.error('Error checking user picks:', err);
      return false;
    }
  };

  const fetchUserPicks = async (userId, userName) => {
    if (!selectedWeek || !activeYear) return;
    
    setPicksLoading(true);
    setSelectedUser({ id: userId, name: userName });
    setPicksPopupOpen(true);
    
    try {
      const response = await fetch(`/api/picks?userId=${userId}&collectionName=${selectedWeek}&year=${activeYear}`);
      if (!response.ok) throw new Error('Failed to fetch user picks');
      const data = await response.json();
      console.log('Raw picks data:', data);
      if (data.length > 0) {
        console.log('First pick structure:', data[0]);
        console.log('Game details:', data[0].gameDetails);
      }
      setUserPicks(data || []);
    } catch (err) {
      console.error('Error fetching user picks:', err);
      setUserPicks([]);
    } finally {
      setPicksLoading(false);
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
    // Reset all modal system filters using resetFilter to clear both selectedItems and appliedItems
    userNameModal.resetFilter();
    rankModal.resetFilter();
    winPctModal.resetFilter();
    // Reset sort configuration to default (rank ascending)
    setSortConfig({ key: 'rank', direction: 'asc' });
    // Reset view mode to default (regular standings)
    setViewMode('regular');
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

  // Helper function to detect ties in 3-0 week standings based on threeZeroWeeks value
  const getTiedUsersThreeZero = (standings) => {
    const tieGroups = {};
    const rankMap = {}; // Map to track what rank each threeZeroWeeks value should get
    
    // Group users by threeZeroWeeks value and assign ranks
    standings.forEach((user, index) => {
      const threeZeroWeeks = user.threeZeroWeeks || 0;
      if (!tieGroups[threeZeroWeeks]) {
        tieGroups[threeZeroWeeks] = [];
        // Find the first occurrence of this threeZeroWeeks value to determine rank
        const firstIndex = standings.findIndex(u => (u.threeZeroWeeks || 0) === threeZeroWeeks);
        rankMap[threeZeroWeeks] = firstIndex + 1;
      }
      tieGroups[threeZeroWeeks].push({ ...user, effectiveRank: rankMap[threeZeroWeeks] });
    });
    
    // Return only groups with more than 1 user (actual ties) mapped by effective rank
    const actualTies = {};
    Object.keys(tieGroups).forEach(threeZeroWeeks => {
      if (tieGroups[threeZeroWeeks].length > 1) {
        const effectiveRank = rankMap[threeZeroWeeks];
        actualTies[effectiveRank] = tieGroups[threeZeroWeeks];
      }
    });
    
    return actualTies;
  };

  const tiedUsers = viewMode === 'regular' 
    ? getTiedUsers(enhancedStandings) 
    : getTiedUsersThreeZero(currentStandings);

  // Calculate league averages for the current standings
  const calculateAverages = (standings) => {
    if (standings.length === 0) return { avgWins: 0, avgLosses: 0, avgTies: 0, avgPercentage: 0 };
    
    const totals = standings.reduce((acc, user) => {
      acc.wins += user.wins || 0;
      acc.losses += user.losses || 0;
      acc.ties += user.ties || 0;
      return acc;
    }, { wins: 0, losses: 0, ties: 0 });
    
    const avgWins = (totals.wins / standings.length).toFixed(1);
    const avgLosses = (totals.losses / standings.length).toFixed(1);
    const avgTies = (totals.ties / standings.length).toFixed(1);
    
    // Calculate average percentage
    const totalGames = parseFloat(avgWins) + parseFloat(avgLosses) + parseFloat(avgTies);
    const winPoints = parseFloat(avgWins) + 0.5 * parseFloat(avgTies);
    const avgPercentage = totalGames > 0 ? ((winPoints / totalGames) * 100).toFixed(1) : '0.0';
    
    return { avgWins, avgLosses, avgTies, avgPercentage };
  };

  const leagueAverages = calculateAverages(viewMode === 'regular' ? enhancedStandings : currentStandings);

  // Calculate league totals for the current standings
  const calculateTotals = (standings) => {
    if (standings.length === 0) return { totalWins: 0, totalLosses: 0, totalTies: 0, totalPercentage: 0 };
    
    const totals = standings.reduce((acc, user) => {
      acc.wins += user.wins || 0;
      acc.losses += user.losses || 0;
      acc.ties += user.ties || 0;
      return acc;
    }, { wins: 0, losses: 0, ties: 0 });
    
    // Calculate total percentage
    const totalGames = totals.wins + totals.losses + totals.ties;
    const winPoints = totals.wins + 0.5 * totals.ties;
    const totalPercentage = totalGames > 0 ? ((winPoints / totalGames) * 100).toFixed(1) : '0.0';
    
    return { 
      totalWins: totals.wins, 
      totalLosses: totals.losses, 
      totalTies: totals.ties, 
      totalPercentage 
    };
  };

  const leagueTotals = calculateTotals(viewMode === 'regular' ? enhancedStandings : currentStandings);

  // Find the index where users transition from above average to below average
  const findAverageSeparatorIndex = (standings) => {
    if (standings.length === 0) return -1;
    
    const avgPercentage = parseFloat(leagueAverages.avgPercentage);
    
    for (let i = 0; i < standings.length; i++) {
      const userPercentage = viewMode === 'regular' 
        ? parseFloat(getWinPct(standings[i]).replace('%', ''))
        : standings[i].percentage || 0;
      
      // Find the first user who is below average
      if (userPercentage < avgPercentage) {
        return i; // Insert separator before this user
      }
    }
    
    return -1; // All users are above average
  };

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
    
    // Primary sort comparison
    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    
    // Secondary sort: alphabetical by username when primary values are equal (ties)
    const aName = (a.name || '').toString().toLowerCase();
    const bName = (b.name || '').toString().toLowerCase();
    if (aName < bName) return -1;
    if (aName > bName) return 1;
    
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
    <div className="max-w-7xl mx-auto px-2 py-2 md:p-4">
      {/* Title and Description */}
      <div className="text-center mb-4 md:mb-6">
        <h1 className="text-xl md:text-3xl font-bold text-gray-800 mb-1 md:mb-2">
          {viewMode === 'regular' ? 'Overall Standings' : '3-0 Week Standings'} - {activeYear}
        </h1>
        {/* <p className="text-sm md:text-base text-gray-600">
          {viewMode === 'regular' 
            ? 'Complete season performance rankings'
            : `Total 3-0 Weeks`
          }
        </p> */}
      </div>

      {/* Controls Row */}
      <div className="flex flex-row items-center justify-between mb-4 md:mb-6 gap-2 md:gap-4">
        {/* Left side - View Mode Toggle */}
        <div className="flex items-center gap-1 md:gap-3 flex-shrink-1">
          <div className="flex bg-gray-100 rounded-lg p-0.5 md:p-1">
            <button
              className={`px-2 py-1 md:px-4 md:py-2 rounded-md text-xs md:text-sm font-medium transition-colors duration-200 ${
                viewMode === 'regular'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setViewMode('regular')}
            >
              <span className="md:hidden">Regular</span>
              <span className="hidden md:inline">Regular Standings</span>
            </button>
            <button
              className={`px-2 py-1 md:px-4 md:py-2 rounded-md text-xs md:text-sm font-medium transition-colors duration-200 ${
                viewMode === 'threeZero'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setViewMode('threeZero')}
            >
              <span className="md:hidden">3-0</span>
              <span className="hidden md:inline">3-0 Weeks</span>
            </button>
          </div>
          
          <button
            className="hidden md:block border border-gray-300 text-gray-700 bg-white px-4 py-2 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors duration-200 text-sm font-medium"
            onClick={handleResetFilters}
            type="button"
          >
            Reset Filters
          </button>
          

        </div>

        {/* Right side - Week Selector and Legend */}
        <div className="flex items-center gap-1 md:gap-3 flex-shrink-0">
          {viewMode === 'regular' && (
            <div className="flex items-center gap-1">
              <label htmlFor="week-select" className="text-xs md:text-sm font-medium text-gray-700 whitespace-nowrap">Week:</label>
              <select
                id="week-select"
                value={selectedWeek || ''}
                onChange={e => setSelectedWeek(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1 md:px-3 md:py-2 text-xs md:text-sm bg-white hover:border-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors duration-200 min-w-0"
                disabled={availableWeeks.length === 0}
              >
                {(() => {
                  const reversedWeeks = availableWeeks.slice().reverse();
                  return reversedWeeks.map((week, reversedIndex) => {
                    const parts = week.split('_');
                    // parts[1] is year, parts[2] is month, parts[3] is day
                    const date = new Date(parts[1], parts[2] - 1, parts[3]);
                    const formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(2)}`;
                    const originalIndex = availableWeeks.length - 1 - reversedIndex;
                    const isCurrentWeek = reversedIndex === 0; // First item after reverse is most recent
                    
                    return [
                      // Add separator after current week
                      reversedIndex === 1 && <option key="separator" disabled style={{ borderTop: '1px solid #d1d5db', color: '#6b7280', fontStyle: 'italic' }}>— Previous Weeks —</option>,
                      <option 
                        key={week} 
                        value={week}
                        style={{
                          color: isCurrentWeek ? '#111827' : '#6b7280',
                          fontWeight: isCurrentWeek ? '600' : '400'
                        }}
                      >
                        Week {originalIndex + 1} - {formattedDate}
                      </option>
                    ].filter(Boolean);
                  }).flat();
                })()}
              </select>
            </div>
          )}
          
          <Popover as="span" className="relative hidden md:inline-block">
            {({ open, close }) => {
              return (
                <>
                  <Popover.Button
                    ref={legendBtnRef}
                    className="flex items-center gap-2 border border-gray-300 text-gray-700 bg-white px-3 py-2 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors duration-200 text-sm font-medium"
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
                            <span className="text-xs text-purple-600 font-medium flex-shrink-0">T-3</span>
                            <span className="text-gray-700">Tied at rank 3</span>
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
          <div className="shadow-lg rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full bg-white text-sm md:text-base table-fixed md:table-auto min-w-full">
            <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200">
              <tr>
              <th className="px-1 py-2 md:px-4 md:py-4 text-left border-r border-gray-200 w-[15%] md:w-auto">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-gray-800 text-xs md:text-sm uppercase tracking-wide">Rank</span>
                  {/* Hide sort/filter controls on mobile */}
                  <div className="hidden md:flex flex-col ml-1">
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
                      className: "hidden md:block ml-1 p-1 rounded hover:bg-gray-200 transition-colors"
                    })}
                  />
                </div>
              </th>
              <th className="px-1 py-2 md:px-4 md:py-4 text-left border-r border-gray-200 w-[25%] md:w-auto">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-gray-800 text-xs md:text-sm uppercase tracking-wide">Name</span>
                  {/* Hide sort/filter controls on mobile */}
                  <div className="hidden md:flex flex-col ml-1">
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
                      className: "hidden md:block ml-1 p-1 rounded hover:bg-gray-200 transition-colors"
                    })}
                  />
                </div>
              </th>
              <th className="px-1 py-2 md:px-4 md:py-4 text-left border-r border-gray-200 w-[20%] md:w-auto">
                <span className="font-bold text-gray-800 text-xs md:text-sm uppercase tracking-wide">W-L-T</span>
              </th>
              <th className="px-1 py-2 md:px-4 md:py-4 text-left border-r border-gray-200 w-[15%] md:w-auto">
                <span className="font-bold text-gray-800 text-xs md:text-sm uppercase tracking-wide">Week</span>
              </th>
              <th className="px-2 py-2 md:px-4 md:py-4 text-left border-r border-gray-200 hidden md:table-cell">
                <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">Total</span>
              </th>
              <th className="px-2 py-2 md:px-4 md:py-4 text-left border-r border-gray-200 hidden md:table-cell">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">Win %</span>
                  {/* Hide sort/filter controls on mobile */}
                  <div className="hidden md:flex flex-col ml-1">
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
                      className: "hidden md:block ml-1 p-1 rounded hover:bg-gray-200 transition-colors"
                    })}
                  />
                </div>
              </th>
              <th className="px-2 py-2 md:px-4 md:py-4 text-left border-r border-gray-200 hidden md:table-cell">
                <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">WB</span>
              </th>
              <th className="px-2 py-2 md:px-4 md:py-4 text-left border-r border-gray-200 hidden md:table-cell">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">3-0 Weeks</span>
                  {/* Hide sort/filter controls on mobile */}
                  <div className="hidden md:flex flex-col ml-1">
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
              <th className="px-2 py-2 md:px-4 md:py-4 text-left border-r border-gray-200 hidden md:table-cell">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">3-0 Payout</span>
                  {/* Hide sort/filter controls on mobile */}
                  <div className="hidden md:flex flex-col ml-1">
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
              <th className="px-1 py-2 md:px-4 md:py-4 text-left border-r border-gray-200 w-[25%] md:w-auto">
                <span className="font-bold text-gray-800 text-xs md:text-sm uppercase tracking-wide">Projected Payout</span>
              </th>
              <th className="px-2 py-2 md:px-4 md:py-4 text-left hidden md:table-cell">
                <span className="font-bold text-gray-800 text-sm uppercase tracking-wide">Rank Δ</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(() => {
              const separatorIndex = findAverageSeparatorIndex(sortedStandings);
              const rows = [];
              
              sortedStandings.forEach((user, idx) => {
                // Insert separator before this user if they're the first below-average user
                if (idx === separatorIndex && separatorIndex > 0) {
                  rows.push(
                    <tr key={`separator-${idx}`} className="bg-gradient-to-r from-blue-100 to-indigo-100 border-t-2 border-b-2 border-blue-300">
                      <td colSpan="11" className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="flex-1 h-px bg-blue-300"></div>
                          <span className="text-sm font-bold text-blue-700 px-3 py-1 bg-white rounded-full border-2 border-blue-300">
                            League Average: {leagueAverages.avgPercentage}%
                          </span>
                          <div className="flex-1 h-px bg-blue-300"></div>
                        </div>
                        {/* <div className="text-xs text-blue-600 mt-1">
                          Above Average ↑ • Below Average ↓
                        </div> */}
                      </td>
                    </tr>
                  );
                }
                
                // Add the regular user row
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
                
                const userRow = (
                  <tr key={user._id} className={rowClassName}>
                  <td className="px-1 py-2 md:px-4 md:py-4 border-r border-gray-200">
                    <div className="flex items-center">
                      {isTopFive && (
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2 ${
                          user.rank === 1 ? 'bg-yellow-500' : 
                          user.rank === 2 ? 'bg-gray-400' : 
                          user.rank === 3 ? 'bg-amber-600' :
                          user.rank === 4 ? 'bg-blue-500' :
                          'bg-green-500'
                        }`}>
                          {isTied ? `T-${user.rank}` : user.rank}
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className={`font-bold text-sm md:text-lg ${isTopFive ? 'text-gray-800' : 'text-gray-600'}`}>
                          {!isTopFive && (isTied ? `T-${user.rank}` : user.rank)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-1 py-2 md:px-4 md:py-4 border-r border-gray-200">
                    {user.firebaseUid ? (
                      <UserNameButton 
                        user={user}
                        isTopFive={isTopFive}
                        onPicksClick={() => fetchUserPicks(user.firebaseUid, user.name)}
                        checkPicksComplete={() => checkUserPicksComplete(user.firebaseUid)}
                      />
                    ) : (
                      <span className={`font-medium ${isTopFive ? 'text-gray-800 text-xs md:text-lg' : 'text-gray-700 text-xs md:text-base'}`}>
                        {user.name}
                      </span>
                    )}
                  </td>
                  <td className="px-1 py-2 md:px-4 md:py-4 border-r border-gray-200">
                    <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded whitespace-nowrap">
                      {`${user.wins}-${user.losses}-${user.ties}`}
                    </span>
                  </td>
                  <td className="px-1 py-2 md:px-4 md:py-4 border-r border-gray-200">
                    <span className="font-mono text-xs text-gray-600 whitespace-nowrap">
                      {weekRecord}
                    </span>
                  </td>
                  <td className="px-1 py-2 md:px-4 md:py-4 border-r border-gray-200 hidden md:table-cell">
                    <span className="font-semibold text-sm text-gray-700">
                      {totalLocks}
                    </span>
                  </td>
                  <td className="px-1 py-2 md:px-4 md:py-4 border-r border-gray-200 hidden md:table-cell">
                    <span className={`font-bold text-sm md:text-lg ${
                      parseFloat(winPct.replace('%', '')) >= 60 ? 'text-green-600' :
                      parseFloat(winPct.replace('%', '')) >= 50 ? 'text-blue-600' :
                      'text-red-500'
                    }`}>
                      {winPct}
                    </span>
                  </td>
                  <td className="px-1 py-2 md:px-4 md:py-4 border-r border-gray-200 hidden md:table-cell">
                    <span className="text-gray-600 font-medium text-sm">
                      {user.gamesBack === '0.0' ? '-' : user.gamesBack}
                    </span>
                  </td>
                  <td className="px-1 py-2 md:px-4 md:py-4 border-r border-gray-200 hidden md:table-cell">
                    <span className={`font-bold text-sm md:text-base ${
                      user.threeZeroWeeks > 0 ? 'text-blue-600' : 'text-gray-400'
                    }`}>
                      {user.threeZeroWeeks || 0}
                    </span>
                  </td>
                  <td className="px-1 py-2 md:px-4 md:py-4 border-r border-gray-200 hidden md:table-cell">
                    {user.threeZeroPayout > 0 ? (
                      <span className="font-bold text-blue-700 text-xs md:text-base bg-blue-100 px-1 md:px-2 py-1 rounded-full">
                        ${user.threeZeroPayout.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-gray-400 font-medium">-</span>
                    )}
                  </td>
                  <td className="px-1 py-2 md:px-4 md:py-4 border-r border-gray-200">
                    {isWinner ? (
                      <span className="font-bold text-green-700 text-base bg-green-100 px-2 py-1 rounded-full">
                        ${user.payout.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-gray-400 font-medium">-</span>
                    )}
                  </td>
                  <td className="px-1 py-2 md:px-4 md:py-4 hidden md:table-cell">
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
                
                rows.push(userRow);
              });
              
              return rows;
            })()}

          </tbody>
          </table>
          </div>
        ) : (
          // 3-0 Week standings table
          <div className="shadow-lg rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full bg-white text-sm md:text-base table-fixed md:table-auto min-w-full">
              <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200">
                <tr>
                  <th className="px-1 py-2 md:px-4 md:py-4 text-left border-r border-gray-200 w-[15%] md:w-auto">
                    <span className="font-bold text-gray-800 text-xs md:text-sm uppercase tracking-wide">Rank</span>
                  </th>
                  <th className="px-1 py-2 md:px-4 md:py-4 text-left border-r border-gray-200 w-[25%] md:w-auto">
                    <span className="font-bold text-gray-800 text-xs md:text-sm uppercase tracking-wide">Name</span>
                  </th>
                  <th className="px-1 py-2 md:px-4 md:py-4 text-left border-r border-gray-200 w-[20%] md:w-auto">
                    <span className="font-bold text-gray-800 text-xs md:text-sm uppercase tracking-wide">3-0 Weeks</span>
                  </th>
                  <th className="px-1 py-2 md:px-4 md:py-4 text-left border-r border-gray-200 hidden md:table-cell">
                    <span className="font-bold text-gray-800 text-xs md:text-sm uppercase tracking-wide">Percentage</span>
                  </th>
                  <th className="px-1 py-2 md:px-4 md:py-4 text-left w-[40%] md:w-auto">
                    <span className="font-bold text-gray-800 text-xs md:text-sm uppercase tracking-wide">Payout</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(() => {
                  const separatorIndex = findAverageSeparatorIndex(sortedStandings);
                  const rows = [];
                  
                  sortedStandings.forEach((user, idx) => {
                    // Insert separator before this user if they're the first below-average user
                    if (idx === separatorIndex && separatorIndex > 0) {
                      const avgPercentage = currentStandings.length > 0 
                        ? (currentStandings.reduce((sum, user) => sum + (user.percentage || 0), 0) / currentStandings.length).toFixed(1)
                        : '0.0';
                      
                      rows.push(
                        <tr key={`separator-${idx}`} className="bg-gradient-to-r from-blue-100 to-indigo-100 border-t-2 border-b-2 border-blue-300">
                          <td colSpan="5" className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="flex-1 h-px bg-blue-300"></div>
                              <span className="text-sm font-bold text-blue-700 px-3 py-1 bg-white rounded-full border-2 border-blue-300">
                                League Average: {avgPercentage}%
                              </span>
                              <div className="flex-1 h-px bg-blue-300"></div>
                            </div>
                            <div className="text-xs text-blue-600 mt-1">
                              Above Average ↑ • Below Average ↓
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    
                    // Add the regular user row
                    const rank = idx + 1;
                    const isTopFive = rank <= 5;
                    const hasEarnings = user.payout > 0;
                    
                    // Check if this user is tied based on threeZeroWeeks value
                    // Find the effective rank (first occurrence rank) for tie detection
                    const threeZeroWeeks = user.threeZeroWeeks || 0;
                    const firstIndex = sortedStandings.findIndex(u => (u.threeZeroWeeks || 0) === threeZeroWeeks);
                    const effectiveRank = firstIndex + 1;
                    const isTied = tiedUsers[effectiveRank] && tiedUsers[effectiveRank].length > 1;
                    
                    // Determine row styling
                    let rowClassName = 'hover:bg-blue-50 transition-colors duration-200';
                    if (isTopFive && user.threeZeroWeeks > 0) {
                      rowClassName += ' bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-l-yellow-400';
                    } else if (idx % 2 === 0) {
                      rowClassName += ' bg-white';
                    } else {
                      rowClassName += ' bg-gray-50';
                    }
                    
                    const userRow = (
                      <tr key={user._id} className={rowClassName}>
                      <td className="px-1 py-2 md:px-4 md:py-4 border-r border-gray-200">
                        <div className="flex items-center">
                          {isTopFive && user.threeZeroWeeks > 0 && (
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2 ${
                              effectiveRank === 1 ? 'bg-yellow-500' : 
                              effectiveRank === 2 ? 'bg-gray-400' : 
                              effectiveRank === 3 ? 'bg-amber-600' :
                              effectiveRank === 4 ? 'bg-blue-500' :
                              'bg-green-500'
                            }`}>
                              {isTied ? `T-${effectiveRank}` : effectiveRank}
                            </div>
                          )}
                          <span className={`font-bold text-sm md:text-lg ${isTopFive && user.threeZeroWeeks > 0 ? 'text-gray-800' : 'text-gray-600'}`}>
                            {(!isTopFive || user.threeZeroWeeks === 0) && (isTied ? `T-${effectiveRank}` : effectiveRank)}
                          </span>
                        </div>
                      </td>
                      <td className="px-1 py-2 md:px-4 md:py-4 border-r border-gray-200">
                        {user.firebaseUid ? (
                          <UserNameButton 
                            user={user}
                            isTopFive={isTopFive && user.threeZeroWeeks > 0}
                            onPicksClick={() => fetchUserPicks(user.firebaseUid, user.name)}
                            checkPicksComplete={() => checkUserPicksComplete(user.firebaseUid)}
                          />
                        ) : (
                          <span className={`font-medium ${isTopFive && user.threeZeroWeeks > 0 ? 'text-gray-800 text-xs md:text-lg' : 'text-gray-700 text-xs md:text-base'}`}>
                            {user.name}
                          </span>
                        )}
                      </td>
                      <td className="px-1 py-2 md:px-4 md:py-4 border-r border-gray-200">
                        <span className="font-bold text-sm md:text-lg text-blue-600">
                          {user.threeZeroWeeks || 0}
                        </span>
                      </td>
                      <td className="px-1 py-2 md:px-4 md:py-4 border-r border-gray-200 hidden md:table-cell">
                        <span className={`font-bold text-sm md:text-lg ${
                          user.percentage >= 20 ? 'text-green-600' :
                          user.percentage >= 10 ? 'text-blue-600' :
                          'text-gray-500'
                        }`}>
                          {user.percentage?.toFixed(1) || '0.0'}%
                        </span>
                      </td>
                      <td className="px-1 py-2 md:px-4 md:py-4">
                        {hasEarnings ? (
                          <span className="font-bold text-green-700 text-lg bg-green-100 px-3 py-1 rounded-full">
                            ${user.payout?.toFixed(2) || '0.00'}
                          </span>
                        ) : (
                          <span className="text-gray-400 font-medium">-</span>
                        )}
                      </td>
                    </tr>
                    );
                    
                    rows.push(userRow);
                  });
                  
                  return rows;
                })()}

              </tbody>
            </table>
          </div>
        )}

        {/* League Statistics Section */}
        <div className="mt-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-3 border border-gray-200">
          <h3 className="text-sm md:text-base font-bold text-gray-700 mb-2">League Statistics</h3>
          {viewMode === 'regular' ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Averages Column */}
                <div>
                  <h4 className="text-xs md:text-sm font-semibold text-gray-600 mb-2 text-center">Averages</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center">
                      <div className="text-xs text-gray-600">Record</div>
                      <div className="font-mono text-sm font-bold text-gray-800 bg-white px-2 py-1 rounded border">
                        {leagueAverages.avgWins} - {leagueAverages.avgLosses} - {leagueAverages.avgTies}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-600">Total Games</div>
                      <div className="text-sm font-bold text-gray-800">
                        {(parseFloat(leagueAverages.avgWins) + parseFloat(leagueAverages.avgLosses) + parseFloat(leagueAverages.avgTies)).toFixed(1)}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Totals Column */}
                <div>
                  <h4 className="text-xs md:text-sm font-semibold text-blue-600 mb-2 text-center">Totals</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center">
                      <div className="text-xs text-blue-600">Total Record</div>
                      <div className="font-mono text-sm font-bold text-blue-800 bg-white px-2 py-1 rounded border border-blue-200">
                        {leagueTotals.totalWins} - {leagueTotals.totalLosses} - {leagueTotals.totalTies}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-blue-600">Total Games</div>
                      <div className="text-sm font-bold text-blue-800">
                        {leagueTotals.totalWins + leagueTotals.totalLosses + leagueTotals.totalTies}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Shared Bottom Row */}
              <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-gray-300">
                <div className="text-center">
                  <div className="text-xs md:text-sm text-gray-600">Win %</div>
                  <div className="text-lg md:text-xl font-bold text-blue-700">
                    {leagueTotals.totalPercentage}%
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs md:text-sm text-gray-600">Players</div>
                  <div className="text-lg md:text-xl font-bold text-gray-800">
                    {enhancedStandings.length}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Averages Column */}
                <div>
                  <h4 className="text-xs md:text-sm font-semibold text-gray-600 mb-2 text-center">Averages</h4>
                  <div className="text-center">
                    <div className="text-xs text-gray-600">3-0 Weeks</div>
                    <div className="text-sm font-bold text-gray-800">
                      {currentStandings.length > 0 
                        ? (currentStandings.reduce((sum, user) => sum + (user.threeZeroWeeks || 0), 0) / currentStandings.length).toFixed(1)
                        : '0.0'
                      }
                    </div>
                  </div>
                </div>
                
                {/* Totals Column */}
                <div>
                  <h4 className="text-xs md:text-sm font-semibold text-blue-600 mb-2 text-center">Totals</h4>
                  <div className="text-center">
                    <div className="text-xs text-blue-600">Total 3-0 Weeks</div>
                    <div className="text-sm font-bold text-blue-800">
                      {currentStandings.length > 0 
                        ? currentStandings.reduce((sum, user) => sum + (user.threeZeroWeeks || 0), 0)
                        : 0
                      }
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Shared Bottom Row */}
              <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-gray-300">
                <div className="text-center">
                  <div className="text-xs md:text-sm text-gray-600">Total Payout</div>
                  <div className="text-lg md:text-xl font-bold text-blue-700">
                    ${currentStandings.length > 0 
                      ? currentStandings.reduce((sum, user) => sum + (user.payout || 0), 0).toFixed(2)
                      : '0.00'
                    }
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs md:text-sm text-gray-600">Players</div>
                  <div className="text-lg md:text-xl font-bold text-gray-800">
                    {currentStandings.length}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

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

      {/* User Picks Popup */}
      {picksPopupOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedUser?.name}'s Picks
                </h3>
                <button
                  onClick={() => setPicksPopupOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Week: {selectedWeek ? (() => {
                  const parts = selectedWeek.split('_');
                  const date = new Date(parts[1], parts[2] - 1, parts[3]);
                  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(2)}`;
                })() : ''}
              </p>
            </div>
            
            <div className="p-4">
              {picksLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-500">Loading picks...</div>
                </div>
              ) : userPicks.length > 0 ? (
                <div className="space-y-3">
                  {userPicks.map((pick, index) => {
                    // Try to get team names from various possible fields
                    const awayTeam = pick.gameDetails?.away_team_abbrev || pick.gameDetails?.awayTeam || 
                                   pick.gameDetails?.away_team || pick.awayTeam || pick.away_team || 
                                   pick.gameDetails?.away || pick.away ||
                                   pick.gameDetails?.awayAbbreviation || pick.awayAbbreviation ||
                                   'Away Team';
                    const homeTeam = pick.gameDetails?.home_team_abbrev || pick.gameDetails?.homeTeam || 
                                   pick.gameDetails?.home_team || pick.homeTeam || pick.home_team || 
                                   pick.gameDetails?.home || pick.home ||
                                   pick.gameDetails?.homeAbbreviation || pick.homeAbbreviation ||
                                   'Home Team';

                    console.log('Pick', index + 1, '- Away:', awayTeam, 'Home:', homeTeam);
                    
                    // Try to get game time from various possible fields
                    const gameTime = pick.gameDetails?.gameTime || pick.gameTime || pick.gameDetails?.commence_time || pick.commence_time;
                    
                    // Determine the user's pick based on pickType and pickSide
                    let userPick = '';
                    let pickDescription = '';
                    
                    if (pick.pickType === 'spread') {
                      userPick = pick.pickSide; // This should be the team (KC, TB, etc.)
                      pickDescription = `${userPick} (Spread)`;
                    } else if (pick.pickType === 'total') {
                      userPick = pick.pickSide; // This should be 'over' or 'under'
                      pickDescription = `${userPick.charAt(0).toUpperCase() + userPick.slice(1)} (Total)`;
                    } else if (pick.pickType === 'moneyline') {
                      userPick = pick.pickSide; // This should be the team
                      pickDescription = `${userPick} (ML)`;
                    } else {
                      userPick = pick.pickSide || pick.pick || 'Unknown';
                      pickDescription = userPick;
                    }
                    
                    // Try to get confidence
                    const confidence = pick.confidence || pick.confidencePoints;

                    // Get the result of the pick
                    const result = pick.result?.toUpperCase();
                    let resultDisplay = '';
                    let resultClass = '';
                    
                    if (result === 'WIN' || result === 'W') {
                      resultDisplay = 'W';
                      resultClass = 'bg-green-500 text-white';
                    } else if (result === 'LOSS' || result === 'L') {
                      resultDisplay = 'L';
                      resultClass = 'bg-red-500 text-white';
                    } else if (result === 'TIE' || result === 'T') {
                      resultDisplay = 'T';
                      resultClass = 'bg-yellow-500 text-white';
                    } else {
                      resultDisplay = '--';
                      resultClass = 'bg-gray-400 text-white';
                    }

                    return (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {awayTeam} @ {homeTeam}
                          </div>
                          <div className="text-sm text-gray-600">
                            {gameTime ? new Date(gameTime).toLocaleString() : 'Time TBD'}
                          </div>
                        </div>
                        <div className="ml-4 flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            pick.pickType === 'spread' || pick.pickType === 'moneyline' 
                              ? (userPick === awayTeam ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800')
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {pickDescription}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-bold ${resultClass}`}>
                            {resultDisplay}
                          </span>
                          {confidence && (
                            <span className="text-sm text-gray-500">
                              ({confidence})
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No picks found for this week
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Standings; 