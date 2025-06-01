import React, { useEffect, useState, useContext, useRef } from 'react';
import axios from 'axios';
import { Popover, Portal } from '@headlessui/react';
import { FunnelIcon as FunnelIconOutline, CheckIcon } from '@heroicons/react/24/outline';
import { FunnelIcon as FunnelIconSolid, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/solid';
// import { AuthContext } from '../contexts/AuthContext'; // Uncomment if you have AuthContext

const CURRENT_WEEK = 1; // TODO: Replace with dynamic week logic

const Picks = () => {
  // const { user } = useContext(AuthContext); // Uncomment if you have AuthContext
  const userId = 'HARDCODED_USER_ID'; // TODO: Replace with user._id from context
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
    const fetchGames = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`/api/games?weekNumber=${CURRENT_WEEK}`);
        console.log('Games API response:', res.data);
        setGames(
          (Array.isArray(res.data) ? res.data : []).map(game => ({
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
      } catch (err) {
        setError('Failed to load games');
        setGames([]); // Ensure games is always an array
      } finally {
        setLoading(false);
      }
    };
    fetchGames();
  }, []);

  const isGameLocked = (game) => {
    return new Date(game.commenceTime) < new Date();
  };

  const handlePickChange = (gameId, pickType, pickSide, line, price) => {
    const pickKey = `${gameId}_${pickType}_${pickSide}`;
    const alreadyPicked = selectedPicks.find(p => p.key === pickKey);
    let newPicks;
    if (alreadyPicked) {
      newPicks = selectedPicks.filter(p => p.key !== pickKey);
    } else {
      if (selectedPicks.length >= 3) return;
      newPicks = [
        ...selectedPicks,
        { key: pickKey, gameId, pickType, pickSide, line, price }
      ];
    }
    setSelectedPicks(newPicks);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const picksPayload = selectedPicks.map(({ key, ...rest }) => rest);
      await axios.post('/api/picks', {
        userId,
        weekNumber: CURRENT_WEEK,
        picks: picksPayload
      });
      setSuccess(true);
      setSelectedPicks([]);
    } catch (err) {
      setError('Failed to submit picks');
    } finally {
      setSubmitting(false);
    }
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
        return game.commenceTime ? new Date(game.commenceTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
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
    (dateFilter.length === 0 || dateFilter.includes(game.commenceTime ? new Date(game.commenceTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''))
  ));
  const filteredGamesForAwayTeam = games.filter(game => (
    (leagueFilter.length === 0 || leagueFilter.includes(game.league)) &&
    (awayTeamFullFilter.length === 0 || awayTeamFullFilter.includes(game.awayTeamFull)) &&
    (homeTeamFilter.length === 0 || homeTeamFilter.includes(game.homeTeam)) &&
    (homeTeamFullFilter.length === 0 || homeTeamFullFilter.includes(game.homeTeamFull)) &&
    (dateFilter.length === 0 || dateFilter.includes(game.commenceTime ? new Date(game.commenceTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''))
  ));
  const filteredGamesForAwayTeamFull = games.filter(game => (
    (leagueFilter.length === 0 || leagueFilter.includes(game.league)) &&
    (awayTeamFilter.length === 0 || awayTeamFilter.includes(game.awayTeam)) &&
    (homeTeamFilter.length === 0 || homeTeamFilter.includes(game.homeTeam)) &&
    (homeTeamFullFilter.length === 0 || homeTeamFullFilter.includes(game.homeTeamFull)) &&
    (dateFilter.length === 0 || dateFilter.includes(game.commenceTime ? new Date(game.commenceTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''))
  ));
  const filteredGamesForHomeTeam = games.filter(game => (
    (leagueFilter.length === 0 || leagueFilter.includes(game.league)) &&
    (awayTeamFilter.length === 0 || awayTeamFilter.includes(game.awayTeam)) &&
    (awayTeamFullFilter.length === 0 || awayTeamFullFilter.includes(game.awayTeamFull)) &&
    (homeTeamFullFilter.length === 0 || homeTeamFullFilter.includes(game.homeTeamFull)) &&
    (dateFilter.length === 0 || dateFilter.includes(game.commenceTime ? new Date(game.commenceTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''))
  ));
  const filteredGamesForHomeTeamFull = games.filter(game => (
    (leagueFilter.length === 0 || leagueFilter.includes(game.league)) &&
    (awayTeamFilter.length === 0 || awayTeamFilter.includes(game.awayTeam)) &&
    (awayTeamFullFilter.length === 0 || awayTeamFullFilter.includes(game.awayTeamFull)) &&
    (homeTeamFilter.length === 0 || homeTeamFilter.includes(game.homeTeam)) &&
    (dateFilter.length === 0 || dateFilter.includes(game.commenceTime ? new Date(game.commenceTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''))
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
      (dateFilter.length === 0 || dateFilter.includes(game.commenceTime ? new Date(game.commenceTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''))
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

  if (loading) return <div>Loading games...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Pick Your Betting Lines</h1>
      <div className="mb-2 text-gray-600">Select up to 3 outcomes across all games.</div>
      <div className="mb-4 text-blue-700 font-semibold">Picks: {selectedPicks.length}/3</div>
      {success && <div className="text-green-600 mb-2">Picks submitted!</div>}
      <button
        className="bg-blue-600 text-white px-4 py-2 rounded mb-4 disabled:opacity-50"
        onClick={handleSubmit}
        disabled={selectedPicks.length === 0 || submitting}
      >
        Submit Picks
      </button>
      <div className="overflow-x-auto">
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
              <th className="px-2 py-2 border-r border-gray-300">
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
            {sortedGames.map((game, idx) => (
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
                <td className="px-2 py-2 border-r border-gray-300 whitespace-nowrap">{game.commenceTime ? new Date(game.commenceTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}</td>
                <td className="px-2 py-2 border-r border-gray-300">
                  <div className="flex flex-col gap-1">
                    <label>
                      <input
                        type="checkbox"
                        disabled={isGameLocked(game) || selectedPicks.length >= 3 && !selectedPicks.some(p => p.gameId === game._id)}
                        checked={!!selectedPicks.find(p => p.key === `${game._id}_spread_${game.awayTeam}`)}
                        onChange={() => handlePickChange(game._id, 'spread', game.awayTeam, game.awaySpread, null)}
                      />{' '}
                      {game.awayTeam} {game.awaySpread > 0 ? '+' : ''}{game.awaySpread}
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        disabled={isGameLocked(game) || selectedPicks.length >= 3 && !selectedPicks.some(p => p.gameId === game._id)}
                        checked={!!selectedPicks.find(p => p.key === `${game._id}_spread_${game.homeTeam}`)}
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
                        disabled={isGameLocked(game) || selectedPicks.length >= 3 && !selectedPicks.some(p => p.gameId === game._id)}
                        checked={!!selectedPicks.find(p => p.key === `${game._id}_total_OVER`)}
                        onChange={() => handlePickChange(game._id, 'total', 'OVER', game.total, null)}
                      />{' '}
                      O {game.total}
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        disabled={isGameLocked(game) || selectedPicks.length >= 3 && !selectedPicks.some(p => p.gameId === game._id)}
                        checked={!!selectedPicks.find(p => p.key === `${game._id}_total_UNDER`)}
                        onChange={() => handlePickChange(game._id, 'total', 'UNDER', game.total, null)}
                      />{' '}
                      U {game.total}
                    </label>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Picks; 