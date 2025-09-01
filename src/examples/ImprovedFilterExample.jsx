import React from 'react';
import { FunnelIcon as FunnelIconOutline } from '@heroicons/react/24/outline';
import { FunnelIcon as FunnelIconSolid } from '@heroicons/react/24/solid';
import FilterModal from '../components/FilterModal';
import { useFilterModal, createFilterButtonProps, createFilterModalProps } from '../hooks/useFilterModal';

/**
 * Example of how to integrate the improved filter modal system
 * This replaces the old manual positioning approach with the new smart positioning
 */
const ImprovedFilterExample = ({ games = [] }) => {
  // Extract unique values for filtering
  const uniqueLeagues = [...new Set(games.map(game => game.sport_key))].sort();
  const uniqueAwayTeams = [...new Set(games.map(game => game.away_team))].sort();
  const uniqueHomeTeams = [...new Set(games.map(game => game.home_team))].sort();

  // Initialize filter modals using the hook
  const leagueModal = useFilterModal(uniqueLeagues, []);
  const awayTeamModal = useFilterModal(uniqueAwayTeams, []);
  const homeTeamModal = useFilterModal(uniqueHomeTeams, []);

  // Filter application handlers
  const handleLeagueFilter = (selectedLeagues) => {
    // Apply your filtering logic here
  };

  const handleAwayTeamFilter = (selectedTeams) => {
    // Apply your filtering logic here
  };

  const handleHomeTeamFilter = (selectedTeams) => {
    // Apply your filtering logic here
  };

  return (
    <div className="p-4">
      <div className="mb-4 flex gap-4 items-center">
        <h2 className="text-lg font-semibold">Games</h2>
        
        {/* League Filter Button */}
        <div className="flex items-center gap-1">
          <span className="text-sm">League:</span>
          <button
            {...createFilterButtonProps(leagueModal, uniqueLeagues, handleLeagueFilter, {
              IconComponent: FunnelIconOutline,
              IconComponentSolid: FunnelIconSolid,
            })}
          />
        </div>

        {/* Away Team Filter Button */}
        <div className="flex items-center gap-1">
          <span className="text-sm">Away Team:</span>
          <button
            {...createFilterButtonProps(awayTeamModal, uniqueAwayTeams, handleAwayTeamFilter, {
              IconComponent: FunnelIconOutline,
              IconComponentSolid: FunnelIconSolid,
            })}
          />
        </div>

        {/* Home Team Filter Button */}
        <div className="flex items-center gap-1">
          <span className="text-sm">Home Team:</span>
          <button
            {...createFilterButtonProps(homeTeamModal, uniqueHomeTeams, handleHomeTeamFilter, {
              IconComponent: FunnelIconOutline,
              IconComponentSolid: FunnelIconSolid,
            })}
          />
        </div>
      </div>

      {/* Filter Status Indicators */}
      <div className="mb-4 text-sm text-gray-600">
        {leagueModal.isFiltered && (
          <span className="mr-4">League: {leagueModal.selectedItems.length} selected</span>
        )}
        {awayTeamModal.isFiltered && (
          <span className="mr-4">Away Teams: {awayTeamModal.selectedItems.length} selected</span>
        )}
        {homeTeamModal.isFiltered && (
          <span className="mr-4">Home Teams: {homeTeamModal.selectedItems.length} selected</span>
        )}
      </div>

      {/* Game List (simplified for example) */}
      <div className="space-y-2">
        {games.map((game, index) => (
          <div key={index} className="p-2 border rounded">
            <div className="flex justify-between items-center">
              <span>{game.away_team} @ {game.home_team}</span>
              <span className="text-sm text-gray-500">{game.sport_key}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Modals */}
      <FilterModal
        {...createFilterModalProps(leagueModal, uniqueLeagues, handleLeagueFilter, {
          title: 'Filter League',
          placement: 'bottom-start',
        })}
      />

      <FilterModal
        {...createFilterModalProps(awayTeamModal, uniqueAwayTeams, handleAwayTeamFilter, {
          title: 'Filter Away Team',
          placement: 'bottom-start',
        })}
      />

      <FilterModal
        {...createFilterModalProps(homeTeamModal, uniqueHomeTeams, handleHomeTeamFilter, {
          title: 'Filter Home Team',
          placement: 'bottom-start',
        })}
      />
    </div>
  );
};

export default ImprovedFilterExample;
