import React from 'react';

const PopularLocksModal = ({ picks, onClose }) => {
  const getPopularPicks = () => {
    if (!picks || picks.length === 0) {
      return [];
    }

    const pickCounts = picks.reduce((acc, pick) => {
      const { gameDetails, pickType, pickSide, line } = pick;
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
          gameTime: gameDetails.start_timestamp
        };
      }
      acc[key].count++;
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full">
        <h2 className="text-2xl font-bold mb-4">Top 5 Popular Locks</h2>
        {popularPicks.length > 0 ? (
          <ul>
            {popularPicks.map((pick, index) => (
              <li key={index} className="mb-2 p-2 border-b">
                <p className="font-semibold">{pick.gameDisplay}</p>
                                    <p>{pick.pickDisplay} - <span className="font-bold">{pick.count} {pick.count === 1 ? 'lock' : 'locks'}</span></p>
              </li>
            ))}
          </ul>
        ) : (
          <p>Not enough data to determine popular locks.</p>
        )}
        <button
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default PopularLocksModal; 