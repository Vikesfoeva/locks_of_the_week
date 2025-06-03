import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch collections (weeks) on mount
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

        fetchedCollections = fetchedCollections.filter(name => parseCollectionNameToDate(name) !== null);

        if (fetchedCollections.length === 0) {
          setError('No valid collections found after filtering.');
          setCollections([]);
          setSelectedCollection('');
          setLoading(false);
          return;
        }

        fetchedCollections.sort((a, b) => {
          const dateA = parseCollectionNameToDate(a);
          const dateB = parseCollectionNameToDate(b);
          return dateB - dateA;
        });

        setCollections(fetchedCollections);
        const mostRecentCollection = fetchedCollections[0];
        setSelectedCollection(mostRecentCollection);
        setError('');
      } catch (err) {
        console.error('Failed to fetch collections:', err);
        setError('Failed to load collections. Please try again later.');
        setCollections([]);
        setSelectedCollection('');
      } finally {
        setLoading(false);
      }
    };
    fetchCollections();
  }, []);

  // Fetch picks when collection or user changes
  useEffect(() => {
    const fetchPicks = async () => {
      if (!selectedCollection || !currentUser) return;
      setLoading(true);
      setError('');
      try {
        // Fetch current user's picks for the selected collection
        const userPicksRes = await axios.get(`/api/picks?userId=${currentUser.uid}&collectionName=${selectedCollection}`);
        const userPicksData = Array.isArray(userPicksRes.data) ? userPicksRes.data : [];
        setUserPicks(userPicksData);

        // If user has 3 picks, fetch all users' picks for the collection
        if (userPicksData.length === 3) {
          const allPicksRes = await axios.get(`/api/picks?collectionName=${selectedCollection}`);
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
  }, [selectedCollection, currentUser]);

  // Handler for dropdown change
  const handleCollectionChange = (e) => {
    setSelectedCollection(e.target.value);
  };

  const hasThreePicks = userPicks.length === 3;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Weekly Picks</h1>
      {/* Collection Dropdown */}
      <div className="mb-6">
        <label className="block mb-2 font-semibold">Select Week:</label>
        <select
          className="border rounded px-3 py-2"
          value={selectedCollection || ''}
          onChange={handleCollectionChange}
          disabled={loading || collections.length === 0}
        >
          <option value="" disabled>Select a week</option>
          {collections.map((collectionName) => {
            const date = parseCollectionNameToDate(collectionName);
            return (
              <option key={collectionName} value={collectionName}>
                {date
                  ? `Week of ${date.toLocaleString('default', { month: 'long' })} ${date.getDate()}, ${date.getFullYear()}`
                  : collectionName}
              </option>
            );
          })}
        </select>
      </div>

      {error && <div className="text-red-600 mb-4">{error}</div>}

      {/* Conditional rendering based on pick count */}
      {loading ? (
        <div>Loading...</div>
      ) : hasThreePicks ? (
        <div>
          <h2 className="text-xl font-semibold mb-4">All Picks for This Week</h2>
          <table className="min-w-full border">
            <thead>
              <tr>
                <th className="border px-4 py-2">User</th><th className="border px-4 py-2">Game</th><th className="border px-4 py-2">Pick</th><th className="border px-4 py-2">Spread/Total</th><th className="border px-4 py-2">Score</th>
              </tr>
            </thead>
            <tbody>
              {allPicks.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-4">No picks found for this week.</td></tr>
              ) : (
                allPicks.map((pick, idx) => (
                  <tr key={idx}>
                    <td className="border px-4 py-2">{pick.userName || pick.userEmail || pick.userId}</td><td className="border px-4 py-2">{pick.gameId || 'Game info'}</td><td className="border px-4 py-2">{pick.pickType} {pick.pickSide}</td><td className="border px-4 py-2">{pick.line || pick.total || ''}</td><td className="border px-4 py-2"></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center mt-8">
          <p className="text-lg text-gray-700 mb-4">You must make all 3 picks for this week to view your picks.</p>
        </div>
      )}
    </div>
  );
};

export default WeeklyPicks; 