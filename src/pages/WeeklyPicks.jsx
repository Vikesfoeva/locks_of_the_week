import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API_URL = 'http://localhost:5001/api';

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

const WeeklyPicks = () => {
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

  // Active year state
  const [activeYear, setActiveYear] = useState(null);
  const [activeYearLoading, setActiveYearLoading] = useState(true);
  const [activeYearError, setActiveYearError] = useState(null);

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
        setError('Failed to load picks.');
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
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Weekly Picks</h1>
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
      </div>
      {loading && <div>Loading...</div>}
      {error && <div className="text-red-500">{error}</div>}
      {activeYearLoading && <div>Loading active year...</div>}
      {activeYearError && <div className="text-red-500">{activeYearError}</div>}
      {userPicks.length === 3 && allPicks.length > 0 ? (
        <>
          <h2 className="text-xl font-semibold mb-2">All Picks for This Week</h2>
          {viewMode === 'table' ? (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-300 rounded shadow text-xs md:text-sm">
                <thead>
                  <tr className="bg-gray-100 text-left border-b border-gray-300">
                    <th className="px-2 py-2 border-r border-gray-300">User</th>
                    <th className="px-2 py-2 border-r border-gray-300">League</th>
                    <th className="px-2 py-2 border-r border-gray-300">Away</th>
                    <th className="px-2 py-2 border-r border-gray-300">Home</th>
                    <th className="px-2 py-2 border-r border-gray-300">Lock</th>
                    <th className="px-2 py-2 border-r border-gray-300">Line/O/U</th>
                    <th className="px-2 py-2 border-r border-gray-300">Score</th>
                    <th className="px-2 py-2 border-r border-gray-300">Status</th>
                    <th className="px-2 py-2">W/L/T</th>
                  </tr>
                </thead>
                <tbody>
                  {allPicks.map((pick, idx) => {
                    const userName = userMap[pick.userId] || pick.userId;
                    const game = pick.gameDetails;
                    return (
                      <tr key={pick._id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-2 py-2 border-r border-gray-300 font-semibold">{userName}</td>
                        <td className="px-2 py-2 border-r border-gray-300">{game?.league || '--'}</td>
                        <td className="px-2 py-2 border-r border-gray-300">{game?.away_team_abbrev || '--'}</td>
                        <td className="px-2 py-2 border-r border-gray-300">{game?.home_team_abbrev || '--'}</td>
                        <td className="px-2 py-2 border-r border-gray-300">{pick.pickType === 'spread' ? `${pick.pickSide} Line` : pick.pickType === 'total' ? (pick.pickSide === 'OVER' ? 'Over' : 'Under') : '--'}</td>
                        <td className="px-2 py-2 border-r border-gray-300">{pick.line !== undefined ? pick.line : '--'}</td>
                        <td className="px-2 py-2 border-r border-gray-300">{typeof pick.awayScore === 'number' && typeof pick.homeScore === 'number' ? `${pick.awayScore} - ${pick.homeScore}` : '--'}</td>
                        <td className="px-2 py-2 border-r border-gray-300">{pick.status ? pick.status : '--'}</td>
                        <td className="px-2 py-2">{pick.result || '--'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="w-screen relative left-1/2 right-1/2 -mx-[50vw] px-8 overflow-x-auto">
              <table className="w-full bg-white border border-gray-300 rounded shadow text-xs md:text-sm">
                <thead>
                  <tr className="bg-gray-100 text-left border-b border-gray-300">
                    <th className="px-2 py-2 border-r border-gray-300">User</th>
                    {[1,2,3].map(i => (
                      <th key={i} colSpan={8} className="px-2 py-2 border-r border-gray-300 text-center">Pick {i}</th>
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
                              <td className="px-2 py-2 border-r border-gray-300">{pick.line !== undefined ? pick.line : '--'}</td>
                              <td className="px-2 py-2 border-r border-gray-300">{typeof pick.awayScore === 'number' && typeof pick.homeScore === 'number' ? `${pick.awayScore} - ${pick.homeScore}` : '--'}</td>
                              <td className="px-2 py-2 border-r border-gray-300">{pick.status ? pick.status : '--'}</td>
                              <td className="px-2 py-2 border-r border-gray-300">{pick.result || '--'}</td>
                            </React.Fragment>
                          ) : (
                            <td key={i} colSpan={8} className="px-2 py-2 border-r border-gray-300 text-center text-gray-400">--</td>
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
        <div className="text-gray-600 mt-4">Make all 3 picks to view the weekly picks table.</div>
      )}
    </div>
  );
};

export default WeeklyPicks; 