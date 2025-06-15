import React, { useState } from 'react';

// Mock data for demonstration
const mockStandings = [
  {
    rank: 1,
    name: 'Greg Steuterman',
    wins: 39,
    losses: 20,
    ties: 1,
    weekWins: 3,
    weekLosses: 0,
    weekTies: 0,
    totalWins: 39,
    paid: true,
    rankChange: '+1',
  },
  {
    rank: 2,
    name: 'Nathaniel Urban',
    wins: 38,
    losses: 21,
    ties: 1,
    weekWins: 2,
    weekLosses: 1,
    weekTies: 0,
    totalWins: 38,
    paid: true,
    rankChange: '-1',
  },
  {
    rank: 3,
    name: 'James Oelke',
    wins: 37,
    losses: 22,
    ties: 1,
    weekWins: 1,
    weekLosses: 2,
    weekTies: 0,
    totalWins: 37,
    paid: false,
    rankChange: '0',
  },
  // ... more mock users
];

const mockWeeks = Array.from({ length: 20 }, (_, i) => i + 1);

const Standings = () => {
  const [selectedWeek, setSelectedWeek] = useState(20);

  const getWinPct = (user, week) => {
    const totalPoints = 3 * week;
    const winPoints = user.wins + 0.5 * user.ties;
    return totalPoints > 0 ? winPoints / totalPoints : 0;
  };

  // Sort by win percentage (highest to lowest)
  const sortedStandings = [...mockStandings].sort((a, b) => getWinPct(b, selectedWeek) - getWinPct(a, selectedWeek));

  const firstPlaceWins = sortedStandings.length > 0 ? sortedStandings[0].wins : 0;

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
        <h1 className="text-2xl font-bold">Overall Standings</h1>
        <div>
          <label htmlFor="week-select" className="mr-2 font-medium">View as of week:</label>
          <select
            id="week-select"
            value={selectedWeek}
            onChange={e => setSelectedWeek(Number(e.target.value))}
            className="border rounded px-2 py-1"
          >
            {mockWeeks.map(week => (
              <option key={week} value={week}>Week {week}</option>
            ))}
          </select>
        </div>
      </div>
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
            {sortedStandings.map((user, idx) => {
              const totalPoints = 3 * selectedWeek;
              const winPoints = user.wins + 0.5 * user.ties;
              const winPct = totalPoints > 0 ? ((winPoints / totalPoints) * 100).toFixed(1) + '%' : '0.0%';
              const weekRecord = `${user.weekWins}-${user.weekLosses}-${user.weekTies}`;
              const totalPicks = user.wins + user.losses + user.ties;
              const wb = firstPlaceWins - user.wins;
              return (
                <tr key={user.name} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 font-semibold">{idx + 1}</td>
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
    </div>
  );
};

export default Standings; 