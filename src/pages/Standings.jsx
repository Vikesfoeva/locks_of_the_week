import React, { useState, useEffect } from 'react';

const Standings = () => {
  const [standings, setStandings] = useState([]);
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [activeYear, setActiveYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchActiveYear = async () => {
      try {
        const response = await fetch('/api/active-year');
        if (!response.ok) {
          throw new Error('Failed to fetch active year');
        }
        const data = await response.json();
        if (data.year) {
          setActiveYear(data.year);
        }
      } catch (error) {
        console.error("Could not fetch active year, defaulting to current year:", error);
        // Keep default year if fetch fails
      }
    };
    fetchActiveYear();
  }, []);

  useEffect(() => {
    if (!activeYear) return;

    const fetchStandings = async () => {
      setLoading(true);
      try {
        const url = selectedWeek 
          ? `/api/standings?year=${activeYear}&week=${selectedWeek}`
          : `/api/standings?year=${activeYear}`;
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch standings');
        }
        const data = await response.json();
        setStandings(data.standings);
        setAvailableWeeks(data.availableWeeks);
        if (selectedWeek === null) {
          setSelectedWeek(data.selectedWeek);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStandings();
  }, [activeYear, selectedWeek]);
  
  const getWinPct = (user) => {
    const totalGames = user.wins + user.losses + user.ties;
    if (totalGames === 0) return '0.0%';
    const winPoints = user.wins + 0.5 * user.ties;
    return ((winPoints / totalGames) * 100).toFixed(1) + '%';
  };
  
  const firstPlaceWins = standings.length > 0 ? standings[0].wins : 0;

  if (loading) return <div className="text-center p-8">Loading standings...</div>;
  if (error) return <div className="text-center p-8 text-red-500">Error: {error}</div>;

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
        <h1 className="text-2xl font-bold">Overall Standings - {activeYear}</h1>
        <div>
          <label htmlFor="week-select" className="mr-2 font-medium">View as of week:</label>
          <select
            id="week-select"
            value={selectedWeek || ''}
            onChange={e => setSelectedWeek(e.target.value)}
            className="border rounded px-2 py-1"
            disabled={availableWeeks.length === 0}
          >
            {availableWeeks.map((week, index) => (
              <option key={week} value={week}>Week {index + 1} ({week.split('_').slice(1).join('/')})</option>
            ))}
          </select>
        </div>
      </div>
      {standings.length === 0 ? (
        <div className="text-center p-8">No standings data available for this week.</div>
      ) : (
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300 bg-white shadow-sm rounded-lg">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 text-left">Rank</th>
              <th className="px-3 py-2 text-left">User Name</th>
              <th className="px-3 py-2 text-left">W-L-T</th>
              <th className="px-3 py-2 text-left">Week</th>
              <th className="px-3 py-2 text-left">Total</th>
              <th className="px-3 py-2 text-left">Win %</th>
              <th className="px-3 py-2 text-left">WB</th>
              <th className="px-3 py-2 text-left">Rank Δ</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((user, idx) => {
              const winPct = getWinPct(user);
              const weekRecord = `${user.weekWins}-${user.weekLosses}-${user.weekTies}`;
              const totalPicks = user.wins + user.losses + user.ties;
              const wb = firstPlaceWins - user.wins;
              return (
                <tr key={user._id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 font-semibold">{user.rank}</td>
                  <td className="px-3 py-2">{user.name}</td>
                  <td className="px-3 py-2">{`${user.wins}-${user.losses}-${user.ties}`}</td>
                  <td className="px-3 py-2">{weekRecord}</td>
                  <td className="px-3 py-2">{totalPicks}</td>
                  <td className="px-3 py-2">{winPct}</td>
                  <td className="px-3 py-2">{wb === 0 ? '-' : wb}</td>
                  <td className="px-3 py-2">
                    <span className={
                      user.rankChange.startsWith('+')
                        ? 'text-green-600 font-bold'
                        : user.rankChange.startsWith('-')
                          ? 'text-red-600 font-bold'
                          : 'text-gray-600 font-bold'
                    }>
                      {user.rankChange}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
};

export default Standings; 