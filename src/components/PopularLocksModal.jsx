import React from 'react';

const PopularLocksModal = ({ picks, userMap, onClose }) => {
  const getPopularPicks = () => {
    if (!picks || picks.length === 0) {
      return [];
    }

    const pickCounts = picks.reduce((acc, pick) => {
      const { gameDetails, pickType, pickSide, line, userId } = pick;
      if (!gameDetails) return acc;

      const gameIdentifier = `${gameDetails.away_team_abbrev} @ ${gameDetails.home_team_abbrev}`;
      let pickIdentifier;
      let pickDisplay;

      if (pickType === 'spread') {
        pickIdentifier = `${gameIdentifier}-${pickType}-${pickSide}-${line}`;
        pickDisplay = `${pickSide} ${line > 0 ? '+' : ''}${line}`;
      } else if (pickType === 'total') {
        pickIdentifier = `${gameIdentifier}-${pickType}-${pickSide}-${line}`;
        pickDisplay = `${pickSide} ${line}`;
      } else {
        return acc;
      }

      const key = `${pickIdentifier}-${pick.gameDetails.id}`;

      if (!acc[key]) {
        acc[key] = {
          count: 0,
          gameDisplay: gameIdentifier,
          pickDisplay: pickDisplay,
          gameTime: gameDetails.start_timestamp,
          users: [] // Track which users made this pick
        };
      }
      acc[key].count++;
      
      // Add user to the list if not already present
      const userName = userMap[userId] || userId;
      if (!acc[key].users.includes(userName)) {
        acc[key].users.push(userName);
      }
      
      return acc;
    }, {});

    const sortedPicks = Object.values(pickCounts).sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return new Date(a.gameTime) - new Date(b.gameTime);
    });

    return sortedPicks.slice(0, 5);
  };

  const popularPicks = getPopularPicks();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-2 sm:p-4">
      <div className="bg-white p-3 sm:p-4 md:p-6 rounded-lg shadow-xl w-full max-w-xs sm:max-w-sm md:max-w-lg max-h-[90vh] sm:max-h-[85vh] md:max-h-[80vh] overflow-y-auto">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4 text-center sm:text-left">Top 5 Popular Locks</h2>
        {popularPicks.length > 0 ? (
          <ul className="space-y-2 sm:space-y-3">
            {popularPicks.map((pick, index) => (
              <li key={index} className="p-2 sm:p-3 border-b border-gray-200 last:border-b-0">
                <p className="font-semibold text-sm sm:text-base md:text-lg mb-1">{pick.gameDisplay}</p>
                <p className="text-gray-700 mb-1 text-sm sm:text-base">
                  {pick.pickDisplay} - <span className="font-bold text-blue-600">{pick.count} {pick.count === 1 ? 'lock' : 'locks'}</span>
                </p>
                <div className="mt-1">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">Picked by:</p>
                  <div className="flex flex-wrap gap-1">
                    {pick.users.map((userName, userIndex) => (
                      <span 
                        key={userIndex} 
                        className="inline-block px-1.5 py-0.5 text-xs bg-gray-100 text-gray-700 rounded"
                      >
                        {userName}
                      </span>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm sm:text-base text-center text-gray-600">Not enough data to determine popular locks.</p>
        )}
        <button
          className="mt-3 sm:mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm sm:text-base transition-colors"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default PopularLocksModal; 