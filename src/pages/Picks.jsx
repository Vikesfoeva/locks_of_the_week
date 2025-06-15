import React, { useEffect, useState, useContext, useRef } from 'react';
import axios from 'axios';
import { Popover, Portal } from '@headlessui/react';
import { FunnelIcon as FunnelIconOutline, CheckIcon } from '@heroicons/react/24/outline';
import { FunnelIcon as FunnelIconSolid, ChevronUpIcon, ChevronDownIcon, LockClosedIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { LockOpenIcon } from '@heroicons/react/24/solid';
// import { AuthContext } from '../contexts/AuthContext'; // Uncomment if you have AuthContext
import { useAuth } from '../contexts/AuthContext'; // Using useAuth hook
import { API_URL } from '../config';

const CURRENT_WEEK = 1; // TODO: Replace with dynamic week logic

const Picks = () => {
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
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
  const [awayTeamFilterOpen, setAwayTeamFilterOpen] = useState(false);
  const [awayTeamFilterDraft, setAwayTeamFilterDraft] = useState([]);
  const [awayTeamFilter, setAwayTeamFilter] = useState([]);
  const [awayTeamSearch, setAwayTeamSearch] = useState('');
  const funnelBtnRef = useRef(null);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });

  // State for all popover filters
  const [leagueFilterDraft, setLeagueFilterDraft] = useState([]);
  const [leagueFilter, setLeagueFilter] = useState([]);
  const [leagueSearch, setLeagueSearch] = useState('');
  const leagueBtnRef = useRef(null);
  const [leaguePopoverPosition, setLeaguePopoverPosition] = useState({ top: 0, left: 0 });
  const leaguePopoverOpenRef = useRef(false);

  const [awayTeamFullFilterOpen, setAwayTeamFullFilterOpen] = useState(false);
  const [awayTeamFullFilterDraft, setAwayTeamFullFilterDraft] = useState([]);
  const [awayTeamFullFilter, setAwayTeamFullFilter] = useState([]);
  const [awayTeamFullSearch, setAwayTeamFullSearch] = useState('');
  const awayTeamFullBtnRef = useRef(null);
  const [awayTeamFullPopoverPosition, setAwayTeamFullPopoverPosition] = useState({ top: 0, left: 0 });

  const [homeTeamFilterOpen, setHomeTeamFilterOpen] = useState(false);
  const [homeTeamFilterDraft, setHomeTeamFilterDraft] = useState([]);
  const [homeTeamFilter, setHomeTeamFilter] = useState([]);
  const [homeTeamSearch, setHomeTeamSearch] = useState('');
  const homeTeamBtnRef = useRef(null);
  const [homeTeamPopoverPosition, setHomeTeamPopoverPosition] = useState({ top: 0, left: 0 });

  const [homeTeamFullFilterOpen, setHomeTeamFullFilterOpen] = useState(false);
  const [homeTeamFullFilterDraft, setHomeTeamFullFilterDraft] = useState([]);
  const [homeTeamFullFilter, setHomeTeamFullFilter] = useState([]);
  const [homeTeamFullSearch, setHomeTeamFullSearch] = useState('');
  const homeTeamFullBtnRef = useRef(null);
  const [homeTeamFullPopoverPosition, setHomeTeamFullPopoverPosition] = useState({ top: 0, left: 0 });

  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [dateFilterDraft, setDateFilterDraft] = useState([]);
  const [dateFilter, setDateFilter] = useState([]);
  const [dateSearch, setDateSearch] = useState('');
  const dateBtnRef = useRef(null);
  const [datePopoverPosition, setDatePopoverPosition] = useState({ top: 0, left: 0 });

  // Add refs for all popovers
  const awayTeamPopoverOpenRef = useRef(false);
  const awayTeamFullPopoverOpenRef = useRef(false);
  const homeTeamPopoverOpenRef = useRef(false);
  const homeTeamFullPopoverOpenRef = useRef(false);
  const datePopoverOpenRef = useRef(false);

  // New state variables for collection management
  const [collections, setCollections] = useState([]); // To store available collection names
  const [selectedCollection, setSelectedCollection] = useState(''); // To store the currently selected collection
  // To store picks made by the user for each collection, helping manage the 3-pick limit per collection
  const [userPicksByCollection, setUserPicksByCollection] = useState({});

  // Add toast state
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Active year state
  const [activeYear, setActiveYear] = useState(null);
  const [activeYearLoading, setActiveYearLoading] = useState(true);
  const [activeYearError, setActiveYearError] = useState(null);

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

  // Add useEffect hooks for all popovers
  useEffect(() => {
    if (awayTeamPopoverOpenRef.current && funnelBtnRef.current) {
      const rect = funnelBtnRef.current.getBoundingClientRect();
      setPopoverPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      });
    }
  }, [awayTeamPopoverOpenRef.current]);

  useEffect(() => {
    if (awayTeamFullPopoverOpenRef.current && awayTeamFullBtnRef.current) {
      const rect = awayTeamFullBtnRef.current.getBoundingClientRect();
      setAwayTeamFullPopoverPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      });
    }
  }, [awayTeamFullPopoverOpenRef.current]);

  useEffect(() => {
    if (homeTeamPopoverOpenRef.current && homeTeamBtnRef.current) {
      const rect = homeTeamBtnRef.current.getBoundingClientRect();
      setHomeTeamPopoverPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      });
    }
  }, [homeTeamPopoverOpenRef.current]);

  useEffect(() => {
    if (homeTeamFullPopoverOpenRef.current && homeTeamFullBtnRef.current) {
      const rect = homeTeamFullBtnRef.current.getBoundingClientRect();
      setHomeTeamFullPopoverPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      });
    }
  }, [homeTeamFullPopoverOpenRef.current]);

  useEffect(() => {
    if (datePopoverOpenRef.current && dateBtnRef.current) {
      const rect = dateBtnRef.current.getBoundingClientRect();
      setDatePopoverPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      });
    }
  }, [datePopoverOpenRef.current]);

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
        setError('This pick has already been submitted and cannot be changed.');
        setTimeout(() => setError(''), 3000);
        return;
      }
      // If pick exists and is pending, unselect it (remove it).
      newPicksForCurrentCollection = currentCollectionPicks.filter(p => p.key !== pickKey);
    } else {
      // Adding a new pick. Count current (pending + submitted) picks for this collection.
      const totalPicksForCollection = currentCollectionPicks.length;
      
      if (totalPicksForCollection >= 3) {
        setError('You can only make up to 3 picks per week.');
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

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    setSuccess(false);

    const picksToSubmit = selectedPicks.filter(p => p.status === 'pending' && p.collectionName === selectedCollection);

    if (picksToSubmit.length === 0) {
      setToastMessage('Already submitted all picks for this week.');
      setShowToast(true);
      setSubmitting(false);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    try {
      const picksPayload = picksToSubmit.map(({ key, status, ...rest }) => rest);
      
      await axios.post(`${API_URL}/picks`, {
        userId: currentUser.uid,
        collectionName: selectedCollection,
        year: activeYear,
        picks: picksPayload
      });

      setSuccess(`Successfully submitted ${picksPayload.length} pick(s) for ${selectedCollection}!`);
      setTimeout(() => setSuccess(false), 3000);

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
      const errorMessage = err.response?.data?.message || err.message || 'Failed to submit picks';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetFilters = () => {
    setLeagueFilter([]);
    setAwayTeamFilter([]);
    setAwayTeamFullFilter([]);
    setHomeTeamFilter([]);
    setHomeTeamFullFilter([]);
    setDateFilter([]);
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
  const getUniqueValues = (arr, key, isDate = false) => {
    const values = arr.map(game => {
      if (isDate) {
        return formatGameDate(game.commenceTime);
      }
      return game[key] || '';
    });
    return Array.from(new Set(values)).filter(Boolean).sort();
  };

  // Compute filteredGames for each filter popover, excluding that filter
  const filteredGamesForLeague = games.filter(game => (
    (awayTeamFilter.length === 0 || awayTeamFilter.includes(game.awayTeam)) &&
    (awayTeamFullFilter.length === 0 || awayTeamFullFilter.includes(game.awayTeamFull)) &&
    (homeTeamFilter.length === 0 || homeTeamFilter.includes(game.homeTeam)) &&
    (homeTeamFullFilter.length === 0 || homeTeamFullFilter.includes(game.homeTeamFull)) &&
    (dateFilter.length === 0 || dateFilter.includes(formatGameDate(game.commenceTime)))
  ));
  const filteredGamesForAwayTeam = games.filter(game => (
    (leagueFilter.length === 0 || leagueFilter.includes(game.league)) &&
    (awayTeamFullFilter.length === 0 || awayTeamFullFilter.includes(game.awayTeamFull)) &&
    (homeTeamFilter.length === 0 || homeTeamFilter.includes(game.homeTeam)) &&
    (homeTeamFullFilter.length === 0 || homeTeamFullFilter.includes(game.homeTeamFull)) &&
    (dateFilter.length === 0 || dateFilter.includes(formatGameDate(game.commenceTime)))
  ));
  const filteredGamesForAwayTeamFull = games.filter(game => (
    (leagueFilter.length === 0 || leagueFilter.includes(game.league)) &&
    (awayTeamFilter.length === 0 || awayTeamFilter.includes(game.awayTeam)) &&
    (homeTeamFilter.length === 0 || homeTeamFilter.includes(game.homeTeam)) &&
    (homeTeamFullFilter.length === 0 || homeTeamFullFilter.includes(game.homeTeamFull)) &&
    (dateFilter.length === 0 || dateFilter.includes(formatGameDate(game.commenceTime)))
  ));
  const filteredGamesForHomeTeam = games.filter(game => (
    (leagueFilter.length === 0 || leagueFilter.includes(game.league)) &&
    (awayTeamFilter.length === 0 || awayTeamFilter.includes(game.awayTeam)) &&
    (awayTeamFullFilter.length === 0 || awayTeamFullFilter.includes(game.awayTeamFull)) &&
    (homeTeamFullFilter.length === 0 || homeTeamFullFilter.includes(game.homeTeamFull)) &&
    (dateFilter.length === 0 || dateFilter.includes(formatGameDate(game.commenceTime)))
  ));
  const filteredGamesForHomeTeamFull = games.filter(game => (
    (leagueFilter.length === 0 || leagueFilter.includes(game.league)) &&
    (awayTeamFilter.length === 0 || awayTeamFilter.includes(game.awayTeam)) &&
    (awayTeamFullFilter.length === 0 || awayTeamFullFilter.includes(game.awayTeamFull)) &&
    (homeTeamFilter.length === 0 || homeTeamFilter.includes(game.homeTeam)) &&
    (homeTeamFullFilter.length === 0 || homeTeamFullFilter.includes(game.homeTeamFull)) &&
    (dateFilter.length === 0 || dateFilter.includes(formatGameDate(game.commenceTime)))
  ));
  const filteredGamesForDate = games.filter(game => (
    (leagueFilter.length === 0 || leagueFilter.includes(game.league)) &&
    (awayTeamFilter.length === 0 || awayTeamFilter.includes(game.awayTeam)) &&
    (awayTeamFullFilter.length === 0 || awayTeamFullFilter.includes(game.awayTeamFull)) &&
    (homeTeamFilter.length === 0 || homeTeamFilter.includes(game.homeTeam)) &&
    (homeTeamFullFilter.length === 0 || homeTeamFullFilter.includes(game.homeTeamFull))
  ));

  // Unique values for each column, context-aware
  const uniqueLeagues = getUniqueValues(filteredGamesForLeague, 'league');
  const uniqueAwayTeams = getUniqueValues(filteredGamesForAwayTeam, 'awayTeam');
  const uniqueAwayTeamFulls = getUniqueValues(filteredGamesForAwayTeamFull, 'awayTeamFull');
  const uniqueHomeTeams = getUniqueValues(filteredGamesForHomeTeam, 'homeTeam');
  const uniqueHomeTeamFulls = getUniqueValues(filteredGamesForHomeTeamFull, 'homeTeamFull');
  const uniqueDates = getUniqueValues(filteredGamesForDate, 'commenceTime', true);

  // Filtered values for search
  const filteredLeagues = uniqueLeagues.filter(val => val.toLowerCase().includes(leagueSearch.toLowerCase()));
  const filteredAwayTeams = uniqueAwayTeams.filter(val => val.toLowerCase().includes(awayTeamSearch.toLowerCase()));
  const filteredAwayTeamFulls = uniqueAwayTeamFulls.filter(val => val.toLowerCase().includes(awayTeamFullSearch.toLowerCase()));
  const filteredHomeTeams = uniqueHomeTeams.filter(val => val.toLowerCase().includes(homeTeamSearch.toLowerCase()));
  const filteredHomeTeamFulls = uniqueHomeTeamFulls.filter(val => val.toLowerCase().includes(homeTeamFullSearch.toLowerCase()));
  const filteredDates = uniqueDates.filter(val => val.toLowerCase().includes(dateSearch.toLowerCase()));

  // Open popover handlers for each column
  const openLeaguePopover = () => {
    setLeagueFilterDraft(leagueFilter.length ? leagueFilter : [...uniqueLeagues]);
    setTimeout(() => {
      if (leagueBtnRef.current) {
        const rect = leagueBtnRef.current.getBoundingClientRect();
        setLeaguePopoverPosition({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
        });
      }
    }, 0);
  };
  const openAwayTeamPopover = () => {
    setAwayTeamFilterDraft(awayTeamFilter.length ? awayTeamFilter : [...uniqueAwayTeams]);
    setTimeout(() => {
      if (funnelBtnRef.current) {
        const rect = funnelBtnRef.current.getBoundingClientRect();
        setPopoverPosition({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
        });
      }
    }, 0);
  };
  const openAwayTeamFullPopover = () => {
    setAwayTeamFullFilterDraft(awayTeamFullFilter.length ? awayTeamFullFilter : [...uniqueAwayTeamFulls]);
    setTimeout(() => {
      if (awayTeamFullBtnRef.current) {
        const rect = awayTeamFullBtnRef.current.getBoundingClientRect();
        setAwayTeamFullPopoverPosition({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
        });
      }
    }, 0);
  };
  const openHomeTeamPopover = () => {
    setHomeTeamFilterDraft(homeTeamFilter.length ? homeTeamFilter : [...uniqueHomeTeams]);
    setTimeout(() => {
      if (homeTeamBtnRef.current) {
        const rect = homeTeamBtnRef.current.getBoundingClientRect();
        setHomeTeamPopoverPosition({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
        });
      }
    }, 0);
  };
  const openHomeTeamFullPopover = () => {
    setHomeTeamFullFilterDraft(homeTeamFullFilter.length ? homeTeamFullFilter : [...uniqueHomeTeamFulls]);
    setTimeout(() => {
      if (homeTeamFullBtnRef.current) {
        const rect = homeTeamFullBtnRef.current.getBoundingClientRect();
        setHomeTeamFullPopoverPosition({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
        });
      }
    }, 0);
  };
  const openDatePopover = () => {
    setDateFilterDraft(dateFilter.length ? dateFilter : [...uniqueDates]);
    setTimeout(() => {
      if (dateBtnRef.current) {
        const rect = dateBtnRef.current.getBoundingClientRect();
        setDatePopoverPosition({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
        });
      }
    }, 0);
  };

  // Filter logic for all columns
  const filteredGames = games.filter(game => {
    return (
      (leagueFilter.length === 0 || leagueFilter.includes(game.league)) &&
      (awayTeamFilter.length === 0 || awayTeamFilter.includes(game.awayTeam)) &&
      (awayTeamFullFilter.length === 0 || awayTeamFullFilter.includes(game.awayTeamFull)) &&
      (homeTeamFilter.length === 0 || homeTeamFilter.includes(game.homeTeam)) &&
      (homeTeamFullFilter.length === 0 || homeTeamFullFilter.includes(game.homeTeamFull)) &&
      (dateFilter.length === 0 || dateFilter.includes(formatGameDate(game.commenceTime)))
    );
  });

  const sortedGames = [...filteredGames].sort((a, b) => {
    const { key, direction } = sortConfig;
    if (!key) return 0;
    let aValue = a[key];
    let bValue = b[key];
    if (key === 'commenceTime') {
      aValue = new Date(aValue);
      bValue = new Date(bValue);
    } else {
      aValue = aValue ? aValue.toString().toLowerCase() : '';
      bValue = bValue ? bValue.toString().toLowerCase() : '';
    }
    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  // Add useEffect hooks at the top level for each popover
  useEffect(() => {
    if (leaguePopoverOpenRef.current && leagueBtnRef.current) {
      const rect = leagueBtnRef.current.getBoundingClientRect();
      setLeaguePopoverPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      });
    }
  }, [leaguePopoverOpenRef.current]);

  // For each filter column, determine if it is actually filtered (not empty and not all options)
  const isLeagueFiltered = leagueFilter.length > 0 && leagueFilter.length < uniqueLeagues.length;
  const isAwayTeamFiltered = awayTeamFilter.length > 0 && awayTeamFilter.length < uniqueAwayTeams.length;
  const isAwayTeamFullFiltered = awayTeamFullFilter.length > 0 && awayTeamFullFilter.length < uniqueAwayTeamFulls.length;
  const isHomeTeamFiltered = homeTeamFilter.length > 0 && homeTeamFilter.length < uniqueHomeTeams.length;
  const isHomeTeamFullFiltered = homeTeamFullFilter.length > 0 && homeTeamFullFilter.length < uniqueHomeTeamFulls.length;
  const isDateFiltered = dateFilter.length > 0 && dateFilter.length < uniqueDates.length;

  // Now we can safely use early returns after all hooks and helper functions
  if (loading) return <div>Loading games...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (activeYearLoading) return <div>Loading active year...</div>;
  if (activeYearError) return <div className="text-red-500">{activeYearError}</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4 text-center md:text-left">Pick Your Betting Lines</h1>

      {/* Collection Selector Dropdown */}
      {collections.length > 0 && (
        <div className="mb-4">
          <label htmlFor="collection-select" className="block text-sm font-medium text-gray-700 mr-2">
            Select Week:
          </label>
          <select
            id="collection-select"
            name="collection-select"
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
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
            {collections.map(collectionName => (
              <option key={collectionName} value={collectionName}>
                {/* Format display name, e.g., "Week of June 1, 2025" */}
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
      )}

      <div className="mb-2 text-gray-600">Select up to 3 outcomes across all games for the selected week.</div>
      {/* Update pick count display to reflect current collection's picks */}
      <div className="mb-4 text-blue-700 font-semibold text-center md:text-left">
        Picks for {selectedCollection ? (
          (() => {
            const date = parseCollectionNameToDate(selectedCollection);
            return date 
              ? `Week of ${date.toLocaleString('default', { month: 'long' })} ${date.getDate()}` 
              : selectedCollection;
          })()
        ) : 'current week'}: {selectedPicks.length}/3
      </div>
      {success && <div className="text-green-600 mb-2">{success}</div>}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-2">
        <div className="flex items-center gap-2 mb-2 md:mb-0 justify-center md:justify-start">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
            onClick={handleSubmit}
            disabled={selectedPicks.length === 0 || submitting}
          >
            Submit Picks
          </button>
          <button
            className="border border-gray-400 text-gray-700 bg-white px-4 py-2 rounded hover:bg-gray-100"
            onClick={handleResetFilters}
            type="button"
          >
            Reset Filters
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start">
          <span className="font-semibold text-gray-700">Your Picks:</span>
          {selectedPicks.length === 0 && <span className="text-gray-400">None selected</span>}
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
                className={`inline-flex items-center px-2 py-1 rounded-full text-sm font-medium mr-1 mb-1 ${pick.status === 'submitted' ? 'bg-gray-300 text-gray-600' : 'bg-blue-100 text-blue-800'}`}
              >
                {label}
                {pick.status === 'submitted' ? (
                  <LockClosedIcon className="h-4 w-4 ml-1 text-gray-500" title="Submitted/Locked" />
                ) : (
                  <button
                    className="ml-1 text-blue-600 hover:text-red-600 focus:outline-none"
                    onClick={() => handlePickChange(pick.gameId, pick.pickType, pick.pickSide, pick.line, pick.price)}
                    title="Remove pick"
                    type="button"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      </div>
      {/* Wrapper for full-width table */}
      <div className="w-[90vw] mx-auto px-4 md:px-8 overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300 rounded shadow">
          <thead>
            <tr className="bg-gray-100 text-left border-b border-gray-300">
              <th className="px-2 py-2 border-r border-gray-300">
                <div className="flex items-center gap-1">
                  <span>Sport</span>
                  <div className="flex flex-col ml-1">
                    <ChevronUpIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'league' && sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); setSortConfig({ key: 'league', direction: 'asc' }); }}
                    />
                    <ChevronDownIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'league' && sortConfig.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); setSortConfig({ key: 'league', direction: 'desc' }); }}
                    />
                  </div>
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
                            {isLeagueFiltered
                              ? <FunnelIconSolid className="h-4 w-4 text-blue-600" />
                              : <FunnelIconOutline className="h-4 w-4 text-gray-500" />}
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
                                    onClick={e => { e.stopPropagation(); setLeagueFilter(leagueFilterDraft); close(); }}
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
                    <ChevronUpIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'awayTeam' && sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); setSortConfig({ key: 'awayTeam', direction: 'asc' }); }}
                    />
                    <ChevronDownIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'awayTeam' && sortConfig.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); setSortConfig({ key: 'awayTeam', direction: 'desc' }); }}
                    />
                  </div>
                  <Popover as="span" className="relative">
                    {({ open, close }) => {
                      awayTeamPopoverOpenRef.current = open;
                      return (
                        <>
                          <Popover.Button
                            ref={funnelBtnRef}
                            className="ml-1 p-1 rounded hover:bg-gray-200"
                            onClick={e => {
                              setAwayTeamFilterDraft(awayTeamFilter.length ? awayTeamFilter : [...uniqueAwayTeams]);
                              const rect = e.currentTarget.getBoundingClientRect();
                              setPopoverPosition({
                                top: rect.bottom + window.scrollY + 4,
                                left: rect.left + window.scrollX,
                              });
                            }}
                          >
                            {isAwayTeamFiltered
                              ? <FunnelIconSolid className="h-4 w-4 text-blue-600" />
                              : <FunnelIconOutline className="h-4 w-4 text-gray-500" />}
                          </Popover.Button>
                          <Portal>
                            {open && (
                              <Popover.Panel static className="z-50 w-64 bg-white border border-gray-300 rounded shadow-lg p-3" style={{ position: 'fixed', top: popoverPosition.top, left: popoverPosition.left }}>
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
                                    onClick={e => { e.stopPropagation(); setAwayTeamFilter(awayTeamFilterDraft); close(); }}
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
                  <Popover as="span" className="relative">
                    {({ open, close }) => {
                      awayTeamFullPopoverOpenRef.current = open;
                      return (
                        <>
                          <Popover.Button
                            ref={awayTeamFullBtnRef}
                            className="ml-1 p-1 rounded hover:bg-gray-200"
                            onClick={e => {
                              setAwayTeamFullFilterDraft(awayTeamFullFilter.length ? awayTeamFullFilter : [...uniqueAwayTeamFulls]);
                              const rect = e.currentTarget.getBoundingClientRect();
                              setAwayTeamFullPopoverPosition({
                                top: rect.bottom + window.scrollY + 4,
                                left: rect.left + window.scrollX,
                              });
                            }}
                          >
                            {isAwayTeamFullFiltered
                              ? <FunnelIconSolid className="h-4 w-4 text-blue-600" />
                              : <FunnelIconOutline className="h-4 w-4 text-gray-500" />}
                          </Popover.Button>
                          <Portal>
                            {open && (
                              <Popover.Panel static className="z-50 w-64 bg-white border border-gray-300 rounded shadow-lg p-3" style={{ position: 'fixed', top: awayTeamFullPopoverPosition.top, left: awayTeamFullPopoverPosition.left }}>
                                <div className="font-semibold mb-2">Filter Away Team</div>
                                <div className="flex items-center mb-2 gap-2 text-xs">
                                  <button className="underline" onClick={() => setAwayTeamFullFilterDraft([...uniqueAwayTeamFulls])} type="button">Select all</button>
                                  <span>-</span>
                                  <button className="underline" onClick={() => setAwayTeamFullFilterDraft([])} type="button">Clear</button>
                                </div>
                                <input
                                  className="w-full mb-2 px-2 py-1 border border-gray-300 rounded"
                                  placeholder="Search..."
                                  value={awayTeamFullSearch}
                                  onChange={e => setAwayTeamFullSearch(e.target.value)}
                                />
                                <div className="max-h-40 overflow-y-auto mb-2">
                                  {filteredAwayTeamFulls.map(val => (
                                    <label key={val} className="flex items-center gap-2 px-1 py-0.5 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={awayTeamFullFilterDraft.includes(val)}
                                        onChange={() => setAwayTeamFullFilterDraft(draft => draft.includes(val) ? draft.filter(v => v !== val) : [...draft, val])}
                                      />
                                      <span>{val}</span>
                                    </label>
                                  ))}
                                </div>
                                <div className="flex justify-end gap-2 mt-2">
                                  <button
                                    className="px-3 py-1 rounded border border-gray-300 bg-gray-100"
                                    onClick={e => { e.stopPropagation(); setAwayTeamFullFilterDraft(awayTeamFullFilter); close(); }}
                                    type="button"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    className="px-3 py-1 rounded bg-green-600 text-white"
                                    onClick={e => { e.stopPropagation(); setAwayTeamFullFilter(awayTeamFullFilterDraft); close(); }}
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
                    <ChevronUpIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'homeTeam' && sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); setSortConfig({ key: 'homeTeam', direction: 'asc' }); }}
                    />
                    <ChevronDownIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'homeTeam' && sortConfig.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); setSortConfig({ key: 'homeTeam', direction: 'desc' }); }}
                    />
                  </div>
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
                            {isHomeTeamFiltered
                              ? <FunnelIconSolid className="h-4 w-4 text-blue-600" />
                              : <FunnelIconOutline className="h-4 w-4 text-gray-500" />}
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
                                    onClick={e => { e.stopPropagation(); setHomeTeamFilter(homeTeamFilterDraft); close(); }}
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
                  <Popover as="span" className="relative">
                    {({ open, close }) => {
                      homeTeamFullPopoverOpenRef.current = open;
                      return (
                        <>
                          <Popover.Button
                            ref={homeTeamFullBtnRef}
                            className="ml-1 p-1 rounded hover:bg-gray-200"
                            onClick={e => {
                              setHomeTeamFullFilterDraft(homeTeamFullFilter.length ? homeTeamFullFilter : [...uniqueHomeTeamFulls]);
                              const rect = e.currentTarget.getBoundingClientRect();
                              setHomeTeamFullPopoverPosition({
                                top: rect.bottom + window.scrollY + 4,
                                left: rect.left + window.scrollX,
                              });
                            }}
                          >
                            {isHomeTeamFullFiltered
                              ? <FunnelIconSolid className="h-4 w-4 text-blue-600" />
                              : <FunnelIconOutline className="h-4 w-4 text-gray-500" />}
                          </Popover.Button>
                          <Portal>
                            {open && (
                              <Popover.Panel static className="z-50 w-64 bg-white border border-gray-300 rounded shadow-lg p-3" style={{ position: 'fixed', top: homeTeamFullPopoverPosition.top, left: homeTeamFullPopoverPosition.left }}>
                                <div className="font-semibold mb-2">Filter Home Team</div>
                                <div className="flex items-center mb-2 gap-2 text-xs">
                                  <button className="underline" onClick={() => setHomeTeamFullFilterDraft([...uniqueHomeTeamFulls])} type="button">Select all</button>
                                  <span>-</span>
                                  <button className="underline" onClick={() => setHomeTeamFullFilterDraft([])} type="button">Clear</button>
                                </div>
                                <input
                                  className="w-full mb-2 px-2 py-1 border border-gray-300 rounded"
                                  placeholder="Search..."
                                  value={homeTeamFullSearch}
                                  onChange={e => setHomeTeamFullSearch(e.target.value)}
                                />
                                <div className="max-h-40 overflow-y-auto mb-2">
                                  {filteredHomeTeamFulls.map(val => (
                                    <label key={val} className="flex items-center gap-2 px-1 py-0.5 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={homeTeamFullFilterDraft.includes(val)}
                                        onChange={() => setHomeTeamFullFilterDraft(draft => draft.includes(val) ? draft.filter(v => v !== val) : [...draft, val])}
                                      />
                                      <span>{val}</span>
                                    </label>
                                  ))}
                                </div>
                                <div className="flex justify-end gap-2 mt-2">
                                  <button
                                    className="px-3 py-1 rounded border border-gray-300 bg-gray-100"
                                    onClick={e => { e.stopPropagation(); setHomeTeamFullFilterDraft(homeTeamFullFilter); close(); }}
                                    type="button"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    className="px-3 py-1 rounded bg-green-600 text-white"
                                    onClick={e => { e.stopPropagation(); setHomeTeamFullFilter(homeTeamFullFilterDraft); close(); }}
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
              <th className="px-2 py-2">
                <div className="flex items-center gap-1">
                  <span>Date & Time</span>
                  <div className="flex flex-col ml-1">
                    <ChevronUpIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'commenceTime' && sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); setSortConfig({ key: 'commenceTime', direction: 'asc' }); }}
                    />
                    <ChevronDownIcon
                      className={`h-3 w-3 cursor-pointer ${sortConfig.key === 'commenceTime' && sortConfig.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}
                      onClick={e => { e.stopPropagation(); setSortConfig({ key: 'commenceTime', direction: 'desc' }); }}
                    />
                  </div>
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
                            {isDateFiltered
                              ? <FunnelIconSolid className="h-4 w-4 text-blue-600" />
                              : <FunnelIconOutline className="h-4 w-4 text-gray-500" />}
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
                                    onClick={e => { e.stopPropagation(); setDateFilter(dateFilterDraft); close(); }}
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
              <th className="px-2 py-2 border-r border-gray-300">Spread</th>
              <th className="px-2 py-2">Total</th>
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
                  <td className="px-2 py-2 border-r border-gray-300 font-semibold">{game.league}</td>
                  <td className="px-2 py-2 border-r border-gray-300 font-bold">{game.awayTeam}</td>
                  <td className="px-2 py-2 border-r border-gray-300 hidden md:table-cell">{game.awayTeamFull}</td>
                  <td className="px-2 py-2 border-r border-gray-300 font-bold">{game.homeTeam}</td>
                  <td className="px-2 py-2 border-r border-gray-300 hidden md:table-cell">{game.homeTeamFull}</td>
                  <td className="px-2 py-2 border-r border-gray-300 whitespace-nowrap">{formatGameDate(game.commenceTime)}</td>
                  <td className="px-2 py-2 border-r border-gray-300">
                    <div className="flex flex-col gap-1">
                      <label>
                        <input
                          type="checkbox"
                          disabled={
                            isGameLocked(game) || 
                            (awaySpreadPick?.status === 'submitted') ||
                            (selectedPicks.length >= 3 && !awaySpreadPick)
                          }
                          checked={!!awaySpreadPick}
                          onChange={() => handlePickChange(game._id, 'spread', game.awayTeam, game.awaySpread, null)}
                        />{' '}
                        {game.awayTeam} {game.awaySpread > 0 ? '+' : ''}{game.awaySpread}
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          disabled={
                            isGameLocked(game) || 
                            (homeSpreadPick?.status === 'submitted') ||
                            (selectedPicks.length >= 3 && !homeSpreadPick)
                          }
                          checked={!!homeSpreadPick}
                          onChange={() => handlePickChange(game._id, 'spread', game.homeTeam, game.homeSpread, null)}
                        />{' '}
                        {game.homeTeam} {game.homeSpread > 0 ? '+' : ''}{game.homeSpread}
                      </label>
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-col gap-1">
                      <label>
                        <input
                          type="checkbox"
                          disabled={
                            isGameLocked(game) || 
                            (overTotalPick?.status === 'submitted') ||
                            (selectedPicks.length >= 3 && !overTotalPick)
                          }
                          checked={!!overTotalPick}
                          onChange={() => handlePickChange(game._id, 'total', 'OVER', game.total, null)}
                        />{' '}
                        O {game.total}
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          disabled={
                            isGameLocked(game) || 
                            (underTotalPick?.status === 'submitted') ||
                            (selectedPicks.length >= 3 && !underTotalPick)
                          }
                          checked={!!underTotalPick}
                          onChange={() => handlePickChange(game._id, 'total', 'UNDER', game.total, null)}
                        />{' '}
                        U {game.total}
                      </label>
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
    </div>
  );
};

export default Picks; 