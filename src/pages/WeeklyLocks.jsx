import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config';
import { Popover, Portal } from '@headlessui/react';
import { FunnelIcon as FunnelIconOutline, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { FunnelIcon as FunnelIconSolid, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/solid';
import PopularLocksModal from '../components/PopularLocksModal';
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
    return status; // Return as-is for any other status values
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
        'Line/O/U': pick.line !== undefined ? pick.line : '--',
        'Score': typeof pick.awayScore === 'number' && typeof pick.homeScore === 'number' ? `${pick.awayScore} - ${pick.homeScore}` : '--',
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
  
  // State for popover filters
  const [userFilter, setUserFilter] = useState([]);
  const [userFilterDraft, setUserFilterDraft] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const userBtnRef = React.useRef(null);
  const [userPopoverPosition, setUserPopoverPosition] = useState({ top: 0, left: 0 });
  const userPopoverOpenRef = React.useRef(false);

  const [leagueFilter, setLeagueFilter] = useState([]);
  const [leagueFilterDraft, setLeagueFilterDraft] = useState([]);
  const [leagueSearch, setLeagueSearch] = useState('');
  const leagueBtnRef = React.useRef(null);
  const [leaguePopoverPosition, setLeaguePopoverPosition] = useState({ top: 0, left: 0 });
  const leaguePopoverOpenRef = React.useRef(false);

  const [awayTeamFilter, setAwayTeamFilter] = useState([]);
  const [awayTeamFilterDraft, setAwayTeamFilterDraft] = useState([]);
  const [awayTeamSearch, setAwayTeamSearch] = useState('');
  const awayTeamBtnRef = React.useRef(null);
  const [awayTeamPopoverPosition, setAwayTeamPopoverPosition] = useState({ top: 0, left: 0 });
  const awayTeamPopoverOpenRef = React.useRef(false);

  const [homeTeamFilter, setHomeTeamFilter] = useState([]);
  const [homeTeamFilterDraft, setHomeTeamFilterDraft] = useState([]);
  const [homeTeamSearch, setHomeTeamSearch] = useState('');
  const homeTeamBtnRef = React.useRef(null);
  const [homeTeamPopoverPosition, setHomeTeamPopoverPosition] = useState({ top: 0, left: 0 });
  const homeTeamPopoverOpenRef = React.useRef(false);

  const [lockFilter, setLockFilter] = useState([]);
  const [lockFilterDraft, setLockFilterDraft] = useState([]);
  const [lockSearch, setLockSearch] = useState('');
  const lockBtnRef = React.useRef(null);
  const [lockPopoverPosition, setLockPopoverPosition] = useState({ top: 0, left: 0 });
  const lockPopoverOpenRef = React.useRef(false);

  const [resultFilter, setResultFilter] = useState([]);
  const [resultFilterDraft, setResultFilterDraft] = useState([]);
  const [resultSearch, setResultSearch] = useState('');
  const resultBtnRef = React.useRef(null);
  const [resultPopoverPosition, setResultPopoverPosition] = useState({ top: 0, left: 0 });
  const resultPopoverOpenRef = React.useRef(false);

  const [dateFilter, setDateFilter] = useState([]);
  const [dateFilterDraft, setDateFilterDraft] = useState([]);
  const [dateSearch, setDateSearch] = useState('');
  const dateBtnRef = React.useRef(null);
  const [datePopoverPosition, setDatePopoverPosition] = useState({ top: 0, left: 0 });
  const datePopoverOpenRef = React.useRef(false);

  const [timeFilter, setTimeFilter] = useState([]);
  const [timeFilterDraft, setTimeFilterDraft] = useState([]);
  const [timeSearch, setTimeSearch] = useState('');
  const timeBtnRef = React.useRef(null);
  const [timePopoverPosition, setTimePopoverPosition] = useState({ top: 0, left: 0 });
  const timePopoverOpenRef = React.useRef(false);

  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleResetFilters = () => {
    setUserFilter([]);
    setLeagueFilter([]);
    setAwayTeamFilter([]);
    setHomeTeamFilter([]);
    setLockFilter([]);
    setResultFilter([]);
    setDateFilter([]);
    setTimeFilter([]);
    setUserSearch('');
    setLeagueSearch('');
    setAwayTeamSearch('');
    setHomeTeamSearch('');
    setLockSearch('');
    setResultSearch('');
    setDateSearch('');
    setTimeSearch('');
  };

  const getUniqueValues = (picks, key, subKey = null) => {
    const values = picks.map(pick => {
      let value;
      if (key === 'user') {
        value = userMap[pick.userId] || pick.userId;
      } else if (key === 'lock') {
        value = pick.pickType === 'spread' ? `${pick.pickSide} Line` : pick.pickType === 'total' ? (pick.pickSide === 'OVER' ? 'Over' : 'Under') : '--';
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
  
  const filteredUsers = uniqueUsers.filter(val => val.toLowerCase().includes(userSearch.toLowerCase()));
  const filteredLeagues = uniqueLeagues.filter(val => val.toLowerCase().includes(leagueSearch.toLowerCase()));
  const filteredAwayTeams = uniqueAwayTeams.filter(val => val.toLowerCase().includes(awayTeamSearch.toLowerCase()));
  const filteredHomeTeams = uniqueHomeTeams.filter(val => val.toLowerCase().includes(homeTeamSearch.toLowerCase()));
  const filteredLocks = uniqueLocks.filter(val => val.toLowerCase().includes(lockSearch.toLowerCase()));
  const filteredResults = uniqueResults.filter(val => val.toLowerCase().includes(resultSearch.toLowerCase()));
  const filteredDates = uniqueDates.filter(val => val.toLowerCase().includes(dateSearch.toLowerCase()));
  const filteredTimes = uniqueTimes.filter(val => val.toLowerCase().includes(timeSearch.toLowerCase()));

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
                        <Popover as="span" className="relative">
                          {({ open, close }) => {
                            userPopoverOpenRef.current = open;
                            return (
                              <>
                                <Popover.Button
                                  ref={userBtnRef}
                                  className="ml-1 p-1 rounded hover:bg-gray-200"
                                  onClick={e => {
                                    setUserFilterDraft(userFilter.length ? userFilter : [...uniqueUsers]);
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setUserPopoverPosition({
                                      top: rect.bottom + window.scrollY + 4,
                                      left: rect.left + window.scrollX,
                                    });
                                  }}
                                >
                                  {isUserFiltered ? <FunnelIconSolid className="h-4 w-4 text-blue-600" /> : <FunnelIconOutline className="h-4 w-4 text-gray-500" />}
                                </Popover.Button>
                                <Portal>
                                  {open && (
                                    <Popover.Panel static className="z-50 w-64 bg-white border border-gray-300 rounded shadow-lg p-3" style={{ position: 'fixed', top: userPopoverPosition.top, left: userPopoverPosition.left }}>
                                      <div className="font-semibold mb-2">Filter Users</div>
                                      <div className="flex items-center mb-2 gap-2 text-xs">
                                        <button className="underline" onClick={() => setUserFilterDraft([...uniqueUsers])} type="button">Select all</button>
                                        <span>-</span>
                                        <button className="underline" onClick={() => setUserFilterDraft([])} type="button">Clear</button>
                                      </div>
                                      <input
                                        className="w-full mb-2 px-2 py-1 border border-gray-300 rounded"
                                        placeholder="Search..."
                                        value={userSearch}
                                        onChange={e => setUserSearch(e.target.value)}
                                      />
                                      <div className="max-h-40 overflow-y-auto mb-2">
                                        {filteredUsers.map(val => (
                                          <label key={val} className="flex items-center gap-2 px-1 py-0.5 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={userFilterDraft.includes(val)}
                                              onChange={() => setUserFilterDraft(draft => draft.includes(val) ? draft.filter(v => v !== val) : [...draft, val])}
                                            />
                                            <span>{val}</span>
                                          </label>
                                        ))}
                                      </div>
                                      <div className="flex justify-end gap-2 mt-2">
                                        <button
                                          className="px-3 py-1 rounded border border-gray-300 bg-gray-100"
                                          onClick={e => { e.stopPropagation(); setUserFilterDraft(userFilter); close(); }}
                                          type="button"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          className="px-3 py-1 rounded bg-green-600 text-white"
                                          onClick={e => { 
                                            e.stopPropagation(); 
                                            if (userFilterDraft.length === uniqueUsers.length) {
                                                setUserFilter([]);
                                            } else {
                                                setUserFilter(userFilterDraft); 
                                            }
                                            close(); 
                                          }}
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
                    <th className="px-2 py-2 border-r border-gray-300">
                      <div className="flex items-center gap-1">
                        <span>League</span>
                        <div className="flex flex-col ml-1">
                          <ChevronUpIcon className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'league' && sortConfig.direction === 'ascending' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => handleSort('league')} />
                          <ChevronDownIcon className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'league' && sortConfig.direction === 'descending' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => handleSort('league')} />
                        </div>
                        {/* League Filter Popover */}
                        <Popover as="span" className="relative">
                          {({ open, close }) => {
                            leaguePopoverOpenRef.current = open;
                            return (
                              <>
                                <Popover.Button
                                  ref={leagueBtnRef}
                                  className="ml-1 p-1 rounded hover:bg-gray-200"
                                  onClick={e => {
                                    setLeagueFilterDraft(leagueFilter.length ? leagueFilter : [...uniqueLeagues]);
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setLeaguePopoverPosition({
                                      top: rect.bottom + window.scrollY + 4,
                                      left: rect.left + window.scrollX,
                                    });
                                  }}
                                >
                                  {isLeagueFiltered ? <FunnelIconSolid className="h-4 w-4 text-blue-600" /> : <FunnelIconOutline className="h-4 w-4 text-gray-500" />}
                                </Popover.Button>
                                <Portal>
                                  {open && (
                                    <Popover.Panel static className="z-50 w-64 bg-white border border-gray-300 rounded shadow-lg p-3" style={{ position: 'fixed', top: leaguePopoverPosition.top, left: leaguePopoverPosition.left }}>
                                      <div className="font-semibold mb-2">Filter League</div>
                                      <div className="flex items-center mb-2 gap-2 text-xs">
                                        <button className="underline" onClick={() => setLeagueFilterDraft([...uniqueLeagues])} type="button">Select all</button>
                                        <span>-</span>
                                        <button className="underline" onClick={() => setLeagueFilterDraft([])} type="button">Clear</button>
                                      </div>
                                      <input
                                        className="w-full mb-2 px-2 py-1 border border-gray-300 rounded"
                                        placeholder="Search..."
                                        value={leagueSearch}
                                        onChange={e => setLeagueSearch(e.target.value)}
                                      />
                                      <div className="max-h-40 overflow-y-auto mb-2">
                                        {filteredLeagues.map(val => (
                                          <label key={val} className="flex items-center gap-2 px-1 py-0.5 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={leagueFilterDraft.includes(val)}
                                              onChange={() => setLeagueFilterDraft(draft => draft.includes(val) ? draft.filter(v => v !== val) : [...draft, val])}
                                            />
                                            <span>{val}</span>
                                          </label>
                                        ))}
                                      </div>
                                      <div className="flex justify-end gap-2 mt-2">
                                        <button
                                          className="px-3 py-1 rounded border border-gray-300 bg-gray-100"
                                          onClick={e => { e.stopPropagation(); setLeagueFilterDraft(leagueFilter); close(); }}
                                          type="button"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          className="px-3 py-1 rounded bg-green-600 text-white"
                                          onClick={e => { 
                                            e.stopPropagation(); 
                                            if (leagueFilterDraft.length === uniqueLeagues.length) {
                                                setLeagueFilter([]);
                                            } else {
                                                setLeagueFilter(leagueFilterDraft); 
                                            }
                                            close(); 
                                          }}
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
                    <th className="px-2 py-2 border-r border-gray-300">
                      <div className="flex items-center gap-1">
                        <span>Away</span>
                        <div className="flex flex-col ml-1">
                            <ChevronUpIcon className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'away_team_abbrev' && sortConfig.direction === 'ascending' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => handleSort('away_team_abbrev')} />
                            <ChevronDownIcon className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'away_team_abbrev' && sortConfig.direction === 'descending' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => handleSort('away_team_abbrev')} />
                        </div>
                        {/* Away Team Filter Popover */}
                        <Popover as="span" className="relative">
                          {({ open, close }) => {
                            awayTeamPopoverOpenRef.current = open;
                            return (
                              <>
                                <Popover.Button
                                  ref={awayTeamBtnRef}
                                  className="ml-1 p-1 rounded hover:bg-gray-200"
                                  onClick={e => {
                                    setAwayTeamFilterDraft(awayTeamFilter.length ? awayTeamFilter : [...uniqueAwayTeams]);
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setAwayTeamPopoverPosition({
                                      top: rect.bottom + window.scrollY + 4,
                                      left: rect.left + window.scrollX,
                                    });
                                  }}
                                >
                                  {isAwayTeamFiltered ? <FunnelIconSolid className="h-4 w-4 text-blue-600" /> : <FunnelIconOutline className="h-4 w-4 text-gray-500" />}
                                </Popover.Button>
                                <Portal>
                                  {open && (
                                    <Popover.Panel static className="z-50 w-64 bg-white border border-gray-300 rounded shadow-lg p-3" style={{ position: 'fixed', top: awayTeamPopoverPosition.top, left: awayTeamPopoverPosition.left }}>
                                      <div className="font-semibold mb-2">Filter Away Team</div>
                                      <div className="flex items-center mb-2 gap-2 text-xs">
                                        <button className="underline" onClick={() => setAwayTeamFilterDraft([...uniqueAwayTeams])} type="button">Select all</button>
                                        <span>-</span>
                                        <button className="underline" onClick={() => setAwayTeamFilterDraft([])} type="button">Clear</button>
                                      </div>
                                      <input
                                        className="w-full mb-2 px-2 py-1 border border-gray-300 rounded"
                                        placeholder="Search..."
                                        value={awayTeamSearch}
                                        onChange={e => setAwayTeamSearch(e.target.value)}
                                      />
                                      <div className="max-h-40 overflow-y-auto mb-2">
                                        {filteredAwayTeams.map(val => (
                                          <label key={val} className="flex items-center gap-2 px-1 py-0.5 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={awayTeamFilterDraft.includes(val)}
                                              onChange={() => setAwayTeamFilterDraft(draft => draft.includes(val) ? draft.filter(v => v !== val) : [...draft, val])}
                                            />
                                            <span>{val}</span>
                                          </label>
                                        ))}
                                      </div>
                                      <div className="flex justify-end gap-2 mt-2">
                                        <button
                                          className="px-3 py-1 rounded border border-gray-300 bg-gray-100"
                                          onClick={e => { e.stopPropagation(); setAwayTeamFilterDraft(awayTeamFilter); close(); }}
                                          type="button"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          className="px-3 py-1 rounded bg-green-600 text-white"
                                          onClick={e => { 
                                            e.stopPropagation(); 
                                            if (awayTeamFilterDraft.length === uniqueAwayTeams.length) {
                                                setAwayTeamFilter([]);
                                            } else {
                                                setAwayTeamFilter(awayTeamFilterDraft); 
                                            }
                                            close(); 
                                          }}
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
                    <th className="px-2 py-2 border-r border-gray-300">
                        <div className="flex items-center gap-1">
                            <span>Home</span>
                            <div className="flex flex-col ml-1">
                                <ChevronUpIcon className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'home_team_abbrev' && sortConfig.direction === 'ascending' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => handleSort('home_team_abbrev')} />
                                <ChevronDownIcon className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'home_team_abbrev' && sortConfig.direction === 'descending' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => handleSort('home_team_abbrev')} />
                            </div>
                            {/* Home Team Filter Popover */}
                            <Popover as="span" className="relative">
                              {({ open, close }) => {
                                homeTeamPopoverOpenRef.current = open;
                                return (
                                  <>
                                    <Popover.Button
                                      ref={homeTeamBtnRef}
                                      className="ml-1 p-1 rounded hover:bg-gray-200"
                                      onClick={e => {
                                        setHomeTeamFilterDraft(homeTeamFilter.length ? homeTeamFilter : [...uniqueHomeTeams]);
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setHomeTeamPopoverPosition({
                                          top: rect.bottom + window.scrollY + 4,
                                          left: rect.left + window.scrollX,
                                        });
                                      }}
                                    >
                                      {isHomeTeamFiltered ? <FunnelIconSolid className="h-4 w-4 text-blue-600" /> : <FunnelIconOutline className="h-4 w-4 text-gray-500" />}
                                    </Popover.Button>
                                    <Portal>
                                      {open && (
                                        <Popover.Panel static className="z-50 w-64 bg-white border border-gray-300 rounded shadow-lg p-3" style={{ position: 'fixed', top: homeTeamPopoverPosition.top, left: homeTeamPopoverPosition.left }}>
                                          <div className="font-semibold mb-2">Filter Home Team</div>
                                          <div className="flex items-center mb-2 gap-2 text-xs">
                                            <button className="underline" onClick={() => setHomeTeamFilterDraft([...uniqueHomeTeams])} type="button">Select all</button>
                                            <span>-</span>
                                            <button className="underline" onClick={() => setHomeTeamFilterDraft([])} type="button">Clear</button>
                                          </div>
                                          <input
                                            className="w-full mb-2 px-2 py-1 border border-gray-300 rounded"
                                            placeholder="Search..."
                                            value={homeTeamSearch}
                                            onChange={e => setHomeTeamSearch(e.target.value)}
                                          />
                                          <div className="max-h-40 overflow-y-auto mb-2">
                                            {filteredHomeTeams.map(val => (
                                              <label key={val} className="flex items-center gap-2 px-1 py-0.5 cursor-pointer">
                                                <input
                                                  type="checkbox"
                                                  checked={homeTeamFilterDraft.includes(val)}
                                                  onChange={() => setHomeTeamFilterDraft(draft => draft.includes(val) ? draft.filter(v => v !== val) : [...draft, val])}
                                                />
                                                <span>{val}</span>
                                              </label>
                                            ))}
                                          </div>
                                          <div className="flex justify-end gap-2 mt-2">
                                            <button
                                              className="px-3 py-1 rounded border border-gray-300 bg-gray-100"
                                              onClick={e => { e.stopPropagation(); setHomeTeamFilterDraft(homeTeamFilter); close(); }}
                                              type="button"
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              className="px-3 py-1 rounded bg-green-600 text-white"
                                              onClick={e => { 
                                                e.stopPropagation(); 
                                                if (homeTeamFilterDraft.length === uniqueHomeTeams.length) {
                                                    setHomeTeamFilter([]);
                                                } else {
                                                    setHomeTeamFilter(homeTeamFilterDraft); 
                                                }
                                                close(); 
                                              }}
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
                    <th className="px-2 py-2 border-r border-gray-300">
                        <div className="flex items-center gap-1">
                            <span>Lock</span>
                            <div className="flex flex-col ml-1">
                                <ChevronUpIcon className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'lock' && sortConfig.direction === 'ascending' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => handleSort('lock')} />
                                <ChevronDownIcon className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'lock' && sortConfig.direction === 'descending' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => handleSort('lock')} />
                            </div>
                            {/* Lock Filter Popover */}
                            <Popover as="span" className="relative">
                              {({ open, close }) => {
                                lockPopoverOpenRef.current = open;
                                return (
                                  <>
                                    <Popover.Button
                                      ref={lockBtnRef}
                                      className="ml-1 p-1 rounded hover:bg-gray-200"
                                      onClick={e => {
                                        setLockFilterDraft(lockFilter.length ? lockFilter : [...uniqueLocks]);
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setLockPopoverPosition({
                                          top: rect.bottom + window.scrollY + 4,
                                          left: rect.left + window.scrollX,
                                        });
                                      }}
                                    >
                                      {isLockFiltered ? <FunnelIconSolid className="h-4 w-4 text-blue-600" /> : <FunnelIconOutline className="h-4 w-4 text-gray-500" />}
                                    </Popover.Button>
                                    <Portal>
                                      {open && (
                                        <Popover.Panel static className="z-50 w-64 bg-white border border-gray-300 rounded shadow-lg p-3" style={{ position: 'fixed', top: lockPopoverPosition.top, left: lockPopoverPosition.left }}>
                                          <div className="font-semibold mb-2">Filter Lock</div>
                                          <div className="flex items-center mb-2 gap-2 text-xs">
                                            <button className="underline" onClick={() => setLockFilterDraft([...uniqueLocks])} type="button">Select all</button>
                                            <span>-</span>
                                            <button className="underline" onClick={() => setLockFilterDraft([])} type="button">Clear</button>
                                          </div>
                                          <input
                                            className="w-full mb-2 px-2 py-1 border border-gray-300 rounded"
                                            placeholder="Search..."
                                            value={lockSearch}
                                            onChange={e => setLockSearch(e.target.value)}
                                          />
                                          <div className="max-h-40 overflow-y-auto mb-2">
                                            {filteredLocks.map(val => (
                                              <label key={val} className="flex items-center gap-2 px-1 py-0.5 cursor-pointer">
                                                <input
                                                  type="checkbox"
                                                  checked={lockFilterDraft.includes(val)}
                                                  onChange={() => setLockFilterDraft(draft => draft.includes(val) ? draft.filter(v => v !== val) : [...draft, val])}
                                                />
                                                <span>{val}</span>
                                              </label>
                                            ))}
                                          </div>
                                          <div className="flex justify-end gap-2 mt-2">
                                            <button
                                              className="px-3 py-1 rounded border border-gray-300 bg-gray-100"
                                              onClick={e => { e.stopPropagation(); setLockFilterDraft(lockFilter); close(); }}
                                              type="button"
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              className="px-3 py-1 rounded bg-green-600 text-white"
                                              onClick={e => { 
                                                e.stopPropagation(); 
                                                if (lockFilterDraft.length === uniqueLocks.length) {
                                                    setLockFilter([]);
                                                } else {
                                                    setLockFilter(lockFilterDraft); 
                                                }
                                                close(); 
                                              }}
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
                    <th className="px-2 py-2 border-r border-gray-300">
                        <div className="flex items-center gap-1">
                            <span>Date</span>
                            <div className="flex flex-col ml-1">
                                <ChevronUpIcon className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'date' && sortConfig.direction === 'ascending' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => handleSort('date')} />
                                <ChevronDownIcon className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'date' && sortConfig.direction === 'descending' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => handleSort('date')} />
                            </div>
                            {/* Date Filter Popover */}
                            <Popover as="span" className="relative">
                              {({ open, close }) => {
                                datePopoverOpenRef.current = open;
                                return (
                                  <>
                                    <Popover.Button
                                      ref={dateBtnRef}
                                      className="ml-1 p-1 rounded hover:bg-gray-200"
                                      onClick={e => {
                                        setDateFilterDraft(dateFilter.length ? dateFilter : [...uniqueDates]);
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setDatePopoverPosition({
                                          top: rect.bottom + window.scrollY + 4,
                                          left: rect.left + window.scrollX,
                                        });
                                      }}
                                    >
                                      {isDateFiltered ? <FunnelIconSolid className="h-4 w-4 text-blue-600" /> : <FunnelIconOutline className="h-4 w-4 text-gray-500" />}
                                    </Popover.Button>
                                    <Portal>
                                      {open && (
                                        <Popover.Panel static className="z-50 w-64 bg-white border border-gray-300 rounded shadow-lg p-3" style={{ position: 'fixed', top: datePopoverPosition.top, left: datePopoverPosition.left }}>
                                          <div className="font-semibold mb-2">Filter Date</div>
                                          <div className="flex items-center mb-2 gap-2 text-xs">
                                            <button className="underline" onClick={() => setDateFilterDraft([...uniqueDates])} type="button">Select all</button>
                                            <span>-</span>
                                            <button className="underline" onClick={() => setDateFilterDraft([])} type="button">Clear</button>
                                          </div>
                                          <input
                                            className="w-full mb-2 px-2 py-1 border border-gray-300 rounded"
                                            placeholder="Search..."
                                            value={dateSearch}
                                            onChange={e => setDateSearch(e.target.value)}
                                          />
                                          <div className="max-h-40 overflow-y-auto mb-2">
                                            {filteredDates.map(val => (
                                              <label key={val} className="flex items-center gap-2 px-1 py-0.5 cursor-pointer">
                                                <input
                                                  type="checkbox"
                                                  checked={dateFilterDraft.includes(val)}
                                                  onChange={() => setDateFilterDraft(draft => draft.includes(val) ? draft.filter(v => v !== val) : [...draft, val])}
                                                />
                                                <span>{val}</span>
                                              </label>
                                            ))}
                                          </div>
                                          <div className="flex justify-end gap-2 mt-2">
                                            <button
                                              className="px-3 py-1 rounded border border-gray-300 bg-gray-100"
                                              onClick={e => { e.stopPropagation(); setDateFilterDraft(dateFilter); close(); }}
                                              type="button"
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              className="px-3 py-1 rounded bg-green-600 text-white"
                                              onClick={e => { 
                                                e.stopPropagation(); 
                                                if (dateFilterDraft.length === uniqueDates.length) {
                                                    setDateFilter([]);
                                                } else {
                                                    setDateFilter(dateFilterDraft); 
                                                }
                                                close(); 
                                              }}
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
                    <th className="px-2 py-2 border-r border-gray-300">
                        <div className="flex items-center gap-1">
                            <span>Time</span>
                            <div className="flex flex-col ml-1">
                                <ChevronUpIcon className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'time' && sortConfig.direction === 'ascending' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => handleSort('time')} />
                                <ChevronDownIcon className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'time' && sortConfig.direction === 'descending' ? 'text-blue-600' : 'text-gray-400'}`} onClick={() => handleSort('time')} />
                            </div>
                            {/* Time Filter Popover */}
                            <Popover as="span" className="relative">
                              {({ open, close }) => {
                                timePopoverOpenRef.current = open;
                                return (
                                  <>
                                    <Popover.Button
                                      ref={timeBtnRef}
                                      className="ml-1 p-1 rounded hover:bg-gray-200"
                                      onClick={e => {
                                        setTimeFilterDraft(timeFilter.length ? timeFilter : [...uniqueTimes]);
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setTimePopoverPosition({
                                          top: rect.bottom + window.scrollY + 4,
                                          left: rect.left + window.scrollX,
                                        });
                                      }}
                                    >
                                      {isTimeFiltered ? <FunnelIconSolid className="h-4 w-4 text-blue-600" /> : <FunnelIconOutline className="h-4 w-4 text-gray-500" />}
                                    </Popover.Button>
                                    <Portal>
                                      {open && (
                                        <Popover.Panel static className="z-50 w-64 bg-white border border-gray-300 rounded shadow-lg p-3" style={{ position: 'fixed', top: timePopoverPosition.top, left: timePopoverPosition.left }}>
                                          <div className="font-semibold mb-2">Filter Time</div>
                                          <div className="flex items-center mb-2 gap-2 text-xs">
                                            <button className="underline" onClick={() => setTimeFilterDraft([...uniqueTimes])} type="button">Select all</button>
                                            <span>-</span>
                                            <button className="underline" onClick={() => setTimeFilterDraft([])} type="button">Clear</button>
                                          </div>
                                          <input
                                            className="w-full mb-2 px-2 py-1 border border-gray-300 rounded"
                                            placeholder="Search..."
                                            value={timeSearch}
                                            onChange={e => setTimeSearch(e.target.value)}
                                          />
                                          <div className="max-h-40 overflow-y-auto mb-2">
                                            {filteredTimes.map(val => (
                                              <label key={val} className="flex items-center gap-2 px-1 py-0.5 cursor-pointer">
                                                <input
                                                  type="checkbox"
                                                  checked={timeFilterDraft.includes(val)}
                                                  onChange={() => setTimeFilterDraft(draft => draft.includes(val) ? draft.filter(v => v !== val) : [...draft, val])}
                                                />
                                                <span>{val}</span>
                                              </label>
                                            ))}
                                          </div>
                                          <div className="flex justify-end gap-2 mt-2">
                                            <button
                                              className="px-3 py-1 rounded border border-gray-300 bg-gray-100"
                                              onClick={e => { e.stopPropagation(); setTimeFilterDraft(timeFilter); close(); }}
                                              type="button"
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              className="px-3 py-1 rounded bg-green-600 text-white"
                                              onClick={e => { 
                                                e.stopPropagation(); 
                                                if (timeFilterDraft.length === uniqueTimes.length) {
                                                    setTimeFilter([]);
                                                } else {
                                                    setTimeFilter(timeFilterDraft); 
                                                }
                                                close(); 
                                              }}
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
                            {/* Result Filter Popover */}
                            <Popover as="span" className="relative">
                              {({ open, close }) => {
                                resultPopoverOpenRef.current = open;
                                return (
                                  <>
                                    <Popover.Button
                                      ref={resultBtnRef}
                                      className="ml-1 p-1 rounded hover:bg-gray-200"
                                      onClick={e => {
                                        setResultFilterDraft(resultFilter.length ? resultFilter : [...uniqueResults]);
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setResultPopoverPosition({
                                          top: rect.bottom + window.scrollY + 4,
                                          left: rect.left + window.scrollX,
                                        });
                                      }}
                                    >
                                      {isResultFiltered ? <FunnelIconSolid className="h-4 w-4 text-blue-600" /> : <FunnelIconOutline className="h-4 w-4 text-gray-500" />}
                                    </Popover.Button>
                                    <Portal>
                                      {open && (
                                        <Popover.Panel static className="z-50 w-64 bg-white border border-gray-300 rounded shadow-lg p-3" style={{ position: 'fixed', top: resultPopoverPosition.top, left: resultPopoverPosition.left }}>
                                          <div className="font-semibold mb-2">Filter W/L/T</div>
                                          <div className="flex items-center mb-2 gap-2 text-xs">
                                            <button className="underline" onClick={() => setResultFilterDraft([...uniqueResults])} type="button">Select all</button>
                                            <span>-</span>
                                            <button className="underline" onClick={() => setResultFilterDraft([])} type="button">Clear</button>
                                          </div>
                                          <input
                                            className="w-full mb-2 px-2 py-1 border border-gray-300 rounded"
                                            placeholder="Search..."
                                            value={resultSearch}
                                            onChange={e => setResultSearch(e.target.value)}
                                          />
                                          <div className="max-h-40 overflow-y-auto mb-2">
                                            {filteredResults.map(val => (
                                              <label key={val} className="flex items-center gap-2 px-1 py-0.5 cursor-pointer">
                                                <input
                                                  type="checkbox"
                                                  checked={resultFilterDraft.includes(val)}
                                                  onChange={() => setResultFilterDraft(draft => draft.includes(val) ? draft.filter(v => v !== val) : [...draft, val])}
                                                />
                                                <span>{val}</span>
                                              </label>
                                            ))}
                                          </div>
                                          <div className="flex justify-end gap-2 mt-2">
                                            <button
                                              className="px-3 py-1 rounded border border-gray-300 bg-gray-100"
                                              onClick={e => { e.stopPropagation(); setResultFilterDraft(resultFilter); close(); }}
                                              type="button"
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              className="px-3 py-1 rounded bg-green-600 text-white"
                                              onClick={e => { 
                                                e.stopPropagation(); 
                                                if (resultFilterDraft.length === uniqueResults.length) {
                                                    setResultFilter([]);
                                                } else {
                                                    setResultFilter(resultFilterDraft); 
                                                }
                                                close(); 
                                              }}
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
                        <td className="px-2 py-2 border-r border-gray-300">{pick.line !== undefined ? pick.line : '--'}</td>
                        <td className="px-2 py-2 border-r border-gray-300 whitespace-nowrap">{typeof pick.awayScore === 'number' && typeof pick.homeScore === 'number' ? `${pick.awayScore} - ${pick.homeScore}` : '--'}</td>
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
                             <td className="px-2 py-2 border-r border-gray-300">{pick.line !== undefined ? pick.line : '--'}</td>
                             <td className="px-2 py-2 border-r border-gray-300 whitespace-nowrap">{typeof pick.awayScore === 'number' && typeof pick.homeScore === 'number' ? `${pick.awayScore} - ${pick.homeScore}` : '--'}</td>
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
              {showPopularPicks && <PopularLocksModal picks={allPicks} onClose={() => setShowPopularPicks(false)} />}
    </div>
  );
};

export default WeeklyLocks; 