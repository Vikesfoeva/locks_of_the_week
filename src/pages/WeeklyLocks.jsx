import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config';
import { Popover, Portal } from '@headlessui/react';
import { FunnelIcon as FunnelIconOutline, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { FunnelIcon as FunnelIconSolid, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/solid';
import PopularLocksModal from '../components/PopularLocksModal';
import FilterModal from '../components/FilterModal';
import { useFilterModal, createFilterButtonProps, createFilterModalProps } from '../hooks/useFilterModal';
import * as XLSX from 'xlsx';

// Helper function to parse collection name to a Date object for sorting and display
const parseCollectionNameToDate = (collectionName) => {
  if (!collectionName || typeof collectionName !== 'string') return null;
  const parts = collectionName.split('_'); // Expected format: "odds_YYYY_MM_DD"
  if (parts.length === 4 && parts[0] === 'odds') {
    const year = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10) - 1; // Month is 0-indexed in JS Date
    const day = parseInt(parts[3], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month, day);
    }
  }
  return null; // Return null for invalid formats
};

const WeeklyLocks = () => {
  const { currentUser } = useAuth();
  const [collections, setCollections] = useState([]); // e.g., weeks
  const [selectedCollection, setSelectedCollection] = useState('');
  const [userPicks, setUserPicks] = useState([]); // Current user's picks for the selected collection
  const [allPicks, setAllPicks] = useState([]); // All users' picks for the selected collection
  const [users, setUsers] = useState([]); // All users
  const [userMap, setUserMap] = useState({}); // firebaseUid -> displayName
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState(() => {
    // Try to load from localStorage, fallback to 'table'
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('weeklyPicksViewMode');
      if (saved === 'table' || saved === 'leaderboard') return saved;
    }
    return 'table';
  }); // 'table' or 'leaderboard'
  const [showPopularPicks, setShowPopularPicks] = useState(false);

  // Helper function to format status display
  const formatStatus = (status) => {
    if (!status) return '--';
    if (status === 'final') return 'Final';
    if (status === 'unstarted') return 'Unstarted';
    if (status === 'in-progress') return 'In Progress';
    return status; // Return as-is for any other status values
  };

  // Helper function to format score with team abbreviations
  const formatScore = (awayScore, homeScore, awayTeam, homeTeam) => {
    if (typeof awayScore === 'number' && typeof homeScore === 'number') {
      return `${awayTeam} ${awayScore} - ${homeScore} ${homeTeam}`;
    }
    return '--';
  };

  // Helper function to format game date and time
  const formatGameDateTime = (commenceTime) => {
    if (!commenceTime) return '--';
    return new Date(commenceTime).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Helper function to format just the date
  const formatGameDate = (commenceTime) => {
    if (!commenceTime) return '--';
    return new Date(commenceTime).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  // Helper function to format line value with + sign for positive numbers (only for spreads)
  const formatLineValue = (line, pickType) => {
    if (line === undefined || line === null) return '--';
    if (typeof line === 'number') {
      // Only add + sign for spread picks, not for total (over/under) picks
      if (pickType === 'spread') {
        return line > 0 ? `+${line}` : line.toString();
      } else {
        // For totals (over/under), just return the number as is
        return line.toString();
      }
    }
    return line.toString();
  };

  // Helper function to format just the time
  const formatGameTime = (commenceTime) => {
    if (!commenceTime) return '--';
    return new Date(commenceTime).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Helper function to format result display
  const formatResult = (result) => {
    if (!result) return '--';
    if (result === 'WIN') return 'W';
    if (result === 'LOSS') return 'L';
    if (result === 'TIE') return 'T';
    return result;
  };

  // Helper function to get row background color based on result
  const getRowBackgroundColor = (result, index) => {
    if (!result) return index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
    if (result === 'WIN') return 'bg-green-50';
    if (result === 'LOSS') return 'bg-red-50';
    if (result === 'TIE') return 'bg-orange-50';
    return index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
  };

  // Excel export function
  const exportToExcel = () => {
    if (!filteredAndSortedPicks || filteredAndSortedPicks.length === 0) {
      alert('No data to export');
      return;
    }

    // Prepare the data for export
    const exportData = filteredAndSortedPicks.map((pick) => {
      const userName = userMap[pick.userId] || pick.userId;
      const game = pick.gameDetails;
      
      return {
        'User': userName,
        'League': game?.league || '--',
        'Away': game?.away_team_abbrev || '--',
        'Home': game?.home_team_abbrev || '--',
        'Lock': pick.pickType === 'spread' ? `${pick.pickSide} Line` : pick.pickType === 'total' ? (pick.pickSide === 'OVER' ? 'Over' : 'Under') : '--',
        'Date': formatGameDate(game?.commence_time),
        'Time': formatGameTime(game?.commence_time),
        'Line/O/U': formatLineValue(pick.line, pick.pickType),
        'Score': formatScore(pick.awayScore, pick.homeScore, game?.away_team_abbrev, game?.home_team_abbrev),
        'Status': formatStatus(pick.status),
        'W/L/T': formatResult(pick.result)
      };
    });

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Auto-size columns
    const columnWidths = [
      { wch: 20 }, // User
      { wch: 15 }, // League
      { wch: 8 },  // Away
      { wch: 8 },  // Home
      { wch: 12 }, // Lock
      { wch: 12 }, // Date
      { wch: 10 }, // Time
      { wch: 10 }, // Line/O/U
      { wch: 12 }, // Score
      { wch: 10 }, // Status
      { wch: 8 }   // W/L/T
    ];
    worksheet['!cols'] = columnWidths;

    // Get the week name for the filename
    const weekName = selectedCollection ? 
      (() => {
        const date = parseCollectionNameToDate(selectedCollection);
        return date ? `Week_of_${date.toLocaleString('default', { month: 'long' })}_${date.getDate()}_${date.getFullYear()}` : selectedCollection;
      })() : 
      'Weekly_Locks';

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Weekly Locks');

    // Generate filename
    const fileName = `${weekName}_Locks_Export.xlsx`;

    // Save the file
    XLSX.writeFile(workbook, fileName);
  };

  // Active year state
  const [activeYear, setActiveYear] = useState(null);
  const [activeYearLoading, setActiveYearLoading] = useState(true);
  const [activeYearError, setActiveYearError] = useState(null);

  // Sorting and Filtering State
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  
  // Initialize filter modals using the new hook system
  const userModal = useFilterModal([], []);
  const leagueModal = useFilterModal([], []);
  const awayTeamModal = useFilterModal([], []);
  const homeTeamModal = useFilterModal([], []);
  const lockModal = useFilterModal([], []);
  const resultModal = useFilterModal([], []);
  const dateModal = useFilterModal([], []);
  const timeModal = useFilterModal([], []);

  // Extract current filter values for compatibility with existing logic
  const userFilter = userModal.selectedItems;
  const leagueFilter = leagueModal.selectedItems;
  const awayTeamFilter = awayTeamModal.selectedItems;
  const homeTeamFilter = homeTeamModal.selectedItems;
  const lockFilter = lockModal.selectedItems;
  const resultFilter = resultModal.selectedItems;
  const dateFilter = dateModal.selectedItems;
  const timeFilter = timeModal.selectedItems;



  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleResetFilters = () => {
    // Reset all modal system filters
    userModal.handleSelectionChange([]);
    leagueModal.handleSelectionChange([]);
    awayTeamModal.handleSelectionChange([]);
    homeTeamModal.handleSelectionChange([]);
    lockModal.handleSelectionChange([]);
    resultModal.handleSelectionChange([]);
    dateModal.handleSelectionChange([]);
    timeModal.handleSelectionChange([]);
  };

  const getUniqueValues = (picks, key, subKey = null) => {
    const values = picks.map(pick => {
      let value;
      if (key === 'user') {
        value = userMap[pick.userId] || pick.userId;
      } else if (key === 'lock') {
        value = pick.pickType === 'spread' ? `${pick.pickSide} Line` : pick.pickType === 'total' ? (pick.pickSide === 'OVER' ? 'Over' : 'Under') : '--';
      } else if (key === 'result') {
        // Special handling for result field - include '--' for games without results
        value = pick.result || '--';
      } else if (subKey) {
        value = pick.gameDetails?.[subKey];
      } else {
        value = pick[key];
      }
      return value || '';
    });
    return Array.from(new Set(values)).filter(Boolean).sort();
  };

  const filteredPicksForUser = useMemo(() => allPicks.filter(pick =>
    (leagueFilter.length === 0 || (pick.gameDetails && leagueFilter.includes(pick.gameDetails.league))) &&
    (awayTeamFilter.length === 0 || (pick.gameDetails && awayTeamFilter.includes(pick.gameDetails.away_team_abbrev))) &&
    (homeTeamFilter.length === 0 || (pick.gameDetails && homeTeamFilter.includes(pick.gameDetails.home_team_abbrev))) &&
    (lockFilter.length === 0 || lockFilter.includes(pick.pickType === 'spread' ? `${pick.pickSide} Line` : pick.pickType === 'total' ? (pick.pickSide === 'OVER' ? 'Over' : 'Under') : '--')) &&
    (resultFilter.length === 0 || resultFilter.includes(pick.result || '--')) &&
    (dateFilter.length === 0 || (pick.gameDetails && dateFilter.includes(formatGameDate(pick.gameDetails.commence_time)))) &&
    (timeFilter.length === 0 || (pick.gameDetails && timeFilter.includes(formatGameTime(pick.gameDetails.commence_time))))
  ), [allPicks, leagueFilter, awayTeamFilter, homeTeamFilter, lockFilter, resultFilter, dateFilter, timeFilter]);

  const filteredPicksForLeague = useMemo(() => allPicks.filter(pick =>
    (userFilter.length === 0 || userFilter.includes(userMap[pick.userId] || pick.userId)) &&
    (awayTeamFilter.length === 0 || (pick.gameDetails && awayTeamFilter.includes(pick.gameDetails.away_team_abbrev))) &&
    (homeTeamFilter.length === 0 || (pick.gameDetails && homeTeamFilter.includes(pick.gameDetails.home_team_abbrev))) &&
    (lockFilter.length === 0 || lockFilter.includes(pick.pickType === 'spread' ? `${pick.pickSide} Line` : pick.pickType === 'total' ? (pick.pickSide === 'OVER' ? 'Over' : 'Under') : '--')) &&
    (resultFilter.length === 0 || resultFilter.includes(pick.result || '--')) &&
    (dateFilter.length === 0 || (pick.gameDetails && dateFilter.includes(formatGameDate(pick.gameDetails.commence_time)))) &&
    (timeFilter.length === 0 || (pick.gameDetails && timeFilter.includes(formatGameTime(pick.gameDetails.commence_time))))
  ), [allPicks, userFilter, awayTeamFilter, homeTeamFilter, lockFilter, resultFilter, userMap, dateFilter, timeFilter]);

  const filteredPicksForAwayTeam = useMemo(() => allPicks.filter(pick =>
    (userFilter.length === 0 || userFilter.includes(userMap[pick.userId] || pick.userId)) &&
    (leagueFilter.length === 0 || (pick.gameDetails && leagueFilter.includes(pick.gameDetails.league))) &&
    (homeTeamFilter.length === 0 || (pick.gameDetails && homeTeamFilter.includes(pick.gameDetails.home_team_abbrev))) &&
    (lockFilter.length === 0 || lockFilter.includes(pick.pickType === 'spread' ? `${pick.pickSide} Line` : pick.pickType === 'total' ? (pick.pickSide === 'OVER' ? 'Over' : 'Under') : '--')) &&
    (resultFilter.length === 0 || resultFilter.includes(pick.result || '--')) &&
    (dateFilter.length === 0 || (pick.gameDetails && dateFilter.includes(formatGameDate(pick.gameDetails.commence_time)))) &&
    (timeFilter.length === 0 || (pick.gameDetails && timeFilter.includes(formatGameTime(pick.gameDetails.commence_time))))
  ), [allPicks, userFilter, leagueFilter, homeTeamFilter, lockFilter, resultFilter, userMap, dateFilter, timeFilter]);

  const filteredPicksForHomeTeam = useMemo(() => allPicks.filter(pick =>
    (userFilter.length === 0 || userFilter.includes(userMap[pick.userId] || pick.userId)) &&
    (leagueFilter.length === 0 || (pick.gameDetails && leagueFilter.includes(pick.gameDetails.league))) &&
    (awayTeamFilter.length === 0 || (pick.gameDetails && awayTeamFilter.includes(pick.gameDetails.away_team_abbrev))) &&
    (lockFilter.length === 0 || lockFilter.includes(pick.pickType === 'spread' ? `${pick.pickSide} Line` : pick.pickType === 'total' ? (pick.pickSide === 'OVER' ? 'Over' : 'Under') : '--')) &&
    (resultFilter.length === 0 || resultFilter.includes(pick.result || '--')) &&
    (dateFilter.length === 0 || (pick.gameDetails && dateFilter.includes(formatGameDate(pick.gameDetails.commence_time)))) &&
    (timeFilter.length === 0 || (pick.gameDetails && timeFilter.includes(formatGameTime(pick.gameDetails.commence_time))))
  ), [allPicks, userFilter, leagueFilter, awayTeamFilter, lockFilter, resultFilter, userMap, dateFilter, timeFilter]);

  const filteredPicksForLock = useMemo(() => allPicks.filter(pick =>
    (userFilter.length === 0 || userFilter.includes(userMap[pick.userId] || pick.userId)) &&
    (leagueFilter.length === 0 || (pick.gameDetails && leagueFilter.includes(pick.gameDetails.league))) &&
    (awayTeamFilter.length === 0 || (pick.gameDetails && awayTeamFilter.includes(pick.gameDetails.away_team_abbrev))) &&
    (homeTeamFilter.length === 0 || (pick.gameDetails && homeTeamFilter.includes(pick.gameDetails.home_team_abbrev))) &&
    (resultFilter.length === 0 || resultFilter.includes(pick.result || '--')) &&
    (dateFilter.length === 0 || (pick.gameDetails && dateFilter.includes(formatGameDate(pick.gameDetails.commence_time)))) &&
    (timeFilter.length === 0 || (pick.gameDetails && timeFilter.includes(formatGameTime(pick.gameDetails.commence_time))))
  ), [allPicks, userFilter, leagueFilter, awayTeamFilter, homeTeamFilter, resultFilter, userMap, dateFilter, timeFilter]);

  const filteredPicksForResult = useMemo(() => allPicks.filter(pick =>
    (userFilter.length === 0 || userFilter.includes(userMap[pick.userId] || pick.userId)) &&
    (leagueFilter.length === 0 || (pick.gameDetails && leagueFilter.includes(pick.gameDetails.league))) &&
    (awayTeamFilter.length === 0 || (pick.gameDetails && awayTeamFilter.includes(pick.gameDetails.away_team_abbrev))) &&
    (homeTeamFilter.length === 0 || (pick.gameDetails && homeTeamFilter.includes(pick.gameDetails.home_team_abbrev))) &&
    (lockFilter.length === 0 || lockFilter.includes(pick.pickType === 'spread' ? `${pick.pickSide} Line` : pick.pickType === 'total' ? (pick.pickSide === 'OVER' ? 'Over' : 'Under') : '--')) &&
    (dateFilter.length === 0 || (pick.gameDetails && dateFilter.includes(formatGameDate(pick.gameDetails.commence_time)))) &&
    (timeFilter.length === 0 || (pick.gameDetails && timeFilter.includes(formatGameTime(pick.gameDetails.commence_time))))
  ), [allPicks, userFilter, leagueFilter, awayTeamFilter, homeTeamFilter, lockFilter, userMap, dateFilter, timeFilter]);

  // For checking if a filter is active, we need the total number of unique values from the original data
  const totalUniqueUsers = useMemo(() => getUniqueValues(allPicks, 'user'), [allPicks, userMap]);
  const totalUniqueLeagues = useMemo(() => getUniqueValues(allPicks, 'gameDetails', 'league'), [allPicks]);
  const totalUniqueAwayTeams = useMemo(() => getUniqueValues(allPicks, 'gameDetails', 'away_team_abbrev'), [allPicks]);
  const totalUniqueHomeTeams = useMemo(() => getUniqueValues(allPicks, 'gameDetails', 'home_team_abbrev'), [allPicks]);
  const totalUniqueLocks = useMemo(() => getUniqueValues(allPicks, 'lock'), [allPicks]);
  const totalUniqueResults = useMemo(() => getUniqueValues(allPicks, 'result'), [allPicks]);
  const totalUniqueDates = useMemo(() => Array.from(new Set(
    allPicks
      .map(pick => pick.gameDetails?.commence_time)
      .filter(Boolean)
      .map(commenceTime => formatGameDate(commenceTime))
      .filter(Boolean)
  )).sort(), [allPicks]);
  const totalUniqueTimes = useMemo(() => Array.from(new Set(
    allPicks
      .map(pick => pick.gameDetails?.commence_time)
      .filter(Boolean)
      .map(commenceTime => formatGameTime(commenceTime))
      .filter(Boolean)
  )).sort(), [allPicks]);

  const uniqueUsers = getUniqueValues(filteredPicksForUser, 'user');
  const uniqueLeagues = getUniqueValues(filteredPicksForLeague, 'gameDetails', 'league');
  const uniqueAwayTeams = getUniqueValues(filteredPicksForAwayTeam, 'gameDetails', 'away_team_abbrev');
  const uniqueHomeTeams = getUniqueValues(filteredPicksForHomeTeam, 'gameDetails', 'home_team_abbrev');
  const uniqueLocks = getUniqueValues(filteredPicksForLock, 'lock');
  const uniqueResults = getUniqueValues(filteredPicksForResult, 'result');
  // Use totalUniqueDates for filter modal to always show all available dates
  const uniqueDates = totalUniqueDates;
  const uniqueTimes = totalUniqueTimes;
  


  // Filter status checks using the new modal system
  const isUserFiltered = userFilter.length > 0 && userFilter.length < totalUniqueUsers.length;
  const isLeagueFiltered = leagueFilter.length > 0 && leagueFilter.length < totalUniqueLeagues.length;
  const isAwayTeamFiltered = awayTeamFilter.length > 0 && awayTeamFilter.length < totalUniqueAwayTeams.length;
  const isHomeTeamFiltered = homeTeamFilter.length > 0 && homeTeamFilter.length < totalUniqueHomeTeams.length;
  const isLockFiltered = lockFilter.length > 0 && lockFilter.length < totalUniqueLocks.length;
  const isResultFiltered = resultFilter.length > 0 && resultFilter.length < totalUniqueResults.length;
  const isDateFiltered = dateFilter.length > 0 && dateFilter.length < totalUniqueDates.length;
  const isTimeFiltered = timeFilter.length > 0 && timeFilter.length < totalUniqueTimes.length;

  const filteredAndSortedPicks = useMemo(() => {
    let filtered = [...allPicks];
    
    if (userFilter.length > 0) {
      filtered = filtered.filter(pick => userFilter.includes(userMap[pick.userId] || pick.userId));
    }
    if (leagueFilter.length > 0) {
      filtered = filtered.filter(pick => pick.gameDetails && leagueFilter.includes(pick.gameDetails.league));
    }
    if (awayTeamFilter.length > 0) {
      filtered = filtered.filter(pick => pick.gameDetails && awayTeamFilter.includes(pick.gameDetails.away_team_abbrev));
    }
    if (homeTeamFilter.length > 0) {
      filtered = filtered.filter(pick => pick.gameDetails && homeTeamFilter.includes(pick.gameDetails.home_team_abbrev));
    }
    if (lockFilter.length > 0) {
      filtered = filtered.filter(pick => {
        const lockValue = pick.pickType === 'spread' ? `${pick.pickSide} Line` : pick.pickType === 'total' ? (pick.pickSide === 'OVER' ? 'Over' : 'Under') : '--';
        return lockFilter.includes(lockValue);
      });
    }
    if (resultFilter.length > 0) {
        filtered = filtered.filter(pick => resultFilter.includes(pick.result || '--'));
    }
    if (dateFilter.length > 0) {
        filtered = filtered.filter(pick => pick.gameDetails && dateFilter.includes(formatGameDate(pick.gameDetails.commence_time)));
    }
    if (timeFilter.length > 0) {
        filtered = filtered.filter(pick => pick.gameDetails && timeFilter.includes(formatGameTime(pick.gameDetails.commence_time)));
    }

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aValue;
        let bValue;

        if (sortConfig.key === 'user') {
          aValue = userMap[a.userId] || a.userId;
          bValue = userMap[b.userId] || b.userId;
        } else if (sortConfig.key === 'lock') {
            aValue = a.pickType === 'spread' ? `${a.pickSide} Line` : a.pickType === 'total' ? (a.pickSide === 'OVER' ? 'Over' : 'Under') : '--';
            bValue = b.pickType === 'spread' ? `${b.pickSide} Line` : b.pickType === 'total' ? (b.pickSide === 'OVER' ? 'Over' : 'Under') : '--';
        } else if (sortConfig.key === 'dateTime') {
            aValue = a.gameDetails?.commence_time ? new Date(a.gameDetails.commence_time) : new Date(0);
            bValue = b.gameDetails?.commence_time ? new Date(b.gameDetails.commence_time) : new Date(0);
        } else if (sortConfig.key === 'date') {
            aValue = a.gameDetails?.commence_time ? new Date(a.gameDetails.commence_time) : new Date(0);
            bValue = b.gameDetails?.commence_time ? new Date(b.gameDetails.commence_time) : new Date(0);
        } else if (sortConfig.key === 'time') {
            aValue = a.gameDetails?.commence_time ? new Date(a.gameDetails.commence_time) : new Date(0);
            bValue = b.gameDetails?.commence_time ? new Date(b.gameDetails.commence_time) : new Date(0);
        } else if (['league', 'away_team_abbrev', 'home_team_abbrev'].includes(sortConfig.key)) {
          aValue = a.gameDetails?.[sortConfig.key];
          bValue = b.gameDetails?.[sortConfig.key];
        } else {
          aValue = a[sortConfig.key];
          bValue = b[sortConfig.key];
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [allPicks, sortConfig, userFilter, leagueFilter, awayTeamFilter, homeTeamFilter, lockFilter, resultFilter, dateFilter, timeFilter, userMap]);

  // Fetch active year on mount
  useEffect(() => {
    const fetchActiveYear = async () => {
      setActiveYearLoading(true);
      setActiveYearError(null);
      try {
        const res = await fetch(`${API_URL}/active-year`);
        if (!res.ok) throw new Error('Failed to fetch active year');
        const data = await res.json();
        setActiveYear(data.year);
      } catch (err) {
        setActiveYearError(err.message);
      } finally {
        setActiveYearLoading(false);
      }
    };
    fetchActiveYear();
  }, []);

  // Fetch all users on mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get('/api/users');
        setUsers(res.data);
        // Build UID -> displayName map
        const map = {};
        res.data.forEach(u => {
          map[u.firebaseUid] = (u.firstName || '') + (u.lastName ? ' ' + u.lastName : '');
        });
        setUserMap(map);
      } catch (err) {
        // fallback: just leave empty
      }
    };
    fetchUsers();
  }, []);

  // Fetch collections (weeks) for the active year
  useEffect(() => {
    const fetchCollections = async () => {
      setLoading(true);
      try {
        const response = await axios.get('/api/collections');
        let fetchedCollections = response.data;

        if (!Array.isArray(fetchedCollections) || fetchedCollections.length === 0) {
          setError('No collections found or invalid format from server.');
          setCollections([]);
          setSelectedCollection('');
          setLoading(false);
          return;
        }

        // Only show collections for the active year
        let filteredCollections = fetchedCollections.filter(name => {
          const parts = name.split('_');
          return parts.length === 4 && parts[0] === 'odds' && parseInt(parts[1], 10) === activeYear;
        });

        filteredCollections = filteredCollections.filter(name => parseCollectionNameToDate(name) !== null);

        if (filteredCollections.length === 0) {
          setError('No valid collections found for the current active year.');
          setCollections([]);
          setSelectedCollection('');
          setLoading(false);
          return;
        }

        filteredCollections.sort((a, b) => {
          const dateA = parseCollectionNameToDate(a);
          const dateB = parseCollectionNameToDate(b);
          return dateB - dateA;
        });

        setCollections(filteredCollections);
        const mostRecentCollection = filteredCollections[0];
        setSelectedCollection(mostRecentCollection);
        setError('');
      } catch (err) {
        setError('Failed to load collections. Please try again later.');
        setCollections([]);
        setSelectedCollection('');
        setLoading(false);
      }
    };
    if (activeYear) {
      fetchCollections();
    }
  }, [activeYear]);

  // Fetch picks when collection or user changes
  useEffect(() => {
    const fetchPicks = async () => {
      if (!selectedCollection || !currentUser) return;
      setLoading(true);
      setError('');
      try {
        // Fetch current user's picks for the selected collection
        const userPicksRes = await axios.get(`/api/picks?userId=${currentUser.uid}&collectionName=${selectedCollection}&year=${activeYear}`);
        const userPicksData = Array.isArray(userPicksRes.data) ? userPicksRes.data : [];
        setUserPicks(userPicksData);

        // If user has 3 picks, fetch all users' picks for the collection
        if (userPicksData.length === 3) {
          const allPicksRes = await axios.get(`/api/picks?collectionName=${selectedCollection}&year=${activeYear}`);
          setAllPicks(Array.isArray(allPicksRes.data) ? allPicksRes.data : []);
        } else {
          setAllPicks([]);
        }
      } catch (err) {
        setError('Failed to load locks.');
        setUserPicks([]);
        setAllPicks([]);
      } finally {
        setLoading(false);
      }
    };
    fetchPicks();
  }, [selectedCollection, currentUser, activeYear]);

  // Handler for dropdown change
  const handleCollectionChange = (e) => {
    setSelectedCollection(e.target.value);
  };

  const hasThreePicks = userPicks.length === 3;

  // Helper: group picks by userId
  const picksByUser = {};
  allPicks.forEach(pick => {
    if (!picksByUser[pick.userId]) picksByUser[pick.userId] = [];
    picksByUser[pick.userId].push(pick);
  });

  // Helper: for leaderboard, get picks sorted by submission (or by _id)
  function getSortedPicksForUser(userId) {
    const picks = picksByUser[userId] || [];
    // Sort by submittedAt or _id (fallback)
    return [...picks].sort((a, b) => {
      if (a.submittedAt && b.submittedAt) return new Date(a.submittedAt) - new Date(b.submittedAt);
      if (a._id && b._id) return (a._id > b._id ? 1 : -1);
      return 0;
    });
  }

  // Table rendering
  return (
    <div className="max-w-full mx-auto p-2 md:p-4 lg:p-6">
      <h1 className="text-2xl font-bold mb-4">Weekly Locks</h1>
      <div className="mb-4">
        <label htmlFor="collection-select" className="block text-sm font-medium text-gray-700 mr-2">
          Select Week:
        </label>
        <select
          id="collection-select"
          name="collection-select"
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          value={selectedCollection}
          onChange={handleCollectionChange}
          disabled={loading}
        >
          {collections.map(collectionName => (
            <option key={collectionName} value={collectionName}>
              {(() => {
                const date = parseCollectionNameToDate(collectionName);
                return date
                  ? `Week of ${date.toLocaleString('default', { month: 'long' })} ${date.getDate()}, ${date.getFullYear()}`
                  : collectionName;
              })()}
            </option>
          ))}
        </select>
      </div>
      {/* Toggle Button */}
      <div className="mb-4 flex gap-2">
        <button
          className={`px-4 py-2 rounded ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          onClick={() => {
            setViewMode('table');
            if (typeof window !== 'undefined') {
              localStorage.setItem('weeklyPicksViewMode', 'table');
            }
          }}
        >
          Table View
        </button>
        <button
          className={`px-4 py-2 rounded ${viewMode === 'leaderboard' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          onClick={() => {
            setViewMode('leaderboard');
            if (typeof window !== 'undefined') {
              localStorage.setItem('weeklyPicksViewMode', 'leaderboard');
            }
          }}
        >
          Traditional View
        </button>
        <button
          className={`px-4 py-2 rounded ${showPopularPicks ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          onClick={() => setShowPopularPicks(!showPopularPicks)}
        >
          Show Popular Picks
        </button>
        {viewMode === 'table' && (
          <button
            className="border border-gray-400 text-gray-700 bg-white px-4 py-2 rounded hover:bg-gray-100"
            onClick={handleResetFilters}
            type="button"
          >
            Reset Filters
          </button>
        )}
        {userPicks.length === 3 && allPicks.length > 0 && (
          <button
            className="border border-green-600 text-green-700 bg-white px-4 py-2 rounded hover:bg-green-50 flex items-center gap-2"
            onClick={exportToExcel}
            type="button"
            title="Export to Excel"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Export to Excel
          </button>
        )}
      </div>
      {loading && <div>Loading...</div>}
      {error && <div className="text-red-500">{error}</div>}
      {activeYearLoading && <div>Loading active year...</div>}
      {activeYearError && <div className="text-red-500">{activeYearError}</div>}
      {userPicks.length === 3 && allPicks.length > 0 ? (
        <>
          <h2 className="text-xl font-semibold mb-2">All Locks for This Week</h2>
          {viewMode === 'table' ? (
            <div className="overflow-x-auto min-w-full">
              <table className="w-full bg-white border border-gray-300 rounded shadow text-xs sm:text-sm md:text-base">
                <thead>
                  <tr className="bg-gray-100 text-left border-b border-gray-300">
                    <th className="px-2 py-2 border-r border-gray-300">
                      <div className="flex items-center gap-1">
                        <span>User</span>
                        <div className="flex flex-col ml-1">
                          <ChevronUpIcon className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'user' && sortConfig.direction === 'ascending' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => handleSort('user')} />
                          <ChevronDownIcon className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'user' && sortConfig.direction === 'descending' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => handleSort('user')} />
                        </div>
                        <button
                          {...createFilterButtonProps(userModal, uniqueUsers, (selectedUsers) => {
                            // Apply the filter with special logic for "select all" case
                            if (selectedUsers.length === uniqueUsers.length) {
                              userModal.handleSelectionChange([]);
                            } else {
                              userModal.handleSelectionChange(selectedUsers);
                            }
                          }, {
                            IconComponent: FunnelIconOutline,
                            IconComponentSolid: FunnelIconSolid,
                          })}
                        />
                      </div>
                    </th>
                    <th className="px-2 py-2 border-r border-gray-300">
                      <div className="flex items-center gap-1">
                        <span>League</span>
                        <div className="flex flex-col ml-1">
                          <ChevronUpIcon className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'league' && sortConfig.direction === 'ascending' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => handleSort('league')} />
                          <ChevronDownIcon className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'league' && sortConfig.direction === 'descending' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => handleSort('league')} />
                        </div>
                        <button
                          {...createFilterButtonProps(leagueModal, uniqueLeagues, (selectedLeagues) => {
                            if (selectedLeagues.length === uniqueLeagues.length) {
                              leagueModal.handleSelectionChange([]);
                            } else {
                              leagueModal.handleSelectionChange(selectedLeagues);
                            }
                          }, {
                            IconComponent: FunnelIconOutline,
                            IconComponentSolid: FunnelIconSolid,
                          })}
                        />
                      </div>
                    </th>
                    <th className="px-2 py-2 border-r border-gray-300">
                      <div className="flex items-center gap-1">
                        <span>Away</span>
                        <div className="flex flex-col ml-1">
                            <ChevronUpIcon className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'away_team_abbrev' && sortConfig.direction === 'ascending' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => handleSort('away_team_abbrev')} />
                            <ChevronDownIcon className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'away_team_abbrev' && sortConfig.direction === 'descending' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => handleSort('away_team_abbrev')} />
                        </div>
                        <button
                          {...createFilterButtonProps(awayTeamModal, uniqueAwayTeams, (selectedAwayTeams) => {
                            if (selectedAwayTeams.length === uniqueAwayTeams.length) {
                              awayTeamModal.handleSelectionChange([]);
                            } else {
                              awayTeamModal.handleSelectionChange(selectedAwayTeams);
                            }
                          }, {
                            IconComponent: FunnelIconOutline,
                            IconComponentSolid: FunnelIconSolid,
                          })}
                        />
                      </div>
                    </th>
                    <th className="px-2 py-2 border-r border-gray-300">
                        <div className="flex items-center gap-1">
                            <span>Home</span>
                            <div className="flex flex-col ml-1">
                                <ChevronUpIcon className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'home_team_abbrev' && sortConfig.direction === 'ascending' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => handleSort('home_team_abbrev')} />
                                <ChevronDownIcon className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'home_team_abbrev' && sortConfig.direction === 'descending' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => handleSort('home_team_abbrev')} />
                            </div>
                            <button
                              {...createFilterButtonProps(homeTeamModal, uniqueHomeTeams, (selectedHomeTeams) => {
                                if (selectedHomeTeams.length === uniqueHomeTeams.length) {
                                  homeTeamModal.handleSelectionChange([]);
                                } else {
                                  homeTeamModal.handleSelectionChange(selectedHomeTeams);
                                }
                              }, {
                                IconComponent: FunnelIconOutline,
                                IconComponentSolid: FunnelIconSolid,
                              })}
                            />
                        </div>
                    </th>
                    <th className="px-2 py-2 border-r border-gray-300">
                        <div className="flex items-center gap-1">
                            <span>Lock</span>
                            <div className="flex flex-col ml-1">
                                <ChevronUpIcon className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'lock' && sortConfig.direction === 'ascending' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => handleSort('lock')} />
                                <ChevronDownIcon className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'lock' && sortConfig.direction === 'descending' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => handleSort('lock')} />
                            </div>
                            <button
                              {...createFilterButtonProps(lockModal, uniqueLocks, (selectedLocks) => {
                                if (selectedLocks.length === uniqueLocks.length) {
                                  lockModal.handleSelectionChange([]);
                                } else {
                                  lockModal.handleSelectionChange(selectedLocks);
                                }
                              }, {
                                IconComponent: FunnelIconOutline,
                                IconComponentSolid: FunnelIconSolid,
                              })}
                            />
                        </div>
                    </th>
                    <th className="px-2 py-2 border-r border-gray-300">
                        <div className="flex items-center gap-1">
                            <span>Date</span>
                            <div className="flex flex-col ml-1">
                                <ChevronUpIcon className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'date' && sortConfig.direction === 'ascending' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => handleSort('date')} />
                                <ChevronDownIcon className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'date' && sortConfig.direction === 'descending' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => handleSort('date')} />
                            </div>
                            <button
                              {...createFilterButtonProps(dateModal, uniqueDates, (selectedDates) => {
                                if (selectedDates.length === uniqueDates.length) {
                                  dateModal.handleSelectionChange([]);
                                } else {
                                  dateModal.handleSelectionChange(selectedDates);
                                }
                              }, {
                                IconComponent: FunnelIconOutline,
                                IconComponentSolid: FunnelIconSolid,
                              })}
                            />
                        </div>
                    </th>
                    <th className="px-2 py-2 border-r border-gray-300">
                        <div className="flex items-center gap-1">
                            <span>Time</span>
                            <div className="flex flex-col ml-1">
                                <ChevronUpIcon className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'time' && sortConfig.direction === 'ascending' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => handleSort('time')} />
                                <ChevronDownIcon className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'time' && sortConfig.direction === 'descending' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => handleSort('time')} />
                            </div>
                            <button
                              {...createFilterButtonProps(timeModal, uniqueTimes, (selectedTimes) => {
                                if (selectedTimes.length === uniqueTimes.length) {
                                  timeModal.handleSelectionChange([]);
                                } else {
                                  timeModal.handleSelectionChange(selectedTimes);
                                }
                              }, {
                                IconComponent: FunnelIconOutline,
                                IconComponentSolid: FunnelIconSolid,
                              })}
                            />
                        </div>
                    </th>
                    <th className="px-2 py-2 border-r border-gray-300">Line/O/U</th>
                    <th className="px-2 py-2 border-r border-gray-300">Score</th>
                    <th className="px-2 py-2 border-r border-gray-300">Status</th>
                    <th className="px-2 py-2">
                        <div className="flex items-center gap-1">
                            <span>W/L/T</span>
                            <div className="flex flex-col ml-1">
                                <ChevronUpIcon className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'result' && sortConfig.direction === 'ascending' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => handleSort('result')} />
                                <ChevronDownIcon className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'result' && sortConfig.direction === 'descending' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => handleSort('result')} />
                            </div>
                            <button
                              {...createFilterButtonProps(resultModal, uniqueResults, (selectedResults) => {
                                if (selectedResults.length === uniqueResults.length) {
                                  resultModal.handleSelectionChange([]);
                                } else {
                                  resultModal.handleSelectionChange(selectedResults);
                                }
                              }, {
                                IconComponent: FunnelIconOutline,
                                IconComponentSolid: FunnelIconSolid,
                              })}
                            />
                        </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedPicks.map((pick, idx) => {
                    const userName = userMap[pick.userId] || pick.userId;
                    const game = pick.gameDetails;
                    return (
                      <tr key={pick._id || idx} className={getRowBackgroundColor(pick.result, idx)}>
                        <td className="px-2 py-2 border-r border-gray-300 font-semibold">{userName}</td>
                        <td className="px-2 py-2 border-r border-gray-300">{game?.league || '--'}</td>
                        <td className="px-2 py-2 border-r border-gray-300">{game?.away_team_abbrev || '--'}</td>
                        <td className="px-2 py-2 border-r border-gray-300">{game?.home_team_abbrev || '--'}</td>
                        <td className="px-2 py-2 border-r border-gray-300">{pick.pickType === 'spread' ? `${pick.pickSide} Line` : pick.pickType === 'total' ? (pick.pickSide === 'OVER' ? 'Over' : 'Under') : '--'}</td>
                        <td className="px-2 py-2 border-r border-gray-300 whitespace-nowrap">{formatGameDate(game?.commence_time)}</td>
                        <td className="px-2 py-2 border-r border-gray-300 whitespace-nowrap">{formatGameTime(game?.commence_time)}</td>
                        <td className="px-2 py-2 border-r border-gray-300">{formatLineValue(pick.line, pick.pickType)}</td>
                        <td className="px-2 py-2 border-r border-gray-300 whitespace-nowrap">{formatScore(pick.awayScore, pick.homeScore, game?.away_team_abbrev, game?.home_team_abbrev)}</td>
                        <td className="px-2 py-2 border-r border-gray-300">{formatStatus(pick.status)}</td>
                        <td className="px-2 py-2">{formatResult(pick.result)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="w-screen relative left-1/2 right-1/2 -mx-[50vw] px-8 overflow-x-auto">
             <table className="w-full bg-white border border-gray-300 rounded shadow text-xs sm:text-sm md:text-base">
               <thead>
                 <tr className="bg-gray-100 text-left border-b border-gray-300">
                   <th className="px-2 py-2 border-r border-gray-300">User</th>
                   {[1,2,3].map(i => (
                     <th key={i} colSpan={10} className="px-2 py-2 border-r border-gray-300 text-center">Lock {i}</th>
                   ))}
                 </tr>
                 <tr className="bg-gray-50 text-left border-b border-gray-300">
                   <th className="px-2 py-2 border-r border-gray-300"></th>
                   {[1,2,3].map(i => (
                     <React.Fragment key={i}>
                       <th className="px-2 py-2 border-r border-gray-300">League</th>
                       <th className="px-2 py-2 border-r border-gray-300">Away</th>
                       <th className="px-2 py-2 border-r border-gray-300">Home</th>
                       <th className="px-2 py-2 border-r border-gray-300">Lock</th>
                       <th className="px-2 py-2 border-r border-gray-300">Date</th>
                       <th className="px-2 py-2 border-r border-gray-300">Time</th>
                       <th className="px-2 py-2 border-r border-gray-300">Line/O/U</th>
                       <th className="px-2 py-2 border-r border-gray-300">Score</th>
                       <th className="px-2 py-2 border-r border-gray-300">Status</th>
                       <th className="px-2 py-2 border-r border-gray-300">W/L/T</th>
                     </React.Fragment>
                   ))}
                 </tr>
               </thead>
               <tbody>
                 {users.map((user, idx) => {
                   const userName = (user.firstName || '') + (user.lastName ? ' ' + user.lastName : '');
                   const picks = getSortedPicksForUser(user.firebaseUid);
                   return (
                     <tr key={user.firebaseUid} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                       <td className="px-2 py-2 border-r border-gray-300 font-semibold whitespace-nowrap">{userName || user.email}</td>
                       {[0,1,2].map(i => {
                         const pick = picks[i];
                         const game = pick ? pick.gameDetails : undefined;
                         return pick ? (
                           <React.Fragment key={i}>
                             <td className="px-2 py-2 border-r border-gray-300">{game?.league || '--'}</td>
                             <td className="px-2 py-2 border-r border-gray-300">{game?.away_team_abbrev || '--'}</td>
                             <td className="px-2 py-2 border-r border-gray-300">{game?.home_team_abbrev || '--'}</td>
                             <td className="px-2 py-2 border-r border-gray-300">{pick.pickType === 'spread' ? `${pick.pickSide} Line` : pick.pickType === 'total' ? (pick.pickSide === 'OVER' ? 'Over' : 'Under') : '--'}</td>
                             <td className="px-2 py-2 border-r border-gray-300 whitespace-nowrap">{formatGameDate(game?.commence_time)}</td>
                             <td className="px-2 py-2 border-r border-gray-300 whitespace-nowrap">{formatGameTime(game?.commence_time)}</td>
                             <td className="px-2 py-2 border-r border-gray-300">{formatLineValue(pick.line, pick.pickType)}</td>
                             <td className="px-2 py-2 border-r border-gray-300 whitespace-nowrap">{formatScore(pick.awayScore, pick.homeScore, game?.away_team_abbrev, game?.home_team_abbrev)}</td>
                             <td className="px-2 py-2 border-r border-gray-300">{formatStatus(pick.status)}</td>
                             <td className="px-2 py-2 border-r border-gray-300">{formatResult(pick.result)}</td>
                           </React.Fragment>
                         ) : (
                           <td key={i} colSpan={10} className="px-2 py-2 border-r border-gray-300 text-center text-gray-400">--</td>
                         );
                       })}
                     </tr>
                   );
                 })}
               </tbody>
             </table>
            </div>
          )}
        </>
      ) : (
        <p>You need to have 3 locks submitted for the selected week to view all locks.</p>
      )}
              {showPopularPicks && <PopularLocksModal picks={allPicks} userMap={userMap} onClose={() => setShowPopularPicks(false)} />}
      
      {/* Filter Modals using the new improved positioning system */}
      <FilterModal
        {...createFilterModalProps(userModal, uniqueUsers, (selectedUsers) => {
          if (selectedUsers.length === uniqueUsers.length) {
            userModal.handleSelectionChange([]);
          } else {
            userModal.handleSelectionChange(selectedUsers);
          }
        }, {
          title: 'Filter Users',
          placement: 'bottom-start',
        })}
      />
      
      <FilterModal
        {...createFilterModalProps(leagueModal, uniqueLeagues, (selectedLeagues) => {
          if (selectedLeagues.length === uniqueLeagues.length) {
            leagueModal.handleSelectionChange([]);
          } else {
            leagueModal.handleSelectionChange(selectedLeagues);
          }
        }, {
          title: 'Filter League',
          placement: 'bottom-start',
        })}
      />
      
      <FilterModal
        {...createFilterModalProps(homeTeamModal, uniqueHomeTeams, (selectedHomeTeams) => {
          if (selectedHomeTeams.length === uniqueHomeTeams.length) {
            homeTeamModal.handleSelectionChange([]);
          } else {
            homeTeamModal.handleSelectionChange(selectedHomeTeams);
          }
        }, {
          title: 'Filter Home Team',
          placement: 'bottom-start',
        })}
      />
      
      <FilterModal
        {...createFilterModalProps(awayTeamModal, uniqueAwayTeams, (selectedAwayTeams) => {
          if (selectedAwayTeams.length === uniqueAwayTeams.length) {
            awayTeamModal.handleSelectionChange([]);
          } else {
            awayTeamModal.handleSelectionChange(selectedAwayTeams);
          }
        }, {
          title: 'Filter Away Team',
          placement: 'bottom-start',
        })}
      />
      
      <FilterModal
        {...createFilterModalProps(lockModal, uniqueLocks, (selectedLocks) => {
          if (selectedLocks.length === uniqueLocks.length) {
            lockModal.handleSelectionChange([]);
          } else {
            lockModal.handleSelectionChange(selectedLocks);
          }
        }, {
          title: 'Filter Lock',
          placement: 'bottom-start',
        })}
      />
      
      <FilterModal
        {...createFilterModalProps(dateModal, uniqueDates, (selectedDates) => {
          if (selectedDates.length === uniqueDates.length) {
            dateModal.handleSelectionChange([]);
          } else {
            dateModal.handleSelectionChange(selectedDates);
          }
        }, {
          title: 'Filter Date',
          placement: 'bottom-start',
        })}
      />
      
      <FilterModal
        {...createFilterModalProps(timeModal, uniqueTimes, (selectedTimes) => {
          if (selectedTimes.length === uniqueTimes.length) {
            timeModal.handleSelectionChange([]);
          } else {
            timeModal.handleSelectionChange(selectedTimes);
          }
        }, {
          title: 'Filter Time',
          placement: 'bottom-start',
        })}
      />
      
      <FilterModal
        {...createFilterModalProps(resultModal, uniqueResults, (selectedResults) => {
          if (selectedResults.length === uniqueResults.length) {
            resultModal.handleSelectionChange([]);
          } else {
            resultModal.handleSelectionChange(selectedResults);
          }
        }, {
          title: 'Filter W/L/T',
          placement: 'bottom-start',
        })}
      />
    </div>
  );
};

export default WeeklyLocks; 