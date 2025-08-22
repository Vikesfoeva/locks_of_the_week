import React, { useEffect, useState, useContext, useRef } from 'react';
import axios from 'axios';
import { Popover, Portal } from '@headlessui/react';
import { FunnelIcon as FunnelIconOutline, CheckIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { FunnelIcon as FunnelIconSolid, ChevronUpIcon, ChevronDownIcon, LockClosedIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { LockOpenIcon } from '@heroicons/react/24/solid';
// import { AuthContext } from '../contexts/AuthContext'; // Uncomment if you have AuthContext
import { useAuth } from '../contexts/AuthContext'; // Using useAuth hook
import { API_URL } from '../config';
import ConfirmModal from '../components/ConfirmModal';
import FilterModal from '../components/FilterModal';
import { useFilterModal, createFilterButtonProps, createFilterModalProps } from '../hooks/useFilterModal';

const CURRENT_WEEK = 1; // TODO: Replace with dynamic week logic

const Locks = () => {
  // const { user } = useContext(AuthContext); // Uncomment if you have AuthContext
  const { currentUser } = useAuth(); // Use AuthContext
  const userId = currentUser?.uid || 'HARDCODED_USER_ID'; // Use Firebase UID, fallback if necessary
  const [games, setGames] = useState([]);
  const [selectedPicks, setSelectedPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [filters, setFilters] = useState({
    league: '',
    awayTeam: '',
    awayTeamFull: '',
    homeTeam: '',
    homeTeamFull: '',
    date: '',
  });
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [hideStartedGames, setHideStartedGames] = useState(true);
  // Initialize filter modals using the new hook system
  const leagueModal = useFilterModal([], []);
  const awayTeamModal = useFilterModal([], []);
  const awayTeamFullModal = useFilterModal([], []);
  const homeTeamModal = useFilterModal([], []);
  const homeTeamFullModal = useFilterModal([], []);
  const dateModal = useFilterModal([], []);
  const timeModal = useFilterModal([], []);

  // Extract current filter values for compatibility with existing logic
  const leagueFilter = leagueModal.selectedItems;
  const awayTeamFilter = awayTeamModal.selectedItems;
  const awayTeamFullFilter = awayTeamFullModal.selectedItems;
  const homeTeamFilter = homeTeamModal.selectedItems;
  const homeTeamFullFilter = homeTeamFullModal.selectedItems;
  const dateFilter = dateModal.selectedItems;
  const timeFilter = timeModal.selectedItems;

  // New state variables for collection management
  const [collections, setCollections] = useState([]); // To store available collection names
  const [selectedCollection, setSelectedCollection] = useState(''); // To store the currently selected collection
  // To store picks made by the user for each collection, helping manage the 3-pick limit per collection
  const [userPicksByCollection, setUserPicksByCollection] = useState({});

  // Add toast state
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Add confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [userMessage, setUserMessage] = useState('');
  const [showMessageInput, setShowMessageInput] = useState(false);

  // Active year state
  const [activeYear, setActiveYear] = useState(null);
  const [activeYearLoading, setActiveYearLoading] = useState(true);
  const [activeYearError, setActiveYearError] = useState(null);

  // Mobile sort/filter modal state
  const [showMobileSortFilter, setShowMobileSortFilter] = useState(false);

  // Helper function to parse collection name to a Date object for sorting
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

  const formatGameDate = (commenceTime) => {
    if (!commenceTime) return '';
    return new Date(commenceTime).toLocaleString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Helper function to format just the date
  const formatGameDateOnly = (commenceTime) => {
    if (!commenceTime) return '';
    return new Date(commenceTime).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  // Helper function to format just the time
  const formatGameTimeOnly = (commenceTime) => {
    if (!commenceTime) return '';
    return new Date(commenceTime).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Helper function to abbreviate league names for mobile
  const formatLeagueForMobile = (league) => {
    if (!league) return '';
    // Replace NFL Preseason with NFLP for mobile
    if (league === 'NFL Preseason') return 'NFLP';
    return league;
  };


  useEffect(() => {
    const fetchGamesAndUserPicks = async () => {
      if (!selectedCollection || !userId) {
        setGames([]); // Clear games if no collection or user
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        // Fetch games for the selected collection
        const gamesRes = await axios.get(`${API_URL}/games?collectionName=${selectedCollection}`);
        console.log(`Games API response for ${selectedCollection}:`, gamesRes.data);
        setGames(
          (Array.isArray(gamesRes.data) ? gamesRes.data : []).map(game => ({
            ...game,
            awayTeam: game.away_team_abbrev,
            homeTeam: game.home_team_abbrev,
            awayTeamFull: game.away_team_full,
            homeTeamFull: game.home_team_full,
            awaySpread: game.away_spread,
            homeSpread: game.home_spread,
            total: game.total,
            commenceTime: game.commence_time,
            league: game.league,
          }))
        );

        // Fetch user's picks for the selected collection using Firebase UID
        const picksRes = await axios.get(`${API_URL}/picks?userId=${userId}&collectionName=${selectedCollection}&year=${activeYear}`);
        const userPicksForCollection = Array.isArray(picksRes.data) ? picksRes.data : [];
        
        // Map fetched picks and mark them as 'submitted' and reconstruct key
        const processedUserPicks = userPicksForCollection.map(p => ({
          ...p,
          key: `${p.gameId}_${p.pickType}_${p.pickSide}`,
          status: 'submitted' // Picks fetched from backend are considered submitted
        }));

        setSelectedPicks(processedUserPicks);

        // Update userPicksByCollection with fetched picks for the current collection
        setUserPicksByCollection(prev => ({
          ...prev,
          [selectedCollection]: processedUserPicks 
        }));

        setError(''); // Clear previous errors
      } catch (err) {
        console.error(`Failed to load games or picks for ${selectedCollection}:`, err);
        setError(`Failed to load data for ${selectedCollection}`);
        setGames([]);
        setSelectedPicks([]);
      } finally {
        setLoading(false);
      }
    };

    if (selectedCollection) {
      fetchGamesAndUserPicks();
    } else {
      setGames([]);
      setSelectedPicks([]);
      setLoading(false);
    }
  }, [selectedCollection, userId, activeYear]);

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

  // Effect to fetch available collections (weeks)
  useEffect(() => {
    const fetchCollections = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${API_URL}/collections`);
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
        const initialPicksByCollection = {};
        filteredCollections.forEach(coll => {
          initialPicksByCollection[coll] = [];
        });
        setUserPicksByCollection(initialPicksByCollection);
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

  // Move all helper functions and state computations here, before the early returns
  const isGameLocked = (game) => {
    if (activeYear === 2024) return false;
    return new Date(game.commenceTime) < new Date();
  };

  const handlePickChange = (gameId, pickType, pickSide, line, price) => {
    const pickKey = `${gameId}_${pickType}_${pickSide}`;
    const currentCollectionPicks = selectedPicks; // These are for the selectedCollection

    const existingPick = currentCollectionPicks.find(p => p.key === pickKey);

    let newPicksForCurrentCollection;

    if (existingPick) {
      // If pick exists and is already submitted, do nothing.
      if (existingPick.status === 'submitted') {
        setError('This lock has already been submitted and cannot be changed.');
        setTimeout(() => setError(''), 3000);
        return;
      }
      // If pick exists and is pending, unselect it (remove it).
      newPicksForCurrentCollection = currentCollectionPicks.filter(p => p.key !== pickKey);
    } else {
      // Adding a new pick. Count current (pending + submitted) picks for this collection.
      const totalPicksForCollection = currentCollectionPicks.length;
      
      if (totalPicksForCollection >= 3) {
        setError('You can only make up to 3 locks per week.');
        setTimeout(() => setError(''), 3000);
        return;
      }
      setError(''); // Clear any previous error
      newPicksForCurrentCollection = [
        ...currentCollectionPicks,
        // Add new pick with 'pending' status
        { key: pickKey, gameId, pickType, pickSide, line, price, collectionName: selectedCollection, status: 'pending' }
      ];
    }
    setSelectedPicks(newPicksForCurrentCollection);
    setUserPicksByCollection(prev => ({
      ...prev,
      [selectedCollection]: newPicksForCurrentCollection
    }));
  };

  const handleSubmit = () => {
    const picksToSubmit = selectedPicks.filter(p => p.status === 'pending' && p.collectionName === selectedCollection);

    if (picksToSubmit.length === 0) {
      setToastMessage('Already submitted all locks for this week.');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    // Show message input first
    setShowMessageInput(true);
  };

  const handleMessageSubmit = () => {
    // Message is now optional - no validation needed
    setShowMessageInput(false);
    setShowConfirmModal(true);
  };

  // Convert newlines to <br> tags for HTML parsing
  const formatMessageForBackend = (message) => {
    return message.replace(/\n/g, '<br>');
  };

  const handleConfirmSubmit = async () => {
    setShowConfirmModal(false);
    setSubmitting(true);
    setError('');
    setSuccess(false);

    const picksToSubmit = selectedPicks.filter(p => p.status === 'pending' && p.collectionName === selectedCollection);

    try {
      const picksPayload = picksToSubmit.map(({ key, status, ...rest }) => rest);
      
      // Submit picks to the main API (this will also handle Google Apps Script)
      await axios.post(`${API_URL}/picks`, {
        userId: currentUser.uid,
        collectionName: selectedCollection,
        year: activeYear,
        picks: picksPayload,
        userMessage: userMessage.trim() ? formatMessageForBackend(userMessage.trim()) : ''
      });

      setSuccess(`Successfully submitted ${picksPayload.length} lock(s) for ${selectedCollection}!`);
      setTimeout(() => setSuccess(false), 3000);

      // Clear the user message after successful submission
      setUserMessage('');

      const updatedPicksForCurrentCollection = selectedPicks.map(p => {
        if (p.status === 'pending' && p.collectionName === selectedCollection && picksToSubmit.find(submittedPick => submittedPick.key === p.key)) {
          return { ...p, status: 'submitted' };
        }
        return p;
      });

      setSelectedPicks(updatedPicksForCurrentCollection);
      setUserPicksByCollection(prev => ({
        ...prev,
        [selectedCollection]: updatedPicksForCurrentCollection
      }));

    } catch (err) {
      console.error("Failed to submit picks:", err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to submit locks';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>Games</title>');
    printWindow.document.write('<style>body { font-family: sans-serif; } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #ddd; padding: 8px; text-align: left; } th { background-color: #f2f2f2; }</style>');
    printWindow.document.write('</head><body>');

    const date = parseCollectionNameToDate(selectedCollection);
    const weekString = date
      ? `Week of ${date.toLocaleString('default', { month: 'long' })} ${date.getDate()}, ${date.getFullYear()}`
      : selectedCollection;
    printWindow.document.write(`<h1>${weekString}</h1>`);

    printWindow.document.write('<table>');
    printWindow.document.write('<thead><tr><th>Sport</th><th>Away</th><th>Away Team</th><th>Home</th><th>Home Team</th><th>Date</th><th>Time</th><th>Spread</th><th>Total</th></tr></thead>');
    printWindow.document.write('<tbody>');

    sortedGames.forEach(game => {
      const awaySpread = `${game.awayTeam} ${game.awaySpread > 0 ? '+' : ''}${game.awaySpread}`;
      const homeSpread = `${game.homeTeam} ${game.homeSpread > 0 ? '+' : ''}${game.homeSpread}`;
      const overTotal = `O ${game.total}`;
      const underTotal = `U ${game.total}`;

      printWindow.document.write(`<tr>
        <td>${game.league}</td>
        <td>${game.awayTeam}</td>
        <td>${game.awayTeamFull}</td>
        <td>${game.homeTeam}</td>
        <td>${game.homeTeamFull}</td>
        <td>${formatGameDateOnly(game.commenceTime)}</td>
        <td>${formatGameTimeOnly(game.commenceTime)}</td>
        <td>${awaySpread}<br/>${homeSpread}</td>
        <td>${overTotal}<br/>${underTotal}</td>
      </tr>`);
    });

    printWindow.document.write('</tbody></table>');
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
  };

  const handleResetFilters = () => {
    // Reset all modal system filters using the new resetFilter method
    leagueModal.resetFilter();
    awayTeamModal.resetFilter();
    awayTeamFullModal.resetFilter();
    homeTeamModal.resetFilter();
    homeTeamFullModal.resetFilter();
    dateModal.resetFilter();
    timeModal.resetFilter();
    setHideStartedGames(true);
    // Reset sort configuration to default (null key triggers default league-based sorting)
    setSortConfig({ key: null, direction: 'asc' });
  };

  const handleFilterChange = (e, key) => {
    setFilters({ ...filters, [key]: e.target.value });
  };

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  // Helper to get unique values for a column from a given array
  const getUniqueValues = (arr, key, isDate = false, isTime = false) => {
    // Filter out games that have already started if hideStartedGames is true
    const filteredArr = hideStartedGames ? arr.filter(game => new Date(game.commenceTime) >= new Date()) : arr;
    
    const values = filteredArr.map(game => {
      if (isDate) {
        return formatGameDateOnly(game.commenceTime);
      }
      if (isTime) {
        return formatGameTimeOnly(game.commenceTime);
      }
      return game[key] || '';
    });
    return Array.from(new Set(values)).filter(Boolean).sort();
  };

  // Compute filteredGames for each filter popover, excluding that filter
  const filteredGamesForLeague = games.filter(game => {
    // Filter out games that have already started if hideStartedGames is true
    if (hideStartedGames && new Date(game.commenceTime) < new Date()) {
      return false;
    }
    
    return (
      (awayTeamFilter.length === 0 || awayTeamFilter.includes(game.awayTeam)) &&
      (awayTeamFullFilter.length === 0 || awayTeamFullFilter.includes(game.awayTeamFull)) &&
      (homeTeamFilter.length === 0 || homeTeamFilter.includes(game.homeTeam)) &&
      (homeTeamFullFilter.length === 0 || homeTeamFullFilter.includes(game.homeTeamFull)) &&
      (dateFilter.length === 0 || dateFilter.includes(formatGameDateOnly(game.commenceTime))) &&
      (timeFilter.length === 0 || timeFilter.includes(formatGameTimeOnly(game.commenceTime)))
    );
  });
  const filteredGamesForAwayTeam = games.filter(game => {
    // Filter out games that have already started if hideStartedGames is true
    if (hideStartedGames && new Date(game.commenceTime) < new Date()) {
      return false;
    }
    
    return (
      (leagueFilter.length === 0 || leagueFilter.includes(game.league)) &&
      (awayTeamFullFilter.length === 0 || awayTeamFullFilter.includes(game.awayTeamFull)) &&
      (homeTeamFilter.length === 0 || homeTeamFilter.includes(game.homeTeam)) &&
      (homeTeamFullFilter.length === 0 || homeTeamFullFilter.includes(game.homeTeamFull)) &&
      (dateFilter.length === 0 || dateFilter.includes(formatGameDateOnly(game.commenceTime))) &&
      (timeFilter.length === 0 || timeFilter.includes(formatGameTimeOnly(game.commenceTime)))
    );
  });
  const filteredGamesForAwayTeamFull = games.filter(game => {
    // Filter out games that have already started if hideStartedGames is true
    if (hideStartedGames && new Date(game.commenceTime) < new Date()) {
      return false;
    }
    
    return (
      (leagueFilter.length === 0 || leagueFilter.includes(game.league)) &&
      (awayTeamFilter.length === 0 || awayTeamFilter.includes(game.awayTeam)) &&
      (homeTeamFilter.length === 0 || homeTeamFilter.includes(game.homeTeam)) &&
      (homeTeamFullFilter.length === 0 || homeTeamFullFilter.includes(game.homeTeamFull)) &&
      (dateFilter.length === 0 || dateFilter.includes(formatGameDateOnly(game.commenceTime))) &&
      (timeFilter.length === 0 || timeFilter.includes(formatGameTimeOnly(game.commenceTime)))
    );
  });
  const filteredGamesForHomeTeam = games.filter(game => {
    // Filter out games that have already started if hideStartedGames is true
    if (hideStartedGames && new Date(game.commenceTime) < new Date()) {
      return false;
    }
    
    return (
      (leagueFilter.length === 0 || leagueFilter.includes(game.league)) &&
      (awayTeamFilter.length === 0 || awayTeamFilter.includes(game.awayTeam)) &&
      (awayTeamFullFilter.length === 0 || awayTeamFullFilter.includes(game.awayTeamFull)) &&
      (homeTeamFullFilter.length === 0 || homeTeamFullFilter.includes(game.homeTeamFull)) &&
      (dateFilter.length === 0 || dateFilter.includes(formatGameDateOnly(game.commenceTime))) &&
      (timeFilter.length === 0 || timeFilter.includes(formatGameTimeOnly(game.commenceTime)))
    );
  });
  const filteredGamesForHomeTeamFull = games.filter(game => {
    // Filter out games that have already started if hideStartedGames is true
    if (hideStartedGames && new Date(game.commenceTime) < new Date()) {
      return false;
    }
    
    return (
      (leagueFilter.length === 0 || leagueFilter.includes(game.league)) &&
      (awayTeamFilter.length === 0 || awayTeamFilter.includes(game.awayTeam)) &&
      (awayTeamFullFilter.length === 0 || awayTeamFullFilter.includes(game.awayTeamFull)) &&
      (homeTeamFilter.length === 0 || homeTeamFilter.includes(game.homeTeam)) &&
      (homeTeamFullFilter.length === 0 || homeTeamFullFilter.includes(game.homeTeamFull)) &&
      (dateFilter.length === 0 || dateFilter.includes(formatGameDateOnly(game.commenceTime))) &&
      (timeFilter.length === 0 || timeFilter.includes(formatGameTimeOnly(game.commenceTime)))
    );
  });
  const filteredGamesForDate = games.filter(game => {
    // Filter out games that have already started if hideStartedGames is true
    if (hideStartedGames && new Date(game.commenceTime) < new Date()) {
      return false;
    }
    
    return (
      (leagueFilter.length === 0 || leagueFilter.includes(game.league)) &&
      (awayTeamFilter.length === 0 || awayTeamFilter.includes(game.awayTeam)) &&
      (awayTeamFullFilter.length === 0 || awayTeamFullFilter.includes(game.awayTeamFull)) &&
      (homeTeamFilter.length === 0 || homeTeamFilter.includes(game.homeTeam)) &&
      (homeTeamFullFilter.length === 0 || homeTeamFullFilter.includes(game.homeTeamFull)) &&
      (timeFilter.length === 0 || timeFilter.includes(formatGameTimeOnly(game.commenceTime)))
    );
  });

  const filteredGamesForTime = games.filter(game => {
    // Filter out games that have already started if hideStartedGames is true
    if (hideStartedGames && new Date(game.commenceTime) < new Date()) {
      return false;
    }
    
    return (
      (leagueFilter.length === 0 || leagueFilter.includes(game.league)) &&
      (awayTeamFilter.length === 0 || awayTeamFilter.includes(game.awayTeam)) &&
      (awayTeamFullFilter.length === 0 || awayTeamFullFilter.includes(game.awayTeamFull)) &&
      (homeTeamFilter.length === 0 || homeTeamFilter.includes(game.homeTeam)) &&
      (homeTeamFullFilter.length === 0 || homeTeamFullFilter.includes(game.homeTeamFull)) &&
      (dateFilter.length === 0 || dateFilter.includes(formatGameDateOnly(game.commenceTime)))
    );
  });

  // Unique values for each column - calculate from filtered datasets to show only available options
  const uniqueLeagues = getUniqueValues(filteredGamesForLeague, 'league');
  const uniqueAwayTeams = getUniqueValues(filteredGamesForAwayTeam, 'awayTeam');
  const uniqueAwayTeamFulls = getUniqueValues(filteredGamesForAwayTeamFull, 'awayTeamFull');
  const uniqueHomeTeams = getUniqueValues(filteredGamesForHomeTeam, 'homeTeam');
  const uniqueHomeTeamFulls = getUniqueValues(filteredGamesForHomeTeamFull, 'homeTeamFull');
  const uniqueDates = getUniqueValues(filteredGamesForDate, 'commenceTime', true);
  const uniqueTimes = getUniqueValues(filteredGamesForTime, 'commenceTime', false, true);





  // Filter logic for all columns
  const filteredGames = games.filter(game => {
    // Filter out games that have already started if hideStartedGames is true
    if (hideStartedGames && new Date(game.commenceTime) < new Date()) {
      return false;
    }
    
    return (
      (leagueFilter.length === 0 || leagueFilter.includes(game.league)) &&
      (awayTeamFilter.length === 0 || awayTeamFilter.includes(game.awayTeam)) &&
      (awayTeamFullFilter.length === 0 || awayTeamFullFilter.includes(game.awayTeamFull)) &&
      (homeTeamFilter.length === 0 || homeTeamFilter.includes(game.homeTeam)) &&
      (homeTeamFullFilter.length === 0 || homeTeamFullFilter.includes(game.homeTeamFull)) &&
      (dateFilter.length === 0 || dateFilter.includes(formatGameDateOnly(game.commenceTime))) &&
      (timeFilter.length === 0 || timeFilter.includes(formatGameTimeOnly(game.commenceTime)))
    );
  });

  // Count games that have already started for the indicator
  const startedGamesCount = games.filter(game => new Date(game.commenceTime) < new Date()).length;

  const sortedGames = [...filteredGames].sort((a, b) => {
    const { key, direction } = sortConfig;
    
    // Apply default sorting: CFB first, then NFL, then NFLP, grouped by date and time
    if (!key) {
      const aLeague = a.league || '';
      const bLeague = b.league || '';
      const aTime = a.commenceTime ? new Date(a.commenceTime) : new Date(0);
      const bTime = b.commenceTime ? new Date(b.commenceTime) : new Date(0);
      
      // First sort by league: CFB first, then NFL, then NFLP
      const aLeagueOrder = aLeague === 'CFB' ? 0 : aLeague === 'NFL' ? 1 : aLeague === 'NFL Preseason' ? 2 : 3;
      const bLeagueOrder = bLeague === 'CFB' ? 0 : bLeague === 'NFL' ? 1 : bLeague === 'NFL Preseason' ? 2 : 3;
      
      if (aLeagueOrder !== bLeagueOrder) {
        return aLeagueOrder - bLeagueOrder;
      }
      
      // Then sort by date and time within each league
      return aTime - bTime;
    }
    
    // Apply user-selected sorting
    let aValue = a[key];
    let bValue = b[key];
    if (key === 'commenceTime' || key === 'date' || key === 'time') {
      // For time sorting, use the original commenceTime field, not the formatted time string
      if (key === 'time') {
        aValue = a.commenceTime ? new Date(a.commenceTime) : new Date(0);
        bValue = b.commenceTime ? new Date(b.commenceTime) : new Date(0);
      } else {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }
    } else {
      aValue = aValue ? aValue.toString().toLowerCase() : '';
      bValue = bValue ? bValue.toString().toLowerCase() : '';
    }
    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });



  // For each filter column, determine if it is actually filtered (not empty and not all options)
  const isLeagueFiltered = leagueModal.isFiltered;
  const isAwayTeamFiltered = awayTeamModal.isFiltered;
  const isAwayTeamFullFiltered = awayTeamFullModal.isFiltered;
  const isHomeTeamFiltered = homeTeamModal.isFiltered;
  const isHomeTeamFullFiltered = homeTeamFullModal.isFiltered;
  const isDateFiltered = dateModal.isFiltered;
  const isTimeFiltered = timeModal.isFiltered;

  // Now we can safely use early returns after all hooks and helper functions
  if (loading) return <div>Loading games...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (activeYearLoading) return <div>Loading active year...</div>;
  if (activeYearError) return <div className="text-red-500">{activeYearError}</div>;

  return (
    <div className="md:p-4">
      <div className="px-2 md:px-0">
        <h1 className="text-xl md:text-2xl font-bold mb-1 md:mb-4 text-center md:text-left">Lock Lines</h1>

        {/* Collection Selector Dropdown */}
        {collections.length > 0 && (
          <div className="mb-1 md:mb-4">
          <label htmlFor="collection-select" className="block text-sm font-medium text-gray-700 mr-2">
            Select Week:
          </label>
          <select
            id="collection-select"
            name="collection-select"
            className="mt-1 block w-full pl-2 md:pl-3 pr-8 md:pr-10 py-1 md:py-2 text-sm md:text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
            value={selectedCollection}
            onChange={(e) => {
              setSelectedCollection(e.target.value);
              // When collection changes, selectedPicks should reflect the newly selected collection's picks.
              // This will be handled by the useEffect that depends on selectedCollection,
              // which fetches and sets userPicks for that collection into selectedPicks.
              // We also clear current local selectedPicks to avoid brief display of old picks.
              setSelectedPicks(userPicksByCollection[e.target.value] || []);
            }}
            disabled={loading} // Disable while loading new collection data
          >
            {collections.map((collectionName, index) => {
              const isCurrentWeek = index === 0; // First item is most recent (current week)
              const date = parseCollectionNameToDate(collectionName);
              const weekNumber = collections.length - index; // Calculate week number (latest week gets highest number)
              const displayName = date 
                ? `Week ${weekNumber} - ${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(2)}` 
                : `Week ${weekNumber} - ${collectionName}`;
              
              return [
                // Add separator after current week
                index === 1 && <option key="separator" disabled style={{ borderTop: '1px solid #d1d5db', color: '#6b7280', fontStyle: 'italic' }}>— Previous Weeks —</option>,
                <option 
                  key={collectionName} 
                  value={collectionName}
                  style={{
                    color: isCurrentWeek ? '#111827' : '#6b7280',
                    fontWeight: isCurrentWeek ? '600' : '400'
                  }}
                >
                  {displayName}
                </option>
              ].filter(Boolean);
            }).flat()}
          </select>
        </div>
      )}

      <div className="mb-1 md:mb-2 text-gray-600 text-sm md:text-base">Select up to 3 outcomes across all games for the selected week.</div>
      {/* Update pick count display to reflect current collection's picks */}
      <div className="mb-2 md:mb-4 text-blue-700 font-semibold text-center md:text-left text-sm md:text-base">
                    Locks for {selectedCollection ? (
          (() => {
            const date = parseCollectionNameToDate(selectedCollection);
            return date 
              ? `Week of ${date.toLocaleString('default', { month: 'long' })} ${date.getDate()}` 
              : selectedCollection;
          })()
        ) : 'current week'}: {selectedPicks.length}/3
      </div>
      {success && <div className="text-green-600 mb-2">{success}</div>}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 md:mb-4 gap-1 md:gap-2">
        <div className="flex flex-wrap items-center gap-1 md:gap-2 mb-1 md:mb-0 justify-center md:justify-start">
          <button
            className="bg-blue-600 text-white px-2 py-1 md:px-4 md:py-2 rounded disabled:opacity-50 text-sm md:text-base"
            onClick={handleSubmit}
            disabled={selectedPicks.length === 0 || submitting}
          >
            Submit Locks
          </button>
          <button
            className="border border-gray-400 text-gray-700 bg-white px-2 py-1 md:px-4 md:py-2 rounded hover:bg-gray-100 text-sm md:text-base"
            onClick={handleResetFilters}
            type="button"
          >
            Reset Filters
          </button>
          <button
            className="border border-gray-400 text-gray-700 bg-white px-2 py-1 md:px-4 md:py-2 rounded hover:bg-gray-100 flex items-center text-sm md:text-base"
            onClick={handlePrint}
            type="button"
          >
            <PrinterIcon className="h-4 w-4 md:h-5 md:w-5 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Print Games</span>
            <span className="sm:hidden">Print</span>
          </button>
          <button
            className={`px-2 py-1 md:px-4 md:py-2 rounded flex items-center gap-1 md:gap-2 text-sm md:text-base ${
              hideStartedGames 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'border border-gray-400 text-gray-700 bg-white hover:bg-gray-100'
            }`}
            onClick={() => setHideStartedGames(!hideStartedGames)}
            type="button"
            title={hideStartedGames ? "Currently hiding games that have already started" : "Currently showing all games including those that have started"}
          >
            {hideStartedGames ? '✓' : '○'} <span className="hidden sm:inline">Hide Started Games</span><span className="sm:hidden">Hide Started</span>
            {hideStartedGames && startedGamesCount > 0 && (
              <span className="ml-1 text-xs bg-white text-blue-600 px-1 py-0.5 md:px-1.5 rounded-full">
                {startedGamesCount}
              </span>
            )}
          </button>
          {/* Mobile Sort & Filter Button - Only visible on mobile */}
          <button
            className={`md:hidden px-2 py-1 rounded flex items-center gap-1 text-sm ${
              (isLeagueFiltered || isAwayTeamFiltered || isHomeTeamFiltered || isDateFiltered || isTimeFiltered || sortConfig.key !== 'commenceTime')
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'border border-gray-400 text-gray-700 bg-white hover:bg-gray-100'
            }`}
            onClick={() => setShowMobileSortFilter(true)}
            type="button"
          >
            {(isLeagueFiltered || isAwayTeamFiltered || isHomeTeamFiltered || isDateFiltered || isTimeFiltered || sortConfig.key !== 'commenceTime') ? (
              <FunnelIconSolid className="h-4 w-4" />
            ) : (
              <FunnelIconOutline className="h-4 w-4" />
            )}
            Sort & Filter
            {(isLeagueFiltered || isAwayTeamFiltered || isHomeTeamFiltered || isDateFiltered || isTimeFiltered) && (
              <span className="ml-1 text-xs bg-white text-blue-600 px-1 py-0.5 rounded-full">
                Active
              </span>
            )}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1 md:gap-2 justify-center md:justify-start">
                          <span className="font-semibold text-gray-700 text-sm md:text-base">Your Locks:</span>
                {selectedPicks.length === 0 && <span className="text-gray-400 text-sm md:text-base">None selected</span>}
          {selectedPicks.map((pick, idx) => {
            let label = '';
            if (pick.pickType === 'spread') {
              label = `${pick.pickSide} ${pick.line > 0 ? '+' : ''}${pick.line}`;
            } else if (pick.pickType === 'total') {
              // Find the game for this pick
              const game = games.find(g => g._id === pick.gameId);
              if (game) {
                label = `${game.awayTeam}/${game.homeTeam} ${pick.pickSide === 'OVER' ? 'O' : 'U'} ${pick.line}`;
              } else {
                label = `${pick.pickSide === 'OVER' ? 'O' : 'U'} ${pick.line}`;
              }
            } else {
              label = `${pick.pickSide} ${pick.line}`;
            }
            return (
              <span
                key={pick.key}
                className={`inline-flex items-center px-1 py-0.5 md:px-2 md:py-1 rounded-full text-xs md:text-sm font-medium mr-0.5 md:mr-1 mb-0.5 md:mb-1 ${pick.status === 'submitted' ? 'bg-gray-300 text-gray-600' : 'bg-blue-100 text-blue-800'}`}
              >
                {label}
                {pick.status === 'submitted' ? (
                  <LockClosedIcon className="h-3 w-3 md:h-4 md:w-4 ml-0.5 md:ml-1 text-gray-500" title="Submitted/Locked" />
                ) : (
                  <button
                    className="ml-0.5 md:ml-1 text-blue-600 hover:text-red-600 focus:outline-none"
                    onClick={() => handlePickChange(pick.gameId, pick.pickType, pick.pickSide, pick.line, pick.price)}
                    title="Remove pick"
                    type="button"
                  >
                    <XMarkIcon className="h-3 w-3 md:h-4 md:w-4" />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      </div>
      </div>
      {/* Wrapper for full-width table */}
      <div className="w-full md:w-[90vw] md:mx-auto px-0 md:px-8 overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300 rounded shadow text-sm md:text-base">
          <thead>
            <tr className="bg-gray-100 text-left border-b border-gray-300">
              <th className="px-1 py-1 md:px-2 md:py-2 border-r border-gray-300">
                <div className="flex items-center gap-1">
                  <span>Sport</span>
                  {/* Hide sort/filter controls on mobile */}
                  <div className="hidden md:flex flex-col ml-1">
                    <ChevronUpIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'league' && sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); setSortConfig({ key: 'league', direction: 'asc' }); }}
                    />
                    <ChevronDownIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'league' && sortConfig.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); setSortConfig({ key: 'league', direction: 'desc' }); }}
                    />
                  </div>
                  <button
                    {...createFilterButtonProps(leagueModal, uniqueLeagues, (selectedLeagues) => {
                      leagueModal.handleSelectionChange(selectedLeagues);
                    }, {
                      IconComponent: FunnelIconOutline,
                      IconComponentSolid: FunnelIconSolid,
                      className: "hidden md:block ml-1 p-1 rounded hover:bg-gray-200 transition-colors"
                    })}
                  />
                </div>
              </th>
              <th className="px-1 py-1 md:px-2 md:py-2 border-r border-gray-300">
                <div className="flex items-center gap-1">
                  <span>Away</span>
                  {/* Hide sort/filter controls on mobile */}
                  <div className="hidden md:flex flex-col ml-1">
                    <ChevronUpIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'awayTeam' && sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); setSortConfig({ key: 'awayTeam', direction: 'asc' }); }}
                    />
                    <ChevronDownIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'awayTeam' && sortConfig.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); setSortConfig({ key: 'awayTeam', direction: 'desc' }); }}
                    />
                  </div>
                  <button
                    {...createFilterButtonProps(awayTeamModal, uniqueAwayTeams, (selectedAwayTeams) => {
                      awayTeamModal.handleSelectionChange(selectedAwayTeams);
                    }, {
                      IconComponent: FunnelIconOutline,
                      IconComponentSolid: FunnelIconSolid,
                      className: "hidden md:block ml-1 p-1 rounded hover:bg-gray-200 transition-colors"
                    })}
                  />
                </div>
              </th>
              <th className="px-2 py-2 border-r border-gray-300 hidden md:table-cell">
                <div className="flex items-center gap-1">
                  <span>Away Team</span>
                  <div className="flex flex-col ml-1">
                    <ChevronUpIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'awayTeamFull' && sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); setSortConfig({ key: 'awayTeamFull', direction: 'asc' }); }}
                    />
                    <ChevronDownIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'awayTeamFull' && sortConfig.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); setSortConfig({ key: 'awayTeamFull', direction: 'desc' }); }}
                    />
                  </div>
                  <button
                    {...createFilterButtonProps(awayTeamFullModal, uniqueAwayTeamFulls, (selectedAwayTeamFulls) => {
                      awayTeamFullModal.handleSelectionChange(selectedAwayTeamFulls);
                    }, {
                      IconComponent: FunnelIconOutline,
                      IconComponentSolid: FunnelIconSolid,
                      className: "ml-1 p-1 rounded hover:bg-gray-200 transition-colors"
                    })}
                  />
                </div>
              </th>
              <th className="px-1 py-1 md:px-2 md:py-2 border-r border-gray-300">
                <div className="flex items-center gap-1">
                  <span>Home</span>
                  {/* Hide sort/filter controls on mobile */}
                  <div className="hidden md:flex flex-col ml-1">
                    <ChevronUpIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'homeTeam' && sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); setSortConfig({ key: 'homeTeam', direction: 'asc' }); }}
                    />
                    <ChevronDownIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'homeTeam' && sortConfig.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); setSortConfig({ key: 'homeTeam', direction: 'desc' }); }}
                    />
                  </div>
                  <button
                    {...createFilterButtonProps(homeTeamModal, uniqueHomeTeams, (selectedHomeTeams) => {
                      homeTeamModal.handleSelectionChange(selectedHomeTeams);
                    }, {
                      IconComponent: FunnelIconOutline,
                      IconComponentSolid: FunnelIconSolid,
                      className: "hidden md:block ml-1 p-1 rounded hover:bg-gray-200 transition-colors"
                    })}
                  />
                </div>
              </th>
              <th className="px-2 py-2 border-r border-gray-300 hidden md:table-cell">
                <div className="flex items-center gap-1">
                  <span>Home Team</span>
                  <div className="flex flex-col ml-1">
                    <ChevronUpIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'homeTeamFull' && sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); setSortConfig({ key: 'homeTeamFull', direction: 'asc' }); }}
                    />
                    <ChevronDownIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'homeTeamFull' && sortConfig.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); setSortConfig({ key: 'homeTeamFull', direction: 'desc' }); }}
                    />
                  </div>
                  <button
                    {...createFilterButtonProps(homeTeamFullModal, uniqueHomeTeamFulls, (selectedHomeTeamFulls) => {
                      homeTeamFullModal.handleSelectionChange(selectedHomeTeamFulls);
                    }, {
                      IconComponent: FunnelIconOutline,
                      IconComponentSolid: FunnelIconSolid,
                      className: "ml-1 p-1 rounded hover:bg-gray-200 transition-colors"
                    })}
                  />
                </div>
              </th>
              <th className="px-1 py-1 md:px-2 md:py-2">
                <div className="flex items-center gap-1">
                  <span className="md:hidden">Time</span>
                  <span className="hidden md:inline">Date</span>
                  {/* Hide sort/filter controls on mobile */}
                  <div className="hidden md:flex flex-col ml-1">
                    <ChevronUpIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'date' && sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); setSortConfig({ key: 'date', direction: 'asc' }); }}
                    />
                    <ChevronDownIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'date' && sortConfig.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); setSortConfig({ key: 'date', direction: 'desc' }); }}
                    />
                  </div>
                  <button
                    {...createFilterButtonProps(dateModal, uniqueDates, (selectedDates) => {
                      dateModal.handleSelectionChange(selectedDates);
                    }, {
                      IconComponent: FunnelIconOutline,
                      IconComponentSolid: FunnelIconSolid,
                      className: "hidden md:block ml-1 p-1 rounded hover:bg-gray-200 transition-colors"
                    })}
                  />
                </div>
              </th>
              <th className="px-1 py-1 md:px-2 md:py-2 hidden md:table-cell">
                <div className="flex items-center gap-1">
                  <span>Time</span>
                  {/* Hide sort/filter controls on mobile */}
                  <div className="flex flex-col ml-1">
                    <ChevronUpIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'time' && sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); setSortConfig({ key: 'time', direction: 'asc' }); }}
                    />
                    <ChevronDownIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'time' && sortConfig.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); setSortConfig({ key: 'time', direction: 'desc' }); }}
                    />
                  </div>
                  <button
                    {...createFilterButtonProps(timeModal, uniqueTimes, (selectedTimes) => {
                      timeModal.handleSelectionChange(selectedTimes);
                    }, {
                      IconComponent: FunnelIconOutline,
                      IconComponentSolid: FunnelIconSolid,
                      className: "ml-1 p-1 rounded hover:bg-gray-200 transition-colors"
                    })}
                  />
                </div>
              </th>
              <th className="px-1 py-1 md:px-2 md:py-2 border-r border-gray-300">Spread</th>
              <th className="px-1 py-1 md:px-2 md:py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {sortedGames.map((game, idx) => {
              const awaySpreadPickKey = `${game._id}_spread_${game.awayTeam}`;
              const homeSpreadPickKey = `${game._id}_spread_${game.homeTeam}`;
              const overTotalPickKey = `${game._id}_total_OVER`;
              const underTotalPickKey = `${game._id}_total_UNDER`;

              const awaySpreadPick = selectedPicks.find(p => p.key === awaySpreadPickKey);
              const homeSpreadPick = selectedPicks.find(p => p.key === homeSpreadPickKey);
              const overTotalPick = selectedPicks.find(p => p.key === overTotalPickKey);
              const underTotalPick = selectedPicks.find(p => p.key === underTotalPickKey);

              return (
                <tr
                  key={game._id}
                  className={
                    `${isGameLocked(game) ? 'opacity-50' : ''} ` +
                    `${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b border-gray-300`
                  }
                >
                  <td className="px-1 py-1 md:px-2 md:py-2 border-r border-gray-300 font-semibold">
                    <span className="md:hidden">{formatLeagueForMobile(game.league)}</span>
                    <span className="hidden md:inline">{game.league}</span>
                  </td>
                  <td className="px-1 py-1 md:px-2 md:py-2 border-r border-gray-300 font-bold">{game.awayTeam}</td>
                  <td className="px-1 py-1 md:px-2 md:py-2 border-r border-gray-300 hidden md:table-cell">{game.awayTeamFull}</td>
                  <td className="px-1 py-1 md:px-2 md:py-2 border-r border-gray-300 font-bold">{game.homeTeam}</td>
                  <td className="px-1 py-1 md:px-2 md:py-2 border-r border-gray-300 hidden md:table-cell">{game.homeTeamFull}</td>
                  <td className="px-1 py-1 md:px-2 md:py-2 border-r border-gray-300">
                    <div className="md:hidden text-xs leading-tight">
                      <div>{formatGameDateOnly(game.commenceTime)}</div>
                      <div>{formatGameTimeOnly(game.commenceTime)}</div>
                    </div>
                    <span className="hidden md:inline whitespace-nowrap">{formatGameDateOnly(game.commenceTime)}</span>
                  </td>
                  <td className="px-1 py-1 md:px-2 md:py-2 border-r border-gray-300 whitespace-nowrap hidden md:table-cell">{formatGameTimeOnly(game.commenceTime)}</td>
                  <td className="px-1 py-1 md:px-2 md:py-2 border-r border-gray-300">
                    <div className="flex flex-col gap-0.5 md:gap-1">
                      <button
                        type="button"
                        disabled={
                          isGameLocked(game) || 
                          (awaySpreadPick?.status === 'submitted') ||
                          (selectedPicks.length >= 3 && !awaySpreadPick)
                        }
                        onClick={() => handlePickChange(game._id, 'spread', game.awayTeam, game.awaySpread, null)}
                        className={`text-xs md:text-sm px-1 py-0.5 md:px-2 md:py-1 rounded border transition-colors ${
                          awaySpreadPick 
                            ? 'bg-blue-600 text-white border-blue-600' 
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {game.awayTeam} {game.awaySpread > 0 ? '+' : ''}{game.awaySpread}
                      </button>
                      <button
                        type="button"
                        disabled={
                          isGameLocked(game) || 
                          (homeSpreadPick?.status === 'submitted') ||
                          (selectedPicks.length >= 3 && !homeSpreadPick)
                        }
                        onClick={() => handlePickChange(game._id, 'spread', game.homeTeam, game.homeSpread, null)}
                        className={`text-xs md:text-sm px-1 py-0.5 md:px-2 md:py-1 rounded border transition-colors ${
                          homeSpreadPick 
                            ? 'bg-blue-600 text-white border-blue-600' 
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {game.homeTeam} {game.homeSpread > 0 ? '+' : ''}{game.homeSpread}
                      </button>
                    </div>
                  </td>
                  <td className="px-1 py-1 md:px-2 md:py-2">
                    <div className="flex flex-col gap-0.5 md:gap-1">
                      <button
                        type="button"
                        disabled={
                          isGameLocked(game) || 
                          (overTotalPick?.status === 'submitted') ||
                          (selectedPicks.length >= 3 && !overTotalPick)
                        }
                        onClick={() => handlePickChange(game._id, 'total', 'OVER', game.total, null)}
                        className={`text-xs md:text-sm px-1 py-0.5 md:px-2 md:py-1 rounded border transition-colors ${
                          overTotalPick 
                            ? 'bg-blue-600 text-white border-blue-600' 
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        O {game.total}
                      </button>
                      <button
                        type="button"
                        disabled={
                          isGameLocked(game) || 
                          (underTotalPick?.status === 'submitted') ||
                          (selectedPicks.length >= 3 && !underTotalPick)
                        }
                        onClick={() => handlePickChange(game._id, 'total', 'UNDER', game.total, null)}
                        className={`text-xs md:text-sm px-1 py-0.5 md:px-2 md:py-1 rounded border transition-colors ${
                          underTotalPick 
                            ? 'bg-blue-600 text-white border-blue-600' 
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        U {game.total}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showToast && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded shadow-lg z-50">
          {toastMessage}
        </div>
      )}

      {/* Message Input Modal */}
      {showMessageInput && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Add a Message</h3>
            <p className="text-gray-600 mb-4">
              Please enter a message to accompany your locks submission (optional):
            </p>
            <textarea
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              placeholder="Enter your message here..."
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={6}
              maxLength={2000}
            />
            <div className="flex justify-between items-center mt-2 mb-4">
              <span className="text-sm text-gray-500">
                {userMessage.length}/2000 characters
              </span>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowMessageInput(false);
                  setUserMessage('');
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleMessageSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmSubmit}
        title="Confirm Submit Locks"
        message={`Are you sure you want to submit ${selectedPicks.filter(p => p.status === 'pending' && p.collectionName === selectedCollection).length} lock(s) for this week? This action cannot be undone.`}
        confirmText="Submit Locks"
        cancelText="Cancel"
      />

      {/* Filter Modals */}
      <FilterModal
        {...createFilterModalProps(leagueModal, uniqueLeagues, (selectedLeagues) => {
          leagueModal.handleSelectionChange(selectedLeagues);
        }, {
          title: 'Filter League',
          placement: 'bottom-start',
        })}
      />

      <FilterModal
        {...createFilterModalProps(awayTeamModal, uniqueAwayTeams, (selectedAwayTeams) => {
          awayTeamModal.handleSelectionChange(selectedAwayTeams);
        }, {
          title: 'Filter Away Team',
          placement: 'bottom-start',
        })}
      />

      <FilterModal
        {...createFilterModalProps(awayTeamFullModal, uniqueAwayTeamFulls, (selectedAwayTeamFulls) => {
          awayTeamFullModal.handleSelectionChange(selectedAwayTeamFulls);
        }, {
          title: 'Filter Away Team Full',
          placement: 'bottom-start',
        })}
      />

      <FilterModal
        {...createFilterModalProps(homeTeamModal, uniqueHomeTeams, (selectedHomeTeams) => {
          homeTeamModal.handleSelectionChange(selectedHomeTeams);
        }, {
          title: 'Filter Home Team',
          placement: 'bottom-start',
        })}
      />

      <FilterModal
        {...createFilterModalProps(homeTeamFullModal, uniqueHomeTeamFulls, (selectedHomeTeamFulls) => {
          homeTeamFullModal.handleSelectionChange(selectedHomeTeamFulls);
        }, {
          title: 'Filter Home Team Full',
          placement: 'bottom-start',
        })}
      />

      <FilterModal
        {...createFilterModalProps(dateModal, uniqueDates, (selectedDates) => {
          dateModal.handleSelectionChange(selectedDates);
        }, {
          title: 'Filter Date',
          placement: 'bottom-start',
        })}
      />

      <FilterModal
        {...createFilterModalProps(timeModal, uniqueTimes, (selectedTimes) => {
          timeModal.handleSelectionChange(selectedTimes);
        }, {
          title: 'Filter Time',
          placement: 'bottom-start',
        })}
      />

      {/* Mobile Sort & Filter Modal */}
      {showMobileSortFilter && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 md:hidden">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Sort & Filter</h3>
              <button
                onClick={() => setShowMobileSortFilter(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            {/* Sort Section */}
            <div className="mb-6">
              <h4 className="font-medium text-gray-900 mb-3">Sort By</h4>
              <div className="space-y-2">
                {[
                  { key: 'league', label: 'Sport' },
                  { key: 'awayTeam', label: 'Away Team' },
                  { key: 'homeTeam', label: 'Home Team' },
                  { key: 'commenceTime', label: 'Time' }
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm">{label}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setSortConfig({ key, direction: 'asc' })}
                        className={`px-2 py-1 text-xs rounded ${
                          sortConfig.key === key && sortConfig.direction === 'asc'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        <ChevronUpIcon className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => setSortConfig({ key, direction: 'desc' })}
                        className={`px-2 py-1 text-xs rounded ${
                          sortConfig.key === key && sortConfig.direction === 'desc'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        <ChevronDownIcon className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Filter Section */}
            <div className="mb-6">
              <h4 className="font-medium text-gray-900 mb-3">Filters</h4>
              <div className="space-y-4">
                {/* Sport Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sport</label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    value={leagueFilter.length === 1 ? leagueFilter[0] : ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      leagueModal.handleSelectionChange(value ? [value] : []);
                    }}
                  >
                    <option value="">All Sports</option>
                    {uniqueLeagues.map(league => (
                      <option key={league} value={league}>{league}</option>
                    ))}
                  </select>
                </div>

                {/* Away Team Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Away Team</label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    value={awayTeamFilter.length === 1 ? awayTeamFilter[0] : ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      awayTeamModal.handleSelectionChange(value ? [value] : []);
                    }}
                  >
                    <option value="">All Away Teams</option>
                    {uniqueAwayTeams.map(team => (
                      <option key={team} value={team}>{team}</option>
                    ))}
                  </select>
                </div>

                {/* Home Team Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Home Team</label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    value={homeTeamFilter.length === 1 ? homeTeamFilter[0] : ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      homeTeamModal.handleSelectionChange(value ? [value] : []);
                    }}
                  >
                    <option value="">All Home Teams</option>
                    {uniqueHomeTeams.map(team => (
                      <option key={team} value={team}>{team}</option>
                    ))}
                  </select>
                </div>

                {/* Date Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    value={dateFilter.length === 1 ? dateFilter[0] : ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      dateModal.handleSelectionChange(value ? [value] : []);
                    }}
                  >
                    <option value="">All Dates</option>
                    {uniqueDates.map(date => (
                      <option key={date} value={date}>{date}</option>
                    ))}
                  </select>
                </div>

                {/* Time Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    value={timeFilter.length === 1 ? timeFilter[0] : ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      timeModal.handleSelectionChange(value ? [value] : []);
                    }}
                  >
                    <option value="">All Times</option>
                    {uniqueTimes.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between gap-3">
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Reset All
              </button>
              <button
                onClick={() => setShowMobileSortFilter(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Locks; 